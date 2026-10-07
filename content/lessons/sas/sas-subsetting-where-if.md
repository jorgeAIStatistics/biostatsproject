## What problem are we trying to solve?

The statistician asks for two datasets to start the demographics work for CBX417-301:

> "Give me the **safety population** from ADSL with just `USUBJID`, `TRT01P`, `AGE`, `SEX` and an age group, and a separate list of safety subjects **aged 65 or over**."

Selecting rows and columns is the most frequent thing you will do in SAS, and SAS offers several ways to do it: the `WHERE` statement, the `WHERE=` data set option, the subsetting `IF`, `IF-THEN DELETE`, `KEEP`/`DROP` statements and `KEEP=`/`DROP=` options. Most of the time they give the same answer. The cases where they **don't** — a variable created in the step, a MERGE, BY-group flags, missing values — are exactly where wrong subjects enter a table.

It is also the single most common SAS interview question: *"What is the difference between WHERE and IF?"*

## Intuition

Picture the DATA step as a room with a door.

- **`WHERE` is a bouncer at the door.** It checks each observation *before* it enters the PDV. Rejected observations are never read into the step at all. The bouncer can only check what is written on the observation's badge — the variables already stored in the input dataset.
- **A subsetting `IF` is a check inside the room.** The observation is already in the PDV, your earlier statements have run, and new variables may have been computed. If the condition is false, the observation is sent out of the room without being written.
- **Data set options** are instructions attached to a specific dataset, like a label on a box: `adsl(keep=… where=(…))` changes what is *read from* that box; `saf(keep=…)` on the DATA statement changes what is *written into* that box.

The consequence: `WHERE` is earlier and cheaper, `IF` is later and more flexible.

## Clinical context

Subsetting is how populations and analysis sets enter every program:

| Typical subset | Variables involved | Where it is decided |
|---|---|---|
| Safety population | `SAFFL = 'Y'` (ADSL) | Safety tables and listings |
| Intent-to-treat / full analysis set | `ITTFL = 'Y'` | Efficacy analyses |
| Treatment-emergent AEs | `TRTEMFL = 'Y'` (ADAE) | AE tables |
| One parameter of a BDS dataset | `PARAMCD = 'ALT'` | Lab tables, figures |
| Records used for analysis | `ANL01FL = 'Y'` | By-visit summaries |

The population flag variables are defined in the SAP and derived once, in ADSL; table programs then **select** on them rather than re-deriving the population. When a count in a table is off by a few subjects, one of the first things QC checks is how and where the population subset was applied — which is why the log's echo of every `WHERE` clause is valuable evidence.

## Formal concept

### WHERE: select before reading

```sas
set adam.adsl;
where SAFFL = 'Y' and not missing(TRT01P);
```

- Applied as observations are read from a **SAS dataset** (by `SET`, `MERGE`, `UPDATE`, `MODIFY`, or by a procedure). It cannot be used with raw data read by `INPUT`.
- Can reference **only variables that exist in the input dataset(s)** — not variables created in the step, and not automatic variables such as `_N_` or `FIRST.USUBJID`.
- Works in DATA steps **and** procedures: `proc freq data=adam.adsl; where SAFFL = 'Y'; tables SEX; run;`
- Offers operators the IF statement does not have: `BETWEEN … AND …`, `CONTAINS` (or `?`), `IS MISSING` / `IS NULL`, `LIKE` (with `%` and `_` wildcards), and `=*` (sounds like).
- With several input datasets (`MERGE a b;`), a WHERE **statement** applies to every dataset, so its variables must exist in all of them. To filter just one dataset, use the `WHERE=` data set option on that dataset.
- A second WHERE statement in the same step **replaces** the first (the log says `NOTE: WHERE clause has been replaced.`). To add a condition, write `where also …;` (`NOTE: WHERE clause has been augmented.`).

### Subsetting IF: select after computing

```sas
if AGEGR1 = '>=65';
```

- An IF with no THEN. When the condition is false, the current iteration stops immediately: no further statements run and no implicit output happens for that observation.
- Can use **anything in the PDV**: variables created earlier in the step, `_N_`, `FIRST.`/`LAST.` flags, retained values.
- Works with raw data (`INPUT`) as well as with SAS datasets; exists **only in the DATA step**.
- Equivalent to `if not (condition) then delete;`.

### IF-THEN/ELSE: conditional execution, not selection

```sas
if AGE >= 65 then AGEGR1 = '>=65';
else if not missing(AGE) then AGEGR1 = '<65';
```

IF-THEN/ELSE decides which statements run; every observation still reaches the implicit output. Only one branch of an `if … else if … else` chain executes, tested in order — so the order of the conditions and the final `else` (which catches *everything* not matched, including missing values) matter.

### Data set options versus statements

| Tool | Attached to | When it acts | Affects |
|---|---|---|---|
| `KEEP=` / `DROP=` / `RENAME=` / `WHERE=` on an **input** dataset | `set adsl(keep=…)` | as data is read | which variables/observations enter the PDV |
| `KEEP=` / `DROP=` / `RENAME=` / `WHERE=` on an **output** dataset | `data saf(keep=…)` | as data is written | that output dataset only |
| `KEEP` / `DROP` / `RENAME` statements | the step | as data is written | **every** output dataset of the step |
| `WHERE` statement | the step | as data is read | every input dataset of the step |

Two consequences you must remember:

1. A variable excluded by an **input** `KEEP=`/`DROP=` never enters the PDV, so the step cannot use it. A variable excluded by an **output** `KEEP=` is available to every statement and simply not written.
2. On one input dataset, SAS applies `DROP=`/`KEEP=` first, then `RENAME=`, then `WHERE=` — regardless of the order you type them. So `KEEP=` lists the **old** names and `WHERE=` uses the **new** names:

```sas
set adam.adsl(keep=USUBJID AGE SAFFL rename=(AGE=AGEBL) where=(AGEBL >= 65 and SAFFL = 'Y'));
```

### Several output datasets in one step

List them on the DATA statement and route rows with `OUTPUT`:

```sas
data saf eld_saf;
  set adam.adsl;
  where SAFFL = 'Y';
  output saf;
  if AGE >= 65 then output eld_saf;
run;
```

Remember from the PDV lesson: once any explicit `OUTPUT` appears, nothing is written automatically, so every destination needs its own `OUTPUT`.

## Worked example

An eight-subject ADSL. Two randomized subjects were never treated, so their `SAFFL` is `N`.

| USUBJID | TRT01P | AGE | SEX | SAFFL |
|---|---|---:|---|---|
| CBX417-301-1012-0001 | CBX-417 + Docetaxel | 64 | M | Y |
| CBX417-301-1012-0002 | Placebo + Docetaxel | 71 | F | Y |
| CBX417-301-1012-0004 | CBX-417 + Docetaxel | 58 | F | N |
| CBX417-301-2031-0001 | Placebo + Docetaxel | 66 | M | Y |
| CBX417-301-2031-0002 | CBX-417 + Docetaxel | 49 | F | Y |
| CBX417-301-2031-0003 | Placebo + Docetaxel | 69 | M | N |
| CBX417-301-3044-0001 | CBX-417 + Docetaxel | 77 | F | Y |
| CBX417-301-3044-0002 | Placebo + Docetaxel | 55 | M | Y |

**Step 1 — the safety population.** `SAFFL = 'Y'` holds for 6 subjects (all except 1012-0004 and 2031-0003). Both a `WHERE` and a subsetting `IF` would keep the same 6 rows; the difference shows in the log:

| Method | "observations read" | "observations written" |
|---|---:|---:|
| `where SAFFL = 'Y';` | 6 | 6 |
| `if SAFFL = 'Y';` | 8 | 6 |

:::number[Why does IF read 8 but WHERE read 6?]
With WHERE, the two non-safety subjects are rejected at the door, so the step only ever sees 6 observations. With IF, all 8 are read into the PDV and the two failing ones are discarded inside the step. Same result here, but on a dataset with millions of lab records the WHERE version does far less work — and WHERE can use an index if one exists.
:::

**Step 2 — the age group, then the elderly subset.** `AGEGR1` is *created in the step*, so it can only be tested with IF:

- `if AGEGR1 = '>=65';` works: by the time the IF runs, `AGEGR1` has been computed in the PDV.
- `where AGEGR1 = '>=65';` fails: SAS looks for `AGEGR1` in `WORK.ADSL`, does not find it, and stops with `ERROR: Variable AGEGR1 is not on file WORK.ADSL.`

Among the 6 safety subjects, those aged 65 or older are 1012-0002 (71), 2031-0001 (66) and 3044-0001 (77): **3 subjects**. Subject 2031-0003 is 69 but not in the safety population, so it never enters the step.

:::number[Where did 3 come from?]
Safety subjects and their ages: 64, 71, 66, 49, 77, 55. Values ≥ 65: 71, 66, 77 → 3. If you had subset on age *before* the safety flag — or forgotten the safety flag — you would count 4 (adding 2031-0003, aged 69).
:::

## Code

```sas title="safety_subsets.sas"
data adsl;
  infile datalines dlm='|' truncover;
  input USUBJID :$20. TRT01P :$19. AGE SEX :$1. SAFFL :$1.;
  datalines;
CBX417-301-1012-0001|CBX-417 + Docetaxel|64|M|Y
CBX417-301-1012-0002|Placebo + Docetaxel|71|F|Y
CBX417-301-1012-0004|CBX-417 + Docetaxel|58|F|N
CBX417-301-2031-0001|Placebo + Docetaxel|66|M|Y
CBX417-301-2031-0002|CBX-417 + Docetaxel|49|F|Y
CBX417-301-2031-0003|Placebo + Docetaxel|69|M|N
CBX417-301-3044-0001|CBX-417 + Docetaxel|77|F|Y
CBX417-301-3044-0002|Placebo + Docetaxel|55|M|Y
;
run;

data saf(keep=USUBJID TRT01P AGE SEX AGEGR1)
     eld_saf(keep=USUBJID TRT01P AGE);
  set adsl(where=(SAFFL = 'Y'));
  length AGEGR1 $4;
  if AGE >= 65 then AGEGR1 = '>=65';
  else if not missing(AGE) then AGEGR1 = '<65';
  output saf;
  if AGEGR1 = '>=65' then output eld_saf;
run;
```

:::lines
1-3: Reads pipe-delimited in-stream data. The pipe delimiter lets `TRT01P` contain spaces; `:$19.` gives it length 19, the length of `CBX-417 + Docetaxel`.
16-17: Two output datasets, each with its own `KEEP=` option. The options act when rows are written, so every variable is still available inside the step.
18: `WHERE=` on the input dataset: only safety subjects are read. `SAFFL` itself is not kept in either output, but it can still be used here because input options act before the step runs.
19: Declares `AGEGR1` before its first use (length 4 fits `'>=65'`).
20-21: IF-THEN/ELSE assigns the age group. The `not missing(AGE)` condition means a missing age stays blank instead of falling into `'<65'`.
22: Writes every safety subject to `SAF`.
23: Writes subjects aged 65 or older to `ELD_SAF`. Testing `AGEGR1`, a variable created at line 20, requires IF — a WHERE could not see it.
:::

The same selection written with a WHERE **statement** and a subsetting IF, producing only the elderly subset:

```sas
data eld_saf2;
  set adsl;
  where SAFFL = 'Y';
  length AGEGR1 $4;
  if AGE >= 65 then AGEGR1 = '>=65';
  else if not missing(AGE) then AGEGR1 = '<65';
  if AGEGR1 = '>=65';
  keep USUBJID TRT01P AGE;
run;
```

:::line[Is `if AGEGR1 = '>=65';` the same as `if AGE >= 65;` here?]
For non-missing ages, yes. The explicit age-group version keeps the selection consistent with the derived variable that the table will display — if the grouping rule ever changes (for example a new cut-off in the SAP), the subset changes with it.
:::

## Output

Expected log for the two-output step:

```log
NOTE: There were 6 observations read from the data set WORK.ADSL.
      WHERE SAFFL='Y';
NOTE: The data set WORK.SAF has 6 observations and 5 variables.
NOTE: The data set WORK.ELD_SAF has 3 observations and 3 variables.
```

And the expected log if you try to use WHERE on the created variable:

```log
ERROR: Variable AGEGR1 is not on file WORK.ADSL.
NOTE: The SAS System stopped processing this step because of errors.
```

Expected `proc print data=eld_saf noobs; run;` output:

```output
USUBJID                 TRT01P                 AGE

CBX417-301-1012-0002    Placebo + Docetaxel     71
CBX417-301-2031-0001    Placebo + Docetaxel     66
CBX417-301-3044-0001    CBX-417 + Docetaxel     77
```

## Interpretation

- **Same rows, different evidence.** For a simple population flag, WHERE and IF select the same observations. The log still differs (6 read versus 8 read), and reviewers reading a log expect to see the population restriction echoed as a WHERE clause.
- **Order of subsetting is part of the definition.** "Safety subjects aged ≥65" (3) and "subjects aged ≥65" (4) are different populations. The specification states which population a table uses; your code must apply it before anything else.
- **Output options only trim columns.** `SAFFL` was used for selection and then dropped by `KEEP=` on output; nothing about the selection is lost, but a reader of `WORK.SAF` can no longer see *why* those 6 subjects are there. In analysis datasets the flags are therefore usually kept.

## Common mistakes

:::mistake[WHERE on a variable created in the step]
`where AGEGR1 = '>=65';` when `AGEGR1` is computed in the same step gives `ERROR: Variable AGEGR1 is not on file …`. Use a subsetting IF after the derivation — or subset in a later step.
:::

:::mistake[A WHERE statement with MERGE when only one dataset has the variable]
```sas
data adlb2;
  merge adlb adsl(keep=USUBJID SAFFL TRT01A);
  by USUBJID;
  where SAFFL = 'Y';
run;
```
The WHERE statement applies to **both** datasets, and `ADLB` has no `SAFFL`, so the step fails (`ERROR: Variable SAFFL is not on file WORK.ADLB.`). Put `where=(SAFFL = 'Y')` on the ADSL dataset (and use `IN=` flags, covered in the MERGE lesson), or use a subsetting IF after the merge.
:::

:::mistake[A subsetting IF placed before BY-group logic]
With `by USUBJID;`, `FIRST.USUBJID` and `LAST.USUBJID` are computed from every observation read. A subsetting IF placed before a `first.USUBJID` reset can skip the reset, carrying counts from one subject into the next. Filter with WHERE (before the flags are computed) instead — see the BY-group lesson.
:::

::lesson{id="sas-by-group-processing" label="See: the subsetting-IF bug in BY-group processing"}

:::mistake[IF-THEN chains without ELSE]
```sas
if BMIBL < 18.5 then BMICAT = 'UNDERWEIGHT';
if 18.5 <= BMIBL < 25 then BMICAT = 'NORMAL';
else if 25 <= BMIBL < 30 then BMICAT = 'OVERWEIGHT';
else BMICAT = 'OBESE';
```
The second `if` starts a new chain, so an underweight subject fails it, fails the `else if`, and lands in the final `else`: `BMICAT = 'OBESE'`. Write the whole classification as one `if … else if … else` chain, and test missing values first.
:::

:::mistake[Two WHERE statements]
Writing `where SAFFL = 'Y';` and later `where AGE >= 65;` in the same step keeps only the second condition (`NOTE: WHERE clause has been replaced.`). Combine them with `and`, or use `where also`.
:::

:::mistake[KEEP= on input drops a variable you still need]
`set adsl(keep=USUBJID TRT01P);` followed by `if AGE >= 65 then …` produces `NOTE: Variable AGE is uninitialized.` — the age never entered the PDV. Keep what the step needs on input; trim on output.
:::

## Knowledge check

::quiz{ids="sas.subsetting-where-if.where-new-var-mcq,sas.subsetting-where-if.where-vs-if-classify,sas.subsetting-where-if.dsopt-order-mcq,sas.subsetting-where-if.count-numeric"}

## Hands-on exercise

::practice{ids="sas.subsetting-where-if.pop-subsets-code,sas.subsetting-where-if.keep-option-mcq,sas.subsetting-where-if.where-replaced-mcq" title="Practice: populations and subsets"}

## Challenge exercise

::practice{ids="sas.subsetting-where-if.merge-where-log,sas.subsetting-where-if.else-chain-hotspot" title="Debug: subsets that select the wrong subjects"}

## Industry note

- **Filter early, and filter on flags.** Production table programs select populations with a WHERE on flags derived once in ADSL (`SAFFL`, `ITTFL`) rather than re-implementing population logic. If the definition changes, it changes in one place.
- **Know which tool the reviewer expects.** WHERE is preferred for pure selection on stored variables (efficient, echoed in the log, usable in procedures). IF is required when the condition depends on something computed in the step, on `_N_`, or on `FIRST.`/`LAST.`.
- **Mind SQL and R semantics when translating.** A WHERE in SAS treats a missing numeric value as smaller than any number, so `where AGE < 18` selects missing ages. In R, `filter(AGE < 18)` drops rows where the comparison is `NA`; in standard SQL, `NULL < 18` is unknown and the row is excluded. The missing-values lesson covers this in detail.

::lesson{id="sas-missing-values" label="Next: missing values in comparisons"}

:::interview[What is the difference between WHERE and IF?]
"WHERE filters observations before they are read into the program data vector, so it can only use variables that exist in the input dataset, it works in procedures as well as DATA steps, and it is generally more efficient; it also has extra operators like BETWEEN, CONTAINS, LIKE and IS MISSING. A subsetting IF filters after the observation is in the PDV, so it can use variables created earlier in the step, `_N_`, and FIRST./LAST. flags, and it works with raw data read by INPUT, but only in a DATA step. The results can differ: with BY-group processing, FIRST./LAST. are computed on the observations WHERE lets through, whereas an IF discards records after the flags are set; and with MERGE a WHERE statement filters each input dataset before combining, while an IF tests the combined observation."
:::

:::ai[If an AI assistant writes your subsetting code…]
Check three things: that WHERE is not used on a variable created in the same step; that a WHERE statement in a MERGE step does not reference a variable that exists in only one of the datasets; and that any IF-THEN classification is a single chain whose final ELSE cannot silently absorb missing values. Then compare the log's observation counts with the population sizes you expect.
:::
