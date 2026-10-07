## What problem are we trying to solve?

Your merged dataset has 3,110 rows. It should have 3,082.

Twenty-eight extra records appeared from nowhere. Every one of them looks plausible — a real subject, a real visit, a real value. Nothing errored. And every count you compute from this dataset is now slightly wrong, in a way that will survive review because each individual number is internally consistent.

**Somewhere, a key was not unique.** One subject had two rows in a dataset you assumed had one, and the join duplicated their records.

This is the most expensive class of bug in clinical programming, for three reasons: it is silent, it inflates rather than breaks, and the symptom appears in a table weeks later, far from the join that caused it.

This lesson is about **preventing it structurally** rather than catching it afterwards — declaring what you expect of a join, asserting the grain before you merge, and using `anti_join()` to reconcile two datasets in one line.

## Intuition

A join answers one question: **for each row on the left, which rows on the right have a matching key?**

Everything else follows from the number of matches:

| Matches found | What happens |
|---|---|
| Exactly one | The row gains columns. Row count unchanged. |
| None | `left_join` keeps the row with `NA`; `inner_join` drops it |
| **Two or more** | **The row is duplicated, once per match** |

The third case is the whole problem. It is not an error — a one-to-many join is often exactly what you want, as when you attach subject-level treatment to every vital-signs record. It is only a bug when you *expected* one match and got two.

**The tool cannot know which you intended.** So you have to say.

:::why[Why does SAS's MERGE behave differently — and worse?]
`MERGE` in a DATA step does not produce a Cartesian product. It matches **observation by observation** within the BY group: the first row of A with the first row of B, the second with the second, and when one side runs out it **carries the last value forward** to the remaining rows.

The result is neither an inner join nor a cross join. It is a structure with no standard meaning, produced silently.

```text
A: id=1 x=a    B: id=1 y=X
   id=1 x=b       id=1 y=Y
                  id=1 y=Z

MERGE gives: (a,X) (b,Y) (.,Z)   <- carried forward, and a phantom row
```

dplyr's many-to-many gives a genuine Cartesian product — 2 × 3 = 6 rows — which is at least mathematically defined and usually obviously wrong because the row count explodes. SAS's version produces a plausible-looking row count and wrong values.

**This is why a SAS programmer's instinct to "just merge and see" is a habit worth unlearning.** The check is `PROC SORT NODUPKEY` or a `FIRST./LAST.` count before the merge, and it is not optional.
:::

## Clinical context

| Join | Relationship | Purpose |
|---|---|---|
| ADSL → BDS | **one-to-many** | Attach treatment, population flags, key dates to every record |
| BDS → ADSL | many-to-one | Bring a derived subject-level value back |
| AE → ADSL | many-to-one | Denominators and treatment for a safety table |
| SDTM DM → raw randomization | **one-to-one** | Verify the treatment assignment |
| ADTTE → ADSL | one-to-one | One time-to-event record per subject per parameter |

**ADSL is the one-row-per-subject anchor**, which is why almost every join in a clinical pipeline has ADSL on the "one" side. If ADSL ever has two rows for a subject, every downstream dataset inflates at once — which is why `!any(duplicated(adsl$USUBJID))` is worth asserting the moment you read it.

:::mistake[Joining to a BDS dataset without restricting it first]
```r
# WRONG — ADVS has ~11 rows per subject
adsl |> left_join(advs, by = "USUBJID")          # 270 -> 3,082 rows

# Restrict to the grain you want first
adsl |> left_join(
  filter(advs, PARAMCD == "SYSBP", AVISITN == 12),
  by = "USUBJID", relationship = "one-to-one"
)
```

The first version is not an error if you meant it. It becomes a bug when the next line counts subjects with `n()`. **Restrict the "many" side to one row per subject before joining**, or accept that the result is record-level and count accordingly.
:::

## Formal concept

### The join types

```r
left_join(x, y)    # all rows of x; NA where y has no match
inner_join(x, y)   # only rows with a match in both
full_join(x, y)    # all rows of both
anti_join(x, y)    # rows of x with NO match in y  <- reconciliation
semi_join(x, y)    # rows of x WITH a match, no columns added  <- filtering
```

`anti_join()` and `semi_join()` are **filtering joins** — they never add columns and never change the row count beyond removing rows. They have no single-verb SAS equivalent and they are the fastest reconciliation tools available:

```r
anti_join(advs, adsl, by = "USUBJID")   # records whose subject is not in ADSL — orphans
anti_join(adsl, advs, by = "USUBJID")   # subjects with no records at all
```

:::why[Why is the direction of an anti_join so important?]
Because the two directions mean completely different things, and only one is acceptable.

**Subjects in ADSL with no records elsewhere** is often legitimate — a subject randomized but withdrawn before any assessment genuinely has no vital signs. Worth reporting, not a defect.

**Records whose subject is not in ADSL** is an **orphan** and always a finding. Either the identifier is wrong, or a subject was removed from ADSL who should not have been. It means the datasets disagree about who was in the study.

Running both directions on every data transfer takes two lines and catches a whole class of problems while they are still cheap.
:::

### Declaring the relationship

Since dplyr 1.1 you can state what you expect:

```r
left_join(advs, adsl, by = "USUBJID", relationship = "many-to-one")
```

| Value | Meaning | Errors when |
|---|---|---|
| `"one-to-one"` | Each key appears at most once on both sides | Either side has duplicates |
| `"many-to-one"` | Left may repeat; right must be unique | The **right** side has duplicates |
| `"one-to-many"` | Left must be unique; right may repeat | The left side has duplicates |
| `"many-to-many"` | Explicitly allowed | Never — silences the warning |

**This is the structural fix.** An unexpected many-to-many warns by default; declaring the relationship turns that warning into an error at the point of the mistake rather than a wrong number three steps later.

:::number[What does a many-to-many join actually produce?]
A Cartesian product **within each key**. Two rows on the left matching three on the right gives 2 × 3 = 6 rows for that key.

```r
a <- data.frame(id = c(1, 1, 2), x = c("a", "b", "c"))
b <- data.frame(id = c(1, 1, 2), y = c("X", "Y", "Z"))
left_join(a, b, by = "id")
```

```text
  id x y
1  1 a X
2  1 a Y
3  1 b X
4  1 b Y
5  2 c Z
```

Three rows joined to three rows gives **five** — four from the duplicated key plus one clean match. dplyr warns; SAS's `MERGE` on the same data would silently give three rows with values carried forward.
:::

### Key types must be compatible

```r
a <- data.frame(id = c(1, 2, 3), v = 1:3)        # numeric
b <- data.frame(id = c("1", "2", "3"), w = 4:6)  # character
left_join(a, b, by = "id")
```

```text
Error: Can't join `x$id` with `y$id` due to incompatible types.
ℹ `x$id` is a <double>.
ℹ `y$id` is a <character>.
```

**Current dplyr protects you here**, which is a genuine improvement over older versions and over SQL, where a numeric-to-text comparison often coerces silently.

:::mistake[The failure dplyr cannot catch]
The type check does not protect against **damaged values**. If a site identifier was read as numeric — turning `007` into `7` — and then cast back to character somewhere downstream, both sides are character, the types agree, and `"7"` simply never matches `"007"`.

No error. Every joined column `NA`. And the `as.character()` that "fixed" the type is what removed the protection.

**The signature:** *every* joined value being `NA` means zero rows matched. Partial failures give some NAs. A wholly-NA joined column always means the keys are not comparable — in type, which dplyr catches, or in value, which it cannot.
:::

## Worked example

Attaching treatment and population flags to the vital-signs data, safely.

```r
library(dplyr)

# 1. Assert ADSL's grain before using it as the "one" side
stopifnot(!any(duplicated(adsl$USUBJID)))

# 2. Reconcile in both directions BEFORE joining
orphans <- anti_join(advs, adsl, by = "USUBJID")
no_data <- anti_join(adsl, advs, by = "USUBJID")

stopifnot(nrow(orphans) == 0)          # orphans are never acceptable
message(nrow(no_data), " subject(s) with no vital-signs records")

# 3. Join, declaring what you expect
combined <- advs |>
  left_join(select(adsl, USUBJID, TRT01P, ITTFL, SAFFL),
            by = "USUBJID",
            relationship = "many-to-one")

# 4. Assert the row count did not change
stopifnot(nrow(combined) == nrow(advs))
```

**Step 1 — assert the anchor.** ADSL is one row per subject by definition. If that fails, stop; nothing downstream can be trusted.

**Step 2 — reconcile first.** Two `anti_join()` calls, two very different meanings. Orphans get an assertion because they are never acceptable; subjects without records get a message because they are informative rather than wrong.

**Step 3 — declare `"many-to-one"`.** ADVS may repeat a subject (many visits); ADSL must not. If ADSL ever gains a duplicate, this errors here rather than inflating a count later.

**Step 4 — assert the row count.** A `left_join` with a unique right side cannot change the row count. Asserting it is one line and it catches any violation of the assumption, including ones the `relationship` argument misses.

:::number[Why assert the row count when `relationship = "many-to-one"` already guards it?]
Belt and braces, and they catch different things. The `relationship` argument checks the *key* structure; the row-count assertion checks the *outcome*.

They come apart when the join key is a composite and you name only part of it, or when a later edit adds a `by` column. The row-count assertion is agnostic to how the join was specified — it simply says the operation must not have changed the grain.

One line, and it survives refactoring that the `relationship` declaration might not.
:::

### Output

```text
> nrow(advs); nrow(combined)
[1] 3082
[1] 3082

> nrow(anti_join(advs, adsl, by = "USUBJID"))
[1] 0
> nrow(anti_join(adsl, advs, by = "USUBJID"))
[1] 0
```

Both reconciliations are clean on this study: every ADVS record belongs to a subject in ADSL, and every ADSL subject has at least one vital-signs record. The join preserved the row count exactly.

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,ITTFL,SAFFL,AGE,SEX" rows="6" caption="ADSL — one row per subject, the anchor for every join"}

**The grain, verified:**

```r
nrow(adsl)                    # 270
n_distinct(adsl$USUBJID)      # 270   <- one row per subject
nrow(advs)                    # 3082
n_distinct(advs$USUBJID)      # 270   <- ~11 records per subject
```

**Reconciling on "appears anywhere" versus "has the analysis visit"** gives different answers, and confusing them is how a denominator goes wrong:

| Question | Count |
|---|---:|
| Subjects in ADSL | 270 |
| Subjects appearing anywhere in ADVS | 270 |
| Subjects with a Week 12 systolic record | **238** |

Every randomized subject has at least a baseline measurement, so the first reconciliation is clean. Restricting to Week 12 loses 32 subjects who discontinued earlier.

:::number[Which of those is the denominator for a Week 12 table?]
It depends on the SAP, and the join type is where the decision gets made — usually silently.

```r
# Observed cases: 238 subjects
adsl |> inner_join(w12, by = "USUBJID")

# ITT with missing kept: 270 subjects, 32 with NA
adsl |> left_join(w12, by = "USUBJID", relationship = "one-to-one")
```

**`inner_join` versus `left_join` here *is* the missing-data strategy.** For a continuous endpoint an observed-case analysis at Week 12 is common; for a binary responder endpoint, ITT with non-responder imputation is more usual, because the 32 subjects who discontinued are unlikely to have been responders.

Neither is the default-correct answer. What is wrong is letting a join verb decide it without the SAP saying so.
:::

## Code

::::tabs
:::tab[SAS]
```sas
/* Check the grain BEFORE merging — this is not optional */
proc sort data=adam.adsl out=adsl_chk nodupkey dupout=adsl_dups;
  by usubjid;
run;
/* adsl_dups must be empty */

proc sort data=adam.advs; by usubjid; run;
proc sort data=adam.adsl; by usubjid; run;

data combined;
  merge adam.advs (in=a)
        adam.adsl (in=b keep=usubjid trt01p ittfl saffl);
  by usubjid;
  if a;                     /* left join */
run;

/* Reconcile in both directions */
data only_vs only_sl;
  merge adam.advs (in=a) adam.adsl (in=b);
  by usubjid;
  if a and not b then output only_vs;   /* orphans — must be empty */
  if b and not a then output only_sl;   /* subjects with no records */
run;
```

:::lines
2: `NODUPKEY` with `DUPOUT=` is the SAS grain check: it writes the duplicates to a separate dataset so you can look at them rather than silently discarding them. **Do this before every merge where you assume a unique key.**
11: `KEEP=` on the dataset option limits what comes across. Without it, any variable present in both datasets is silently overwritten by the second one — a distinct and equally quiet failure mode.
13: `if a;` makes it a left join. Omitting it gives a full join and adds subjects with no vital-signs records.
19: The two-output DATA step is SAS's `anti_join`, in both directions at once. It takes six lines where dplyr takes two, which is part of why the check gets skipped.
:::
:::

:::tab[R]
```r
library(dplyr)

stopifnot(!any(duplicated(adsl$USUBJID)))

# Reconcile both directions
stopifnot(nrow(anti_join(advs, adsl, by = "USUBJID")) == 0)
message(nrow(anti_join(adsl, advs, by = "USUBJID")),
        " subject(s) with no records")

combined <- advs |>
  left_join(select(adsl, USUBJID, TRT01P, ITTFL, SAFFL),
            by = "USUBJID",
            relationship = "many-to-one")

stopifnot(nrow(combined) == nrow(advs))
```

:::lines
3: The anchor assertion. ADSL failing this invalidates everything downstream, so it belongs at the top of the program.
6: `anti_join` in the orphan direction gets an assertion — a record whose subject is not in ADSL is always a finding.
7: The other direction gets a message rather than an assertion, because subjects with no records can be legitimate.
11: `select()` before joining rather than joining everything. It limits what crosses over and — more importantly — avoids the `.x`/`.y` suffixes that appear when both sides share a column name, which are a common source of "why is this column empty" confusion.
13: `relationship = "many-to-one"` errors if ADSL ever has a duplicate key. Declaring it is the structural fix.
15: The row-count assertion is independent of how the join was specified, so it survives refactoring.
:::
:::

:::tab[SQL]
```sql
-- Grain check
SELECT USUBJID, COUNT(*) AS n
FROM   adsl
GROUP  BY USUBJID
HAVING COUNT(*) > 1;          -- must return zero rows

-- The join
SELECT v.*, s.TRT01P, s.ITTFL, s.SAFFL
FROM   advs v
LEFT JOIN adsl s ON v.USUBJID = s.USUBJID;

-- Reconciliation: orphan records
SELECT v.USUBJID
FROM   advs v
LEFT JOIN adsl s ON v.USUBJID = s.USUBJID
WHERE  s.USUBJID IS NULL;
```

:::lines
5: `GROUP BY ... HAVING COUNT(*) > 1` is the SQL grain check. Running it before a join is the same discipline as `NODUPKEY` in SAS.
10: SQL's join type is explicit in the syntax, which is its main advantage — you cannot accidentally write a full join when you meant a left join, as you can by omitting `if a;` in SAS.
16: The `LEFT JOIN ... WHERE right IS NULL` idiom is SQL's `anti_join`. There is no dedicated keyword, so this pattern is worth recognising on sight.
:::
:::
::::

## Output

```text
> left_join(a, b, by = "id")   # duplicate keys on both sides
Warning message:
Detected an unexpected many-to-many relationship between `x` and `y`.
ℹ Row 1 of `x` matches multiple rows in `y`.
ℹ Row 1 of `y` matches multiple rows in `x`.
ℹ If a many-to-many relationship is expected, set `relationship = "many-to-many"`.

  id x y
1  1 a X
2  1 a Y
3  1 b X
4  1 b Y
5  2 c Z
```

:::number[Why does the warning name specific rows?]
Because it is pointing you at the evidence. "Row 1 of `x` matches multiple rows in `y`" tells you which key is duplicated, so you can inspect it directly rather than searching.

**Treat this warning as an error.** In a long script it scrolls past; the fix is to declare the relationship you expect, which converts it into an error that stops execution at the point of the problem. A pipeline that warns on every run trains you to ignore warnings, and this is not one to ignore.
:::

## Interpretation

Nothing statistical — but the reconciliation output is itself a finding worth reading.

On this study both `anti_join` directions return zero, and the join preserves 3,082 rows exactly. **That is what a clean dataset pair looks like**, and it is worth seeing once so that an unclean one is recognisable.

The number that *does* need interpretation is the 238 versus 270. Thirty-two randomized subjects have no Week 12 record, and whether a Week 12 table's denominator is 238 or 270 is a missing-data decision belonging to the SAP. The join verb that implements it should be chosen to match, not the other way round.

## Common mistakes

:::mistake[Joining without checking the grain]
A duplicate key on the "one" side duplicates rows silently and inflates every downstream count. `stopifnot(!any(duplicated(x$USUBJID)))` before, `relationship = "many-to-one"` during, and a row-count assertion after.
:::

:::mistake[Letting the join type decide the missing-data strategy]
`inner_join` gives observed cases; `left_join` keeps everyone with `NA`. That choice determines the denominator of every percentage in the table, and it is a SAP decision rather than a coding convenience.
:::

:::mistake[Joining all columns instead of selecting first]
Columns present in both datasets get `.x` and `.y` suffixes, and a later reference to the unsuffixed name silently fails or picks the wrong one. `select()` the columns you need before joining.
:::

:::mistake[Treating the many-to-many warning as noise]
It names the offending rows and it is almost never expected in clinical data. Declare the relationship so it becomes an error.
:::

:::mistake[Assuming a key type mismatch will error]
Current dplyr does error — but only while the types actually differ. A damaged value cast back to the right type passes the check and matches nothing. All-NA joined columns are the signature.
:::

## Knowledge check

::quiz{ids="r.joins.many-to-many,r.joins.anti-direction,r.joins.relationship-arg,r.joins.inner-vs-left"}

## Hands-on exercise

::practice{ids="r.joins.grain-check,r.joins.reconcile,r.joins.row-count,r.joins.safe-join-code" title="Practice: checking grain and reconciling datasets"}

## Challenge exercise

::practice{ids="r.joins.silent-inflation,r.joins.sas-merge,r.joins.open" title="Challenge: silent inflation and the SAS MERGE trap"}

## Industry note

**Row-count reconciliation is a standard QC step, not a personal habit.** Many sponsors' programming standards require that any program producing an analysis dataset log the input and output row counts, and that an unexpected change be explained. The reason is exactly this class of bug: a join that inflates is invisible in the output and visible in the row count.

**`{admiral}`'s derivation functions bake the check in.** `derive_vars_merged()` — the pharmaverse function for exactly this pattern — takes a `check_type` argument that errors on duplicate keys in the source, because the package authors know this is where ADaM derivations go wrong. If you use admiral, you get the assertion whether or not you remember to write it.

:::standard{kind="convention"}
Reporting input and output record counts in the log of every analysis-dataset program is common sponsor practice and appears in most internal programming standards. It is not required by any regulation; ICH E6's expectations around computerised system validation and data integrity are what it serves.
:::

**In SAS, `PROC SQL` is often safer than `MERGE`** for exactly this reason. A many-to-many `PROC SQL` join produces a genuine Cartesian product — obviously wrong, with an exploding row count — while `MERGE` produces a plausible row count with wrong values. When the key uniqueness is uncertain, the join that fails loudly is the better tool.

:::interview[How do you make sure a merge did what you intended?]
The answer should have three parts — before, during, after — because that is how you actually prevent this rather than detect it.

"**Before:** assert the grain of the side I am treating as unique. ADSL should be one row per subject, and `stopifnot(!any(duplicated(adsl$USUBJID)))` proves it. In SAS that is `PROC SORT NODUPKEY` with `DUPOUT=` so I can see what was duplicated rather than silently dropping it.

**During:** declare the relationship. `relationship = 'many-to-one'` in dplyr errors if the right side has duplicates, which turns a silent inflation into an error at the point of the mistake. And select the columns I need before joining, so I don't get `.x`/`.y` suffixes from overlapping names.

**After:** assert the row count. A left join against a unique key cannot change it. That check is independent of how the join was written, so it survives someone editing the `by` clause later.

And separately from the join itself, I reconcile with `anti_join` in both directions — records whose subject isn't in ADSL are orphans and always a finding; subjects with no records may be legitimate and are worth reporting."

If they push on why it matters so much, the honest answer is the failure mode: a join that inflates produces internally consistent wrong numbers, so it survives review and surfaces weeks later in a table nobody can reconcile.
:::
