## What problem are we trying to solve?

Your Week 12 efficacy table has a row that reads:

```text
VTX-221 20 mg - Placebo    -8.98 mmHg    (-12.62, -5.33)    p < 0.0001
```

Three numbers. The medical writer asks you what the middle one means, and you need an answer that is both correct and sayable out loud.

The tempting answer — *"there is a 95% probability the true effect is between −12.62 and −5.33"* — is the one most people give, and it is the one that will be marked wrong in a biostatistics interview. The correct interpretation is stranger and more useful, and getting it right changes how you write the CSR.

This lesson also answers a question that comes up in every oncology and safety table: **response rates are proportions, not means. Which interval do you use?** The textbook formula $\hat{p} \pm 1.96\sqrt{\hat{p}(1-\hat{p})/n}$ is the one everybody learns and the one that is wrong often enough to matter — sometimes producing a "95%" interval with 81% coverage, sometimes producing a negative lower bound for a response rate. Knowing which interval a SAP should specify, and why, is real expertise.

## Intuition

Go back to the pile of 20,000 cards from the last lesson — the sampling distribution. A confidence interval is what you get when you run that picture **backwards**.

Forwards: if I knew the true mean $\mu$, I could say where 95% of sample means would land — within about two standard errors of $\mu$.

Backwards: I don't know $\mu$, but I have one sample mean. If my sample mean is within two SEs of $\mu$ (which happens 95% of the time), then $\mu$ is within two SEs of **my sample mean**. So I draw a net of ±2 SEs around what I observed and claim it caught the truth.

The subtlety is in *what is random*. The truth $\mu$ is a fixed, unknown number — it isn't bouncing around. What bounces is **the net**. Each new trial gives a new sample mean and therefore a new interval, in a new place, with a new width.

**95% confidence means: 95% of the nets you would throw, over repeated trials, would contain the truth.** For the one net you actually threw, it either caught the truth or it didn't. You don't get to know which.

::widget{name="ci-coverage"}

Run that widget and watch the intervals stack up. Roughly one in twenty misses the true value entirely — and there is nothing about a missing interval that looks wrong from the inside. That is the honest content of "95%".

:::why[If the truth is fixed, why can't I say there's a 95% probability it's in my interval?]
Because in the frequentist framework there is no probability distribution over $\mu$ — it is a constant, not a random variable. The statement "$P(-12.62 < \mu < -5.33) = 0.95$" treats $\mu$ as random, which is a Bayesian statement requiring a prior. A **credible interval** from a Bayesian analysis *can* be read that way. A confidence interval cannot. In practice the two often nearly coincide with vague priors, which is why the wrong interpretation so rarely gets anybody into trouble — and why it still gets marked wrong.
:::

## Clinical context

Confidence intervals do work in a clinical trial report that p-values cannot:

| Situation | What the CI tells you that p does not |
|---|---|
| Primary endpoint is significant | *How big* the effect plausibly is. "p < 0.0001" is compatible with a 2 mmHg effect in a huge trial; the CI says the effect is at least 5.3 mmHg |
| Primary endpoint is not significant | Whether the trial was **informative**. A CI of (−0.5, 0.4) rules out clinically meaningful effects. A CI of (−14, 6) rules out nothing — the trial was too small to conclude anything |
| Non-inferiority | The entire decision rule. NI is declared when the CI excludes the non-inferiority margin — there is no p-value in the primary statement |
| Safety: a rare event not observed | How high the true rate could still be. Zero events in 100 subjects is compatible with a rate up to about 3.6% |
| Subgroup forest plot | Each row's precision, which is the whole reason subgroup point estimates should not be read as findings |

:::standard{kind="official"}
ICH E9, *Statistical Principles for Clinical Trials* (Section 5.5), states that estimates of treatment effects should be accompanied by confidence intervals and that these should be presented alongside significance tests. ICH E3 (Section 11.4.2) expects the CSR to present effect estimates with confidence intervals. Presenting a p-value alone is a genuine reporting deficiency, not a stylistic choice.
:::

For non-inferiority the interval *is* the analysis, which is worth stating precisely because it is a common interview question: you conclude non-inferiority when the confidence interval for the difference lies entirely on the favourable side of the pre-specified margin. No margin, no conclusion — and the margin must be justified before unblinding.

## Formal concept

### Interval for a single mean

For a sample of size $n$ with mean $\bar{x}$ and SD $s$, a $100(1-\alpha)\%$ confidence interval for $\mu$ is

$$
\bar{x} \;\pm\; t_{1-\alpha/2,\,n-1} \cdot \frac{s}{\sqrt{n}}
$$

Three moving parts, and each one is a lever:

- $\bar{x}$ — where the interval sits.
- $s/\sqrt{n}$ — the standard error, the unit of width.
- $t_{1-\alpha/2,\,n-1}$ — the **multiplier**, set by your confidence level and your degrees of freedom.

:::number[Why $t$ and not 1.96?]
1.96 is the normal quantile, appropriate only when $\sigma$ is known. Since you estimated it with $s$, the correct multiplier is from the $t$ distribution with $n-1$ df — and it is always larger than 1.96, paying for the extra uncertainty in $s$. With $n = 12$ it is 2.201; with $n = 77$ it is 1.992; with $n = 1000$ it is 1.962. The practical rule: past about $n = 60$ the difference stops mattering, and below about $n = 20$ using 1.96 makes your interval visibly too narrow.
:::

### Interval for a difference in means

$$
(\bar{x}_1 - \bar{x}_2) \;\pm\; t_{1-\alpha/2,\,\nu} \cdot \sqrt{\frac{s_1^2}{n_1} + \frac{s_2^2}{n_2}}
$$

with $\nu$ from the Welch–Satterthwaite approximation (a non-integer, e.g. 154.64) unless you pool the variances, in which case $\nu = n_1 + n_2 - 2$.

### Intervals for a proportion

Here the textbook formula and the right answer part company. Let $x$ events out of $n$, $\hat{p} = x/n$.

**Wald (the "normal approximation"):**

$$
\hat{p} \pm z_{1-\alpha/2}\sqrt{\frac{\hat{p}(1-\hat{p})}{n}}
$$

Easy to compute, taught everywhere, and **badly behaved** when $p$ is near 0 or 1 or when $n$ is small. It can produce bounds below 0 or above 1, and it collapses to zero width when $x = 0$ or $x = n$ — claiming perfect certainty from the least informative data possible.

**Wilson (score):** invert the score test rather than plugging $\hat p$ into the variance.

$$
\frac{\hat{p} + \frac{z^2}{2n} \;\pm\; z\sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}
$$

Never leaves $[0,1]$, behaves well at the extremes, and has close-to-nominal coverage across most of the range.

**Clopper–Pearson (exact):** invert the binomial test. The bounds are beta quantiles:

$$
L = \operatorname{Beta}^{-1}\!\left(\tfrac{\alpha}{2};\, x,\, n-x+1\right), \qquad
U = \operatorname{Beta}^{-1}\!\left(1-\tfrac{\alpha}{2};\, x+1,\, n-x\right)
$$

with $L = 0$ when $x = 0$ and $U = 1$ when $x = n$. "Exact" means *guaranteed at least* $1-\alpha$ coverage — which, because the binomial is discrete, means it is usually **conservative** (wider than necessary).

:::why[Why does discreteness make an "exact" interval conservative?]
Coverage can only change at the discrete jumps where $x$ moves from one integer to the next. You cannot tune the interval to hit exactly 95% for every true $p$; to guarantee *at least* 95% everywhere, you must be above 95% almost everywhere. The simulation below shows Clopper–Pearson delivering 99.2% coverage when you asked for 95% — safe, but paying for it in width.
:::

::widget{name="ci-coverage"}

## Worked example

Twelve subjects in a single-arm pilot, change from baseline in systolic BP (mmHg) at Week 12:

`-14, -6, -18, 2, -11, -9, -22, -4, -13, -7, -16, -2`

**Step 1 — mean.** The twelve values sum to $-120$:

$$
\bar{x} = \frac{-120}{12} = -10.00 \text{ mmHg}
$$

**Step 2 — sum of squared deviations.** Subtract $-10$ from each value (so the deviations are $-4, 4, -8, 12, -1, 1, -12, 6, -3, 3, -6, 8$) and square:

$$
\sum(x_i - \bar{x})^2 = 16+16+64+144+1+1+144+36+9+9+36+64 = 540
$$

**Step 3 — SD and SE.**

$$
s = \sqrt{\frac{540}{11}} = \sqrt{49.0909} = 7.0065
\qquad
\operatorname{SE} = \frac{7.0065}{\sqrt{12}} = 2.0226
$$

**Step 4 — the multiplier.** $n - 1 = 11$ degrees of freedom, so $t_{0.975,11} = 2.2010$.

:::number[Where does 2.2010 come from?]
It is the 97.5th percentile of the $t$ distribution with 11 degrees of freedom — the value leaving 2.5% in each tail so that 95% lies in the middle. In R: `qt(0.975, 11)`. In SAS: `tinv(0.975, 11)`. In Excel: `T.INV.2T(0.05, 11)`. It is larger than 1.96 because with only 11 df the $t$ distribution has noticeably heavier tails.
:::

**Step 5 — assemble.**

$$
-10.00 \pm 2.2010 \times 2.0226 = -10.00 \pm 4.4517 = (-14.45,\; -5.55) \text{ mmHg}
$$

**Say it out loud, correctly:** *"The estimated mean reduction is 10.0 mmHg. A 95% confidence interval runs from 5.6 to 14.5 mmHg of reduction — the data are compatible with reductions in that range, and the procedure that produced this interval captures the true mean in 95% of studies."*

**Say what it rules out:** the interval excludes zero, so a null effect is not among the compatible values at this level. It also excludes reductions larger than 14.5 mmHg — useful if someone claims a 20 mmHg effect.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — one record per subject, parameter and visit"}

**A mean and a difference.** Week 12 change in systolic BP, analysis records only:

| Quantity | Estimate | SE | df | 95% CI |
|---|---:|---:|---:|---|
| Placebo mean change | −3.30 | 1.32 | 76 | (−5.94, −0.66) |
| 20 mg mean change | −12.28 | 1.29 | 79 | — |
| **20 mg − placebo** | **−8.98** | **1.84** | **154.64** | **(−12.62, −5.33)** |

:::number[Why is the difference's df 154.64 and not 155?]
The Welch–Satterthwaite formula approximates the degrees of freedom of a weighted sum of two chi-squares and returns a non-integer. SAS `PROC TTEST` prints it as `154.64` on the Satterthwaite row; R's `t.test()` prints `df = 154.64`. If you pool the variances instead, df is exactly $80 + 77 - 2 = 155$. With nearly equal SDs and sample sizes the two intervals agree to two decimals here — the distinction matters when the arms differ in size or spread.
:::

**Proportions.** "Controlled hypertension" — Week 12 systolic BP below 140 mmHg, among subjects with a Week 12 value:

| Arm | x / n | $\hat{p}$ | Wald | Wilson | Clopper–Pearson |
|---|---|---:|---|---|---|
| Placebo | 20/77 | 0.260 | (0.162, 0.358) | (0.175, 0.367) | (0.166, 0.372) |
| VTX-221 10 mg | 37/81 | 0.457 | (0.348, 0.565) | (0.353, 0.565) | (0.346, 0.571) |
| VTX-221 20 mg | 43/80 | 0.538 | (0.428, 0.647) | (0.429, 0.643) | (0.422, 0.650) |

With $n \approx 80$ and $\hat p$ near the middle, all three agree closely. **That is exactly why people never learn the difference** — and why they are unprepared when the numbers move to the edge:

| x / n | $\hat{p}$ | Wald | Wilson | Clopper–Pearson |
|---|---:|---|---|---|
| 2/12 | 0.167 | **(−0.044, 0.378)** | (0.047, 0.448) | (0.021, 0.484) |
| 1/20 | 0.050 | **(−0.046, 0.146)** | (0.009, 0.236) | (0.001, 0.249) |
| 0/20 | 0.000 | **(0.000, 0.000)** | (0.000, 0.161) | (0.000, 0.168) |
| 19/20 | 0.950 | **(0.855, 1.046)** | (0.764, 0.991) | (0.751, 0.999) |

A negative lower bound for a response rate. An upper bound above 1. And — worst of all — a zero-width interval when no events were observed, asserting with total confidence that the rate is exactly zero.

**Coverage, simulated.** True $p = 0.10$, $n = 30$, 100,000 simulated samples, asking each method for a 95% interval:

| Method | Actual coverage |
|---|---:|
| Wald | **80.8%** |
| Wilson | 97.4% |
| Clopper–Pearson | 99.2% |

:::number[How can a "95%" interval cover only 81% of the time?]
Because the Wald interval plugs the *estimate* $\hat p$ into the variance formula. When $p = 0.10$ and $n = 30$ you often observe $x = 1$ or $2$, so $\hat p$ is small, so $\hat p(1-\hat p)$ is small, so the interval is *narrow* — precisely in the samples where it is furthest from the truth. The error compounds: bad luck in the estimate causes bad luck in the width. Wilson avoids this by solving for the values of $p$ consistent with the data, rather than assuming the variance at $\hat p$.
:::

## Code

::::tabs
:::tab[SAS]
```sas
/* Mean, SE and 95% CI for a single arm; and the two-sample CI */
proc ttest data=adam.advs alpha=0.05;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12
        and trtp in ('Placebo', 'VTX-221 20 mg');
  class trtp;
  var chg;
run;

/* Binomial proportion CIs: Wald, Wilson and exact in one call */
proc freq data=resp;
  where avisitn = 12;
  tables trtp * responder / nocol nopercent;
  exact binomial;
run;

proc freq data=resp;
  where avisitn = 12 and trtp = 'VTX-221 20 mg';
  tables responder / binomial (level='Y' cl=(wald wilson exact));
run;
```

:::lines
2: `alpha=0.05` is the default; stating it makes the confidence level explicit to a reviewer and to your future self.
5: `class trtp` makes this a two-sample comparison. PROC TTEST then prints **both** the pooled and the Satterthwaite (Welch) rows, plus an equality-of-variances test. The SAP decides which row goes in the table — do not pick it after seeing the p-values.
6: `var chg` analyses the change from baseline. Analysing `aval` instead would be a different (and less powerful) analysis.
16: `binomial (level='Y' ...)` — you must say **which level** counts as the event. Without `level=`, SAS uses the first formatted level, which is alphabetically determined and frequently the wrong one. `cl=(wald wilson exact)` requests all three interval types side by side. `exact` is Clopper–Pearson.
:::
:::

:::tab[R]
```r
library(dplyr)

advs <- readr::read_csv("data/cardio/advs.csv", show_col_types = FALSE)
w12 <- advs |> filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12)

# One-sample interval
pbo <- w12$CHG[w12$TRTP == "Placebo"]
t.test(pbo)$conf.int

# Two-sample (Welch by default — var.equal = FALSE)
t.test(CHG ~ TRTP, data = filter(w12, TRTP %in% c("VTX-221 20 mg", "Placebo")))

# Proportions
x <- sum(w12$AVAL[w12$TRTP == "VTX-221 20 mg"] < 140)
n <- sum(w12$TRTP == "VTX-221 20 mg")

binom.test(x, n)$conf.int              # Clopper-Pearson (exact)
prop.test(x, n, correct = FALSE)$conf.int   # Wilson (score)
```

:::lines
9: `t.test(x)` on a single vector gives the one-sample interval. The `$conf.int` element also carries a `conf.level` attribute, which is worth printing when you paste results into a spec.
12: R's `t.test()` defaults to **`var.equal = FALSE`**, i.e. Welch. SAS prints both rows and lets you choose. If your QC program silently uses R's default while production used the pooled row, you have a discrepancy that is nobody's bug and everybody's afternoon.
18: `binom.test()` gives Clopper–Pearson. There is no base-R Wald interval — which is arguably a feature. `prop.test(..., correct = FALSE)` gives the Wilson interval. **With `correct = TRUE` (the default!)** you get the continuity-corrected Wilson interval, which is wider. Always state it explicitly.
:::
:::

:::tab[Python]
```python
import numpy as np
from scipy import stats
from statsmodels.stats.proportion import proportion_confint

chg_pbo = w12.loc[w12.TRTP == "Placebo", "CHG"]
stats.ttest_1samp(chg_pbo, 0).confidence_interval(0.95)

chg_20 = w12.loc[w12.TRTP == "VTX-221 20 mg", "CHG"]
stats.ttest_ind(chg_20, chg_pbo, equal_var=False).confidence_interval(0.95)

x, n = 43, 80
proportion_confint(x, n, alpha=0.05, method="normal")   # Wald
proportion_confint(x, n, alpha=0.05, method="wilson")   # Wilson
proportion_confint(x, n, alpha=0.05, method="beta")     # Clopper-Pearson
```

:::lines
9: `equal_var=False` gives Welch. SciPy's **default is `equal_var=True`** (pooled) — the opposite of R's default. Three languages, three defaults; write the argument every time.
14: statsmodels calls Clopper–Pearson `"beta"`, because the bounds are beta quantiles. It is the same interval SAS calls `exact` and R's `binom.test` returns.
:::
:::
::::

## Output

```text
                             The TTEST Procedure

                              Variable:  CHG

trtp             N        Mean     Std Dev     Std Err
------------------------------------------------------
Placebo         77     -3.3000     11.6100      1.3231
VTX-221 20 mg   80    -12.2762     11.4967      1.2854
Diff (1-2)             8.9762      11.5510      1.8442

trtp              Method             Mean      95% CL Mean
-----------------------------------------------------------
Placebo                            -3.3000    -5.9351  -0.6649
VTX-221 20 mg                     -12.2762   -14.8347  -9.7178
Diff (1-2)        Pooled            8.9762     5.3331  12.6194
Diff (1-2)        Satterthwaite     8.9762     5.3323  12.6202
```

:::number[Why does the SAS difference read +8.98 when the effect is a reduction of 8.98?]
SAS computes `Diff (1-2)` using the **alphabetical order of the class levels**: "Placebo" sorts before "VTX-221 20 mg", so the difference is placebo minus drug. The clinically meaningful direction is drug minus placebo, −8.98 mmHg. Fix it deliberately — reorder with a format and `ORDER=FORMATTED`, or flip the sign in the table program and document it — and never by editing the number by hand. A sign error in a primary efficacy table is among the most serious errors a programmer can make, and it is invisible unless someone checks the direction.
:::

## Interpretation

**Correct, and sayable:** "The estimated difference is a 8.98 mmHg greater reduction on VTX-221 20 mg than on placebo, with a 95% confidence interval from 5.33 to 12.62 mmHg. Values in that range are compatible with the observed data; the interval excludes zero."

**What it rules out in both directions:** effects smaller than 5.3 mmHg are not well supported, and neither are effects larger than 12.6 mmHg. If the team's commercial case assumed 15 mmHg, this trial is evidence against it.

:::clinical
A 5 to 13 mmHg reduction in systolic pressure is clinically meaningful — the low end of that range is roughly the effect size associated with measurable cardiovascular risk reduction in the epidemiological literature. But note what the interval does *not* settle: it is a group-average effect. Individual subjects in this trial ranged from large increases to reductions over 30 mmHg. A confidence interval for a mean says nothing about how any one patient will respond, and a clinician reading the table should be told the SD alongside it.
:::

## Common mistakes

:::mistake[Saying "95% probability the true value is in this interval"]
The parameter is fixed; the interval is random. The 95% is a property of the **procedure** over repeated trials, not of the one interval you computed. The defensible phrasing is: "we are 95% confident", or better, "the interval, computed by a procedure that captures the true value 95% of the time, runs from A to B". If you genuinely want the probability statement, fit a Bayesian model and report a credible interval — then the statement is correct and you say "credible interval" so the reader knows which you mean.
:::

:::mistake[Using the Wald interval for a rare event]
Zero events in 20 subjects gives a Wald interval of exactly (0.000, 0.000). Nobody believes the true rate is exactly zero. Use Clopper–Pearson or Wilson. For a quick mental check with zero events, the **rule of three** gives an upper bound of about $3/n$: 0/100 gives about 3%, and the exact calculation gives 3.62%.
:::

:::mistake[Reading overlapping CIs as "no difference"]
Two arms' individual confidence intervals can overlap substantially while the interval **for their difference** excludes zero. The variance of a difference is not the sum of the interval widths. Always compute the interval for the contrast you care about. This mistake appears constantly in published figures that show per-arm error bars and invite the reader to compare them by eye.
:::

:::mistake[Treating a CI that includes zero as proof of no effect]
Absence of evidence is not evidence of absence. A CI of (−14, +6) includes zero and also includes a 14 mmHg benefit — it is an uninformative trial, not a negative one. A CI of (−0.4, +0.3) includes zero and genuinely does rule out anything clinically meaningful. Same p-value conclusion; opposite scientific conclusions. Reporting only "not significant" collapses the two, which is exactly why ICH E9 asks for intervals.
:::

:::mistake[Letting the software pick pooled versus Welch]
SAS prints both. R defaults to Welch. SciPy defaults to pooled. The SAP should state which one the analysis uses, and your program should say so explicitly rather than relying on a default. Choosing after seeing which gives the smaller p-value is a serious integrity problem, not a judgement call.
:::

## Knowledge check

::quiz{ids="stats.ci.interpretation,stats.ci.multiplier,stats.ci.wald-failure,stats.ci.overlap"}

## Hands-on exercise

::practice{ids="stats.ci.hand-ci,stats.ci.width-halving,stats.ci.rule-of-three,stats.ci.r-proportions" title="Practice: building and reading intervals"}

## Challenge exercise

::practice{ids="stats.ci.sign-direction,stats.ci.ni-margin,stats.ci.coverage-open" title="Challenge: direction, margins and coverage"}

## Industry note

**Which interval does a SAP actually specify?** For a binary endpoint in a small oncology cohort, most SAPs specify Clopper–Pearson — it is the conservative default and reviewers never argue with it. For larger studies Wilson is increasingly common because it is nearly as safe and materially narrower. Wald appears mainly in legacy shells. In every case the SAP names the method; "95% CI" alone is under-specified, and you should raise it as a comment on a draft SAP rather than choosing silently in code.

:::standard{kind="convention"}
Reporting response rates with exact (Clopper–Pearson) intervals is an industry convention, particularly for single-arm oncology studies. It is not mandated by a specific regulation; what binds you is your protocol and SAP. The FDA guidance landscape addresses endpoint choice and multiplicity in detail, but generally leaves the choice of binomial interval method to the sponsor's pre-specification.
:::

**Non-inferiority is where CIs earn their keep.** In an NI trial the primary conclusion is a statement about an interval and a margin: non-inferiority is concluded if the confidence interval for the treatment difference lies entirely on the favourable side of the pre-specified margin $\delta$. The margin has to be justified on clinical and historical-evidence grounds before unblinding, and a one-sided 97.5% interval is the usual convention (equivalent to the two-sided 95% bound). If you ever hear "the p-value was non-significant so we showed non-inferiority", that is exactly backwards — failing to show a difference is not showing equivalence.

**The confidence interval is what survives into the label.** P-values rarely appear in prescribing information; effect estimates with intervals do. When you build the table, you are building the sentence a physician will eventually read.

:::interview[A subgroup forest plot shows the elderly subgroup with a hazard ratio of 0.55 and a wide CI crossing 1. The team wants to say the drug works especially well in the elderly. What do you say?]
Three things, in order. First, the point estimate in a small subgroup is unstable: with wide intervals, extreme point estimates are *expected* even under a perfectly uniform treatment effect — that is regression to the mean in subgroup analysis. Second, the relevant statistical question is not whether each subgroup is individually significant but whether there is evidence of a **treatment-by-subgroup interaction**; test that, and report it, rather than comparing subgroup p-values. Third, ask whether the subgroup analysis was pre-specified in the SAP and whether multiplicity was addressed; an exploratory subgroup finding is hypothesis-generating and must be described as such in the CSR. The constructive version of the answer offers what you *can* say: the CI is consistent with the overall effect, and the data neither support nor rule out a larger benefit in this subgroup.
:::
