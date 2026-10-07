## What problem are we trying to solve?

Your lead programmer sends you a one-line request:

> "For each subject, give me the date of their first adverse event, how many adverse events they had, and their worst toxicity grade. One row per subject."

The adverse-event data has **many rows per subject** — one row per reported event. The output needs **one row per subject**. Somewhere in between you must:

1. know when a new subject starts (to reset your counters),
2. accumulate information while you are inside that subject's rows, and
3. know when the subject's rows have ended (to write out the result).

This "start of group / inside group / end of group" pattern appears constantly in clinical programming: selecting a baseline record, finding first and last dose dates, flagging the first occurrence of each adverse event, taking the worst post-baseline value, counting records per subject. In SAS, the tool for it is **BY-group processing** with the automatic variables `FIRST.` and `LAST.`.

## Intuition

Imagine reading a printed AE listing that has been sorted by subject. You run your finger down the rows:

- When the subject ID in the row you are reading is **different from the row above**, a new subject has started. That is `FIRST.USUBJID = 1`.
- When the subject ID in the **row below** is different (or there is no row below), you are on that subject's last row. That is `LAST.USUBJID = 1`.

Noticing that a group has *started* only requires looking back one row. Noticing that a group has *ended* requires looking ahead one row — which is exactly what SAS does for you behind the scenes when you add a `BY` statement to a DATA step.

The only precondition is the same one your finger needs: **the rows must be grouped together** — in practice, sorted by the BY variables. If subject `S-002` appeared in two separate places, "a new subject started" would fire twice and your per-subject totals would be wrong. SAS refuses to guess: unsorted data produces an ERROR.

::widget{name="pdv-stepper" example="first-last"}

## Clinical context

BY-group processing is everywhere in ADaM derivations and TLF programming:

| Task | BY variables | Uses |
|---|---|---|
| First and last dose dates (`TRTSDT`, `TRTEDT` in ADSL) | `USUBJID` | `FIRST.` / `LAST.` after sorting exposure records by date |
| Baseline record (`ABLFL`) — last non-missing value on or before first dose | `USUBJID PARAMCD` | `LAST.PARAMCD` after filtering to pre-dose records |
| First-occurrence flags in ADAE (e.g. `AOCCFL`, `AOCCPFL`) | `USUBJID` or `USUBJID AEDECOD` | `FIRST.` after sorting by onset date |
| Worst grade per subject for an AE summary table | `USUBJID AEBODSYS AEDECOD` | accumulate the maximum, output at `LAST.` |
| Duplicate-key checks during QC | the dataset keys | `if not (first.key and last.key)` finds keys that occur more than once |

Specifications rarely say "use FIRST./LAST.", but they constantly say things like *"take the last non-missing value prior to the first dose"* or *"flag the first treatment-emergent occurrence of each preferred term per subject."* Recognising those phrases as BY-group problems is a core statistical-programming skill.

## Formal concept

### What the BY statement creates

When a DATA step reads data with `SET` (or `MERGE`, `UPDATE`) **and** has a `BY` statement, SAS creates two temporary numeric variables for **every** variable listed in `BY`:

- `FIRST.variable` = 1 on the first observation of a BY group, 0 otherwise;
- `LAST.variable` = 1 on the last observation of a BY group, 0 otherwise.

They live in the Program Data Vector (PDV) during execution but are **never written to the output dataset** (if you need them, assign them to a regular variable).

A group with a single record has `FIRST.variable = 1` **and** `LAST.variable = 1` on that record.

### Several BY variables form a hierarchy

With `by USUBJID AEDECOD;` the groups are nested: preferred terms within subjects. The rule is:

> When an outer BY group starts, every inner BY group also starts.

So whenever `FIRST.USUBJID = 1`, `FIRST.AEDECOD` is forced to 1 as well — even if the next subject happens to have the same `AEDECOD` value as the previous subject's last row. The same holds for `LAST.`: the last row of a subject is also the last row of its final preferred-term group.

:::why[Why does SAS force the inner flag to 1?]
Because the inner group is defined *within* the outer group. "Nausea for subject S-001" and "Nausea for subject S-002" are different groups even though the text `AEDECOD = "Nausea"` is identical. If SAS compared only the `AEDECOD` values, two different subjects' nausea records would be glued into one group and a per-subject-per-term count would silently merge subjects.
:::

### Sorting is a precondition

The data must be sorted (or indexed) by the BY variables, in the same order. Otherwise the step stops with:

```log
ERROR: BY variables are not properly sorted on data set WORK.AE.
```

:::standard{kind="convention"}
The `NOTSORTED` option (`by USUBJID notsorted;`) tells SAS to treat each run of *consecutive* identical values as a group without checking order. It is legitimate for data that is grouped but not in sorted order (e.g., records in collection order). In clinical programming it is rarely the right fix for a sort error: if the same subject appears in two separate runs, you get two groups for one subject. Most teams sort explicitly by the full key instead.
:::

### Why you need RETAIN (or a sum statement)

At the start of every iteration of the DATA step, SAS resets variables created by assignment statements to missing. A running count or running maximum would therefore be wiped out on each new row. `RETAIN` stops that reset; the sum statement `N_AE + 1;` implies `RETAIN` and an initial value of 0.

:::deeper[What exactly is reset between iterations?]
Variables read with `SET`/`MERGE` are *retained automatically* — but they are overwritten when the next observation is read, so in practice they hold the current row's values. Variables created in the step (by assignment, `INPUT`, functions…) are reset to missing at the top of each iteration **unless** they appear in a `RETAIN` statement or are the target of a sum statement. `FIRST.`/`LAST.` are recalculated for every observation read.
:::

## Worked example

Eight adverse-event records for three subjects, already sorted by `USUBJID` and onset date `ASTDT`:

| Row | USUBJID | ASTDT | AETOXGR |
|---:|---|---|---:|
| 1 | S-001 | 2023-01-10 | 1 |
| 2 | S-001 | 2023-02-03 | 3 |
| 3 | S-001 | 2023-02-20 | 2 |
| 4 | S-002 | 2023-03-05 | 2 |
| 5 | S-002 | 2023-03-15 | 1 |
| 6 | S-003 | 2023-01-22 | 2 |
| 7 | S-003 | 2023-01-22 | 4 |
| 8 | S-003 | 2023-04-01 | 1 |

We want, per subject: first onset date (`FIRSTDT`), number of AEs (`N_AE`), worst grade (`MAXGR`).

**The plan, in words**

1. On the first row of a subject: store its date as `FIRSTDT`, set `N_AE = 0`, set `MAXGR` to missing.
2. On every row: add 1 to `N_AE`; update `MAXGR` to the larger of `MAXGR` and the current grade.
3. On the last row of a subject: write one observation.

**The PDV, iteration by iteration** (values *after* the statements in the step have executed):

| `_N_` | USUBJID | ASTDT | AETOXGR | `FIRST.USUBJID` | `LAST.USUBJID` | N_AE | MAXGR | Written? |
|---:|---|---|---:|:-:|:-:|---:|---:|:-:|
| 1 | S-001 | 2023-01-10 | 1 | 1 | 0 | 1 | 1 | no |
| 2 | S-001 | 2023-02-03 | 3 | 0 | 0 | 2 | 3 | no |
| 3 | S-001 | 2023-02-20 | 2 | 0 | 1 | 3 | 3 | **yes** |
| 4 | S-002 | 2023-03-05 | 2 | 1 | 0 | 1 | 2 | no |
| 5 | S-002 | 2023-03-15 | 1 | 0 | 1 | 2 | 2 | **yes** |
| 6 | S-003 | 2023-01-22 | 2 | 1 | 0 | 1 | 2 | no |
| 7 | S-003 | 2023-01-22 | 4 | 0 | 0 | 2 | 4 | no |
| 8 | S-003 | 2023-04-01 | 1 | 0 | 1 | 3 | 4 | **yes** |

:::number[Where did LAST.USUBJID = 1 on row 3 come from?]
SAS looked ahead to row 4, saw that `USUBJID` changes from `S-001` to `S-002`, and therefore flagged row 3 as the last row of the `S-001` group. You never write this look-ahead yourself.
:::

:::number[Where did MAXGR = 4 for S-003 come from?]
Row 6 resets `MAXGR` to missing and then `max(., 2) = 2` (the `MAX` function ignores missing arguments). Row 7: `max(2, 4) = 4`. Row 8: `max(4, 1) = 4`. At `LAST.USUBJID`, `MAXGR` is 4.
:::

:::number[Why is FIRSTDT for S-003 2023-01-22 when two AEs start that day?]
Both rows 6 and 7 have the same date; the first one read (row 6) sets `FIRSTDT`. The *date* is the same either way — but if you needed the *grade* of the first AE, the tie would matter, and you would need a documented tie-breaker (for example, sort by `ASTDT` then `AESEQ`). Specifications should state tie-breaking rules; if they don't, ask.
:::

The result — one row per subject:

| USUBJID | FIRSTDT | N_AE | MAXGR |
|---|---|---:|---:|
| S-001 | 2023-01-10 | 3 | 3 |
| S-002 | 2023-03-05 | 2 | 2 |
| S-003 | 2023-01-22 | 3 | 4 |

## Data example

In the CBX-417 study, the analysis adverse-event dataset `ADAE` has one record per reported adverse event, keyed by `USUBJID` and `AESEQ`. Here are its first rows, sorted by subject:

::dataset{id="oncology/adam/adae" cols="USUBJID,AESEQ,AEDECOD,ASTDT,ATOXGR,TRTEMFL" rows="12" sort="USUBJID" caption="ADAE — multiple records per subject"}

Notice what the per-subject pattern means here: a subject can have several records with the same `AEDECOD` (e.g., neutropenia in cycle 1 and again in cycle 3). An AE summary table counts that subject **once** for that preferred term — which is a `by USUBJID AEDECOD;` problem.

## Code

The complete program, runnable in any SAS environment (including the free SAS OnDemand for Academics):

```sas title="by_group_subject_summary.sas"
data ae;
  input USUBJID $ ASTDT :yymmdd10. AETOXGR TRTEMFL $;
  format ASTDT yymmdd10.;
  datalines;
S-001 2023-01-10 1 Y
S-001 2023-02-03 3 Y
S-001 2023-02-20 2 Y
S-002 2023-03-05 2 N
S-002 2023-03-15 1 Y
S-003 2023-01-22 2 Y
S-003 2023-01-22 4 Y
S-003 2023-04-01 1 Y
;
run;

proc sort data=ae;
  by USUBJID ASTDT;
run;

data subj_ae;
  set ae;
  by USUBJID;
  retain FIRSTDT N_AE MAXGR;
  if first.USUBJID then do;
    FIRSTDT = ASTDT;
    N_AE    = 0;
    MAXGR   = .;
  end;
  N_AE  = N_AE + 1;
  MAXGR = max(MAXGR, AETOXGR);
  if last.USUBJID then output;
  keep USUBJID FIRSTDT N_AE MAXGR;
  format FIRSTDT yymmdd10.;
run;

proc print data=subj_ae noobs;
run;
```

:::lines
1: Creates `WORK.AE` from in-stream data so the example is self-contained.
2: List input. `USUBJID $` reads a character value (default length 8 — enough for `S-001`). `:yymmdd10.` is an informat with the colon modifier: read up to the next blank using the `YYMMDD10.` informat, which converts `2023-01-10` into a SAS date (a count of days since 1 January 1960).
3: A format only changes how the date *displays*; the stored value is still a number.
4-13: The data lines. The `;` on line 13 ends them.
16-18: Sorts by subject, then onset date. The BY statement below needs `USUBJID` sorted; sorting by date too makes "first row" mean "earliest AE".
20: Starts the DATA step that builds `WORK.SUBJ_AE`.
21: Reads one observation per iteration.
22: `BY USUBJID` activates BY-group processing and creates `FIRST.USUBJID` and `LAST.USUBJID` in the PDV.
23: Stops `FIRSTDT`, `N_AE` and `MAXGR` from being reset to missing at the top of each iteration. Without it, the count would restart on every row.
24-28: Runs only on a subject's first row: capture the first date and reset the accumulators. Resetting here — not on every row — is what makes the totals per subject.
29: Adds 1 for every row. With `RETAIN`, the value carries forward within the subject.
30: `MAX` returns the largest *non-missing* argument, so `max(., 2)` is 2.
31: Writes the PDV to the output dataset only on the subject's last row — one output row per subject.
32: Keeps only the summary variables. Note `ASTDT` and `AETOXGR` are dropped from the output even though they were used.
33: Displays `FIRSTDT` as a readable date.
36-37: Prints the result without the `Obs` column.
:::

The same result with a sum statement, which implies `RETAIN` and initialises `N_AE` to 0:

```sas
data subj_ae;
  set ae;
  by USUBJID;
  retain FIRSTDT MAXGR;
  if first.USUBJID then do;
    FIRSTDT = ASTDT;
    N_AE    = 0;
    MAXGR   = .;
  end;
  N_AE + 1;                       /* sum statement: implied RETAIN */
  MAXGR = max(MAXGR, AETOXGR);
  if last.USUBJID;                /* subsetting IF: implicit OUTPUT at end of step */
  keep USUBJID FIRSTDT N_AE MAXGR;
  format FIRSTDT yymmdd10.;
run;
```

:::line[Why does `if last.USUBJID;` work without an OUTPUT statement?]
A subsetting IF stops the current iteration when the condition is false, so the implicit `OUTPUT` at the end of the step only happens when it is true. It is equivalent to `if last.USUBJID then output;` **as long as there is no other OUTPUT statement in the step** — once you write any explicit `OUTPUT`, SAS stops doing the implicit one.
:::

### Two BY variables: first occurrence of each preferred term

A per-subject, per-term flag is the classic nested case:

```sas
proc sort data=adae out=teae;
  where TRTEMFL = 'Y';
  by USUBJID AEDECOD ASTDT AESEQ;
run;

data teae;
  set teae;
  by USUBJID AEDECOD;
  length AOCCPFL $1;
  if first.AEDECOD then AOCCPFL = 'Y';
run;
```

:::lines
1: `OUT=` writes the sorted subset to a new dataset, leaving `ADAE` untouched.
2: The `WHERE` filters to treatment-emergent records *before* sorting, so the flag is computed among TEAEs only.
3: `AESEQ` is the tie-breaker: two records with the same onset date are ordered by sequence number, making the result reproducible.
8: Two BY variables: preferred-term groups nested within subjects.
9: Declares the flag as a 1-character variable before it is first assigned.
10: `FIRST.AEDECOD` is 1 on the earliest record of each term for each subject — including a subject's first record, even if its term matches the previous subject's last term.
:::

:::standard{kind="convention"}
ADaM OCCDS defines first-occurrence flags such as `AOCCFL` and `AOCCPFL`, but the exact selection rule (which records qualify, how ties are broken) is set in the study's ADaM specification. "Earliest treatment-emergent record per subject and preferred term, ties broken by `AESEQ`" is a common rule — confirm it in your spec rather than assuming it.
:::

::::tabs
:::tab[SAS]
```sas
proc sort data=ae; by USUBJID ASTDT; run;
data first_ae;
  set ae;
  by USUBJID;
  if first.USUBJID;
run;
```
:::
:::tab[R]
```r
library(dplyr)
first_ae <- ae |>
  arrange(USUBJID, ASTDT) |>
  group_by(USUBJID) |>
  slice_head(n = 1) |>
  ungroup()
```
:::
:::tab[Python]
```python
first_ae = (ae.sort_values(["USUBJID", "ASTDT"], kind="stable")
              .groupby("USUBJID", as_index=False)
              .head(1))
```
:::
:::tab[SQL]
```sql
SELECT *
FROM (
  SELECT ae.*,
         ROW_NUMBER() OVER (PARTITION BY USUBJID ORDER BY ASTDT) AS rn
  FROM ae
) t
WHERE rn = 1;
```
:::
::::

:::note[Same idea, different mechanics]
R and pandas do not have `FIRST.`/`LAST.` flags; they group explicitly and pick rows. SQL uses a window function. All four depend on a well-defined order — and all four return an arbitrary row among ties unless you add a tie-breaker (`AESEQ`) to the sort. `kind="stable"` in pandas preserves input order among ties; SAS `PROC SORT` preserves input order within BY groups by default (the `EQUALS` option).
:::

## Output

Expected result of `proc print data=subj_ae noobs;` for the worked example:

```output
USUBJID       FIRSTDT    N_AE    MAXGR

 S-001     2023-01-10      3        3
 S-002     2023-03-05      2        2
 S-003     2023-01-22      3        4
```

And the key log lines you should expect to see (and check) after the DATA step:

```log
NOTE: There were 8 observations read from the data set WORK.AE.
NOTE: The data set WORK.SUBJ_AE has 3 observations and 4 variables.
```

:::number[Why 8 observations read and 3 written?]
8 is the number of AE records in `WORK.AE`. 3 is the number of distinct subjects — one observation is written per `LAST.USUBJID`. Checking "rows in vs rows out" against what you expect is the cheapest QC check there is: if you expected one row per subject and the log says 5 observations for 3 subjects, stop and investigate.
:::

The step reads every record, but it writes only on the last record of each subject. The number of output observations equals the number of distinct `USUBJID` values — which you can verify independently with `PROC SQL`:

```sas
proc sql;
  select count(distinct USUBJID) as n_subjects from ae;
quit;
```

## Interpretation

- `N_AE` counts **records**, not distinct events or distinct terms. If the same AE was entered twice (a duplicate row), `N_AE` is inflated. Whether duplicates exist is a data-cleaning question you must answer *before* summarising.
- `FIRSTDT` is the earliest onset among the records you kept. Whether it is the first **treatment-emergent** AE depends on whether you filtered on `TRTEMFL` first — in the worked example, S-002's first record has `TRTEMFL = 'N'` (it started before the first dose), so "first AE" and "first TEAE" differ for S-002 (2023-03-05 vs 2023-03-15).
- `MAXGR` is the worst grade among the records kept; missing grades are ignored by `MAX`. If a subject's only record has a missing grade, `MAXGR` is missing — an AE table would typically show that subject under a "missing grade" category rather than silently dropping them.

:::clinical
A per-subject "worst grade" is what feeds tables such as *"Number (%) of subjects with at least one grade ≥3 TEAE"*. The unit of analysis is the **subject**: a subject with three grade 3 neutropenia events counts once. Getting the unit wrong (counting events instead of subjects) is one of the most frequent errors in safety tables.
:::

## Common mistakes

:::mistake[Filtering with a subsetting IF after the BY statement]
```sas
data subj_teae;
  set ae;
  by USUBJID;
  if TRTEMFL = 'Y';             /* rows that fail stop here…   */
  if first.USUBJID then N = 0;  /* …so this reset can be skipped */
  N + 1;
  if last.USUBJID then output;
run;
```
`FIRST.`/`LAST.` are computed from **all** observations read, before the subsetting IF discards any. For S-002 the first row (`TRTEMFL = 'N'`) is discarded before the reset executes, so `N` keeps S-001's value (3) and S-002 is written with `N = 4` instead of 1. Worse, a subject whose *last* record fails the IF is never written at all. Fix: filter with `WHERE` (applied before BY-group flags are computed) or in an earlier step.
:::

:::mistake[Forgetting RETAIN]
Without `RETAIN`, a variable created by assignment is reset to missing at the top of each iteration; `N_AE = N_AE + 1` then yields missing (missing + 1 is missing) and the log shows `NOTE: Missing values were generated as a result of performing an operation on missing values.` Always read that note as a bug report.
:::

:::mistake[Resetting on every row instead of at FIRST.]
Putting `N_AE = 0;` outside the `if first.USUBJID then do;` block resets the count on every record, so every subject ends up with `N_AE = 1`. Run the step on a subject you can count by hand.
:::

:::mistake[Sorting by fewer keys than the logic assumes]
`proc sort; by USUBJID; run;` followed by `if first.USUBJID` gives you *a* first record — whichever happened to come first in the input — not the earliest. Sort by every variable that defines "first", including a tie-breaker.
:::

:::mistake[Missing values sort first]
SAS sorts missing numeric values (and blank character values) **before** everything else. If some `ASTDT` values are missing (e.g., unresolved partial dates), `FIRST.USUBJID` lands on a record with a missing date. Decide how missing dates should be handled (impute per the SAP, or exclude) *before* selecting first records.
:::

:::mistake[Treating NOTSORTED as a fix for a sort error]
Adding `notsorted` makes the ERROR disappear but creates one group per *run* of identical values. If a subject's records are split into two runs, you get two "subjects". Sort the data instead.
:::

## Knowledge check

::quiz{ids="sas.by-group.hierarchy-mcq,sas.by-group.count-groups,sas.by-group.missing-sort-mcq,sas.by-group.steps-order"}

## Hands-on exercise

::practice{ids="sas.by-group.subject-summary,sas.by-group.worst-grade-per-pt" title="Practice: per-subject summaries with FIRST./LAST."}

## Challenge exercise

::practice{ids="sas.by-group.subsetting-if-bug,sas.by-group.unsorted-log,sas.by-group.dup-key-check" title="Debug: when BY-group logic goes wrong"}

## Industry note

- **Specs speak in rules, not syntax.** "Last non-missing value on or before first dose", "earliest onset", "worst post-baseline grade" — each is a sort + BY-group pattern. Before coding, write down the sort keys *including the tie-breaker*, and confirm that the spec defines what happens with missing and tied values.
- **QC programmers often use a different technique on purpose.** If production uses `FIRST.`/`LAST.`, an independent QC program might use `PROC SQL` with `MIN()`/`MAX()` and `GROUP BY`, or `PROC SUMMARY`. Agreement between two different methods is stronger evidence than two copies of the same logic.
- **Check the log's observation counts every time.** "*N* observations read" vs "*M* observations written" is how experienced programmers catch accidental duplicates, missing subjects, and many-to-many merges within seconds.
- **In R and Python** the same derivations use `group_by()`/`slice_head()`/`summarise()` or `groupby().head()`/`agg()`; in SQL, window functions (`ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)`). Being able to translate the pattern across languages is itself an interview signal.

:::interview[How would you select the baseline record for each subject and lab parameter in SAS?]
"First I'd confirm the baseline definition in the SAP/ADaM spec — typically the last non-missing value on or before the first dose date (or date/time if both are collected). Then I would restrict to records with a non-missing result and `ADT <= TRTSDT`, sort by `USUBJID PARAMCD ADT` plus a tie-breaker such as the collection time or `--SEQ`, and in a DATA step with `by USUBJID PARAMCD;` flag the record where `last.PARAMCD` is 1 as `ABLFL = 'Y'`. Finally I'd merge the baseline value back as `BASE`, derive `CHG = AVAL - BASE` for post-baseline records, and QC it by checking that each subject/parameter has at most one baseline flag and by spot-checking subjects with unscheduled or repeated pre-dose samples."
:::

:::ai[If an AI assistant writes BY-group code for you…]
Check three things before trusting it: (1) that the sort keys match the rule in the spec, including a tie-breaker; (2) that any filtering happens with `WHERE` or before the BY-group logic, not with a subsetting IF placed before a `FIRST.` reset; (3) that the log's observation counts match the number of subjects you expect. Generated code frequently gets (2) wrong because it *looks* correct.
:::
