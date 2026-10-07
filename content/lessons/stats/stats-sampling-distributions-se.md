## What problem are we trying to solve?

The VTX-221 hypertension trial has finished. Placebo subjects dropped an average of **3.30 mmHg** in systolic blood pressure between baseline and Week 12. The 20 mg arm dropped **12.28 mmHg**.

The medical director asks the obvious question: *"If we ran this trial again with 270 different patients, would we get the same numbers?"*

The honest answer is **no** — you would get different numbers. A different sample of patients gives a different mean. What you need is the *second* answer: **how different?** Because if repeating the trial could easily produce a placebo change of −9 mmHg instead of −3.3, the 9 mmHg gap you just observed might be nothing but the luck of the draw.

Every confidence interval, every p-value, every standard error in every clinical table is an answer to that one question: **how much would this number move if I had sampled different people?** This lesson builds the machinery that answers it.

It also settles a confusion that costs points in interviews and creates real errors in tables: **SD and SE are not the same thing, they answer different questions, and using one where the shell asks for the other is a finding in QC.**

## Intuition

Imagine the 270 subjects in the trial are a bucket of marbles, each marble labelled with that subject's baseline SBP. You reach in and pull out 9 marbles, average them, and write the average on a card. Put the marbles back, do it again, write another card. Do it 20,000 times.

You now have 20,000 cards — a whole distribution of *sample means*. Three things are always true about that pile of cards:

1. **It is centred on the truth.** The average of the card values equals the average of the bucket. Sampling doesn't bias you; it just makes you imprecise.
2. **It is narrower than the bucket.** Individual patients vary a lot. Averages of 9 patients vary less, because a high patient and a low patient partly cancel. Averages of 100 patients vary much less still.
3. **It is more bell-shaped than the bucket**, even if the bucket is skewed — and it gets more bell-shaped as the sample gets bigger.

The **standard error** is nothing more mysterious than the *standard deviation of that pile of cards*. It measures the spread of a **statistic**, not the spread of **patients**.

:::why[Why does averaging shrink the variability at all?]
Because errors partly cancel. If you sample one patient, whatever makes that patient unusual lands entirely in your estimate. If you sample nine, the unusually high ones and the unusually low ones are added together and divided by nine, so the unusual parts pull in opposite directions. They do not cancel completely — that is why the shrink factor is $\sqrt{n}$ and not $n$.
:::

::widget{name="sampling-distribution"}

Play with that widget before reading on. Two things to look for: the sampling distribution stays centred where the population is centred, and its width shrinks as you increase $n$ — but shrinking from $n=25$ to $n=100$ buys you much less than going from $n=4$ to $n=25$.

## Clinical context

The SD-versus-SE distinction shows up in specific places in specific tables, and the shell tells you which one is wanted:

| Where it appears | Which one | Why |
|---|---|---|
| Demographics table: "Age, mean (SD)" | **SD** | Describes the *patients*: how variable is this population? |
| Change-from-baseline summary: "mean (SD)" | **SD** | Descriptive; the reader wants the spread of individual responses |
| LS means table: "LS mean (SE)" | **SE** | Describes the *estimate*: how precisely did we pin the mean down? |
| Forest plot error bars | **SE or CI** | Describes estimate precision, not patient spread |
| Figure of mean over time with error bars | **Stated in the footnote** — could be either | A figure with unlabelled error bars is a QC finding |

Two career-relevant consequences:

1. **As a programmer:** if the shell says `mean (SD)` and your code emits `STDERR` from PROC MEANS, every cell in the column is wrong, every cell looks plausible, and nobody catches it by eye. Only reading the shell catches it.
2. **As a statistician:** the SE is what you can shrink by enrolling more subjects. The SD is a property of the disease and the population — enrolling 2,000 patients will not make individual blood pressures less variable. This is the whole logic of sample size: *you cannot reduce patient variability, only your uncertainty about the average.*

:::mistake[Plotting SE bars to make a figure look tighter]
A figure of mean change over time with ±1 SE bars looks dramatically more precise than the same figure with ±1 SD bars, and some authors choose SE for exactly that reason. It is not wrong *if the footnote says what the bars are* — and it is misleading if it doesn't. When you build the figure, put the definition in the footnote. When you read one, look for it.
:::

## Formal concept

### The sampling distribution

Let $X_1, \dots, X_n$ be independent draws from a population with mean $\mu$ and standard deviation $\sigma$. The **sample mean** is a random variable:

$$
\bar{X} = \frac{1}{n}\sum_{i=1}^{n} X_i
$$

Its distribution over repeated samples — the pile of cards — is the **sampling distribution of the mean**. Two exact results, true for *any* population shape:

$$
\mathbb{E}[\bar{X}] = \mu
\qquad\qquad
\operatorname{Var}(\bar{X}) = \frac{\sigma^2}{n}
\qquad\Longrightarrow\qquad
\operatorname{SD}(\bar{X}) = \frac{\sigma}{\sqrt{n}}
$$

That last quantity is the **standard error of the mean**. Because $\sigma$ is unknown, we plug in the sample SD $s$:

$$
\widehat{\operatorname{SE}}(\bar{X}) = \frac{s}{\sqrt{n}}
$$

:::number[Where does the $\sqrt{n}$ come from — why not $n$?]
Variances of independent random variables add. $\operatorname{Var}\!\left(\sum X_i\right) = n\sigma^2$. Dividing by $n$ scales the variance by $1/n^2$, so $\operatorname{Var}(\bar X) = n\sigma^2/n^2 = \sigma^2/n$. Standard deviation is the square root of variance, so the **SD** shrinks by $\sqrt{n}$ even though the **variance** shrinks by $n$. This is why quadrupling the sample size only halves the standard error — the single most important practical fact in trial design.
:::

### The central limit theorem

The CLT says that as $n$ grows, the standardized sample mean converges in distribution to a standard normal:

$$
\frac{\bar{X} - \mu}{\sigma/\sqrt{n}} \;\xrightarrow{\;d\;}\; N(0, 1)
$$

What it does **not** say:

- It does not say the *data* become normal. Individual ALT values stay skewed forever.
- It does not say $n \ge 30$ is enough. That rule of thumb comes from mildly skewed textbook examples. For strongly skewed data (AE counts, PK concentrations, hospital costs) the sample mean can still be visibly skewed at $n = 100$.
- It does not rescue you from dependence. Repeated measurements on the same subject are not independent draws, and treating 4 visits × 270 subjects as $n = 1080$ is one of the most common analysis errors in the industry.

:::standard{kind="simplification"}
"$n \ge 30$ means normality" is a teaching shortcut, not a rule from any guidance document. What actually matters is the skewness and kurtosis of the underlying distribution relative to $n$. When in doubt, look at the distribution, or use a method that does not rely on the CLT (exact tests, bootstrap, rank methods).
:::

### From $\sigma$ to $s$: why $t$ and not $z$

If you knew $\sigma$, $(\bar X - \mu)/(\sigma/\sqrt n)$ would be standard normal. You don't — you estimate it with $s$, which is itself noisy. Substituting a noisy denominator makes the ratio more spread out than a normal, and the exact distribution (for normal data) is **Student's $t$ with $n-1$ degrees of freedom**:

$$
T = \frac{\bar{X} - \mu}{s/\sqrt{n}} \sim t_{n-1}
$$

::widget{name="t-distribution"}

:::why[Why $n-1$ degrees of freedom?]
The $n$ residuals $x_i - \bar{x}$ are not free to be anything: they must sum to zero, because $\bar{x}$ was computed from the same data. Knowing $n-1$ of them determines the last one. So the residuals carry $n-1$ independent pieces of information about spread, and that is the parameter of the $t$ distribution. You will meet this same accounting again in regression, where each estimated coefficient costs one degree of freedom.
:::

### The standard error of a difference

Clinical trials compare arms, so the statistic of interest is usually a difference. For two **independent** groups:

$$
\operatorname{SE}(\bar{X}_1 - \bar{X}_2) = \sqrt{\frac{s_1^2}{n_1} + \frac{s_2^2}{n_2}}
$$

Variances add — even for a *difference*, because $\operatorname{Var}(A - B) = \operatorname{Var}(A) + \operatorname{Var}(B)$ when $A$ and $B$ are independent. The uncertainty of a comparison is always larger than the uncertainty of either arm alone.

For **paired** data (the same subject before and after), the two measurements are *not* independent, and you must reduce each pair to a single difference $d_i$ first:

$$
\operatorname{SE}(\bar{d}) = \frac{s_d}{\sqrt{n}}
$$

That correlation is exactly why paired designs are efficient — more in the $t$-test lesson.

## Worked example

The nine subjects enrolled at site 101 in VTX221-201, with baseline (Day 1) systolic blood pressure:

| USUBJID | Arm | SBPBL (mmHg) |
|---|---|---|
| VTX221-201-101-001 | VTX-221 20 mg | 161.7 |
| VTX221-201-101-002 | Placebo | 148.7 |
| VTX221-201-101-003 | VTX-221 10 mg | 146.3 |
| VTX221-201-101-004 | VTX-221 10 mg | 141.7 |
| VTX221-201-101-005 | VTX-221 10 mg | 164.7 |
| VTX221-201-101-006 | Placebo | 142.7 |
| VTX221-201-101-007 | Placebo | 134.0 |
| VTX221-201-101-008 | Placebo | 140.0 |
| VTX221-201-101-009 | VTX-221 20 mg | 150.7 |

**Step 1 — the mean.**

$$
\bar{x} = \frac{1330.5}{9} = 147.8333 \text{ mmHg}
$$

:::number[Where does 1330.5 come from?]
It is the sum of the nine SBPBL values: $161.7 + 148.7 + 146.3 + 141.7 + 164.7 + 142.7 + 134.0 + 140.0 + 150.7 = 1330.5$. Add them yourself — this is the only number in the example that is not derived from another one.
:::

**Step 2 — the sum of squared deviations.** Subtract 147.8333 from each value, square, and add:

$$
\sum (x_i - \bar{x})^2 = 804.78
$$

**Step 3 — the sample SD.** Divide by $n - 1 = 8$, then take the square root:

$$
s = \sqrt{\frac{804.78}{8}} = \sqrt{100.5975} = 10.0298 \text{ mmHg}
$$

**Step 4 — the standard error.**

$$
\operatorname{SE} = \frac{s}{\sqrt{n}} = \frac{10.0298}{\sqrt{9}} = \frac{10.0298}{3} = 3.3433 \text{ mmHg}
$$

**Read the two numbers in words.** The SD says: *a typical patient at this site is about 10 mmHg away from the site average.* The SE says: *if I re-sampled nine patients from this population over and over, the site averages would themselves scatter with a spread of about 3.3 mmHg.*

:::number[Why is the SE exactly one third of the SD here?]
Because $n = 9$ and $\sqrt{9} = 3$ exactly. This is a deliberately chosen sample size for a hand calculation. With $n = 91$ the divisor is $\sqrt{91} = 9.539$, which is why the placebo arm's baseline SE (1.0327) is not a memorable fraction of its SD (9.8512).
:::

**Step 5 — a 95% confidence interval**, previewing the next lesson. With $n - 1 = 8$ degrees of freedom, $t_{0.975,8} = 2.3060$:

$$
147.8333 \pm 2.3060 \times 3.3433 = 147.8333 \pm 7.7097 = (140.12,\; 155.54)
$$

Compare that with the interval you would get from the full ITT population ($n = 270$, SE = 0.5712): roughly $150.42 \pm 1.12$. **Thirty times the sample size, about seven times narrower** — that is $\sqrt{30} \approx 5.5$ from the sample size plus the smaller $t$ multiplier.

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,AGE,SEX,SBPBL,DBPBL,ITTFL" rows="8" caption="ADSL — one record per randomized subject in VTX221-201"}

Baseline systolic blood pressure in the ITT population, by arm:

| Arm | n | Mean (mmHg) | SD | SE |
|---|---:|---:|---:|---:|
| Placebo | 91 | 149.47 | 9.85 | 1.03 |
| VTX-221 10 mg | 90 | 150.66 | 8.94 | 0.94 |
| VTX-221 20 mg | 89 | 151.16 | 9.36 | 0.99 |
| **Total** | **270** | **150.42** | **9.39** | **0.57** |

:::number[Why is the total SD (9.39) almost the same as each arm's SD, while the total SE (0.57) is much smaller?]
Two different mechanisms. The **SD** barely changes because pooling three arms whose means are within 1.7 mmHg of each other adds almost no between-arm spread — the patients are drawn from the same population, which is exactly what randomization guarantees. The **SE** drops because $n$ tripled: $9.39/\sqrt{270} = 0.57$ versus $9.85/\sqrt{91} = 1.03$. The ratio $1.03/0.57 = 1.8 \approx \sqrt{3}$.
:::

Now the sampling distribution itself. Treating these 270 baseline values as the population ($\sigma = 9.3686$ using the $n$ divisor, since this *is* the whole population in the simulation), drawing 20,000 samples with replacement and computing the SD of the sample means:

| Sample size $n$ | SD of 20,000 simulated sample means | Formula $\sigma/\sqrt{n}$ |
|---:|---:|---:|
| 9 | 3.138 | 3.123 |
| 25 | 1.859 | 1.874 |
| 100 | 0.936 | 0.937 |

The simulation and the formula agree to about 1%. **That is the point of the whole lesson**: you do not have to run the trial 20,000 times to know how much the mean would bounce around. One trial plus a square root tells you.

## Code

::::tabs
:::tab[SAS]
```sas
/* SD and SE of baseline SBP by arm — note that STDERR is a separate
   statistic keyword, not a formatting option on STD. */
proc means data=adam.adsl n mean std stderr maxdec=4;
  where ittfl = 'Y';
  class trt01p;
  var sbpbl;
run;

/* The same numbers, output to a dataset so a table program can use them */
proc means data=adam.adsl noprint;
  where ittfl = 'Y';
  class trt01p;
  var sbpbl;
  output out=stats_sbp (where=(_type_ = 1))
         n=n mean=mean std=sd stderr=se;
run;

/* A one-sample t confidence interval for the mean */
proc ttest data=adam.adsl alpha=0.05;
  where ittfl = 'Y' and trt01p = 'Placebo';
  var sbpbl;
run;
```

:::lines
1: `n mean std stderr` — four separate statistic keywords. Ask for `stderr` and SAS computes `std / sqrt(n)` for you; there is no option that converts `std` into a standard error.
5: `class trt01p` produces one row per treatment arm plus, by default, an overall row.
14: `_type_ = 1` keeps only the by-arm rows and drops the overall row. `_type_ = 0` would be the overall row alone.
15: `n=n mean=mean std=sd stderr=se` renames the output columns; without this they get SAS's default `_STAT_`-style layout.
19: `PROC TTEST` with a single `var` and no `class` gives a one-sample test against zero plus the mean, SD, SE and confidence interval in one table.
:::
:::

:::tab[R]
```r
library(dplyr)

adsl <- readr::read_csv("data/cardio/adsl.csv", show_col_types = FALSE)

adsl |>
  filter(ITTFL == "Y") |>
  summarise(
    n    = dplyr::n(),
    mean = mean(SBPBL),
    sd   = sd(SBPBL),
    se   = sd(SBPBL) / sqrt(dplyr::n()),
    .by  = TRT01P
  )

# There is no built-in se() in base R — you write it, every time.
se <- function(x) sd(x, na.rm = TRUE) / sqrt(sum(!is.na(x)))

# Confidence interval for the placebo mean
placebo <- adsl$SBPBL[adsl$ITTFL == "Y" & adsl$TRT01P == "Placebo"]
t.test(placebo)$conf.int
```

:::lines
6: `.by = TRT01P` is the dplyr 1.1+ inline grouping argument; it returns an ungrouped result, unlike `group_by()`, which leaves the result grouped and surprises you two pipes later.
13: `sum(!is.na(x))` — not `length(x)`. If you divide by `length(x)` when values are missing you understate the SE, because the numerator `sd()` already dropped them.
17: `t.test(x)` with one argument tests $H_0: \mu = 0$; you want it here only for the interval, which is the same $\bar{x} \pm t_{0.975,n-1}\,\mathrm{SE}$ arithmetic done above by hand.
:::
:::

:::tab[Python]
```python
import pandas as pd
import numpy as np

adsl = pd.read_csv("data/cardio/adsl.csv")
itt = adsl.query("ITTFL == 'Y'")

out = itt.groupby("TRT01P")["SBPBL"].agg(
    n="count",
    mean="mean",
    sd=lambda s: s.std(ddof=1),
    se=lambda s: s.std(ddof=1) / np.sqrt(s.count()),
)
print(out.round(4))

# scipy gives the standard error directly
from scipy import stats
stats.sem(itt.loc[itt.TRT01P == "Placebo", "SBPBL"])
```

:::lines
8: `s.std(ddof=1)` — pandas `Series.std()` already defaults to `ddof=1`, but **NumPy's `np.std()` defaults to `ddof=0`**. Writing it explicitly means the reader does not have to remember which library they are in.
14: `scipy.stats.sem` also defaults to `ddof=1`. Its `nan_policy` argument controls missing handling and defaults to `'propagate'` — i.e. any NaN returns NaN, which is safer than silently dropping.
:::
:::
::::

## Output

```text
                        The MEANS Procedure

                    Analysis Variable : SBPBL

         N
TRT01P  Obs       N       Mean        Std Dev    Std Error
------------------------------------------------------------
Placebo  91      91   149.4681      9.8512       1.0327
VTX-221
 10 mg   90      90   150.6633      8.9384       0.9422
VTX-221
 20 mg   89      89   151.1584      9.3644       0.9926
------------------------------------------------------------
```

:::number[Why is the 10 mg arm's SE (0.9422) the smallest even though its n is not the largest?]
Because SE depends on **both** $s$ and $n$: $8.9384/\sqrt{90} = 0.9422$. The 10 mg arm has the smallest SD of the three (8.94 versus 9.85 and 9.36), and that dominates the one-subject difference in sample size. A smaller SE is not evidence of a better arm — it is a property of the baseline spread, which randomization left to chance.
:::

## Interpretation

Write the placebo result in the three registers you will be asked for:

**Statistical.** The mean baseline SBP in the placebo arm is 149.47 mmHg with a standard error of 1.03 mmHg; a 95% confidence interval for the population mean is approximately 147.4 to 151.5 mmHg.

**Programming.** `PROC MEANS ... STDERR` produced 1.0327, which equals `STD/SQRT(N)` = $9.8512/\sqrt{91}$. The shell for Table 14.1.2 asks for mean (SD), so the column that goes in the table is 149.5 (9.85), **not** the standard error.

:::clinical
Clinically, the SD is the number that matters for describing *this population*: baseline systolic pressures ranged widely, and roughly two thirds of the subjects were within about 10 mmHg of 149. The SE is the number that matters for *the claim*: it tells the reader how much confidence to place in "the arms were balanced at baseline". A 1 mmHg standard error means a 1.7 mmHg between-arm gap at baseline is comfortably inside sampling noise — exactly what you expect from successful randomization.
:::

## Common mistakes

:::mistake[Reporting SE where the shell says SD (or vice versa)]
The two differ by a factor of $\sqrt{n}$ — a factor of about 9.5 in this trial. Every cell stays plausible-looking, so the error survives eyeballing. Read the shell, then read your `PROC MEANS` statistic list against it. In QC, always recompute one cell by hand: if the shell says SD and $\text{value} \times \sqrt{n}$ reproduces the other program's number, you have found the bug.
:::

:::mistake[Treating repeated measurements as independent observations]
The VTX-221 ADVS dataset has 3,082 vital-sign records from 270 subjects. Computing an SE with $n = 3082$ would understate the uncertainty by roughly $\sqrt{3082/270} = 3.4\times$, because four measurements on one subject are correlated, not four independent draws. The sample size for a subject-level statistic is the number of **subjects**.
:::

:::mistake[Believing that a large n makes the data normal]
The CLT is about the *sampling distribution of the statistic*, not about the data. A histogram of 500 ALT values is still right-skewed. If a reviewer asks "is your data normal?", the statistically literate answer is "the relevant question is whether the sampling distribution of my estimator is approximately normal, and with $n = 250$ per arm for a mildly skewed outcome, it is."
:::

:::mistake[Dividing by length(x) when values are missing]
`sd(x, na.rm = TRUE) / sqrt(length(x))` is wrong when `x` contains `NA`: the numerator uses the non-missing count and the denominator uses the total. The SE comes out too small. Use `sum(!is.na(x))`.
:::

:::mistake[Quoting SE as if it described patients]
"The mean reduction was 12.3 mmHg (SE 1.29)" invites a clinician to think most patients fell between 11 and 13.5 mmHg. They did not — the SD was 11.5, so individual responses ranged from large increases to reductions over 30 mmHg. If the audience is clinical, give the SD, or give the range, and reserve the SE for the precision of the estimate.
:::

## Knowledge check

::quiz{ids="stats.se.sd-vs-se,stats.se.quadruple-n,stats.se.clt-claim,stats.se.diff-se"}

## Hands-on exercise

::practice{ids="stats.se.hand-se,stats.se.sample-size-for-se,stats.se.r-code,stats.se.independence-hotspot" title="Practice: computing and reasoning about standard errors"}

## Challenge exercise

::practice{ids="stats.se.qc-mismatch,stats.se.repeated-measures,stats.se.figure-footnote" title="QC: which statistic is in this column?"}

## Industry note

Three things about standard errors that show up in real work and in interviews:

**1. The $\sqrt{n}$ law governs trial budgets.** Halving a confidence interval requires quadrupling the sample size. A team that wants to tighten a secondary endpoint estimate from ±4 mmHg to ±2 mmHg is asking for four times the patients, four times the sites, four times the monitoring cost. When you can say that fluently, you are having a design conversation rather than a statistics conversation.

**2. Model-based standard errors are the ones that appear in the CSR.** The 1.03 mmHg above is a simple arithmetic SE. The SEs in the primary efficacy table come from the ANCOVA model and are *smaller*, because adjusting for baseline removes variability from the residual. You will see that in the ANCOVA lesson — but note now that "the SE" is not a property of the data alone; it is a property of the data **and the model**.

:::standard{kind="convention"}
Reporting "mean (SD)" for descriptive tables and "LS mean (SE)" or "difference (95% CI)" for inferential tables is an industry convention reflected in most sponsors' shell libraries and in ICH E3's expectations for the presentation of efficacy results. It is not a numbered regulatory rule — your SAP and shells are what bind you.
:::

**3. Bootstrapping is the general-purpose answer.** When a statistic has no tidy standard-error formula — a median, a ratio of medians, an AUC, a difference in restricted mean survival time — you can estimate its sampling distribution by resampling the observed data with replacement, exactly as in the table above. The bootstrap is not exotic; it is the simulation you just ran, used in anger.

:::interview[What is the difference between the standard deviation and the standard error?]
A complete answer has four parts, in this order: (1) the SD describes the spread of individual observations, the SE describes the spread of a statistic over repeated sampling; (2) $\mathrm{SE} = s/\sqrt{n}$ for a mean, so they differ by a factor of $\sqrt{n}$; (3) increasing $n$ shrinks the SE but leaves the SD essentially unchanged, because the SD is a property of the population; (4) give the concrete consequence — a demographics table shows SD because the reader wants to know about the patients, an LS means table shows SE because the reader wants to know how precise the estimate is. Candidates who stop after part (2) sound like they have read a textbook; candidates who reach part (4) sound like they have produced tables.
:::
