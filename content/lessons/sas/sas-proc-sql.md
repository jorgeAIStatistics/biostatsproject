## What problem are we trying to solve?

The safety table for CBX417-301 needs one line:

> "Subjects with at least one grade ≥3 treatment-emergent adverse event, n (%), by actual treatment — with the percentage based on the number of subjects in the safety population of that arm."

Three things make this awkward in a DATA step: you need **distinct subjects** (not events), a **denominator from another dataset** (ADSL), and the result **by arm**. That means sorting, de-duplicating, a merge and a summary — four steps. In PROC SQL it is one query, and the denominators can be dropped straight into macro variables for the table header.

PROC SQL is also the tool QC programmers reach for when they want a method that is genuinely different from production's DATA step logic. Knowing both, and knowing exactly where they disagree, is a core statistical-programming skill.

## Intuition

A DATA step says **how**: read a row, do this, write it. SQL says **what**: the rows I want, from these tables, matching this condition, grouped this way. The engine decides the order of operations.

Two consequences to keep in mind from the start:

1. **SQL does not need sorted data** — it matches on the join condition, not on physical order. It also does not guarantee output order unless you write `ORDER BY`.
2. **SQL joins every matching pair.** If a key repeats on both sides, you get every combination (a Cartesian product within that key). A DATA step MERGE pairs rows by position and never multiplies them. This is the single biggest semantic difference, and it is why SQL is the right tool for genuine many-to-many relationships and the wrong tool if you assumed uniqueness that does not hold.

## Clinical context

Where PROC SQL earns its place in clinical programming:

| Task | Why SQL |
|---|---|
| Counting **subjects**, not records (`count(distinct USUBJID)`) | one function instead of sort + FIRST. logic |
| Denominators into the table header (`into :n_cbx`) | macro variables straight from data |
| Lookups (reference ranges, treatment decodes, visit windows) | joins without sorting either table |
| Data checks (duplicate keys, orphan records, out-of-range values) | `group by … having count(*) > 1`, anti-joins with `not in` |
| Independent QC of a derived value | a different mechanism from the DATA step, so the same bug is unlikely twice |
| Quick answers during a meeting | one query, no intermediate datasets |

PROC SQL uses SAS's missing-value semantics (missing is smaller than any number, `count()` ignores missing), which differs from ANSI SQL engines such as the SQLite database behind this app's SQL lab. When you QC a SAS query with a database query, that difference is a common source of false discrepancies.

## Formal concept

### The shape of a query

```sas
proc sql;
  create table g3 as
  select s.TRT01A,
         count(distinct s.USUBJID) as N_SAF
  from adsl as s
       left join adae as a
         on s.USUBJID = a.USUBJID
  where s.SAFFL = 'Y'
  group by s.TRT01A
  having N_SAF > 0
  order by s.TRT01A;
quit;
```

- Clauses always appear in this order: `SELECT`, `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`.
- Columns in `SELECT` are separated by **commas**; `as` names a column or a table alias.
- `WHERE` filters rows **before** grouping; `HAVING` filters **groups** after the summary functions are computed.
- A PROC SQL step ends with `quit;`, not `run;`. Each statement executes as soon as it is submitted (a `run;` inside PROC SQL does nothing and SAS notes it).
- `CREATE TABLE … AS` writes a dataset instead of printing; without it, the query prints. `NOPRINT` on the PROC SQL statement suppresses printing.

### Joins

```sas
from adlb as l inner join adsl as s on l.USUBJID = s.USUBJID      /* matches only        */
from adlb as l left  join adsl as s on l.USUBJID = s.USUBJID      /* all ADLB rows       */
from adlb as l full  join adsl as s on l.USUBJID = s.USUBJID      /* everything          */
from adlb, adsl where adlb.USUBJID = adsl.USUBJID                 /* older inner-join syntax */
```

- In outer joins the key columns come from one side only, so unmatched rows have a missing key on the other side: use `coalesce(l.USUBJID, s.USUBJID) as USUBJID`.
- Selecting `*` from two tables that share a column name keeps the **first** one and warns: `WARNING: Variable USUBJID already exists on file WORK.X.` Name the columns you want instead.
- A join with no condition (or an accidental mismatch) produces every combination and this note:

```log
NOTE: The execution of this query involves performing one or more Cartesian product joins that can not be optimized.
```

| Relationship on the key | DATA step MERGE | PROC SQL join |
|---|---|---|
| one-to-one | 1 row | 1 row |
| one-to-many | "many" rows, "one" values repeated | same |
| many-to-many (m and n rows) | max(m, n) rows, paired by position, with a NOTE | m × n rows |
| sorting required | yes | no |
| same-named non-key column | last dataset read wins, silently | first one kept, with a WARNING |
| output order | BY order | undefined unless `ORDER BY` |

### Summary functions and GROUP BY

`COUNT(*)`, `COUNT(column)` (non-missing values), `COUNT(DISTINCT column)`, `SUM`, `MEAN`/`AVG`, `MIN`, `MAX`, `STD`, `N`, `NMISS`.

- `count(*)` counts **rows**; `count(distinct USUBJID)` counts **subjects**. In safety tables this distinction is the difference between events and patients.
- Missing values are ignored by the summary functions, exactly as in PROC MEANS.

**Remerging.** If you select a summary function together with a column that is not in `GROUP BY`, SAS computes the summary and joins it back to every row:

```log
NOTE: The query requires remerging summary statistics back with the original data.
```

Sometimes that is exactly what you want (`AVAL - mean(AVAL) as DIFF … group by USUBJID`). Often it means a forgotten `GROUP BY` column and a result with far more rows than expected. Always read this note and decide.

### CASE, CALCULATED and subqueries

```sas
select USUBJID,
       case when ATOXGRN >= 3 then 'Grade 3-5'
            when ATOXGRN in (1, 2) then 'Grade 1-2'
            else 'Missing grade'
       end as GRGROUP,
       AVAL - BASE as CHG,
       calculated CHG / BASE * 100 as PCHG
from adlb
where USUBJID in (select USUBJID from adae where ATOXGRN >= 3);
```

- `CASE … WHEN … THEN … ELSE … END` is SQL's IF-THEN/ELSE; conditions are tested in order.
- A column you created in the same `SELECT` must be referred to with `CALCULATED`; otherwise SAS reports that the column was not found in the contributing tables.
- Subqueries appear after `IN`, `NOT IN`, `EXISTS`, or as a single value in `SELECT`/`WHERE`. Careful with `NOT IN` when the subquery can return missing values.

### INTO: macro variables

```sas
proc sql noprint;
  select count(distinct USUBJID) into :n_cbx trimmed
  from adsl
  where SAFFL = 'Y' and TRT01A = 'CBX-417 + Docetaxel';
quit;
```

`INTO` copies query results into macro variables — denominators for table headers, lists of parameters to loop over (`into :parmlist separated by ' '`), counts to check. `TRIMMED` removes the leading blanks that numeric formatting adds. Macro programming itself is a separate topic; this one use is worth knowing now.

## Worked example

Eight randomized subjects (one never treated, so seven are in the safety population) and ten adverse-event records, one of which is not treatment-emergent.

::::columns
:::col[ADSL]
| USUBJID | TRT01A | SAFFL |
|---|---|---|
| 1012-0001 | CBX-417 + Docetaxel | Y |
| 1012-0002 | Placebo + Docetaxel | Y |
| 1012-0003 | CBX-417 + Docetaxel | Y |
| 1012-0004 | Placebo + Docetaxel | Y |
| 2031-0001 | CBX-417 + Docetaxel | Y |
| 2031-0002 | Placebo + Docetaxel | Y |
| 2031-0003 | CBX-417 + Docetaxel | N |
| 3044-0001 | Placebo + Docetaxel | Y |
:::
:::col[ADAE]
| USUBJID | AEDECOD | ATOXGRN | TRTEMFL |
|---|---|---:|---|
| 1012-0001 | Neutropenia | 3 | Y |
| 1012-0001 | Fatigue | 1 | Y |
| 1012-0001 | Nausea | 2 | N |
| 1012-0002 | Neutropenia | 4 | Y |
| 1012-0002 | Diarrhea | 1 | Y |
| 1012-0003 | Rash | 2 | Y |
| 1012-0003 | Febrile neutropenia | 3 | Y |
| 2031-0001 | Fatigue | 2 | Y |
| 2031-0002 | Pneumonia | 5 | Y |
| 3044-0001 | Anemia | 2 | Y |
:::
::::

The query, its result, and where every number comes from:

| TRT01A | N_SAF | N_G3 | PCT |
|---|---:|---:|---:|
| CBX-417 + Docetaxel | 3 | 2 | 66.7 |
| Placebo + Docetaxel | 4 | 2 | 50.0 |

:::number[Where do 3, 4, 2 and 2 come from?]
Safety subjects (`SAFFL = 'Y'`) are seven: CBX-417 has 1012-0001, 1012-0003 and 2031-0001 (2031-0003 was never treated, so `SAFFL = 'N'`) → **3**; placebo has 1012-0002, 1012-0004, 2031-0002 and 3044-0001 → **4**.

Subjects with at least one treatment-emergent grade ≥3 event: CBX-417 → 1012-0001 (neutropenia, grade 3) and 1012-0003 (febrile neutropenia, grade 3) = **2**; placebo → 1012-0002 (neutropenia, grade 4) and 2031-0002 (pneumonia, grade 5) = **2**. Percentages: 2/3 = 66.7% and 2/4 = 50.0%.

Note what is *not* counted: subject 1012-0001's nausea (grade 2, and `TRTEMFL = 'N'`) and the grade 1–2 events. Counting **records** instead of subjects would give a different, wrong answer.
:::

:::why[Why a LEFT JOIN, and why join to a list of subjects?]
The denominator must include safety subjects **without** any adverse event, so an inner join is wrong: it would drop them, reducing `N_SAF` and inflating the percentage. The right-hand side is reduced to one row per qualifying subject (`select distinct USUBJID … where TRTEMFL = 'Y' and ATOXGRN >= 3`) before the join, so no subject can be counted twice and the join cannot multiply ADSL rows. If you join to the full ADAE instead, any condition on the AE side must sit in the `ON` clause — a condition in `WHERE` removes the rows whose AE columns are missing and silently turns the left join into an inner join.
:::

## Code

```sas title="teae_grade3_sql.sas"
proc sql;
  create table g3 as
  select s.TRT01A label='Actual Treatment',
         count(distinct s.USUBJID) as N_SAF label='Safety subjects',
         count(distinct a.USUBJID) as N_G3 label='Subjects with grade >=3 TEAE',
         calculated N_G3 / calculated N_SAF * 100 as PCT format=5.1 label='%'
  from adsl as s
       left join (select distinct USUBJID
                  from adae
                  where TRTEMFL = 'Y' and ATOXGRN >= 3) as a
         on s.USUBJID = a.USUBJID
  where s.SAFFL = 'Y'
  group by s.TRT01A
  order by s.TRT01A;
quit;

proc sql noprint;
  select count(distinct USUBJID) into :n_cbx trimmed
  from adsl where SAFFL = 'Y' and TRT01A = 'CBX-417 + Docetaxel';

  select count(distinct USUBJID) into :n_pbo trimmed
  from adsl where SAFFL = 'Y' and TRT01A = 'Placebo + Docetaxel';
quit;

%put NOTE- Safety N: CBX-417 = &n_cbx, Placebo = &n_pbo;
```

:::lines
2: `CREATE TABLE … AS` stores the result instead of printing it.
3: Table alias `s` keeps column references unambiguous; `label=` gives the column a label for later reporting.
4: Counts distinct subjects, not rows — the denominator of the table line.
5: Counts the subjects that the joined list supplied; unmatched subjects contribute a missing `a.USUBJID`, which `COUNT` ignores.
6: `CALCULATED` is required to reuse columns created in the same SELECT. `format=5.1` controls display only.
8-11: An in-line view (a query used as a table) reduces ADAE to **one row per subject with a grade ≥3 TEAE**, so the left join cannot multiply rows. The left join keeps safety subjects with no such event.
12: The population filter applies to ADSL and can safely live in `WHERE` — a filter on the right-hand table would have to go in the `ON` clause or inside the view.
13-14: One row per treatment; `ORDER BY` is needed because SQL does not guarantee order.
17-23: Two scalar queries write denominators into macro variables. `TRIMMED` strips the blanks that numeric-to-text conversion adds.
25: Writes a line in the log for traceability; `%put NOTE-` keeps it in the notes style.
:::

::::tabs
:::tab[PROC SQL]
```sas
proc sql;
  select count(distinct USUBJID) as N_G3
  from adae
  where TRTEMFL = 'Y' and ATOXGRN >= 3;
quit;
```
:::
:::tab[DATA step equivalent]
```sas
proc sort data=adae(where=(TRTEMFL = 'Y' and ATOXGRN >= 3))
          out=g3 nodupkey;
  by USUBJID;
run;

data _null_;
  set g3 end=eof;
  N + 1;
  if eof then putlog 'NOTE- Subjects with grade >=3 TEAE: ' N;
run;
```
:::
:::tab[R]
```r
adae |>
  dplyr::filter(TRTEMFL == "Y", ATOXGRN >= 3) |>
  dplyr::distinct(USUBJID) |>
  nrow()
```
:::
::::

:::note[Same answer, different failure modes]
The SQL version fails loudly if you mistype a column name and quietly if a key is not unique on both sides of a join. The DATA step version fails quietly if the sort key is wrong. Using one as production and the other as QC is not ceremony — the two methods break in different ways.
:::

## Output

Expected log:

```log
NOTE: Table WORK.G3 created, with 2 rows and 4 columns.
NOTE: PROCEDURE SQL used (Total process time):
NOTE- Safety N: CBX-417 = 3, Placebo = 4
```

Expected printed result of `proc print data=g3 noobs label;`:

```output
Actual Treatment       Safety subjects    Subjects with grade >=3 TEAE      %

CBX-417 + Docetaxel           3                        2                 66.7
Placebo + Docetaxel           4                        2                 50.0
```

And a query that forgets `GROUP BY` produces the remerge note:

```log
NOTE: The query requires remerging summary statistics back with the original data.
NOTE: Table WORK.CHECK created, with 10 rows and 3 columns.
```

:::number[Why 10 rows instead of 2?]
Selecting `USUBJID` next to `max(ATOXGRN)` with `group by USUBJID` asks for a per-subject maximum *on every AE record* — SAS computes the maximum and merges it back, so the table has one row per adverse event (10), not one per subject (6). If you wanted one row per subject, select only the grouping column and the summary function.
:::

## Interpretation

- **A percentage is a pair of decisions**: which subjects are in the numerator (distinct subjects with at least one qualifying event) and which are in the denominator (safety population of that arm). SQL makes both explicit and testable.
- **Left join versus inner join is a clinical decision**, not a technical one. Dropping subjects without events would answer a different question ("among subjects who had any adverse event…").
- **SQL's convenience is also its risk.** A join whose keys are not unique multiplies rows silently, and percentages computed on multiplied rows look plausible. Always check the row count of a join against what you expect.

## Common mistakes

:::mistake[Counting rows when you mean subjects]
`count(*)` counts adverse events; `count(distinct USUBJID)` counts patients. A subject with three grade 3 events must contribute 1 to a safety table.
:::

:::mistake[Putting the right-hand table's filter in WHERE]
```sas
from adsl as s left join adae as a on s.USUBJID = a.USUBJID
where a.TRTEMFL = 'Y'
```
Rows for subjects with no adverse events have a missing `TRTEMFL`, so the `WHERE` removes them and the left join behaves like an inner join. Put conditions on the right-hand table in the `ON` clause.
:::

:::mistake[Assuming a join key is unique]
If ADSL has two rows for one subject, every AE record of that subject appears twice — and unlike a DATA step MERGE, nothing notes it. Check uniqueness first (`select USUBJID, count(*) from adsl group by USUBJID having count(*) > 1;`).
:::

:::mistake[Ignoring the remerge note]
It is one line in the log, and it can turn a 2-row summary into a 10-row dataset (or produce a "total" that is repeated on every record). Decide each time whether you meant it.
:::

:::mistake[Expecting rows in a particular order]
Without `ORDER BY`, the order is whatever the engine produces. Never rely on it — especially not for a "first record" derivation.
:::

:::mistake[Assuming ANSI missing-value behaviour]
In PROC SQL, `where AGE < 18` selects subjects with a missing age, because SAS treats missing as smaller than any number. In a standard SQL database the same condition excludes NULLs. Check the missing handling whenever you cross-check SAS against a database.
:::

::lesson{id="sas-missing-values" label="Review: missing values in comparisons"}

## Knowledge check

::quiz{ids="sas.proc-sql.m2m-numeric,sas.proc-sql.count-distinct-mcq,sas.proc-sql.clause-order,sas.proc-sql.remerge-mcq"}

## Hands-on exercise

::practice{ids="sas.proc-sql.grade3-code,sas.proc-sql.into-code,sas.proc-sql.missing-sql-mcq" title="Practice: counts, denominators and macro variables"}

## Challenge exercise

::practice{ids="sas.proc-sql.calculated-hotspot,sas.proc-sql.remerge-log,sas.proc-sql.sql-vs-merge-diff" title="Debug and QC: queries that look right"}

## Industry note

- **SQL is the QC programmer's default.** A production DATA step derivation checked with a SQL query (or the reverse) is stronger evidence than two similar programs. Expect interview questions that ask you to write the same derivation both ways.
- **Know the SAS-specific extensions.** `CALCULATED`, `INTO :macro`, automatic remerging and `%SYSFUNC`-free counting are SAS features; they will not work in a database. Conversely, window functions (`ROW_NUMBER() OVER (PARTITION BY …)`) exist in databases and in this app's SQL lab but **not** in PROC SQL, which is why FIRST./LAST. logic stays in the DATA step.
- **Macro variables from data keep headers honest.** Table headers such as "CBX-417 + Docetaxel (N=xx)" should come from the data through `INTO`, never be typed by hand.
- **Watch performance on real data.** On a study with a million lab records, `select distinct` and joins on unindexed keys can be slow; a sorted DATA step merge is often faster. Correctness first, then speed.

:::interview[When would you use PROC SQL instead of a DATA step MERGE?]
"When I need counts of distinct subjects, a summary and a join in one step, when the inputs aren't sorted and sorting them is expensive, when I need denominators in macro variables, or when I'm writing QC code and want a genuinely different method from the production DATA step. I'd stay with the DATA step when the derivation depends on record order or BY-group logic — FIRST./LAST., retained values, LAG — because PROC SQL has no equivalent. The differences I watch for are that SQL joins produce every matching combination where a MERGE pairs by position, that SQL doesn't guarantee output order, that same-named columns are kept from the first table with a warning instead of being overwritten, and that a summary function next to an ungrouped column triggers remerging."
:::

:::ai[If an AI assistant writes a query for you…]
Check four things: `count(*)` versus `count(distinct USUBJID)`; whether conditions on the right-hand table of a left join sit in `ON` or in `WHERE`; whether the join keys are unique on at least one side; and the log for the remerge and Cartesian-product notes. Generated SQL is usually syntactically perfect and semantically optimistic.
:::
