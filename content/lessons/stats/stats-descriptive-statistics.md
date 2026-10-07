## What problem are we trying to solve?

You have produced Table 14.1.2, *Demographic and Baseline Characteristics*, for the VTX-221 hypertension trial. Your QC colleague reran it in R and sends you a message:

> "N, mean, SD, median, min and max all match. But Q1 and Q3 disagree in four cells — for example placebo age Q3 is 64.0 in your table and 63.5 in mine. Which one is wrong?"

Neither program is wrong. SAS and R use **different definitions of a quartile** by default, and with real data they give different answers in some cells. You need to know that before you spend an afternoon hunting for a bug that does not exist — and you need to know which definition your shell or SAP requires.

The same table raises bigger questions a statistician must answer, not just a programmer:

- Why do we show mean *and* SD for age but median and quartiles for some lab values?
- What does an SD of 9.4 mmHg actually tell a clinician about baseline blood pressure?
- If one subject has an ALT of 112 U/L, which summaries move and which do not?

Descriptive statistics look simple, and that is exactly why interviewers use them: a candidate who can explain *why* a table uses median (Q1, Q3), and who knows that "quartile" has several definitions, has clearly produced real tables.

## Intuition

A descriptive statistic compresses a column of numbers into one or two numbers that answer a question:

- **Where is the middle?** The **mean** is the balance point — every value pulls on it, so one extreme value can drag it a long way. The **median** is the middle value in sorted order — it only cares about *ranks*, so an extreme value barely moves it.
- **How spread out are the values?** The **standard deviation** is roughly "the typical distance of a value from the mean", measured in the original units (mmHg, years, U/L). The **interquartile range** (Q3 − Q1) is the width of the middle half of the data.
- **Is the distribution symmetric?** When mean ≈ median, the data are roughly symmetric. When the mean is much larger than the median, a long right tail (a few large values) is pulling the mean up — typical of liver enzymes, CRP, triglycerides, viral loads and most pharmacokinetic concentrations.

Quartiles are the one place where intuition is not enough. With ten values, "the value below which 25% of the data lie" falls *between* the 2nd and 3rd sorted values. Different software packages resolve "between" differently: pick the next observation, average two observations, or interpolate. That single design choice is the whole SAS-versus-R quartile story.

## Clinical context

Descriptive statistics fill the first tables of every clinical study report:

| Table | Typical summaries | Why |
|---|---|---|
| Demographics and baseline characteristics | n, mean, SD, median, Q1, Q3 (or min, max) for continuous; n (%) for categorical | Shows the arms were comparable at baseline and who the results apply to |
| Change from baseline in vital signs by visit | n, mean, SD, median, min, max of `AVAL` and `CHG` | Describes trajectories before any model is fitted |
| Laboratory summaries | median (Q1, Q3) or geometric mean for skewed parameters; shift tables | Liver enzymes and inflammatory markers are right-skewed |
| Pharmacokinetic parameters | geometric mean and geometric CV% for Cmax, AUC | PK parameters are approximately log-normal |
| Exposure and compliance | mean, SD, median, min, max of duration and compliance | Duration is often skewed by early discontinuations |

Two practical consequences for your career:

1. **Statistical programmers** produce these tables daily and must match the shell exactly — including the quartile definition and the number of decimals.
2. **Biostatisticians** choose the summaries in the SAP and must defend them: "median (Q1, Q3) for ALT because the distribution is right-skewed" is a sentence you should be able to say and justify.

## Formal concept

For values $x_1, \dots, x_n$ with sorted values $x_{(1)} \le \dots \le x_{(n)}$:

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i
\qquad
s = \sqrt{\frac{1}{n-1}\sum_{i=1}^{n}\left(x_i - \bar{x}\right)^2}
$$

The divisor $n-1$ (not $n$) makes $s^2$ an unbiased estimator of the population variance: one degree of freedom was "used up" estimating the mean. SAS (`VARDEF=DF`, the default), R `sd()`, Excel `STDEV.S` and pandas `.std()` all use $n-1$. NumPy's `np.std()` uses $n$ unless you pass `ddof=1` — a classic source of tiny QC mismatches.

### Quantile definitions

The $p$-th quantile $Q_p$ ($p = 0.25$ for Q1, $0.5$ for the median, $0.75$ for Q3) has several textbook definitions. The two you will meet constantly:

**SAS default** — `PCTLDEF=5` in PROC UNIVARIATE, `QNTLDEF=5` in PROC MEANS/SUMMARY ("empirical distribution function with averaging"). Write $np = j + g$, where $j$ is the integer part and $g$ the fractional part:

$$
Q_p =
\begin{cases}
\tfrac{1}{2}\left(x_{(j)} + x_{(j+1)}\right) & \text{if } g = 0 \\[4pt]
x_{(j+1)} & \text{if } g > 0
\end{cases}
$$

**R, NumPy and pandas default** — R `quantile(type = 7)`, NumPy/pandas `method="linear"`, Excel `QUARTILE.INC`. Linear interpolation between order statistics:

$$
h = (n-1)p + 1, \qquad
Q_p = x_{(\lfloor h \rfloor)} + \left(h - \lfloor h \rfloor\right)\left(x_{(\lfloor h \rfloor + 1)} - x_{(\lfloor h \rfloor)}\right)
$$

R's `quantile(x, type = 2)` implements exactly the SAS default. In Python, `np.quantile(x, 0.25, method="averaged_inverted_cdf")` does the same.

:::why[Why do all the definitions agree on the median?]
For the median, $p = 0.5$. With even $n$, $np$ is an integer, so the SAS rule averages the two middle values; type 7 gives $h = (n+1)/2$, halfway between the same two values, so it averages them too. With odd $n$ both rules return the middle value. The definitions only diverge when $p$ lands strictly between two order statistics in different ways — which is why **medians match and quartiles do not**.
:::

### Skewed data: geometric summaries

When values are positive and right-skewed (roughly log-normal), summarize on the log scale and transform back:

$$
\text{GM} = \exp\!\left(\frac{1}{n}\sum_{i=1}^{n} \ln x_i\right),
\qquad
\text{geometric CV\%} = 100\sqrt{e^{s_{\ln}^2} - 1}
$$

where $s_{\ln}$ is the SD of $\ln x_i$. The geometric mean is always less than or equal to the arithmetic mean and is much less sensitive to a single large value.

## Worked example

Alanine aminotransferase (ALT, U/L) at screening for ten subjects, already sorted:

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| ALT | 14 | 17 | 18 | 21 | 22 | 25 | 29 | 33 | 48 | 112 |

**Mean.** The sum is $14 + 17 + \dots + 112 = 339$, so $\bar{x} = 339 / 10 = 33.9$ U/L.

**Median.** $n = 10$ is even, so the median is the average of the 5th and 6th values: $(22 + 25)/2 = 23.5$ U/L.

:::number[Why is the mean (33.9) so much larger than the median (23.5)?]
One subject has ALT = 112 U/L. Remove that value and the mean of the remaining nine is $227/9 = 25.2$ while the median becomes 22 — the mean moved by 8.7 U/L, the median by 1.5 U/L. A mean far above the median is the numeric signature of a long right tail.
:::

**Standard deviation.** $\sum x_i^2 = 19{,}137$ and $n\bar{x}^2 = 10 \times 33.9^2 = 11{,}492.1$, so the sum of squared deviations is $19{,}137 - 11{,}492.1 = 7{,}644.9$. Dividing by $n - 1 = 9$ gives the variance 849.43, and $s = \sqrt{849.43} = 29.15$ U/L.

:::number[Why is the SD (29.15) almost as large as the mean (33.9)?]
Most of the 7,644.9 comes from one subject: $(112 - 33.9)^2 = 6{,}099.6$, about 80% of the total. An SD that is a large fraction of the mean, for a variable that cannot go below zero, is a strong hint that "mean ± 2 SD" would include impossible negative values — the distribution is not symmetric and mean (SD) is a poor summary.
:::

**Quartiles, SAS default (PCTLDEF=5).**

- Q1: $np = 10 \times 0.25 = 2.5$, so $j = 2$, $g = 0.5 > 0$ → $Q_1 = x_{(3)} = 18$.
- Q3: $np = 7.5$, so $j = 7$, $g = 0.5 > 0$ → $Q_3 = x_{(8)} = 33$.

**Quartiles, R default (type 7).**

- Q1: $h = 9 \times 0.25 + 1 = 3.25$ → $x_{(3)} + 0.25\,(x_{(4)} - x_{(3)}) = 18 + 0.25 \times 3 = 18.75$.
- Q3: $h = 9 \times 0.75 + 1 = 7.75$ → $x_{(7)} + 0.75\,(x_{(8)} - x_{(7)}) = 29 + 0.75 \times 4 = 32$.

| Summary | SAS default (PCTLDEF=5) | R default (type 7) |
|---|---:|---:|
| Median | 23.5 | 23.5 |
| Q1 | 18.0 | 18.75 |
| Q3 | 33.0 | 32.0 |
| IQR | 15.0 | 13.25 |

Same data, same question, different answers — and both are correct implementations of their definitions.

**Geometric mean.** The mean of $\ln(\text{ALT})$ is 3.317, so $\text{GM} = e^{3.317} = 27.58$ U/L. The SD of the logs is 0.607, giving a geometric CV of $100\sqrt{e^{0.607^2} - 1} = 66.8\%$. The GM (27.6) sits between the median (23.5) and the arithmetic mean (33.9) — much closer to the bulk of the data than the mean.

## Data example

The VTX-221 trial (`cardio/adam/adsl`) has one row per randomized subject:

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,AGE,SEX,BMIBL,SBPBL,DBPBL,COMPLPCT" rows="8" caption="ADSL — one record per randomized subject"}

Summaries of age and baseline systolic blood pressure by planned treatment (ITT, all 270 randomized subjects), with quartiles computed both ways:

| | Placebo (N = 91) | VTX-221 10 mg (N = 90) | VTX-221 20 mg (N = 89) |
|---|---:|---:|---:|
| **Age (years)** mean (SD) | 56.7 (9.78) | 54.9 (10.39) | 55.5 (9.96) |
| median | 56.0 | 55.0 | 55.0 |
| Q1, Q3 — SAS default | 49.0, 64.0 | 47.0, 63.0 | 50.0, 62.0 |
| Q1, Q3 — R type 7 | 49.0, 63.5 | 47.25, 63.0 | 50.0, 62.0 |
| **Baseline SBP (mmHg)** mean (SD) | 149.47 (9.851) | 150.66 (8.938) | 151.16 (9.364) |
| median | 149.00 | 149.30 | 149.70 |
| Q1, Q3 — SAS default | 142.70, 155.00 | 143.70, 157.70 | 144.30, 158.30 |
| Q1, Q3 — R type 7 | 142.70, 154.85 | 143.70, 157.70 | 144.30, 158.30 |

:::number[Where do N = 91, 90 and 89 come from?]
They are the counts of `TRT01P` values among the 270 rows of ADSL, all of which have `ITTFL = "Y"`. The stratified block randomization (blocks of 6 within two baseline-SBP strata) left the last, incomplete blocks slightly unbalanced — a normal outcome of blocked randomization.
:::

Notice three things:

1. Mean ≈ median for both variables: age and baseline SBP are roughly symmetric, so mean (SD) is a sensible primary summary.
2. The two quartile definitions agree in most cells and differ in three (placebo age Q3, 10 mg age Q1, placebo SBP Q3). Differences appear only when the quantile position falls between two *different* order statistics.
3. Treatment compliance (`COMPLPCT`, safety population, n = 268) behaves differently: mean 95.54%, median 96.1%, minimum 59.3% — a **left** tail, created by nine subjects below 80%. Here the mean sits *below* the median.

## Code

::::tabs
:::tab[SAS]
```sas title="t_baseline_summary.sas"
proc means data=adam.adsl n mean std median q1 q3 min max
           qntldef=5 maxdec=2 nway;
  where ITTFL = 'Y';
  class TRT01PN TRT01P;
  var AGE SBPBL;
  output out=summ n= mean= std= median= q1= q3= min= max= / autoname;
run;

proc univariate data=adam.adsl pctldef=5 noprint;
  where SAFFL = 'Y';
  var COMPLPCT;
  output out=comp_pct pctlpts=25 50 75 pctlpre=P_;
run;
```

:::lines
1-2: Requests exactly the statistics in the shell. `QNTLDEF=5` is the default and is written out only to document intent; `MAXDEC=2` controls printed decimals, not stored precision. `NWAY` keeps only the full CLASS combination in the `OUT=` dataset.
3: The table population. Filter with `WHERE` so every statistic uses the same subjects.
4: Two CLASS variables: `TRT01PN` gives the column order (0, 1, 2) and `TRT01P` the label. Without the numeric variable, arms would sort alphabetically.
5: The analysis variables.
6: Writes the statistics to a dataset for the reporting step; `/ AUTONAME` names them `AGE_Mean`, `AGE_StdDev`, `SBPBL_Q1` and so on.
9: PROC UNIVARIATE uses `PCTLDEF=` for the same choice of definition.
12: `PCTLPTS=` requests any percentiles; `PCTLPRE=` prefixes the variable names (`P_25`, `P_50`, `P_75`).
:::
:::
:::tab[R]
```r title="baseline_summary.R"
library(dplyr)
adsl <- read.csv("data/cardio/adsl.csv")

adsl |>
  filter(ITTFL == "Y") |>
  group_by(TRT01PN, TRT01P) |>
  summarise(
    n      = n(),
    mean   = mean(SBPBL),
    sd     = sd(SBPBL),
    median = median(SBPBL),
    q1     = quantile(SBPBL, 0.25, type = 2),   # SAS-compatible
    q3     = quantile(SBPBL, 0.75, type = 2),
    min    = min(SBPBL),
    max    = max(SBPBL),
    .groups = "drop"
  )
```

:::lines
4-6: Same population and grouping as the SAS program; grouping by `TRT01PN` first fixes the column order.
8-11: `sd()` divides by $n-1$, like SAS. If `SBPBL` had missing values you would need `na.rm = TRUE` in each call — otherwise the result is `NA`.
12-13: `type = 2` reproduces SAS `QNTLDEF=5`. Leave it out and you get type 7, which disagrees with SAS in some cells.
:::
:::
:::tab[Python]
```python title="baseline_summary.py"
import numpy as np
import pandas as pd

adsl = pd.read_csv("data/cardio/adsl.csv")
itt = adsl[adsl["ITTFL"] == "Y"]

def q(p):
    return lambda s: np.quantile(s, p, method="averaged_inverted_cdf")  # = SAS QNTLDEF=5

summary = (itt.groupby(["TRT01PN", "TRT01P"])["SBPBL"]
              .agg(n="count", mean="mean", sd="std", median="median",
                   q1=q(0.25), q3=q(0.75), min="min", max="max"))
print(summary.round(3))
```

:::lines
7-8: NumPy's `averaged_inverted_cdf` method is the SAS default definition; pandas' own `.quantile()` uses linear interpolation (type 7).
10-12: pandas `"std"` divides by $n-1$ (unlike `np.std`, which divides by $n$ unless `ddof=1`).
:::
:::
::::

The companion scripts `r/lessons/stats-descriptive-statistics.R` and `python/lessons/stats-descriptive-statistics.py` reproduce every number in this lesson.

## Output

Expected output of the PROC MEANS step, `SBPBL` rows only (layout simplified; values computed independently in R — SAS was not run here):

```output
TRT01PN  TRT01P         N Obs  Variable   N      Mean   Std Dev    Median  Lower Quartile  Upper Quartile  Minimum  Maximum
--------------------------------------------------------------------------------------------------------------------------
      0  Placebo           91  SBPBL     91    149.47      9.85    149.00          142.70          155.00   130.70   179.00
      1  VTX-221 10 mg     90  SBPBL     90    150.66      8.94    149.30          143.70          157.70   133.70   173.00
      2  VTX-221 20 mg     89  SBPBL     89    151.16      9.36    149.70          144.30          158.30   130.00   172.30
```

:::number[Why are there two counts, N Obs and N?]
`N Obs` counts rows in the CLASS level; `N` counts non-missing values of the analysis variable. They are equal here because no subject is missing baseline SBP. When they differ, the table's n must come from `N`, and the difference is worth a footnote.
:::

:::number[Why does the placebo upper quartile read 155.00 here but 154.85 in R's default output?]
With $n = 91$ and $p = 0.75$, $np = 68.25$, so SAS takes the 69th sorted value, 155.0. R type 7 computes $h = 90 \times 0.75 + 1 = 68.5$ and interpolates halfway between the 68th (154.7) and 69th (155.0) values: 154.85.
:::

## Interpretation

- **Mean (SD) for symmetric variables.** Baseline SBP 150.4 (SD 9.4) mmHg overall means most subjects started roughly between 131 and 169 mmHg (mean ± 2 SD) — consistent with the eligibility window of 130–179 mmHg at baseline. The SD describes *subjects*, not the precision of the mean (that is the standard error, next lesson).
- **Median (Q1, Q3) for skewed variables.** For the ALT example, "median 23.5 (Q1 18, Q3 33) U/L" describes a typical subject honestly; "mean 33.9 (SD 29.15)" does not describe anyone.
- **Quartiles are definition-dependent** at the level of one order statistic. Differences of this size are not errors, but a table must use one documented definition consistently, and QC must use the same one.
- **Balance, not testing.** Baseline tables compare arms descriptively. Randomization makes any baseline difference a chance finding by construction, so many sponsors do not present p-values for baseline characteristics — the question is whether an imbalance is large enough to matter clinically.

:::clinical
A clinician reading "baseline SBP 149.5 vs 151.2 mmHg" should conclude the arms started at essentially the same blood pressure: a 1.7 mmHg difference is small relative to the SD of about 9.4 mmHg and to the treatment effects of 5–10 mmHg the trial was designed to detect.
:::

## Common mistakes

:::mistake[Treating a quartile mismatch as a bug — or ignoring a real one]
When SAS and R quartiles differ by at most one gap between adjacent sorted values, check the definition first (`type = 2` in R reproduces SAS). A difference larger than that — or any difference in n, mean or median — points to a real problem: a different population, missing-value handling, or duplicate records.
:::

:::mistake[Dividing by n instead of n − 1]
`np.std(x)` divides by $n$. For $n = 10$ the result is $\sqrt{9/10} \approx 0.949$ times the sample SD — a 5% discrepancy that QC will flag. Use `np.std(x, ddof=1)` or pandas `.std()`.
:::

:::mistake[Letting missing values change the denominator silently]
PROC MEANS excludes missing values from each statistic and reports the reduced N. R returns `NA` for `mean(x)` if any value is missing, and `na.rm = TRUE` drops them without telling you how many. Always display n alongside the statistics so the reader can see the denominator.
:::

:::mistake[Summarizing skewed labs with mean (SD) only]
Mean ± SD for a right-skewed lab often includes negative values ("ALT 33.9 ± 29.15" implies subjects at −24 U/L). Show median (Q1, Q3), or a geometric mean with geometric CV, as the SAP specifies.
:::

:::mistake[Rounding before computing]
Compute statistics on full-precision data and round only for display. Rounding each value first (or rounding the mean and then computing a difference from the rounded mean) creates discrepancies in the last decimal that QC will find.
:::

## Knowledge check

::quiz{ids="stats.desc.sas-default-type,stats.desc.median-even,stats.desc.skewed-summary,stats.desc.mean-outlier"}

## Hands-on exercise

::practice{ids="stats.desc.q1-sas,stats.desc.q1-type7,stats.desc.geometric-mean,stats.desc.r-summary-code" title="Practice: quartiles and summaries by hand and in code"}

## Challenge exercise

::practice{ids="stats.desc.quartile-qc,stats.desc.ddof-hotspot,stats.desc.decimals" title="QC: when two programs disagree"}

## Industry note

- **The shell and SAP decide the summary, not the programmer.** Shells specify statistics and decimals ("Mean (SD)", "Median", "Q1, Q3", "Min, Max"). If a skewed variable is shown as mean (SD) only, raise it with the statistician rather than changing the shell yourself.
- **Document the quantile definition** when an R, Python or SAS QC program must match production. "Quartiles computed with SAS QNTLDEF=5 (R `quantile(type = 2)`)" in the programming specification saves hours.
- **Decimal places follow a convention**, not a rule:

:::standard{kind="convention"}
Many sponsors display the mean and median with one more decimal place than the collected data, the SD with two more, and the minimum and maximum as collected (for example, age collected in whole years: mean 55.7, SD 10.04, median 55.0, min 30, max 80). The exact rule belongs in the sponsor's table standards or the SAP.
:::

- **Interview angle:** expect "why might SAS and R give different quartiles?", "when would you report a median instead of a mean?" and "what is the difference between SD and SE?" (the last one is the next lesson).

:::interview[Your QC program and the production table disagree on Q1 for one arm. What do you do?]
"First I compare the other statistics: if n, mean, median, min and max all match, the populations and data are the same and the likely cause is the quantile definition — SAS defaults to QNTLDEF=5, R to type 7, pandas to linear interpolation. I would recompute with R `type = 2` or NumPy `averaged_inverted_cdf`; if that reproduces production, the programs agree and I document the definition in the spec. If n or the median also differ, I would look for a population or missing-data difference instead."
:::

:::ai[If an AI assistant writes your summary-statistics code…]
Check the quantile definition (most generated R and pandas code uses the type 7 default), the SD divisor in NumPy, how missing values are handled, and that the grouping variable produces the arm order in the shell. Generated code usually runs without errors — the discrepancies are silent.
:::
