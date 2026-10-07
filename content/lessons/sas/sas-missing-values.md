## What problem are we trying to solve?

Three messages land in your inbox on the same day:

1. **Data management:** "Your eligibility listing flags two CBX417-301 subjects as *under 18*. Their birth years were never entered — they have no age at all. Why are they listed?"
2. **The statistician:** "The demographics draft shows 6 subjects under 65 and 4 aged 65 or older, but QC has 4, 4 and 2 *missing*. Which is right?"
3. **The tumor-response reviewer:** "Subject 1012-0001 shows a 35% decrease in the sum of target lesion diameters at Week 6 — a partial response. But one of the three target lesions wasn't measured at that scan."

All three are the same problem: **how SAS represents, compares and propagates missing values** — and how easy it is to write code that silently turns "unknown" into a real-looking value. In clinical data, missing values are everywhere (partial dates, assessments not done, subjects without baseline), so this lesson is less about syntax than about habits that keep "unknown" visible.

## Intuition

Think of a missing numeric value as a **special marker that SAS treats as smaller than every number** — lower than −1,000,000 — whenever it has to compare or sort. Most surprises follow from that one fact:

- `AGE < 18` asks "is this value below 18?" For a missing age, SAS answers **yes**.
- Sorting puts missing values **first**.
- `AGE >= 65` is **no** for a missing age, so an `else` branch catches it.

The second idea is about arithmetic. **Operators propagate** missing values (`30 + . + 14` is missing, because the total is unknown), while **most statistical functions skip them** (`sum(30, ., 14)` is 44, the sum of what is known). Neither behaviour is right or wrong in general; each is right for some questions. Your job is to choose deliberately.

## Clinical context

| Where missing values appear | Why it matters |
|---|---|
| Age, weight, height at baseline | subgroup assignment, BMI, dosing (BSA) |
| Lab and vital-sign results not collected or not done | baseline flags, change from baseline, shift tables |
| Partial or unknown dates (AE start, diagnosis) | treatment-emergence, study days, "first" records |
| Target lesion not measured at a scan | sum of diameters, response assessment |
| AE grade or causality not recorded | "worst grade" and "related" tables |

Tables usually make missing data visible — a "Missing" row in a demographics table, "n" (the number of non-missing values) above the mean. Programs must therefore keep missing values **distinct** from real values all the way through. In SDTM, the reason a planned assessment was not done is recorded with variables such as `--STAT = "NOT DONE"` and `--REASND` rather than with special codes in the result.

:::standard{kind="official" source="RECIST 1.1 (Eisenhauer et al., Eur J Cancer 2009)"}
RECIST 1.1 addresses incomplete assessments explicitly: if only some target lesions are measured at a time point, that time point is usually considered not evaluable (NE), unless it can be argued convincingly that the missing lesion(s) could not change the response assigned — most often when progression is already established. Your SAP and response-derivation specification apply these rules; the point for programmers is that a sum over the lesions that happen to be available is **not** the RECIST sum.
:::

## Formal concept

### How missing values are represented

| Type | Missing value | How you write it in code |
|---|---|---|
| Numeric | `.` (a period) | `AVAL = .;` |
| Numeric, special | `.A` … `.Z` and `._` | `LBSTRESN = .N;` |
| Character | a blank string | `AVALC = ' ';` or `AVALC = '';` |

**Special missing values** let you record *why* a numeric value is missing (for example `.N` for not done and `.U` for unknown) while every procedure still treats them as missing. To read them from raw data with `INPUT`, declare the letters first with a `MISSING` statement (`missing N U;`), so that a data value `N` in a numeric field becomes `.N`. They exist only in SAS — CSV files, R and Python have no equivalent — so they rarely survive outside SAS.

### Comparison and sort order

SAS orders numeric values like this:

$$
\texttt{.\_} < \texttt{.} < \texttt{.A} < \texttt{.B} < \dots < \texttt{.Z} < \text{any negative number} < 0 < \text{any positive number}
$$

So, for a missing `AGE`:

| Expression | Result for `AGE = .` |
|---|---|
| `AGE < 18` | true |
| `AGE >= 65` | false |
| `AGE = .` | true |
| `AGE = .N` | false — `.` and `.N` are different values |
| `missing(AGE)` | true (also true for `.N`, `.A`, …) |
| `AGE > .Z` | false — a common idiom for "is non-missing" |

Blank character values sort before letters and digits too. In a condition, a missing numeric value counts as **false** (`if AVAL then …` is false for `0` and for `.`).

Always test with `missing(x)` (or `not missing(x)`) rather than `x = .`: it works for both types and for every special missing value.

### Operators propagate, functions skip

| Code | L1 = 30, L2 = ., L3 = 14 | Behaviour |
|---|---:|---|
| `L1 + L2 + L3` | . | any missing operand → missing result, and a NOTE in the log |
| `sum(L1, L2, L3)` | 44 | ignores missing arguments; missing only if **all** are missing |
| `sum(0, L1, L2, L3)` | 44 | the `0` guarantees a result of 0 instead of missing when all are missing |
| `mean(L1, L2, L3)` | 22 | mean of the non-missing values: (30 + 14)/2 |
| `n(L1, L2, L3)` | 2 | number of non-missing numeric arguments |
| `nmiss(L1, L2, L3)` | 1 | number of missing numeric arguments |
| `cmiss(L1, L2, SEX)` | depends | number of missing arguments of **any** type |
| `min(L1, L2, L3)` | 14 | ignores missing (the *comparison* `L2 < L1` does not) |

Variable lists work in these functions: `sum(of LES1-LES5)`, `nmiss(of LES1-LES5)`.

When an operator meets a missing operand, the log records it — with the number of occurrences and the line and column of the operation:

```log
NOTE: Missing values were generated as a result of performing an operation on missing values.
      Each place is given by: (Number of times) at (Line):(Column).
      1 at 27:22
```

This note is sometimes expected (change from baseline cannot be computed for a subject without a baseline) and sometimes a bug. A clean log either removes it (by handling missing values explicitly, e.g. `if not missing(BASE) then CHG = AVAL - BASE;`) or documents why it is expected.

### Missing values in procedures

- `PROC MEANS` excludes missing values from every statistic; `N` counts non-missing values and `NMISS` counts missing ones.
- `PROC FREQ` leaves missing values out of the table and the percentages, and prints *Frequency Missing = n* underneath. The `MISSING` option makes missing a regular level, included in the denominators.
- `PROC SORT` puts missing values first.
- `CLASS` variables with missing values are excluded from `PROC MEANS` summaries unless you add the `MISSING` option.

## Worked example

### Part 1 — age: comparisons and IF-THEN/ELSE

Ten subjects; two have no recorded age:

| Subject | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AGE | 64 | 71 | . | 58 | 66 | 49 | . | 77 | 55 | 69 |

**The eligibility check** `if AGE < 18 then output underage;` outputs **2** subjects — subjects 3 and 7 — because missing is smaller than 18. No subject is actually under 18.

**The naive age group**

```sas
if AGE >= 65 then AGEGR1 = '>=65';
else AGEGR1 = '<65';
```

gives `'>=65'` for 71, 66, 77, 69 (4 subjects) and `'<65'` for the other **6** — including the two unknown ages. The correct classification has 4, 4 and 2 missing.

:::number[Where do 6 and 4 come from?]
Ages ≥ 65: 71, 66, 77, 69 → 4. Everyone else reaches the ELSE: 64, 58, 49, 55 (4 real ages) plus the 2 missing ones → 6. The statistician's "6 under 65" is therefore 4 real subjects plus 2 unknowns — a silent misclassification that no log message reports.
:::

**Summary statistics** of `AGE` with `PROC MEANS`: N = 8, NMISS = 2, mean = 63.6, SD = 9.16, median = 65.0, min = 49, max = 77.

:::number[Where do mean 63.6 and median 65.0 come from?]
Only the 8 non-missing ages enter: sum = 64 + 71 + 58 + 66 + 49 + 77 + 55 + 69 = 509, and 509 / 8 = 63.625. Sorted: 49, 55, 58, 64, 66, 69, 71, 77; with an even count the median is the average of the 4th and 5th values, (64 + 66)/2 = 65. The SD uses the n − 1 divisor: 9.164. Nothing was imputed — which is exactly why a demographics table reports **n** next to the mean.
:::

### Part 2 — sum of target lesion diameters

Subject 1012-0001 has three target lesions:

| Visit | LES1 | LES2 | LES3 | `LES1+LES2+LES3` | `sum(of LES1-LES3)` |
|---|---:|---:|---:|---:|---:|
| Baseline | 32 | 21 | 15 | 68 | 68 |
| Week 6 | 30 | . | 14 | . | 44 |

With `SUM()`, the Week 6 percentage change from baseline is (44 − 68)/68 × 100 = **−35.3%**, which crosses the −30% threshold for a partial response. But the decrease is manufactured: lesion 2 was simply not measured. Had it stayed at 21 mm, the sum would be 65 and the change −4.4% — stable disease.

:::number[Where does −35.3% come from, and why is it wrong?]
44 is the sum of only the two measured lesions (30 + 14); 68 is the baseline sum of all three. Comparing a two-lesion sum with a three-lesion sum makes the tumor look smaller by roughly the size of the missing lesion. The `+` operator returns missing for Week 6, which correctly signals that the sum is unknown; the time point is then handled by the RECIST rules for incomplete assessments.
:::

The defensible derivation makes the rule explicit:

```sas
if nmiss(of LES1-LES3) = 0 then SUMDIAM = sum(of LES1-LES3);
else SUMDIAM = .;
```

### Part 3 — special missing values

A raw vital-signs file records systolic blood pressure, with `N` where the measurement was not done:

```sas
missing N;
data vs_raw;
  input USUBJID :$20. VISIT :$12. SYSBP;
  datalines;
CBX417-301-1012-0001 SCREENING 128
CBX417-301-1012-0001 C2D1      N
CBX417-301-1012-0001 C3D1      .
;
run;
```

`SYSBP` is 128, `.N` and `.`. The test `if SYSBP = .` is true only for the third record; `missing(SYSBP)` is true for both the second and third. `PROC MEANS` reports N = 1 and NMISS = 2 — procedures treat every special missing value as missing.

## Code

```sas title="missing_values.sas"
data dm;
  input SUBJ AGE;
  datalines;
1 64
2 71
3 .
4 58
5 66
6 49
7 .
8 77
9 55
10 69
;
run;

data underage agegrp;
  set dm;
  length AGEGR1 $4;
  if not missing(AGE) and AGE < 18 then output underage;
  if missing(AGE) then AGEGR1 = ' ';
  else if AGE >= 65 then AGEGR1 = '>=65';
  else AGEGR1 = '<65';
  output agegrp;
run;

proc means data=dm n nmiss mean std median min max maxdec=1;
  var AGE;
run;

proc freq data=agegrp;
  tables AGEGR1 / missing;
run;
```

:::lines
17: Two output datasets: a check listing and the analysis dataset.
19: Declares the length before the first assignment of `AGEGR1`.
20: The eligibility check guarded against missing values: only real ages below 18 are listed (none here).
21: Missing age handled **first**, so it can never fall through to a numeric category.
22-23: The remaining ages are non-missing, so the ELSE is now safe.
24: Every subject goes to `AGEGRP`, one row per subject.
27-29: Requests N and NMISS explicitly so that the missing count is visible next to the statistics. `MAXDEC=1` limits displayed decimals.
31-33: `MISSING` makes the blank age group a level of its own and includes it in the percentages.
:::

## Output

Expected `PROC MEANS` output:

```output
                        The MEANS Procedure

                       Analysis Variable : AGE

      N    N Miss      Mean    Std Dev     Median    Minimum    Maximum
  ---------------------------------------------------------------------
      8         2      63.6        9.2       65.0       49.0       77.0
  ---------------------------------------------------------------------
```

Expected `PROC FREQ` output with the `MISSING` option:

```output
                                      Cumulative    Cumulative
AGEGR1     Frequency     Percent       Frequency       Percent
----------------------------------------------------------------
                  2        20.00               2         20.00
<65               4        40.00               6         60.00
>=65              4        40.00              10        100.00
```

:::number[Why 20.00, 40.00, 40.00 — and what would change without MISSING?]
With `MISSING`, the denominator is all 10 subjects: 2/10 = 20%, 4/10 = 40%. Without it, the blank row disappears, the denominator becomes the 8 subjects with an age group (4/8 = 50.00% each), and a footnote reports *Frequency Missing = 2*. Which denominator a table uses is decided by the table shell — but either way the missing subjects must be accounted for.
:::

## Interpretation

- **Missing is not a value in any category.** A subject without an age is neither under 65 nor over 65. Code that forces every subject into a category is making an assumption the data do not support.
- **"Sum of what is there" and "total" are different quantities.** `SUM()` answers the first; `+` answers the second (by refusing when a part is unknown). The clinical question decides which one you need; for RECIST sums, the total over all target lesions is what is defined.
- **The most dangerous missing-value bugs are silent.** The `+` operator writes a NOTE when it meets a missing value; comparisons and ELSE branches never do. That is why missing values are handled explicitly and first, not left to fall through.

## Common mistakes

:::mistake[Testing only `x = .`]
`if LBSTRESN = . then …` misses `.N`, `.U` and every other special missing value. Use `missing(LBSTRESN)`.
:::

:::mistake[Unguarded less-than comparisons]
`if AGE < 18`, `if AVAL < ANRLO` (flags a missing lab result as *low*), `if ASTDT < TRTSDT` (a missing onset date counts as *before* treatment, making the AE non-emergent). Guard every less-than comparison with `not missing(…)`, or decide explicitly what a missing value should mean.
:::

:::mistake[A catch-all ELSE]
`else AGEGR1 = '<65';` and `else BMICAT = 'OBESE';` silently absorb missing values. Test `missing(…)` first.
:::

:::mistake[Replacing `+` with `SUM()` just to silence the log]
The "Missing values were generated" note is an invitation to think, not an error to hide. Switching to `SUM()` removes the note and changes the meaning: an unknown total becomes a partial total.
:::

:::mistake[Forgetting that PROC FREQ drops missing by default]
A frequency table without the `MISSING` option quietly uses a smaller denominator. Check the *Frequency Missing* footnote, and follow the table shell for which denominator to report.
:::

:::mistake[Translating SAS logic literally into R, Python or SQL]
In SAS, `AGE < 18` is true for a missing age. In R it is `NA` (and `filter()` drops the row), in pandas it is `False`, and in standard SQL it is unknown (the row is excluded). PROC SQL follows SAS rules, not ANSI rules. The same condition can select different subjects in different languages.
:::

## Knowledge check

::quiz{ids="sas.missing-values.lt-18-mcq,sas.missing-values.sort-order,sas.missing-values.sum-vs-plus-mcq,sas.missing-values.special-missing-mcq"}

## Hands-on exercise

::practice{ids="sas.missing-values.agegr-code,sas.missing-values.completeness-code,sas.missing-values.means-numeric" title="Practice: keep missing values visible"}

## Challenge exercise

::practice{ids="sas.missing-values.sld-hotspot,sas.missing-values.agegr-diff,sas.missing-values.crosswalk-mcq" title="Debug and QC: when missing becomes a value"}

## Industry note

- **Specifications should say what happens to missing data** — for every derived variable. When they do not ("derive AGEGR1 from AGE"), ask. A question such as "should subjects with missing age appear as a Missing category or be excluded from the denominator?" is exactly what a lead wants to hear from a new programmer.
- **QC programmers deliberately test edge cases:** subjects with missing baseline, all-missing lesion measurements, missing dates. If your code has never met a missing value, it has not been tested.
- **Imputation is an analysis decision, not a programming convenience.** Carrying values forward, replacing missing with zero, or averaging available values all change results. They belong in the SAP, and the imputed records are flagged in ADaM (e.g., `DTYPE`) so they remain traceable.

:::interview[How does SAS handle missing values, and where can that bite you in clinical programming?]
"Numeric missing is a period, character missing is blank, and there are special missing values .A to .Z and ._ for recording reasons. In comparisons and sorting, a numeric missing value is smaller than any number, so `AGE < 18` is true for a missing age and missing values sort first — which affects FIRST. selection and 'less than' flags like low lab values or AE onset before treatment. Arithmetic operators propagate missing and write a note in the log, while functions like SUM and MEAN ignore missing arguments — which matters for things like the RECIST sum of diameters, where summing only the available lesions creates a fake decrease. Procedures exclude missing values: PROC MEANS reports N and NMISS, and PROC FREQ drops them unless you use the MISSING option. My habit is to handle missing values first and explicitly in every derivation, and to use `missing()` rather than `= .`."
:::

:::ai[If an AI assistant writes a derivation for you…]
Search the code for `<`, `<=`, `else`, `sum(` and `= .`. Generated code often uses `sum()` to avoid log notes, ends classifications with a catch-all `else`, and tests `= .` instead of `missing()`. Then run it on a record where every input is missing and check the result is what the specification requires.
:::
