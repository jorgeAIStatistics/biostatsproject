## What problem are we trying to solve?

Three requests arrive for CBX417-301, all about information that lives on **other rows**:

1. **Exposure:** "For each docetaxel infusion, add the cumulative dose received so far." (Needed for dose-intensity summaries.)
2. **Vital signs listing:** "Show the change in weight since the *previous* visit, not just since baseline."
3. **Sensitivity analysis:** "Create a dataset where a missing weight is replaced by the subject's last observed weight (last observation carried forward, LOCF)."

The DATA step processes one row at a time and, as the PDV lesson showed, wipes every created variable at the start of each row. To answer any of these requests you must deliberately **carry information across rows**. SAS gives you three tools — `RETAIN`, the sum statement and the `LAG` function — plus one trap that catches almost everyone once: `LAG` inside an `IF`.

## Intuition

- **RETAIN** is a sticky note on a variable: "don't erase me at the top of the next row." Whatever value the variable had at the end of one row is still there when the next row starts.
- **The sum statement** (`CUMDOSE + EXDOSE;`) is a sticky note plus an adding machine: the variable starts at 0, is never erased, and each row adds to it.
- **LAG** is not "the previous row". It is a small **conveyor belt attached to one line of code**. Every time that line runs, you put the current value on the belt and take off the value that was put there the *last time that line ran*. If the line runs on every row, "last time" happens to mean "previous row". If it runs only on some rows, it means "the last row on which it ran" — which may belong to a different subject.

Resetting at the right boundary (`FIRST.USUBJID`, `FIRST.PARAMCD`) is what turns a running value into a per-subject or per-parameter one.

::widget{name="pdv-stepper" example="lag"}

## Clinical context

| Derivation | Tool | Reset at |
|---|---|---|
| Cumulative dose, number of infusions so far | sum statement | `FIRST.USUBJID` |
| Previous visit's value, change from previous visit | `LAG` (unconditional) or `RETAIN` | `FIRST.USUBJID` (and `FIRST.PARAMCD` in BDS data) |
| Carry the last non-missing value forward (LOCF) | `RETAIN` | `FIRST.PARAMCD` within subject |
| Carry the baseline value to post-baseline records | `RETAIN` (an alternative to merging `BASE` back) | `FIRST.PARAMCD` |
| Time since previous dose | `LAG` or `DIF` of dates | `FIRST.USUBJID` |

### Why LOCF is controversial

LOCF was for many years a default way to fill missing post-baseline values in the primary analysis. It fell out of favour because it rests on a strong assumption — that a subject's outcome would have stayed exactly where it was when observation stopped — which is rarely plausible: patients with progressive disease tend to deteriorate after dropout, while symptoms can improve after a toxic treatment stops. Because the imputed values are treated as if they were observed, LOCF also understates uncertainty, and depending on who drops out and when, it can bias a comparison in either direction. An influential National Research Council report (2010) on missing data in clinical trials recommended against single-imputation methods such as LOCF unless their assumptions are scientifically justified.

:::standard{kind="official" source="ICH E9(R1) Addendum on Estimands and Sensitivity Analysis (2019)"}
The addendum asks that intercurrent events and missing data be handled in a way that matches the estimand defined in the protocol and SAP, and that sensitivity analyses explore the assumptions made. An imputation such as LOCF is therefore an analysis choice that must be justified for the estimand — it is specified in the SAP, not chosen by the programmer.
:::

:::standard{kind="convention"}
In ADaM BDS datasets, imputed analysis values are typically placed on **derived records** identified by `DTYPE` (the ADaM controlled terminology codelist Derivation Type includes `LOCF`), so that observed and imputed values stay distinguishable and traceable. The exact record structure is set by the ADaM specification.
:::

You will still meet LOCF in practice: in sensitivity analyses, in older studies, and in listings that display "last available value". Your job as a programmer is to implement it exactly as specified — and to make sure it never leaks across subjects or parameters.

## Formal concept

### RETAIN

```sas
retain CUMDOSE 0 LASTWT;
```

- Listed variables are **not** reset to missing at the top of each iteration.
- An optional initial value (`0` above) is assigned once, before the first iteration; variables without an initial value start as missing.
- Variables read by `SET`/`MERGE` behave as if retained already, but they are overwritten each time a new observation is read — so `retain` on them has little visible effect.
- `RETAIN` is also used (placed before `SET`) to set variable order — a side effect of first mention.

### The sum statement

```sas
CUMDOSE + EXDOSE;
```

- Equivalent to `retain CUMDOSE 0; CUMDOSE = sum(CUMDOSE, EXDOSE);`
- Implies RETAIN, starts at 0, and **ignores missing values** of the expression (the accumulator is simply unchanged).
- Note the form: no `=` sign. `CUMDOSE = CUMDOSE + EXDOSE;` is an ordinary assignment — reset every row and propagating missing values.

### Resetting at group boundaries

```sas
by USUBJID;
if first.USUBJID then CUMDOSE = 0;
CUMDOSE + EXDOSE;
```

Retained values carry across **all** rows, including from one subject to the next. Every retained or summed variable needs an explicit reset at the right `FIRST.` boundary.

### LAG and DIF

- `LAG(x)` returns the value of `x` passed to **this particular LAG call** the previous time it was executed; the first time, it returns missing. `LAGn(x)` returns the value from n executions ago (`LAG2`, `LAG3`, …).
- Each LAG call in the code has its **own** queue. Two `lag(WEIGHT)` calls on different lines are independent.
- `DIF(x)` is `x - LAG(x)`; `DIFn(x)` is `x - LAGn(x)`.
- LAG knows nothing about BY groups. On the first row of a subject it returns the previous subject's value unless you reset the result.

The safe pattern — **call LAG on every row, then fix the result**:

```sas
PREVWT = lag(WEIGHT);
if first.USUBJID then PREVWT = .;
```

The unsafe pattern — **LAG inside a condition**:

```sas
if not first.USUBJID then PREVWT = lag(WEIGHT);   /* the queue skips first rows */
```

Here the queue is only updated on non-first rows, so it hands back values from the last non-first row that ran — sometimes the right one, sometimes one from another subject.

:::deeper[What about the *next* record's value?]
LAG looks backwards only. To see the next record, sort in the opposite order and use LAG, or read the dataset a second time shifted by one row, e.g. `set vs(firstobs=2 keep=WEIGHT rename=(WEIGHT=NEXTWT))` in the same step alongside the main `SET` — remembering that the second SET reaches the end one row earlier, so the last row needs care. Both approaches need a reset at the group boundary, exactly like LAG.
:::

## Worked example

### Part 1 — cumulative dose with a sum statement

Docetaxel infusions (mg), sorted by subject and cycle. Subject 1012-0002's cycle 3 dose is missing on the CRF.

| USUBJID | CYCLE | EXDOSE | `CUMDOSE` |
|---|---:|---:|---:|
| 1012-0001 | 1 | 142.5 | 142.5 |
| 1012-0001 | 2 | 142.5 | 285.0 |
| 1012-0001 | 3 | 114.0 | 399.0 |
| 1012-0002 | 1 | 129.0 | 129.0 |
| 1012-0002 | 2 | 129.0 | 258.0 |
| 1012-0002 | 3 | . | 258.0 |

:::number[Where do 142.5 and 114.0 come from?]
Docetaxel is dosed by body surface area. With a BSA of 1.90 m², 75 mg/m² gives 75 × 1.90 = 142.5 mg; after the protocol's dose reduction to 60 mg/m², 60 × 1.90 = 114.0 mg. For subject 1012-0002 (BSA 1.72 m²), 75 × 1.72 = 129.0 mg.
:::

:::number[Why does CUMDOSE stay at 258.0 on the last row?]
The sum statement ignores a missing expression, so 258.0 + (missing) leaves 258.0. That is convenient — and dangerous: a missing dose on an infusion record is a data issue (was the infusion given?), and the cumulative dose silently treats it as zero. A listing of infusion records with missing dose should go to data management before exposure summaries are final.
:::

### Part 2 — previous visit's weight with LAG

Weights (kg) by subject and cycle:

| Row | USUBJID | CYCLE | WEIGHT | Correct `PREVWT` | Conditional-LAG `PREVWT` |
|---:|---|---:|---:|---:|---:|
| 1 | 1012-0001 | 1 | 70.2 | . | . |
| 2 | 1012-0001 | 2 | 69.5 | 70.2 | **.** |
| 3 | 1012-0001 | 3 | 69.0 | 69.5 | 69.5 |
| 4 | 1012-0002 | 1 | 82.0 | . | . |
| 5 | 1012-0002 | 2 | 81.2 | 82.0 | **69.0** |
| 6 | 1012-0002 | 3 | 80.9 | 81.2 | 81.2 |

The correct column comes from `PREVWT = lag(WEIGHT); if first.USUBJID then PREVWT = .;`, giving changes from the previous visit of −0.7, −0.5 (subject 1012-0001) and −0.8, −0.3 (subject 1012-0002).

:::number[Why does the conditional version give "." on row 2 and 69.0 on row 5?]
In `if not first.USUBJID then PREVWT = lag(WEIGHT);` the LAG call runs only on rows 2, 3, 5 and 6. Row 2 is its **first** execution, so it returns missing (and stores 69.5). Row 3 returns 69.5 (stores 69.0). Row 5 returns 69.0 — **subject 1012-0001's last weight**, stored on row 3 — and stores 81.2. Row 6 returns 81.2. Two of the four values are wrong, and nothing in the log says so. Rows 3 and 6 are right only by coincidence.
:::

### Part 3 — last observation carried forward with RETAIN

| USUBJID | CYCLE | WEIGHT | `WT_LOCF` (reset at FIRST.) | Without reset |
|---|---:|---:|---:|---:|
| 1012-0001 | 1 | 70.2 | 70.2 | 70.2 |
| 1012-0001 | 2 | . | 70.2 | 70.2 |
| 1012-0001 | 3 | 69.0 | 69.0 | 69.0 |
| 1012-0001 | 4 | . | 69.0 | 69.0 |
| 1012-0002 | 1 | . | . | **69.0** |
| 1012-0002 | 2 | 81.2 | 81.2 | 81.2 |

:::number[Where does the 69.0 for subject 1012-0002 come from in the last column?]
Without a reset at `first.USUBJID`, the retained value is still subject 1012-0001's last observed weight when subject 1012-0002's first (missing) record is processed. A subject with no weight at all at cycle 1 is given another person's weight. With the reset, the value stays missing: there is nothing earlier *for this subject* to carry forward.
:::

## Data example

Vital-sign analysis data have exactly the structure these derivations need — one record per subject, parameter and visit, sorted so that "previous" is meaningful:

::dataset{id="oncology/adam/advs" cols="USUBJID,PARAMCD,AVISIT,AVAL" rows="12" filter="PARAMCD=WEIGHT" caption="ADVS — weight by visit; previous-visit and carried-forward values are computed within USUBJID and PARAMCD"}

Any derivation across rows here must reset at `FIRST.PARAMCD` as well as `FIRST.USUBJID`: with `by USUBJID PARAMCD;`, `FIRST.PARAMCD` is 1 at every new subject too (the hierarchy rule from the BY-group lesson), so resetting at `FIRST.PARAMCD` covers both.

## Code

```sas title="retain_lag_locf.sas"
proc sort data=ex;
  by USUBJID CYCLE;
run;

data ex_cum;
  set ex;
  by USUBJID;
  if first.USUBJID then CUMDOSE = 0;
  CUMDOSE + EXDOSE;
run;

proc sort data=vs;
  by USUBJID CYCLE;
run;

data vs_prev;
  set vs;
  by USUBJID;
  PREVWT = lag(WEIGHT);
  if first.USUBJID then PREVWT = .;
  CHGPREV = WEIGHT - PREVWT;
run;

data vs_locf;
  set vs;
  by USUBJID;
  retain WT_LOCF;
  if first.USUBJID then WT_LOCF = .;
  if not missing(WEIGHT) then WT_LOCF = WEIGHT;
  if missing(WEIGHT) and not missing(WT_LOCF) then LOCFFL = 'Y';
run;
```

:::lines
1-3: Every cross-row derivation starts with a sort that defines "previous": subject, then cycle.
7: `BY` provides `FIRST.USUBJID` for the reset.
8: Reset the accumulator on each subject's first record.
9: Sum statement: implied RETAIN, adds `EXDOSE`, ignores a missing dose.
19: LAG is called on **every** row, so its queue always holds the previous row's weight.
20: The previous row belongs to another subject when `FIRST.USUBJID` is 1, so the result is blanked. Only the result is reset — the queue itself carries on correctly.
21: For the first row of each subject, `PREVWT` is missing, so `CHGPREV` is missing too (with a "Missing values were generated" note that is expected and explainable).
27: `WT_LOCF` keeps its value across rows.
28: …but not across subjects.
29: Update the carried value only when a real weight exists.
30: Flag rows where the value was carried forward (missing weight, carried value available). In an ADaM dataset this identification would be done with `DTYPE` on derived records, per the specification.
:::

## Output

Expected log for `VS_PREV` (six weight records, no missing weights):

```log
NOTE: Missing values were generated as a result of performing an operation on missing values.
      Each place is given by: (Number of times) at (Line):(Column).
      2 at 21:20
NOTE: There were 6 observations read from the data set WORK.VS.
NOTE: The data set WORK.VS_PREV has 6 observations and 5 variables.
```

:::number[Why exactly 2 missing values?]
One per subject: on each subject's first row `PREVWT` is missing, so `WEIGHT - PREVWT` is missing. Two subjects → 2. If the count had been 6, `PREVWT` would be missing everywhere; if it had been 0 with the conditional LAG, the first rows would have been wrongly filled. Predicting the count before reading the log is a quick QC habit.
:::

Expected listing of `VS_PREV`:

```output
USUBJID                 CYCLE    WEIGHT    PREVWT    CHGPREV

CBX417-301-1012-0001      1       70.2        .          .
CBX417-301-1012-0001      2       69.5      70.2       -0.7
CBX417-301-1012-0001      3       69.0      69.5       -0.5
CBX417-301-1012-0002      1       82.0        .          .
CBX417-301-1012-0002      2       81.2      82.0       -0.8
CBX417-301-1012-0002      3       80.9      81.2       -0.3
```

## Interpretation

- **Cross-row values depend on sort order.** "Previous" and "last observed" are defined by the sort; sorting by visit number versus by date can give different answers when visits are out of window or unscheduled. State the sort in the specification.
- **A carried value is not an observation.** `WT_LOCF` on cycles 2 and 4 of subject 1012-0001 is an assumption, not a measurement. Keep a flag (or, in ADaM, a derived record with `DTYPE`) so every downstream table knows which values were imputed.
- **Silence is not correctness.** Neither the missing reset nor the conditional LAG produces any warning. Cross-row derivations must be checked on the first and last record of each group — exactly where they fail.

## Common mistakes

:::mistake[LAG inside IF-THEN]
`if not first.USUBJID then PREVWT = lag(WEIGHT);` or `if VISITNUM > 1 then …lag(…)` updates the queue only when the condition is true, so it returns stale values, sometimes from another subject. Always call LAG unconditionally and adjust the result afterwards.
:::

:::mistake[No reset at the group boundary]
RETAIN and sum statements carry values from one subject (or parameter) into the next. Every accumulator needs `if first.<var> then … ;`, and in BDS data the boundary is usually `FIRST.PARAMCD` within `USUBJID`.
:::

:::mistake[Resetting at the wrong level]
In `by USUBJID PARAMCD;` data, resetting only at `FIRST.USUBJID` carries a subject's last ALT value into their AST records. Reset at the innermost level that defines the series.
:::

:::mistake[Expecting RETAIN to keep a SET variable's old value]
`retain WEIGHT;` does not stop `SET` from overwriting `WEIGHT` with the next row's value (including a missing one). To carry a value, copy it into a **new** retained variable.
:::

:::mistake[Letting the sum statement hide missing data]
`CUMDOSE + EXDOSE;` treats a missing dose as zero. That may be the specified rule, or it may hide an unresolved data issue. Count missing doses separately and ask.
:::

:::mistake[Writing `X = X + 1;` and expecting a counter]
Without RETAIN, `X` is reset to missing each row, and missing + 1 is missing. Use the sum statement `X + 1;` (or RETAIN with an initial value).
:::

## Knowledge check

::quiz{ids="sas.retain-sum-lag.sum-statement-mcq,sas.retain-sum-lag.retain-reset-numeric,sas.retain-sum-lag.conditional-lag-mcq,sas.retain-sum-lag.retain-classify"}

## Hands-on exercise

::practice{ids="sas.retain-sum-lag.cumdose-code,sas.retain-sum-lag.prev-visit-code,sas.retain-sum-lag.lag2-numeric" title="Practice: running totals and previous values"}

## Challenge exercise

::practice{ids="sas.retain-sum-lag.conditional-lag-hotspot,sas.retain-sum-lag.locf-reset-hotspot,sas.retain-sum-lag.lag-reset-diff" title="Debug and QC: values that leak across subjects"}

## Industry note

- **Specifications describe these derivations in words** — "cumulative dose up to and including the current administration", "value at the previous scheduled visit", "last non-missing post-baseline value on or before the visit" — and leave the mechanics to you. Translate each phrase into a sort order, a BY level for the reset, and a rule for missing values, and write those three things in your program header.
- **QC these with a different technique.** If production uses LAG, QC can use a self-merge on a shifted visit number, PROC SQL with a correlated subquery, or R's `dplyr::lag()` within `group_by()` — note that `dplyr::lag()` is computed within groups when the data are grouped, which is exactly the reset SAS needs you to write by hand.
- **Be ready to discuss LOCF beyond the code.** An interviewer for a biostatistics role may ask why LOCF has fallen out of favour; for a programming role, how you would implement it without leaking values and how imputed records are identified in ADaM. Both answers are in this lesson.

:::interview[Why does LAG give strange results inside an IF statement?]
"Because LAG doesn't return the previous observation — it returns the value that was passed to that particular LAG call the last time it executed. Each LAG call keeps its own queue, and the queue is only updated when the call runs. Inside an IF, the call is skipped on some rows, so the queue holds a value from the last row where the condition was true — possibly from a different subject. The fix is to call LAG unconditionally on every row and then reset or ignore the result where it doesn't apply, for example `PREV = lag(AVAL); if first.USUBJID then PREV = .;`."
:::

:::ai[If an AI assistant writes a cross-row derivation for you…]
Look for three things: LAG calls inside IF/ELSE branches, accumulators without a reset at the right `FIRST.` level, and sort orders that do not match the specification's definition of "previous". Then test the code on a two-subject example where the second subject's first record is missing — the case that exposes all three.
:::
