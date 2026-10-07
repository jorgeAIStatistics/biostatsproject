## What problem are we trying to solve?

The raw demographics export from the EDC has race as **six checkbox columns** — `RACE_WHITE`, `RACE_ASIAN`, `RACE_BLACK`, `RACE_AMIND`, `RACE_NHPI`, `RACE_OTHER` — each containing `Y` or blank. SDTM DM needs a single `RACE` value, and the study's mapping specification says: one box checked → that race; more than one → `MULTIPLE`; none → `NOT REPORTED`.

You could write six `IF` statements and a counter. Then the lab file arrives with four results in conventional units that must be converted to SI, the vitals file needs the same flag derived for five measurements, and a listing needs one row per planned cycle visit. Each is "the same operation, repeated over several columns (or several times)" — which is exactly what **arrays** and **DO loops** are for.

## Intuition

- An **array** is a temporary nickname for a list of variables that already exist (or that you are about to create): `array race{6} RACE_WHITE RACE_ASIAN … ;` lets you say `race{i}` instead of naming each column. Nothing is stored; the array exists only while the DATA step runs.
- A **DO loop** repeats statements. Combined with an array, "do the same thing to each of these columns" becomes three lines instead of eighteen.
- A loop can also **generate rows**: each `OUTPUT` inside the loop writes an observation, so one input row can produce a planned visit schedule, one row per cycle.

The mental model stays the PDV model: the loop runs inside one iteration of the DATA step, on one row, and the array elements are just the PDV slots of the listed variables.

## Clinical context

| Situation | Shape of the data | What the loop does |
|---|---|---|
| "Check all that apply" fields (race, reasons, prior therapies) | one column per option | count checked options, derive one coded value |
| Vendor lab files in conventional units | one column per test | multiply by a conversion factor per test |
| Wide EDC forms (vitals, questionnaires) | one column per measurement | flag, validate, or turn into long format |
| Expected visit schedules, dosing windows | one row per subject | generate one row per planned visit |
| Grading lab values against limits (CTCAE-style) | repeated tests | compare each value with a limit from a lookup array |

Wide-to-long reshaping is the array's most common clinical use; the next lesson covers `PROC TRANSPOSE`, which does it declaratively. Arrays remain the tool when the transformation differs per column (different units, different limits, different flags).

## Formal concept

### The ARRAY statement

```sas
array race{6} $1 RACE_WHITE RACE_ASIAN RACE_BLACK RACE_AMIND RACE_NHPI RACE_OTHER;
array lbval{*} ALT AST BILI CREAT;
array flag{4} $1 ALTFL ASTFL BILIFL CREATFL;
```

- `{6}` or `{*}` gives the number of elements; `{*}` lets SAS count them and `DIM(array)` returns the count.
- A `$` (and optional length) is needed when the array **creates** new character variables. If the variables already exist in the PDV — because they came from `SET` — their type and length are already fixed and `$` is not required.
- The array name is not a variable and is not written to the dataset; it cannot have the same name as a variable in the step.
- Variable lists are allowed: `array q{10} Q1-Q10;`, `array r{*} RACE_:;` (name prefix), `array n{*} _numeric_;`, `array v{*} ALT--BILI` (all variables from ALT to BILI in dataset order).

### DO loops

```sas
do i = 1 to dim(race);            /* iterative: known number of repetitions */
  if race{i} = 'Y' then NRACE + 1;
end;

do while (SUMDIAM > NADIR);       /* condition tested before each pass      */
end;

do until (FOUND = 1);             /* condition tested after each pass —     */
end;                              /* the body always runs at least once     */
```

- After `do i = 1 to 6;` finishes normally, `i` is **7** — the index is incremented, found to exceed the limit, and the loop ends. Drop the index (`drop i;`) so it does not end up in the output.
- `do i = 1 to dim(x) by 2;`, `leave;` (exit the loop) and `continue;` (skip to the next iteration) are available.
- `do until (…)` always executes the body at least once; `do while (…)` may execute it zero times.

### `_TEMPORARY_` arrays

```sas
array f{4} _temporary_ (17.1 88.4 10 10);    /* conversion factors */
array ulnv{4} _temporary_ (40 40 21 97);     /* upper limits       */
```

Temporary array elements have no variable names, are **automatically retained** across iterations, and are not written to the output dataset. They are the natural home for lookup constants — conversion factors, limits, visit windows — that would otherwise clutter the data.

### Generating rows

```sas
do CYCLE = 1 to 6;
  VISITDT = RANDDT + 21 * (CYCLE - 1);
  output;
end;
```

Each `OUTPUT` writes the current PDV, so one input observation becomes six. Remember the rule from the PDV lesson: as soon as the step contains an explicit `OUTPUT`, the implicit one at `run;` no longer happens.

### Errors and traps

- An index outside the array bounds stops the step: `ERROR: Array subscript out of range at line 24 column 6.`
- An array cannot mix character and numeric variables.
- Forgetting `$` when creating new character variables makes them numeric; assigning `'Y'` then converts, giving invalid-data notes and missing values.

## Worked example

### Part 1 — race checkboxes to a single value

| SUBJECT_ID | RACE_WHITE | RACE_ASIAN | RACE_BLACK | RACE_AMIND | RACE_NHPI | RACE_OTHER | Derived `RACE` |
|---|---|---|---|---|---|---|---|
| 1012-0001 | Y | | | | | | `WHITE` |
| 1012-0002 | | Y | | | | | `ASIAN` |
| 1012-0003 | Y | | Y | | | | `MULTIPLE` |
| 2031-0001 | | | | | | Y | `OTHER` |
| 3044-0001 | | | | | | | `NOT REPORTED` |

The loop counts the checked boxes and remembers which one was checked:

```sas
array chk{6} RACE_WHITE RACE_ASIAN RACE_BLACK RACE_AMIND RACE_NHPI RACE_OTHER;
array term{6} $41 _temporary_
      ('WHITE' 'ASIAN' 'BLACK OR AFRICAN AMERICAN' 'AMERICAN INDIAN OR ALASKA NATIVE'
       'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER' 'OTHER');

NCHK = 0;
do i = 1 to dim(chk);
  if chk{i} = 'Y' then do;
    NCHK + 1;
    LASTI = i;
  end;
end;
```

:::number[Why is the temporary array declared `$41`?]
The longest term, `NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER`, is 41 characters. Character array elements are all the same length, so the declared length must fit the longest value — otherwise every longer term is silently truncated, exactly as in the attributes lesson.
:::

:::number[Why `NCHK = 0;` rather than a sum statement?]
`NCHK + 1;` would imply RETAIN and carry the count from the previous subject. Here the count belongs to one row only, so it is reset explicitly at the top of each iteration. (Inside the loop the sum statement is fine, because the reset happens on the line above.)
:::

Then the rule from the specification:

| `NCHK` | `RACE` |
|---:|---|
| 0 | `NOT REPORTED` |
| 1 | `term{LASTI}` — the checked race |
| ≥ 2 | `MULTIPLE` |

:::standard{kind="convention"}
Mapping several checked races to `RACE = 'MULTIPLE'` and keeping the individual races in SUPPDM is the classic SDTM approach used by this study's mapping specification. Race and ethnicity terminology has been changing in recent CDISC controlled-terminology releases (the 2026 SDTM CT file publishes a "Race As Collected" codelist), so always take the permitted values from the CT version named in your study's define.xml.
:::

### Part 2 — unit conversion with a temporary array

A central-lab row reported in conventional units:

| Test | Reported | Factor | SI value |
|---|---:|---:|---:|
| BILI (mg/dL → µmol/L) | 0.8 | 17.1 | 13.68 |
| CREAT (mg/dL → µmol/L) | 1.1 | 88.4 | 97.24 |
| HGB (g/dL → g/L) | 12.4 | 10 | 124.0 |
| ALB (g/dL → g/L) | 4.2 | 10 | 42.0 |

```sas
array conv{4} BILI CREAT HGB ALB;
array f{4} _temporary_ (17.1 88.4 10 10);
do i = 1 to dim(conv);
  if not missing(conv{i}) then conv{i} = round(conv{i} * f{i}, 0.01);
end;
```

:::number[Where do 13.68 and 97.24 come from?]
0.8 × 17.1 = 13.68 µmol/L and 1.1 × 88.4 = 97.24 µmol/L; haemoglobin and albumin are multiplied by 10 (12.4 g/dL = 124 g/L, 4.2 g/dL = 42 g/L). The factors come from the study specification's unit table. The `not missing` test keeps a missing result missing instead of turning it into a missing multiplication note — and in real data you would convert only the rows whose reported unit says conventional.
:::

### Part 3 — generating the planned visit schedule

Randomization on 11 April 2022, cycles of 21 days:

```sas
do CYCLE = 1 to 6;
  VISITDT = RANDDT + 21 * (CYCLE - 1);
  output;
end;
```

| CYCLE | VISITDT | as a SAS date |
|---:|---|---:|
| 1 | 11APR2022 | 22746 |
| 2 | 02MAY2022 | 22767 |
| 3 | 23MAY2022 | 22788 |
| 4 | 13JUN2022 | 22809 |
| 5 | 04JUL2022 | 22830 |
| 6 | 25JUL2022 | 22851 |

:::number[Why `21 * (CYCLE - 1)` and not `21 * CYCLE`?]
Cycle 1 Day 1 is the reference (day 0 offset). With `21 * CYCLE` every visit would be three weeks late. The dates are simple arithmetic because SAS dates are day counts: 22746 + 21 = 22767 is 2 May 2022.
:::

## Data example

The raw demographics export for CBX417-301 has exactly this shape — one row per screened subject, with a column per race checkbox:

::dataset{id="oncology/raw/demographics" cols="SUBJECT_ID,RACE_WHITE,RACE_ASIAN,RACE_BLACK,RACE_AMIND,RACE_NHPI,RACE_OTHER,RACE_NOT_REPORTED" rows="10" caption="raw/demographics — race as check-all-that-apply columns"}

Note the extra `RACE_NOT_REPORTED` column: this CRF lets a site state explicitly that race was not reported, which is different from leaving every box blank. Your array must cover every checkbox on the form, and the mapping specification must say what each combination means — another reason to use `{*}` with `DIM()` rather than a hard-coded count.

## Code

```sas title="arrays_race_units.sas"
data dm;
  set raw_dm;
  length RACE $41;
  array chk{6} RACE_WHITE RACE_ASIAN RACE_BLACK RACE_AMIND RACE_NHPI RACE_OTHER;
  array term{6} $41 _temporary_
        ('WHITE' 'ASIAN' 'BLACK OR AFRICAN AMERICAN' 'AMERICAN INDIAN OR ALASKA NATIVE'
         'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER' 'OTHER');
  NCHK = 0;
  LASTI = .;
  do i = 1 to dim(chk);
    if chk{i} = 'Y' then do;
      NCHK + 1;
      LASTI = i;
    end;
  end;
  if NCHK = 0 then RACE = 'NOT REPORTED';
  else if NCHK = 1 then RACE = term{LASTI};
  else RACE = 'MULTIPLE';
  drop i;
run;
```

:::lines
3: `RACE` is declared before its first assignment so that the longest term fits.
4: The array names the six checkbox columns. They already exist in `RAW_DM`, so their type and length are known and no `$` is needed here.
5-7: A temporary array holding the coded value for each checkbox, in the same order as the checkbox array. Temporary elements are retained and never written out.
8-9: Reset the per-row counter and index. Without these, `NCHK` would accumulate across subjects.
10-15: One pass over the six columns: count the checked boxes and remember the index of the last one checked.
16-18: The specification's rule, in the order that makes each branch unambiguous.
19: `i` is a loop counter, not data; dropping it keeps the output clean. (`NCHK` and `LASTI` are usually dropped too, or kept for QC.)
:::

::::tabs
:::tab[SAS]
```sas
do i = 1 to dim(chk);
  if chk{i} = 'Y' then NCHK + 1;
end;
```
:::
:::tab[R]
```r
chk <- raw_dm[, c("RACE_WHITE", "RACE_ASIAN", "RACE_BLACK",
                  "RACE_AMIND", "RACE_NHPI", "RACE_OTHER")]
NCHK <- rowSums(chk == "Y", na.rm = TRUE)
```
:::
:::tab[Python]
```python
cols = ["RACE_WHITE", "RACE_ASIAN", "RACE_BLACK",
        "RACE_AMIND", "RACE_NHPI", "RACE_OTHER"]
raw_dm["NCHK"] = (raw_dm[cols] == "Y").sum(axis=1)
```
:::
::::

:::note[Loop or vector?]
R and pandas apply the operation to the whole column block at once, so the "loop" is implicit. SAS's DATA step loops over the columns of one row. The results are identical; what differs is where the missing-value handling has to be written — `na.rm = TRUE` in R, `if not missing(…)` in SAS.
:::

## Output

Expected result of `proc print data=dm noobs; var SUBJECT_ID NCHK RACE; run;`:

```output
SUBJECT_ID    NCHK    RACE

1012-0001       1     WHITE
1012-0002       1     ASIAN
1012-0003       2     MULTIPLE
2031-0001       1     OTHER
3044-0001       0     NOT REPORTED
```

Expected log if the loop limit is wrong (`do i = 1 to 7;` over a six-element array):

```log
ERROR: Array subscript out of range at line 24 column 8.
RACE_WHITE=Y RACE_ASIAN=  RACE_BLACK=  RACE_AMIND=  RACE_NHPI=  RACE_OTHER=
NCHK=1 LASTI=1 i=7 _ERROR_=1 _N_=1
NOTE: The SAS System stopped processing this step because of errors.
```

:::number[Why does the log print all those values?]
An array-subscript error is a data error: SAS sets `_ERROR_ = 1` and dumps the PDV so you can see the row and the index that failed (`i=7`). `DIM(array)` in the loop limit makes this error impossible — one more reason to prefer `{*}` and `DIM()` over hard-coded counts.
:::

## Interpretation

- **The derived value carries an assumption.** `NOT REPORTED` for a subject with no checked box assumes the CRF allowed race to be left blank; if the form had an explicit "Not reported" option, the mapping would differ. Read the annotated CRF, not just the column names.
- **`MULTIPLE` loses information** — which is why the individual races go to SUPPDM. Any derivation that collapses columns should keep the detail somewhere.
- **Loops make code shorter, not automatically clearer.** The array order and the lookup array order must correspond; a reviewer checks that correspondence first, so keep the two declarations adjacent and in the same order.

## Common mistakes

:::mistake[Forgetting `$` when the array creates character variables]
`array flg{3} ALTFL ASTFL BILIFL;` creates three **numeric** variables if they do not already exist. `flg{i} = 'Y';` then triggers a character-to-numeric conversion note, an invalid-data note, and missing values. Write `array flg{3} $1 ALTFL ASTFL BILIFL;`.
:::

:::mistake[Hard-coding the number of elements]
`do i = 1 to 6;` breaks the day someone adds a seventh checkbox — usually with an array-subscript error, sometimes by silently ignoring the new column. Use `{*}` with `dim()`.
:::

:::mistake[Letting a counter accumulate across rows]
`NCHK + 1;` inside the loop without `NCHK = 0;` at the top of the step keeps counting across subjects (the sum statement implies RETAIN). Reset per-row counters explicitly.
:::

:::mistake[Mismatched lookup order]
If the checkbox array and the term array are not in the same order, every subject gets a plausible but wrong race. Keep them adjacent and QC by tabulating each checkbox against the derived value (`proc freq; tables RACE_WHITE*RACE;`).
:::

:::mistake[Leaving loop indexes in the output]
`i`, `LASTI` and similar helpers end up as columns in the analysis dataset unless dropped, and will be flagged by conformance checks on a submission dataset.
:::

:::mistake[Using DO WHILE when the body must run once]
`do while (FOUND = 0);` never executes if `FOUND` is already 0-initialised the wrong way, or executes zero times when you expected one pass. `do until (…)` guarantees one pass.
:::

## Knowledge check

::quiz{ids="sas.arrays-do-loops.index-after-loop-numeric,sas.arrays-do-loops.dim-mcq,sas.arrays-do-loops.while-until-mcq,sas.arrays-do-loops.temporary-mcq"}

## Hands-on exercise

::practice{ids="sas.arrays-do-loops.race-code,sas.arrays-do-loops.unit-conv-numeric,sas.arrays-do-loops.visit-schedule-code" title="Practice: repeated columns and generated rows"}

## Challenge exercise

::practice{ids="sas.arrays-do-loops.char-array-hotspot,sas.arrays-do-loops.subscript-log" title="Debug: arrays that silently change types"}

## Industry note

- **Checkbox fields are everywhere in EDC exports** — race, reasons for discontinuation, seriousness criteria, prior therapies. Mapping them to a single coded value (or to several SUPP records) is a standard SDTM programming task, and interviewers like it because it tests arrays, controlled terminology and specification reading at once.
- **Lookup arrays beat hard-coded constants.** Conversion factors, CTCAE limits and visit windows that appear once in a `_TEMPORARY_` array (or, better, in a small dataset you read) can be checked by a reviewer in one place.
- **Prefer a dataset to a long temporary array** when the lookup is study data rather than a constant: reference ranges by sex and age, for example, belong in a dataset you merge, not in code.
- **Arrays are not a data structure.** They exist only during the DATA step. If an interviewer asks "what is an array in SAS?", the expected answer is "a temporary name for a group of variables of the same type, used to apply the same operation to each of them".

:::interview[How would you convert six race checkbox fields into the SDTM RACE variable?]
"I'd read the mapping specification and the annotated CRF first, because the rule for multiple and missing responses is study-specific. Typically: an array over the six checkbox variables and a parallel temporary array with the controlled-terminology value for each, a loop that counts the checked boxes and remembers which one, then RACE = the single checked term, 'MULTIPLE' when more than one is checked, and the specification's value — often 'NOT REPORTED' — when none is. The individual races go to SUPPDM when RACE is MULTIPLE. For QC I'd cross-tabulate each checkbox against the derived RACE and check that the counts add up to the number of subjects, and I'd confirm the permitted values against the CT version in the define.xml."
:::

:::ai[If an AI assistant writes array code for you…]
Check that new character arrays declare `$` and a length, that loop limits use `dim()` rather than a hard-coded number, that per-row counters are reset, and that the lookup array's order matches the variable array's order. Then tabulate the result against the source columns — a wrong lookup order produces perfectly plausible values.
:::
