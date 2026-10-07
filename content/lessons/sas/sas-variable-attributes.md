## What problem are we trying to solve?

Your ADSL program for CBX417-301 runs with a clean log. Then the QC programmer's comparison report arrives:

- every subject who stopped treatment has `EOTSTT = 'DISCONT'` in your dataset and `'DISCONTINUED'` in theirs;
- the define.xml check says your `TRT01P` has length 200 while the specification says 19;
- `TRTSDT` in your dataset "looks like" 22749 in one viewer and 14APR2022 in another, and a colleague asks whether it is a number or text.

Nothing crashed. The values are wrong or inconsistent because of **variable attributes**: the type, length, label, format and informat that SAS attaches to every variable. Attributes are decided in ways that are easy to miss — the length of a character variable is often fixed by the *first value you happen to assign* — and they matter doubly in clinical work, because submission datasets must match a specification and a transport format with hard limits.

## Intuition

Every SAS variable carries a small identity card:

| Attribute | Question it answers | Example |
|---|---|---|
| **Name** | What is it called? | `TRTSDT` |
| **Type** | Is it text or a number? | numeric |
| **Length** | How many bytes are reserved to store it? | 8 |
| **Label** | What does it mean, in words? | Date of First Exposure to Treatment |
| **Format** | How should the stored value be *displayed*? | `DATE9.` → `14APR2022` |
| **Informat** | How should raw text be *read* into a value? | `YYMMDD10.` reads `2022-04-14` |

Two ideas explain almost every attribute problem:

1. **Type and length are decided once, at compile time, from the first mention of the variable.** If the first thing SAS sees is `EOTSTT = 'ONGOING'`, it reserves 7 bytes — and every longer value is cut to 7.
2. **A format changes how a value looks, never what it is.** The stored value of a date is a number of days; the format only paints it for humans.

## Clinical context

In a clinical study the attributes are not your choice — they come from the **specification**:

- the SDTM and ADaM specifications (and the define.xml generated from them) list each variable's label, type, length and, for numeric dates, display format;
- QC compares attributes as well as values: `PROC COMPARE` reports variables whose type, length, format or label differ between production and QC datasets;
- submitted datasets travel as SAS version 5 transport (XPT) files, which impose limits you must respect when you build the data, not at the last minute.

:::standard{kind="official" source="FDA Study Data Technical Conformance Guide (June 2026), §3.1.1, §3.1.3, §3.1.4"}
The TCG names SAS Transport (XPORT) Version 5 as the file format for submitted study datasets (§3.1.1; the record layout is SAS technical document TS-140). Its Table 1 limits variable names to 8 characters and variable and dataset labels to 40 characters (§3.1.4). It asks that the allotted length of each character column be the maximum length actually used across the study's datasets — its example: if `USUBJID` is at most 18 characters, the column should be 18, not 200 (§3.1.3). It also states that SAS custom formats should not be used in submissions (§3.1.1). The 40-character label limit is a constraint of the transport format; SAS itself allows labels up to 256 characters.
:::

Two practical consequences:

- **Lengths are both a correctness and a conformance issue.** Too short truncates data (a correctness defect); far too long (200 everywhere) wastes space and fails the "maximum length used" expectation. Many teams set lengths from the specification during programming and trim them to the observed maximum in a final step before creating XPT files (convention).
- **Decode with variables, not formats.** Because custom formats are not submitted, ADaM datasets carry pairs such as `TRT01P` (text) and `TRT01PN` (number) rather than a number with a format attached.

## Formal concept

### Type: character or numeric

SAS has exactly two types.

- **Numeric** values are stored as 8-byte floating-point numbers by default. Dates, times and datetimes are numeric: a **SAS date** is the number of days since 1 January 1960 (so 14 April 2022 is 22749), a SAS time is seconds since midnight, and a SAS datetime is seconds since midnight on 1 January 1960.
- **Character** values are fixed-length strings, padded with trailing blanks to the variable's length.

The type is fixed at the first mention. In `LBSTRESN = RESULT;`, if `RESULT` is character, the *new* variable `LBSTRESN` becomes character too — assignment copies the type of the expression.

### Length

For **character** variables, the length (1 to 32,767 bytes) comes from the first of these that SAS meets at compile time:

| First mention | Length given |
|---|---|
| `LENGTH` or `ATTRIB` statement | the length you declare |
| the variable in a `SET`/`MERGE` dataset | its length in that dataset |
| an `INPUT` statement with an informat (`:$20.`) | the informat width |
| an assignment of a literal (`EOTSTT = 'ONGOING';`) | the length of that literal (7) |
| an assignment from a character function such as `SCAN`, `CATX` or `TRANWRD` | often 200 — check the function's documentation |

For **numeric** variables the default length is 8 bytes. Shorter lengths (3–7) are possible but store fewer significant digits; keep non-integer values (lab results, doses, BMI) at 8.

A `LENGTH` statement that appears **after** the first mention is too late. SAS keeps the original length and writes:

```log
WARNING: Length of character variable EOTSTT has already been set.
         Use the LENGTH statement as the very first statement in the DATA STEP to declare the length of a character variable.
```

To change the length of a variable that comes from an input dataset, put `LENGTH` **before** the `SET` statement. Making it longer is safe; making it shorter than the data truncates values, and SAS warns that multiple lengths were specified for the variable.

### Label

A label is free text describing the variable, up to 256 characters in SAS and 40 for submission datasets. Labels appear in `PROC CONTENTS`, as column headers with `PROC PRINT … LABEL` and in many procedures' output. Assign with `label TRTSDT = 'Date of First Exposure to Treatment';`.

### Formats and informats

| | Format | Informat |
|---|---|---|
| Direction | value → text (writing, displaying) | text → value (reading) |
| Used by | `FORMAT` statement, `PUT` statement, `PUT()` function, procedures | `INPUT` statement, `INPUT()` function |
| Date example | `DATE9.` shows 22749 as `14APR2022`; `YYMMDD10.` as `2022-04-14` | `YYMMDD10.` reads `2022-04-14` as 22749 |
| Numeric example | `8.1` shows 27.5487 as `27.5` | `COMMA10.` reads `1,250` as 1250 |
| Character example | `$20.` | `$CHAR20.` keeps leading blanks |

Formats are stored in the dataset's descriptor when you use a `FORMAT` statement in a DATA step, so every procedure displays the value the same way. **They never change the stored value**: `format BMIBL 5.1;` displays 27.5 while 27.5487 is still what `if BMIBL > 27.5` compares. Use `ROUND()` when the specification requires a rounded *value*.

The two conversion functions:

```sas
RANDDT   = input(RAND_DATE, yymmdd10.);   /* character -> numeric, with an informat */
TRTSDTC  = put(TRTSDT, yymmdd10.);        /* numeric   -> character, with a format  */
```

When you mix types without these functions, SAS converts for you and writes a note such as `NOTE: Character values have been converted to numeric values at the places given by: (Line):(Column).` Clean logs avoid these notes; the fix is always an explicit `INPUT()` or `PUT()`.

### ATTRIB: everything in one statement

```sas
attrib TRTSDT length=8 format=date9. label='Date of First Exposure to Treatment';
```

Placed at the top of the step (before `SET`), `ATTRIB` or `LENGTH` statements also fix the **order** of variables to match the specification, because order follows first mention.

## Worked example

### Part 1 — a truncated status

`EOTSTT` (end-of-treatment status) should be `'ONGOING'` for a subject still on treatment at the data cut-off and `'DISCONTINUED'` otherwise.

| USUBJID | DCTREAS (reason treatment stopped) |
|---|---|
| CBX417-301-1012-0001 | PROGRESSIVE DISEASE |
| CBX417-301-1012-0002 | *(blank — still on treatment)* |
| CBX417-301-2031-0001 | ADVERSE EVENT |
| CBX417-301-3044-0001 | PROGRESSIVE DISEASE |

```sas
data adsl;
  set adsl_in;
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
run;
```

At compile time, the first mention of `EOTSTT` is the assignment of `'ONGOING'`, a 7-character literal. `EOTSTT` becomes `$7`. At execution, `'DISCONTINUED'` (12 characters) is stored as its first 7 characters: `'DISCONT'`.

:::number[What does PROC FREQ show?]
Three subjects have a reason for stopping, one does not: `DISCONT` 3 (75.00%) and `ONGOING` 1 (25.00%). The counts are right; the *value* is wrong — which is why value-level QC comparisons catch this and count-level checks do not.
:::

The fix is to declare the length before the first assignment:

```sas
data adsl;
  set adsl_in;
  length EOTSTT $12;
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
run;
```

:::standard{kind="convention"}
`'ONGOING'`, `'DISCONTINUED'` and `'COMPLETED'` are the terms of the ADaM controlled-terminology codelist Subject Trial Status (SBJTSTAT), which sponsors commonly use for `EOTSTT` and `EOSSTT`. Which terms apply, and exactly when a subject counts as discontinued, is defined in your study's ADaM specification.
:::

### Part 2 — a date is a number with a format

The randomization system sends `RAND_DATE` as text, `2022-04-11`; the first dose was on 14 April 2022.

```sas
RANDDT = input(RAND_DATE, yymmdd10.);
format RANDDT TRTSDT date9.;
DAYS_TO_DOSE = TRTSDT - RANDDT;
```

| Variable | Stored value | Displayed with `DATE9.` | Displayed with `YYMMDD10.` |
|---|---:|---|---|
| `RANDDT` | 22746 | 11APR2022 | 2022-04-11 |
| `TRTSDT` | 22749 | 14APR2022 | 2022-04-14 |
| `DAYS_TO_DOSE` | 3 | — | — |

:::number[Where do 22746 and 22749 come from?]
A SAS date counts days from 1 January 1960 (day 0). From 1 January 1960 to 11 April 2022 there are 22,746 days; three days later is 22,749. Because both are plain numbers, `TRTSDT - RANDDT = 3` — the first dose came 3 days after randomization, within the protocol's window for Cycle 1 Day 1. Subtracting two *character* dates would not work at all.
:::

### Part 3 — inspect the result

```output
                    Variables in Creation Order

#    Variable    Type    Len    Format    Label
1    USUBJID     Char     20              Unique Subject Identifier
2    RANDDT      Num       8    DATE9.    Date of Randomization
3    TRTSDT      Num       8    DATE9.    Date of First Exposure to Treatment
4    EOTSTT      Char     12              End of Treatment Status
```

Expected `PROC CONTENTS … VARNUM` output (abridged) for the final program below. Read it the way a reviewer would: every date is `Num` with a date format; every label is at most 40 characters (the longest here is 35); `USUBJID` is exactly as long as the longest value (`CBX417-301-1012-0001` has 20 characters).

## Code

```sas title="adsl_attributes.sas"
data adsl_in;
  infile datalines dlm='|' dsd truncover;
  input USUBJID :$20. RAND_DATE :$10. TRTSDT :yymmdd10. DCTREAS :$40.;
  datalines;
CBX417-301-1012-0001|2022-04-11|2022-04-14|PROGRESSIVE DISEASE
CBX417-301-1012-0002|2022-05-02|2022-05-03|
CBX417-301-2031-0001|2022-06-20|2022-06-22|ADVERSE EVENT
CBX417-301-3044-0001|2022-07-05|2022-07-06|PROGRESSIVE DISEASE
;
run;

data adsl;
  attrib USUBJID length=$20 label='Unique Subject Identifier'
         RANDDT  length=8   format=date9. label='Date of Randomization'
         TRTSDT  length=8   format=date9. label='Date of First Exposure to Treatment'
         EOTSTT  length=$12 label='End of Treatment Status';
  set adsl_in;
  RANDDT = input(RAND_DATE, yymmdd10.);
  if missing(DCTREAS) then EOTSTT = 'ONGOING';
  else EOTSTT = 'DISCONTINUED';
  keep USUBJID RANDDT TRTSDT EOTSTT;
run;

proc contents data=adsl varnum;
run;
```

:::lines
2: `DSD` treats the empty last field on the second data line as missing, so `DCTREAS` is blank for the subject still on treatment.
3: `RAND_DATE :$10.` keeps the randomization date as text (as it arrives from the vendor); `TRTSDT :yymmdd10.` reads the dose date directly into a SAS date with an informat.
13-16: `ATTRIB` before `SET`: declares length, format and label in one place, and fixes the variable order to match the specification. The `$` in `length=$20` marks a character variable.
17: Reads the input. `USUBJID` and `TRTSDT` already have attributes from the ATTRIB statement, which takes precedence because it was the first mention.
18: `INPUT()` with the `YYMMDD10.` informat converts text to a SAS date. No automatic-conversion note appears because the conversion is explicit.
19-20: `EOTSTT` was declared as 12 characters, so `'DISCONTINUED'` is stored in full.
21: Only the specified variables are kept; the raw `RAND_DATE` text and `DCTREAS` stay behind.
:::

## Output

Expected log for the corrected step:

```log
NOTE: There were 4 observations read from the data set WORK.ADSL_IN.
NOTE: The data set WORK.ADSL has 4 observations and 4 variables.
```

And the expected log if the `LENGTH` statement had been placed after the first assignment:

```log
WARNING: Length of character variable EOTSTT has already been set.
         Use the LENGTH statement as the very first statement in the DATA STEP to declare the length of a character variable.
```

Expected `proc print data=adsl noobs; run;` output:

```output
USUBJID                    RANDDT       TRTSDT    EOTSTT

CBX417-301-1012-0001    11APR2022    14APR2022    DISCONTINUED
CBX417-301-1012-0002    02MAY2022    03MAY2022    ONGOING
CBX417-301-2031-0001    20JUN2022    22JUN2022    DISCONTINUED
CBX417-301-3044-0001    05JUL2022    06JUL2022    DISCONTINUED
```

## Interpretation

- **Truncation is silent data corruption.** No ERROR, no WARNING (in the original version), plausible-looking values. Only a comparison against an independent program, or a frequency table you read critically, reveals `'DISCONT'`.
- **A displayed date is not the stored date.** Viewers that ignore SAS formats show 22749; SAS shows 14APR2022. Both are the same value. When you export to CSV or read the data in R or Python, the format may or may not travel with the data — check.
- **Attributes are part of the deliverable.** A dataset whose values are right but whose labels, lengths or types differ from the specification fails QC and conformance checks. Treat the specification's metadata as requirements, not suggestions.

## Common mistakes

:::mistake[Letting the first assignment decide the length]
`if SEX = 'M' then SEXC = 'Male'; else SEXC = 'Female';` makes `SEXC` 4 characters long, so female subjects get `'Fema'`. Declare `length SEXC $6;` first — or, better, take lengths from the specification for every derived character variable.
:::

:::mistake[Relying on a 200-character default]
Functions such as `CATX` and `SCAN` give a new variable a length of 200 unless you declare one. The values are correct but the length is wasteful and does not match the specification; the TCG expects the maximum length actually used.
:::

:::mistake[Formatting instead of rounding]
`format BMIBL 8.1;` makes 27.5487 *print* as 27.5 while every comparison, merge key and summary statistic uses 27.5487. If the specification says "round to 1 decimal", use `ROUND(AVAL, 0.1)`.
:::

:::mistake[Letting SAS convert types]
`if LBORRES > 40` with character `LBORRES` compares after an automatic conversion, logs a conversion note, and turns values such as `'<0.5'` into missing with an "invalid numeric data" note. Convert explicitly with `INPUT()`, and decide (per the specification) what happens to non-numeric results.
:::

:::mistake[Assuming a new variable is numeric]
`LBSTRESN = LBSTRESC;` creates a **character** `LBSTRESN`, because assignment copies the type of the right-hand side. The name suggests a number; the type says otherwise. `PROC CONTENTS` settles it.
:::

:::mistake[Custom formats as the only decode]
A numeric `TRT01PN` with a user-written format looks perfect in your session and arrives as bare 1s and 2s in the submission (and in R or Python). Create the character decode variable explicitly.
:::

## Knowledge check

::quiz{ids="sas.variable-attributes.truncation-mcq,sas.variable-attributes.first-assign-length-numeric,sas.variable-attributes.format-informat-classify,sas.variable-attributes.stored-value-mcq"}

## Hands-on exercise

::practice{ids="sas.variable-attributes.attrib-code,sas.variable-attributes.put-input-mcq,sas.variable-attributes.label-40-mcq" title="Practice: set attributes from a specification"}

## Challenge exercise

::practice{ids="sas.variable-attributes.length-warning-log,sas.variable-attributes.conversion-hotspot,sas.variable-attributes.custom-format-mcq" title="Debug: truncation and silent conversions"}

## Industry note

- **Metadata-driven programming.** Many companies generate `ATTRIB` statements (or apply attributes in a final step) directly from the specification spreadsheet or define.xml metadata, so labels, lengths and order cannot drift from the spec. When you join a team, ask how attributes are applied — it tells you where to make changes.
- **Final-step checks.** Before transport files are created, typical checks include: names ≤ 8 characters, labels ≤ 40 characters, no custom formats, character lengths equal to the maximum value length, and numeric dates carrying a standard date format. Knowing *why* each check exists (the XPT v5 format and the TCG) is an interview differentiator.
- **In R and Python** the same attributes exist in different clothes: `haven` keeps SAS labels and formats as attributes on columns, and pandas has no labels at all. When data moves between languages, lengths and formats are the first things lost — another reason to check `PROC CONTENTS` after every conversion.

:::interview[A character variable in your dataset is truncated. How do you find and fix the cause?]
"First I confirm it with PROC CONTENTS — the length will be shorter than the longest expected value. Then I find the variable's first mention in the DATA step, because that's where its length is fixed at compile time: usually an assignment of a short literal, an input dataset where it's shorter, or a LENGTH statement placed after the first use, which the log flags with a 'length has already been set' warning. The fix is a LENGTH or ATTRIB statement before the first mention, with the length from the specification. Then I rerun and compare the values against QC to confirm nothing else was truncated."
:::

:::ai[If an AI assistant writes derivation code for you…]
Check the first mention of every new character variable: generated code almost never declares lengths, so its first assigned literal decides them. Also look for implicit type conversions (comparisons between character results and numbers) and for formats used where the specification asks for rounded values.
:::
