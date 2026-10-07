## What problem are we trying to solve?

The statistician is drafting the demographics table for CBX417-301 and asks you for the numbers behind it:

> "Before we program the real table: confirm ADSL has exactly one row per subject, then give me the number and percentage of men and women **in each arm**, and n, mean, SD, median, min and max of age **by arm**."

Three procedures cover this, and you will use them in nearly every program you write:

- **PROC SORT** — order the data, and find or remove duplicate keys;
- **PROC FREQ** — count subjects in categories, with percentages;
- **PROC MEANS** (and its twin **PROC SUMMARY**) — descriptive statistics for continuous variables.

Each is easy to run and easy to misread. The details that matter — which record NODUPKEY keeps, which denominator a percentage uses, why `_FREQ_` and `N` differ — are exactly the details QC and interviewers probe.

## Intuition

- **SORT** is putting the file cards in order. Once they are in order, identical keys sit next to each other — which is also the easiest moment to spot and set aside duplicates.
- **FREQ** is tallying: for every category (or combination of categories), how many rows, and what share of a total. The only real question is *which total*.
- **MEANS** is summarising a column of numbers, optionally separately for each group. It only ever uses the values that are present, and it tells you how many that was.

The printed output is for humans. For programming — building a table, QC-ing a number — you want the **output datasets** each procedure can write (`OUT=`, `OUTPUT OUT=`), because those can be merged, formatted and compared.

## Clinical context

A typical demographics table shell looks like this:

| | CBX-417 + Docetaxel (N=xx) | Placebo + Docetaxel (N=xx) | Total (N=xx) |
|---|---|---|---|
| **Age (years)** | | | |
| n | xx | xx | xx |
| Mean (SD) | xx.x (xx.xx) | xx.x (xx.xx) | xx.x (xx.xx) |
| Median | xx.x | xx.x | xx.x |
| Min, Max | xx, xx | xx, xx | xx, xx |
| **Sex, n (%)** | | | |
| Male | xx (xx.x) | xx (xx.x) | xx (xx.x) |
| Female | xx (xx.x) | xx (xx.x) | xx (xx.x) |

Every number in it comes from PROC MEANS (the continuous rows) and PROC FREQ (the categorical rows), usually via output datasets. The percentage for "Male" in an arm column is the number of men in that arm divided by the arm's **N** (the header count) — a *column percentage* when arm is the column variable. Before any of that, the subject-level dataset must have exactly one row per subject — otherwise every count is inflated — which is what the PROC SORT check establishes.

:::standard{kind="convention"}
The layout above (n, mean (SD), median, min/max; n (%) with the arm N as denominator; decimals one more than the collected precision for means and two more for SDs) is a widespread industry convention, not a regulatory requirement. The table shells in your study's SAP define the statistics, decimals and denominators.
:::

## Formal concept

### PROC SORT

```sas
proc sort data=adsl_in out=adsl nodupkey dupout=adsl_dups;
  by USUBJID;
run;
```

- `BY` lists the sort keys, ascending by default. `DESCENDING` applies **only to the variable that follows it**: `by USUBJID descending AVAL;` sorts subjects ascending and, within a subject, `AVAL` from highest to lowest.
- Without `OUT=`, PROC SORT **replaces the input dataset** with the sorted version. With `OUT=`, the input is untouched.
- Missing values sort first; character values sort by their characters' codes, so uppercase letters sort before lowercase ones (`'Male'` and `'male'` end up in different places).
- Observations with identical BY values keep their original relative order (the `EQUALS` behaviour is the default).
- **`NODUPKEY`** keeps only the **first** observation of each distinct combination of BY values and deletes the rest. Which record is "first" depends on the input order — so NODUPKEY silently chooses for you.
- **`NODUPRECS`** (alias `NODUP`) deletes an observation only if it is identical **in every variable** to the observation just before it in the sorted output. Identical records that do not end up adjacent survive.
- **`DUPOUT=`** writes the deleted observations to a separate dataset so you can see what was removed.
- The log reports what happened: `NOTE: 1 observations with duplicate key values were deleted.` (NODUPKEY) or `NOTE: 2 duplicate observations were deleted.` (NODUPRECS).

### PROC FREQ

```sas
proc freq data=adsl;
  tables SEX;                                   /* one-way table */
  tables SEX*TRT01P / norow nopercent;          /* two-way table: rows SEX, columns TRT01P */
  tables SEX*TRT01P / out=sex_cnt outpct;       /* counts and percentages as a dataset */
run;
```

- A **one-way** table lists each level with Frequency, Percent, Cumulative Frequency and Cumulative Percent (`NOCUM` removes the cumulative columns).
- A **two-way** table (`row*column`) shows in each cell the Frequency, the Percent of the grand total, the Row Pct and the Col Pct. `NOROW`, `NOCOL` and `NOPERCENT` suppress the ones you do not want.
- Missing values are excluded from the table and from every denominator, with *Frequency Missing = n* printed underneath. `MISSING` treats missing as a level and includes it in the percentages.
- `OUT=` writes the last table's counts to a dataset with variables `COUNT` and `PERCENT` (percent of total); `OUTPCT` adds `PCT_ROW` and `PCT_COL`.
- Levels appear in sorted order of the unformatted values by default (`ORDER=INTERNAL`); `ORDER=FREQ`, `ORDER=DATA` and `ORDER=FORMATTED` change that.
- `WHERE` works in PROC FREQ (and every procedure): `where SAFFL = 'Y';`.

### PROC MEANS and PROC SUMMARY

```sas
proc means data=adsl n nmiss mean std median min max maxdec=1;
  class TRT01P;
  var AGE;
  output out=agestats n=AGE_N mean=AGE_MEAN std=AGE_SD median=AGE_MED min=AGE_MIN max=AGE_MAX;
run;
```

- With no statistics requested, PROC MEANS prints **N, Mean, Std Dev, Minimum and Maximum**. Request others by keyword: `NMISS`, `MEDIAN`, `Q1`, `Q3`, `SUM`, `CLM`, …
- `STD` uses the $n-1$ divisor (the sample standard deviation). The median of an even number of values is the average of the two middle values.
- **`CLASS`** summarises each level of the class variable(s) in one table, does **not** require sorted data, and excludes observations with a missing class value unless you add the `MISSING` option. With CLASS, the printed table also shows **N Obs**, the number of observations in each level.
- **`BY`** runs a separate analysis per BY group, requires data sorted by the BY variables, and prints one table per group.
- **`OUTPUT OUT=`** writes the statistics to a dataset. With CLASS variables the output also contains:
  - `_TYPE_` — which combination of class variables the row summarises: 0 is the overall row (all observations), and with one class variable, 1 is the per-level rows. With two class variables `A B`, 1 = by `B` alone, 2 = by `A` alone, 3 = by `A*B`.
  - `_FREQ_` — the number of **observations** in that row's group, including those whose analysis variable is missing.
- **`NWAY`** keeps only the rows with the highest `_TYPE_` (every class variable used), dropping the overall and partial rows.
- **PROC SUMMARY** is the same procedure with printing turned off by default; it is used when only the output dataset is wanted. PROC MEANS with `NOPRINT` is equivalent.

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i, \qquad s = \sqrt{\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2}
$$

where $n$ is the number of **non-missing** values — the `N` column, not `_FREQ_`.

## Worked example

Twelve safety subjects, one of whom (CBX417-301-2031-0004) has no recorded age. The raw extract accidentally contains subject CBX417-301-2031-0002 **twice** (an exact duplicate row from a repeated data transfer), so it has 13 rows.

| USUBJID | TRT01P | SEX | AGE |
|---|---|---|---:|
| CBX417-301-1012-0001 | CBX-417 + Docetaxel | M | 64 |
| CBX417-301-1012-0002 | Placebo + Docetaxel | F | 71 |
| CBX417-301-1012-0003 | CBX-417 + Docetaxel | F | 58 |
| CBX417-301-1012-0004 | Placebo + Docetaxel | F | 66 |
| CBX417-301-2031-0001 | CBX-417 + Docetaxel | M | 49 |
| CBX417-301-2031-0002 | Placebo + Docetaxel | M | 62 |
| CBX417-301-2031-0002 | Placebo + Docetaxel | M | 62 |
| CBX417-301-2031-0003 | CBX-417 + Docetaxel | M | 77 |
| CBX417-301-2031-0004 | Placebo + Docetaxel | F | . |
| CBX417-301-3044-0001 | CBX-417 + Docetaxel | F | 69 |
| CBX417-301-3044-0002 | Placebo + Docetaxel | M | 55 |
| CBX417-301-3044-0003 | CBX-417 + Docetaxel | M | 61 |
| CBX417-301-3044-0004 | Placebo + Docetaxel | M | 73 |

**Step 1 — one row per subject?** `proc sort … nodupkey dupout=adsl_dups; by USUBJID;` reads 13 rows, writes 12 to `ADSL` and 1 to `ADSL_DUPS`. Because the two copies are identical, it does not matter which one is kept — but you only know that because `DUPOUT=` let you look. (Investigate *why* a duplicate exists before deleting anything in real data.)

**Step 2 — sex by arm.** From the 12 unique subjects:

| SEX | CBX-417 + Docetaxel | Placebo + Docetaxel | Total |
|---|---:|---:|---:|
| F | 2 (33.3%) | 3 (50.0%) | 5 |
| M | 4 (66.7%) | 3 (50.0%) | 7 |
| Total | 6 | 6 | 12 |

:::number[Where does 66.7% come from?]
4 men among the 6 subjects in the CBX-417 arm: 4/6 = 66.67%. This is the *column* percentage in `tables SEX*TRT01P` (arm is the column variable). The *overall* percent for the same cell is 4/12 = 33.33%, and the *row* percent is 4/7 = 57.14% (the share of all men who are in the CBX-417 arm). A demographics table uses the arm N as denominator, so it needs the column percentage here.
:::

**Step 3 — age by arm.**

| Arm | N Obs | N | N Miss | Mean | SD | Median | Min | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CBX-417 + Docetaxel | 6 | 6 | 0 | 63.0 | 9.57 | 62.5 | 49 | 77 |
| Placebo + Docetaxel | 6 | 5 | 1 | 65.4 | 7.23 | 66.0 | 55 | 73 |

:::number[Where do mean 65.4 and median 66.0 for placebo come from?]
The placebo ages are 71, 66, 62, (missing), 55, 73. Only 5 are present: sum = 327, and 327/5 = 65.4. Sorted: 55, 62, 66, 71, 73, so the median is the middle (3rd) value, 66. For CBX-417 (6 values: 49, 58, 61, 64, 69, 77), the median is the average of the 3rd and 4th values, (61 + 64)/2 = 62.5, and the mean is 378/6 = 63.0.
:::

:::number[Why is N Obs 6 but N 5 for placebo?]
N Obs (and `_FREQ_` in the output dataset) counts **observations** in the group — 6 placebo subjects. N counts **non-missing values of AGE** — 5. The difference is the subject with a missing age. A demographics table reports n = 5 under the placebo column, while the column header N stays 6.
:::

## Data example

In the real CBX417-301 ADSL, the same three questions apply to all randomized subjects. Look at the first rows and note the variables a demographics table uses:

::dataset{id="oncology/adam/adsl" cols="USUBJID,TRT01P,TRT01A,SAFFL,SEX,AGE,AGEGR1,RACE" rows="12" filter="SAFFL=Y" caption="ADSL — safety population, variables used for demographics"}

Safety tables usually summarise by **actual** treatment (`TRT01A`), efficacy tables by **planned** treatment (`TRT01P`); for most subjects they are the same, and the few who differ (dispensing errors, randomized but never treated) are exactly the ones worth checking in your counts.

## Code

```sas title="demog_numbers.sas"
proc sort data=adsl_in out=adsl nodupkey dupout=adsl_dups;
  by USUBJID;
run;

proc freq data=adsl;
  tables SEX*TRT01P / norow nopercent;
  tables SEX*TRT01P / noprint out=sex_cnt outpct;
run;

proc means data=adsl n nmiss mean std median min max maxdec=1;
  class TRT01P;
  var AGE;
  output out=agestats n=AGE_N mean=AGE_MEAN std=AGE_SD
         median=AGE_MED min=AGE_MIN max=AGE_MAX;
run;

proc print data=agestats noobs;
  format AGE_MEAN AGE_SD 8.3 AGE_MED 5.1;
run;
```

:::lines
1: Sorts into a new dataset (the raw input is untouched), keeps the first record per `USUBJID` and writes the deleted duplicates to `ADSL_DUPS`.
2: The key that must be unique in a subject-level dataset.
5: No `WHERE` is needed here because all 12 are safety subjects; in a real program you would add `where SAFFL = 'Y';`.
6: Printed crosstab with rows = sex, columns = arm; only Frequency and Col Pct are shown in each cell.
7: The same table as a dataset: `COUNT`, `PERCENT`, and with `OUTPCT` also `PCT_ROW` and `PCT_COL`. `NOPRINT` on the TABLES statement suppresses printing for this table only.
10: Requests the statistics explicitly, including NMISS; `MAXDEC=1` controls printed decimals only.
11: One summary per arm, in one table; no sorting needed.
13-14: Writes the statistics to `WORK.AGESTATS`, naming each output variable.
17-19: Prints the output dataset; the FORMAT statement controls decimals in the listing.
:::

::::tabs
:::tab[SAS]
```sas
proc means data=adsl n mean std median min max;
  class TRT01P;
  var AGE;
run;
```
:::
:::tab[R]
```r
library(dplyr)
adsl |>
  group_by(TRT01P) |>
  summarise(n = sum(!is.na(AGE)), mean = mean(AGE, na.rm = TRUE),
            sd = sd(AGE, na.rm = TRUE), median = median(AGE, na.rm = TRUE),
            min = min(AGE, na.rm = TRUE), max = max(AGE, na.rm = TRUE))
```
:::
:::tab[Python]
```python
(adsl.groupby("TRT01P")["AGE"]
     .agg(["count", "mean", "std", "median", "min", "max"]))
```
:::
::::

:::note[Same statistics, different defaults]
R's `mean()` and `sd()` return `NA` if any value is missing unless you pass `na.rm = TRUE`; pandas skips missing values by default and its `count` is the number of non-missing values (SAS's N). All three use the $n-1$ divisor for the SD. Quartiles are where they differ: PROC MEANS uses its percentile definition 5 by default and R's `quantile()` uses type 7, so Q1 and Q3 can disagree between a SAS production program and an R QC program even when both are correct. Agree on the definition before comparing.
:::

## Output

Expected log (abridged):

```log
NOTE: There were 13 observations read from the data set WORK.ADSL_IN.
NOTE: 1 observations with duplicate key values were deleted.
NOTE: The data set WORK.ADSL has 12 observations and 4 variables.
NOTE: The data set WORK.ADSL_DUPS has 1 observations and 4 variables.
NOTE: There were 12 observations read from the data set WORK.ADSL.
NOTE: The data set WORK.SEX_CNT has 4 observations and 6 variables.
NOTE: There were 12 observations read from the data set WORK.ADSL.
NOTE: The data set WORK.AGESTATS has 3 observations and 9 variables.
```

:::number[Why does AGESTATS have 3 observations, not 2?]
Without `NWAY`, the output includes the overall row (`_TYPE_ = 0`, all 12 subjects) plus one row per arm (`_TYPE_ = 1`). 9 variables: `TRT01P`, `_TYPE_`, `_FREQ_` and the six statistics. `SEX_CNT` has 4 rows (2 sexes × 2 arms) and 6 variables: `SEX`, `TRT01P`, `COUNT`, `PERCENT`, `PCT_ROW`, `PCT_COL`.
:::

Expected crosstab (layout approximate):

```output
                     Table of SEX by TRT01P

     SEX       TRT01P

     Frequency|
     Col Pct  |CBX-417 +|Placebo +|  Total
              |Docetaxel|Docetaxel|
     ---------+---------+---------+
     F        |      2  |      3  |      5
              |  33.33  |  50.00  |
     ---------+---------+---------+
     M        |      4  |      3  |      7
              |  66.67  |  50.00  |
     ---------+---------+---------+
     Total           6         6        12
```

Expected PROC MEANS output:

```output
                          The MEANS Procedure

                         Analysis Variable : AGE

TRT01P                N Obs    N   N Miss    Mean   Std Dev   Median   Minimum   Maximum
-----------------------------------------------------------------------------------------
CBX-417 + Docetaxel       6    6        0    63.0       9.6     62.5      49.0      77.0
Placebo + Docetaxel       6    5        1    65.4       7.2     66.0      55.0      73.0
-----------------------------------------------------------------------------------------
```

Expected listing of `WORK.AGESTATS`:

```output
TRT01P                 _TYPE_   _FREQ_   AGE_N   AGE_MEAN   AGE_SD   AGE_MED   AGE_MIN   AGE_MAX

                          0       12       11     64.091    8.264      64.0       49        77
CBX-417 + Docetaxel       1        6        6     63.000    9.571      62.5       49        77
Placebo + Docetaxel       1        6        5     65.400    7.232      66.0       55        73
```

:::number[Where does the overall mean 64.091 come from?]
All 11 non-missing ages: 378 (CBX-417) + 327 (placebo) = 705, and 705/11 = 64.091. The overall median is the 6th of the 11 sorted values (49, 55, 58, 61, 62, **64**, 66, 69, 71, 73, 77). This `_TYPE_ = 0` row is what a "Total" column would use.
:::

## Interpretation

- **The de-duplication was a finding, not a fix.** One subject appeared twice in the extract. Before trusting anything downstream, someone must explain why (a repeated transfer here). In a clinical dataset, a duplicated subject in a subject-level dataset is a data issue to report, not something to delete quietly.
- **Denominators are part of the result.** 66.7% of the CBX-417 arm is male; 57.1% of all men are in the CBX-417 arm; 33.3% of all subjects are men in the CBX-417 arm. All three are correct answers to different questions. The table shell tells you which one is wanted.
- **n is reported because missing data exist.** The placebo mean (65.4) is based on 5 subjects, not 6. Reporting "N = 6, mean 65.4" without n would hide that.

## Common mistakes

:::mistake[Using NODUPKEY to make a problem disappear]
`nodupkey` on the wrong key (for example `by USUBJID` on an AE dataset) deletes every AE except the first for each subject, with only a one-line NOTE in the log. Always use `DUPOUT=` and look at what was removed, and never de-duplicate on a key you have not confirmed should be unique.
:::

:::mistake[Expecting NODUPRECS to find all identical records]
NODUPRECS compares each record only with the one just before it. If you sort by `USUBJID` alone, two identical AE records of the same subject can be separated by a different record and both survive. Sort by all variables (`by _all_;`) when the goal is to remove exact duplicates.
:::

:::mistake[Sorting in place]
`proc sort data=sdtm.ae; by USUBJID AESTDTC; run;` rewrites the SDTM dataset (or fails if the library is read-only). Sort into WORK with `OUT=`.
:::

:::mistake[BY without sorting]
`proc means data=adsl; by TRT01P; …` on unsorted data stops with an ERROR that the data set is not sorted in ascending sequence. Either sort first or use `CLASS`, which does not need sorted data.
:::

:::mistake[Stacking OUTPUT OUT= results without handling _TYPE_]
Without `NWAY`, the output dataset contains the overall row too. Appending it to other summaries or merging it by arm can double the totals. Use `NWAY`, or subset on `_TYPE_` deliberately.
:::

:::mistake[Confusing _FREQ_ with N]
`_FREQ_` counts observations in the group; `N` counts non-missing values of the analysis variable. Use N for the "n" row of a table.
:::

:::mistake[Losing subjects with a missing CLASS value]
Subjects with a blank class variable (for example a blank `TRT01A` for a randomized subject who was never treated) silently disappear from CLASS summaries. Decide whether they belong in the table; if so, fix the derivation or use `MISSING`.
:::

## Knowledge check

::quiz{ids="sas.sort-freq-means.nodupkey-vs-noduprecs-mcq,sas.sort-freq-means.descending-mcq,sas.sort-freq-means.colpct-numeric,sas.sort-freq-means.freq-vs-n-mcq,sas.sort-freq-means.type-mcq"}

## Hands-on exercise

::practice{ids="sas.sort-freq-means.demog-code,sas.sort-freq-means.dupout-code,sas.sort-freq-means.class-missing-mcq" title="Practice: the numbers behind a demographics table"}

## Challenge exercise

::practice{ids="sas.sort-freq-means.noduprecs-diff,sas.sort-freq-means.by-unsorted-log" title="QC and debug: duplicates and BY groups"}

## Industry note

- **Production versus presentation.** In production code, statistics are computed once into datasets (OUT=, OUTPUT OUT=, or ODS OUTPUT), then rounded, formatted and arranged by the reporting step (usually PROC REPORT). Rounding happens once, at the end, according to the shell.
- **ODS OUTPUT** captures any table a procedure prints (for example `ods output CrossTabFreqs=ct;` in PROC FREQ), which is how you get statistics that have no OUT= option. You will use it heavily for p-values and model estimates.
- **QC with a different method.** If production uses PROC MEANS, QC may use PROC SQL, PROC UNIVARIATE or R. Agreeing on definitions (denominators, quartile method, how missing values are counted) before comparing saves days of false discrepancies.
- **Key uniqueness is checked, not assumed.** Before merging or summarising, confirm the key: one row per `USUBJID` in ADSL, per `USUBJID AESEQ` in AE, per `USUBJID PARAMCD AVISITN` (plus analysis flags) in a BDS dataset. A NODUPKEY with DUPOUT, or the FIRST./LAST. check from the BY-group lesson, takes a minute and prevents the most expensive mistakes.

:::interview[How would you produce and check the numbers for a demographics table in SAS?]
"I'd start from ADSL restricted to the population in the shell, usually `SAFFL = 'Y'` or `ITTFL = 'Y'`, after confirming it has one row per subject. For continuous variables like age I'd run PROC MEANS or SUMMARY with a CLASS statement on the treatment variable, requesting n, mean, SD, median, min and max into an output dataset, using NWAY or handling `_TYPE_` for the total column. For categorical variables I'd use PROC FREQ with OUT= and OUTPCT, making sure the percentage denominator is the arm N from the header and deciding how missing values are shown. Then a reporting step rounds and arranges the results. To check, I'd verify the header Ns against the population counts, that category counts add up to N (including a missing row if present), and compare against an independent QC program — often SQL or R — with agreed definitions for things like quartiles."
:::

:::ai[If an AI assistant writes these procedure calls for you…]
Check the denominators (row vs column percent), whether missing class values or missing categories are silently dropped, whether a BY statement is used on unsorted data, and whether NODUPKEY is applied on a key that is not supposed to be unique. Generated code often uses NODUPKEY as a generic "clean-up" step — treat that as a red flag.
:::
