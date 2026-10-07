## What problem are we trying to solve?

The vitals CRF for CBX417-301 collects, at each visit, systolic and diastolic blood pressure, pulse, temperature and weight. The EDC exports it the way the form looks — **one row per visit, one column per measurement**:

| SUBJECT_ID | VISIT_NAME | VS_DATE | SYSBP | DIABP | PULSE | TEMP | WEIGHT |
|---|---|---|---:|---:|---:|---:|---:|

SDTM VS needs the opposite shape — **one row per measurement**, with the test identified by `VSTESTCD` and the value in `VSORRES`:

| USUBJID | VSTESTCD | VSORRES | VSORRESU | VISITNUM | VISIT |
|---|---|---|---|---|---|

Turning one shape into the other is *reshaping*, and it goes both ways: raw → SDTM is wide-to-long, while a patient-profile listing or a correlation between systolic and diastolic pressure needs long-to-wide. `PROC TRANSPOSE` does both in a few lines — if you can describe your data in its vocabulary (`BY`, `VAR`, `ID`) and you know its two classic failure modes.

## Intuition

Think of a spreadsheet block and a rotation.

- **Wide to long**: each measurement column becomes a *row*. The column's **name** becomes data (`_NAME_` → `VSTESTCD`) and its **value** becomes the single value column (`COL1` → `VSORRES`). The `BY` variables identify what stays constant: subject, visit, date.
- **Long to wide**: the values of one column become *column names*. That column is the `ID`. Each `BY` group becomes one row.

The `BY` statement answers "what identifies a row of the output?", `VAR` answers "which values move?", and `ID` (long-to-wide only) answers "where do the new column names come from?".

## Clinical context

Almost every clinical data structure is "long", because it must accommodate tests that vary by visit, by subject and by protocol version:

- **SDTM findings domains** (VS, LB, EG, QS) hold one record per test per time point, with the test in `--TESTCD` and the result in `--ORRES`/`--STRESN`.
- **ADaM BDS** is long too: one record per subject, parameter (`PARAMCD`) and time point (`AVISITN`).
- **Raw EDC exports and vendor files** are usually wide, because forms and instruments are laid out that way.
- **Listings, patient profiles, shift tables and some statistical procedures** need wide again — one row per subject or per visit with columns to compare side by side.

So reshaping happens at both ends of the pipeline, and the correctness question is always the same: does every input value appear exactly once in the output, attached to the right subject, visit and test?

## Formal concept

### The statements

```sas
proc transpose data=<in> out=<out> prefix=<text> name=<var> let;
  by  <variables that identify an output row>;   /* data must be sorted by these */
  var <variables whose values move>;
  id  <variable whose values become column names>;   /* long-to-wide only */
  idlabel <variable whose values become column labels>;
  copy <variables copied unchanged>;              /* wide-to-long only */
run;
```

- `BY` requires the data to be **sorted** by those variables; you get one output row (wide-to-long: one per BY group per VAR variable).
- If `VAR` is omitted, PROC TRANSPOSE transposes **all numeric variables** that are not used in `BY`, `ID` or `COPY`.
- Without an `ID`, the new columns are named `COL1`, `COL2`, … (or `PREFIX=`text 1, 2, …).
- `NAME=` renames the automatic `_NAME_` column (which holds the name of the transposed variable); if the transposed variables have labels, a `_LABEL_` column appears too (rename it with `LABEL=`).
- `LET` tells PROC TRANSPOSE to tolerate duplicate `ID` values within a BY group, keeping the **last** one — a dangerous convenience.

### The two failure modes

**1. Duplicate ID values.** Long-to-wide needs at most one record per BY group per ID value. Two records with the same `VSTESTCD` in the same visit (a repeat measurement, an unscheduled assessment given the same visit number) stop the step:

```log
ERROR: The ID value "SYSBP" occurs twice in the same BY group.
```

The fix is never `LET` by default: decide, per the specification, which record is the analysis record (often an analysis flag such as `ANL01FL = 'Y'`), or add the distinguishing variable (time point, sequence) to the `BY` statement.

**2. Mixed types.** All the variables in `VAR` must be of one type, or rather: if **any** of them is character, every transposed value column becomes character, and numeric values are written as text. That is fine for SDTM `--ORRES` (which is character by design) but it silently changes what downstream code can do with the values. Transpose numeric and character variables in separate steps when you need both types preserved.

### Wide-to-long, step by step

```sas
proc sort data=raw_vs out=vs_s;
  by SUBJECT_ID VISIT_NAME VS_DATE;
run;

proc transpose data=vs_s out=vs_long(rename=(COL1=VSSTRESN)) name=VSTESTCD;
  by SUBJECT_ID VISIT_NAME VS_DATE;
  var SYSBP DIABP PULSE TEMP WEIGHT;
run;
```

Each BY group produces one row per VAR variable — including rows where the value is **missing**. PROC TRANSPOSE does not drop them, and that is a decision point: in SDTM, a planned measurement that was not taken is usually represented with `VSSTAT = 'NOT DONE'` (and `VSREASND`) rather than by an absent record, while a test that was never part of the visit's schedule should simply not produce a record. Your mapping specification says which.

### Long-to-wide, step by step

```sas
proc sort data=vs out=vs_s;
  by USUBJID VISITNUM;
run;

proc transpose data=vs_s out=vs_wide(drop=_NAME_);
  by USUBJID VISITNUM;
  id VSTESTCD;
  var VSSTRESN;
run;
```

One row per `USUBJID VISITNUM`, with columns named after the `VSTESTCD` values (`SYSBP`, `DIABP`, …). If the ID values are numbers or start with a digit — visit numbers, for example — SAS prefixes them with an underscore, so `PREFIX=VIS` (giving `VIS10`, `VIS20`) usually reads better.

### The DATA step alternative

```sas
data vs_long;
  set vs_s;
  array m{5} SYSBP DIABP PULSE TEMP WEIGHT;
  array c{5} $8 _temporary_ ('SYSBP' 'DIABP' 'PULSE' 'TEMP' 'WEIGHT');
  do i = 1 to dim(m);
    VSTESTCD = c{i};
    VSSTRESN = m{i};
    output;                    /* inside the loop: one row per measurement */
  end;
  keep SUBJECT_ID VISIT_NAME VS_DATE VSTESTCD VSSTRESN;
run;
```

More lines, but full control: you can attach the right unit per test, skip missing values, apply per-test conversions, or set `VSSTAT` — all in the same pass. Production SDTM mapping programs often use the DATA step for exactly this reason.

## Worked example

Four raw vitals rows (two subjects × two visits). Subject 1012-0002's screening temperature was recorded in Fahrenheit, and their Cycle 1 Day 1 temperature was not taken.

| SUBJECT_ID | VISIT_NAME | VS_DATE | SYSBP | DIABP | PULSE | TEMP | TEMP_UNIT | WEIGHT |
|---|---|---|---:|---:|---:|---:|---|---:|
| 1012-0001 | SCREENING | 2022-04-05 | 128 | 78 | 72 | 36.6 | C | 70.2 |
| 1012-0001 | CYCLE 1 DAY 1 | 2022-04-14 | 132 | 80 | 76 | 36.8 | C | 70.0 |
| 1012-0002 | SCREENING | 2022-04-28 | 118 | 72 | 68 | 97.9 | F | 82.0 |
| 1012-0002 | CYCLE 1 DAY 1 | 2022-05-03 | 124 | 74 | 70 | . | C | 81.6 |

Transposing `SYSBP DIABP PULSE TEMP WEIGHT` by subject, visit and date gives **20 rows**.

:::number[Where does 20 come from — and how many have a value?]
4 BY groups × 5 transposed variables = 20 rows. One of them (subject 1012-0002, Cycle 1 Day 1, `TEMP`) has a missing value, so 19 rows carry a measurement. The 20th row is not an error: it is the question "was the temperature not done, or not scheduled?" arriving in your program. In SDTM that record would be kept with `VSSTAT = 'NOT DONE'` if the measurement was expected, or dropped if it was not.
:::

The first BY group becomes:

| SUBJECT_ID | VISIT_NAME | VSTESTCD | VSSTRESN | VSORRESU |
|---|---|---|---:|---|
| 1012-0001 | SCREENING | SYSBP | 128 | mmHg |
| 1012-0001 | SCREENING | DIABP | 78 | mmHg |
| 1012-0001 | SCREENING | PULSE | 72 | beats/min |
| 1012-0001 | SCREENING | TEMP | 36.6 | C |
| 1012-0001 | SCREENING | WEIGHT | 70.2 | kg |

:::number[Why does the unit have to be attached after the transpose?]
The unit is a property of the **test**, not of the visit, and in the wide file it lives in separate columns (`TEMP_UNIT`, `WEIGHT_UNIT`) or in the specification. After transposing, each row knows its test, so a short lookup assigns `mmHg`, `beats/min`, `C` or `kg`. Those four values are CDISC controlled terminology for vital-signs units, which is why SDTM stores the unit as its own variable rather than inside the result.
:::

:::number[What happens to the Fahrenheit temperature?]
Nothing automatic — and that is the point. `VSORRES`/`VSORRESU` keep the result as collected (97.9 °F), while the standardized result is converted: (97.9 − 32) × 5/9 = 36.6 °C, so `VSSTRESN = 36.6` with `VSSTRESU = 'C'`. Because the conversion depends on the row's unit, it is easiest to do it **after** the transpose (or in a DATA step that transposes and converts in one pass).
:::

Going back the other way, `id VSTESTCD; var VSSTRESN;` with `by SUBJECT_ID VISIT_NAME;` reproduces the wide layout — four rows with columns `SYSBP DIABP PULSE TEMP WEIGHT`, the missing temperature reappearing as a missing cell.

## Data example

The real study data contains both shapes of the same information. The raw export:

::dataset{id="oncology/raw/vitals" cols="SUBJECT_ID,VISIT_NAME,VS_DATE,SYSBP,DIABP,PULSE,TEMP,TEMP_UNIT,WEIGHT" rows="8" caption="raw/vitals — one row per visit, one column per measurement"}

and the SDTM domain built from it:

::dataset{id="oncology/sdtm/vs" cols="USUBJID,VSTESTCD,VSORRES,VSORRESU,VSSTRESN,VSSTRESU,VISITNUM,VISIT" rows="12" caption="sdtm/vs — one row per measurement per visit"}

Compare the two: each raw row has become five VS records (systolic, diastolic, pulse, temperature, weight), plus a height record at screening only. Notice also that `VSORRESU` is not constant within a test — some sites reported temperature in Fahrenheit and weight in pounds — which is why the standardized columns (`VSSTRESN`, `VSSTRESU`) exist.

## Code

```sas title="vitals_wide_to_long.sas"
proc sort data=raw_vs out=vs_s;
  by SUBJECT_ID VISIT_NAME VS_DATE;
run;

proc transpose data=vs_s out=vs_t(rename=(COL1=VSORRESN)) name=VSTESTCD;
  by SUBJECT_ID VISIT_NAME VS_DATE;
  var SYSBP DIABP PULSE TEMP WEIGHT;
run;

data vs_long;
  merge vs_t
        vs_s(keep=SUBJECT_ID VISIT_NAME VS_DATE TEMP_UNIT WEIGHT_UNIT);
  by SUBJECT_ID VISIT_NAME VS_DATE;
  length VSORRESU VSSTRESU $10;
  select (VSTESTCD);
    when ('SYSBP', 'DIABP') do; VSORRESU = 'mmHg';      VSSTRESU = 'mmHg';      end;
    when ('PULSE')          do; VSORRESU = 'beats/min'; VSSTRESU = 'beats/min'; end;
    when ('TEMP')           do; VSORRESU = TEMP_UNIT;   VSSTRESU = 'C';         end;
    when ('WEIGHT')         do; VSORRESU = WEIGHT_UNIT; VSSTRESU = 'kg';        end;
    otherwise;
  end;
  if      VSTESTCD = 'TEMP'   and VSORRESU = 'F'  then VSSTRESN = round((VSORRESN - 32) * 5/9, 0.1);
  else if VSTESTCD = 'WEIGHT' and VSORRESU = 'LB' then VSSTRESN = round(VSORRESN * 0.45359237, 0.1);
  else VSSTRESN = VSORRESN;
  drop TEMP_UNIT WEIGHT_UNIT;
run;
```

:::lines
1-3: `BY` in PROC TRANSPOSE requires sorted data; these three variables identify a visit.
5: `OUT=` names the result; `COL1` (the default value column) is renamed as it is written, and `NAME=` turns `_NAME_` into `VSTESTCD`.
6: The BY group: everything that stays constant across the five measurements of a visit.
7: The five measurement columns that become rows, in the order they will appear.
11-13: A one-to-many merge brings the unit columns back: the transposed dataset has five rows per visit, the wide dataset one, so the unit values are retained across all five rows of the BY group.
14: Declares the unit variables before first use so the longest value (`beats/min`) fits.
15-21: A `SELECT` block assigns the unit per test — the lookup that the transpose itself cannot do. An `OTHERWISE;` branch is required (an empty one is fine), otherwise an unmatched value stops the step.
22-24: The standardized value: Fahrenheit converted to Celsius, pounds to kilograms, everything else copied unchanged. Keeping one rule per test in one place makes the conversions reviewable.
25: The helper columns are not part of VS.
:::

::::tabs
:::tab[PROC TRANSPOSE]
```sas
proc transpose data=vs_s out=vs_long(rename=(COL1=VSSTRESN)) name=VSTESTCD;
  by SUBJECT_ID VISIT_NAME VS_DATE;
  var SYSBP DIABP PULSE TEMP WEIGHT;
run;
```
:::
:::tab[DATA step]
```sas
data vs_long;
  set vs_s;
  array m{5} SYSBP DIABP PULSE TEMP WEIGHT;
  array c{5} $8 _temporary_ ('SYSBP' 'DIABP' 'PULSE' 'TEMP' 'WEIGHT');
  do i = 1 to dim(m);
    VSTESTCD = c{i};
    VSSTRESN = m{i};
    output;
  end;
  keep SUBJECT_ID VISIT_NAME VS_DATE VSTESTCD VSSTRESN;
run;
```
:::
:::tab[R]
```r
vs_long <- tidyr::pivot_longer(
  vs_s,
  cols      = c(SYSBP, DIABP, PULSE, TEMP, WEIGHT),
  names_to  = "VSTESTCD",
  values_to = "VSSTRESN"
)
```
:::
:::tab[Python]
```python
vs_long = vs_s.melt(
    id_vars=["SUBJECT_ID", "VISIT_NAME", "VS_DATE"],
    value_vars=["SYSBP", "DIABP", "PULSE", "TEMP", "WEIGHT"],
    var_name="VSTESTCD", value_name="VSSTRESN",
)
```
:::
::::

:::note[Defaults differ — check the missing values]
`pivot_longer()` and `melt()` keep missing values by default, like PROC TRANSPOSE (`pivot_longer(values_drop_na = TRUE)` drops them). None of the four tools decides for you whether a missing measurement should become a record with `VSSTAT = 'NOT DONE'` or no record at all — the mapping specification does.
:::

## Output

Expected log for the transpose of the four raw rows:

```log
NOTE: There were 4 observations read from the data set WORK.VS_S.
NOTE: The data set WORK.VS_T has 20 observations and 5 variables.
```

:::number[Which 5 variables?]
`SUBJECT_ID`, `VISIT_NAME` and `VS_DATE` (the BY variables), `VSTESTCD` (the renamed `_NAME_`) and `VSORRESN` (the renamed `COL1`). If the transposed variables had labels, a `_LABEL_` column would appear as well. The unit columns are not here — they come back in the merge, one value repeated across the five rows of each visit.
:::

Expected listing of the first BY group of `VS_LONG`:

```output
SUBJECT_ID    VISIT_NAME    VSTESTCD    VSORRESN    VSORRESU     VSSTRESN

1012-0001     SCREENING     SYSBP          128      mmHg            128.0
1012-0001     SCREENING     DIABP           78      mmHg             78.0
1012-0001     SCREENING     PULSE           72      beats/min        72.0
1012-0001     SCREENING     TEMP          36.6      C                 36.6
1012-0001     SCREENING     WEIGHT        70.2      kg                70.2
```

And the expected log when a long-to-wide transpose meets a repeated test in one visit:

```log
ERROR: The ID value "SYSBP" occurs twice in the same BY group.
NOTE: The SAS System stopped processing this step because of errors.
```

## Interpretation

- **Reshaping preserves values, not meaning.** After a wide-to-long transpose you still have to say what each row *is*: which test, in which unit, collected or derived, done or not done. Most of the mapping work happens after the rotation.
- **The row count is the check.** Wide to long: BY groups × transposed variables (before dropping anything). Long to wide: number of BY groups. If your output does not match that arithmetic, something about your BY or ID assumption is wrong.
- **A duplicate-ID error is usually a data question.** Two systolic readings at one visit may be a repeat measurement, an unscheduled assessment, or a duplicate record. `LET` hides the question by keeping the last value; the specification (or the data manager) answers it.

## Common mistakes

:::mistake[Using LET to make the duplicate-ID error go away]
`LET` keeps the last record in each BY group and silently discards the others. Which record is "last" depends on the sort. Decide explicitly: select the analysis record (`where ANL01FL = 'Y'`), or add the distinguishing variable (time point, sequence, unscheduled flag) to the BY statement.
:::

:::mistake[Forgetting that BY needs sorted data]
PROC TRANSPOSE does not sort. Unsorted input gives the same "BY variables are not properly sorted" error as a DATA step — or, with `NOTSORTED`, repeated BY groups and duplicate output rows.
:::

:::mistake[Mixing character and numeric variables in VAR]
One character variable makes every transposed value column character, and numbers are written as text (often with leading blanks). Transpose the types separately, or use a DATA step where you control each assignment.
:::

:::mistake[Assuming missing values disappear]
A wide row with three measurements and two blanks still becomes five long rows. Decide whether the blanks are "not done" records or should be dropped — and make that decision visible in the program, not accidental.
:::

:::mistake[Letting SAS name the columns]
Without `ID`, columns are `COL1`, `COL2`, … — meaningless downstream and easy to mis-align when the VAR list changes. Rename them in the `OUT=` option or use `PREFIX=`. With numeric ID values, SAS prefixes names with an underscore (`_10`), which is rarely what a reviewer wants to read.
:::

:::mistake[Transposing when a summary was wanted]
"One row per subject with the maximum grade per body system" is not a transpose; it is a summary (PROC MEANS/SQL) followed, perhaps, by a transpose. Reshaping cannot aggregate.
:::

## Knowledge check

::quiz{ids="sas.proc-transpose.rows-numeric,sas.proc-transpose.name-mcq,sas.proc-transpose.mixed-types-mcq,sas.proc-transpose.missing-rows-mcq"}

## Hands-on exercise

::practice{ids="sas.proc-transpose.wide-to-long-code,sas.proc-transpose.long-to-wide-code,sas.proc-transpose.id-prefix-mcq" title="Practice: rotate the vitals data both ways"}

## Challenge exercise

::practice{ids="sas.proc-transpose.dup-id-log,sas.proc-transpose.datastep-alt-hotspot" title="Debug: duplicate IDs and a loop that writes one row"}

## Industry note

- **SDTM mapping programs often prefer the DATA step** for wide-to-long, because units, `--STAT`, `--REASND`, sequence numbers and per-test conversions all need to be set while the row is being built. PROC TRANSPOSE shines for quick reshaping, QC datasets and long-to-wide listings.
- **Long-to-wide is a listing and QC tool.** Patient profiles, shift tables and "compare these three visits side by side" checks are all wide. Analysis datasets stay long.
- **Know the equivalents in other languages.** `pivot_longer()`/`pivot_wider()` in R (tidyr) and `melt()`/`pivot()` in pandas do the same job; interviewers for data-scientist roles ask about them in exactly the same terms (identifier columns, value columns, names column).
- **Always state the expected row count in your program header.** "4 visits × 5 tests = 20 records" is a check a reviewer can verify in seconds, and it catches a surprising number of specification misunderstandings.

:::interview[How would you turn the wide raw vitals form into SDTM VS, and what can go wrong?]
"I'd sort by subject, visit and date, then either use PROC TRANSPOSE with those as BY variables and the five measurement columns in VAR — renaming `_NAME_` to `VSTESTCD` and `COL1` to the result — or write a DATA step with an array and an OUTPUT inside the loop, which I'd prefer in production because I can set the unit, the standardized value and `VSSTAT` per test in the same pass.

Things that go wrong: the data isn't sorted for the BY statement; missing measurements produce rows that need a decision — `VSSTAT = 'NOT DONE'` or no record; units live in separate columns in the raw file and have to be attached per test, including conversions like Fahrenheit to Celsius; and if I ever transpose back to wide, repeated tests within a visit cause the 'ID value occurs twice in the same BY group' error, which I'd resolve with the analysis-record flag rather than the LET option. My standard check is the arithmetic: BY groups times tests equals output rows."
:::

:::ai[If an AI assistant writes reshaping code for you…]
Check the BY variables (do they really identify an output row?), whether the data are sorted, what happens to missing values, and whether `ID` values can repeat within a BY group. Then count: BY groups × VAR variables for wide-to-long, BY groups for long-to-wide. Generated code often omits the sort and quietly adds `LET` to make an error disappear.
:::
