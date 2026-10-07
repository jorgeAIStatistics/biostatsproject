## What problem are we trying to solve?

Two requests arrive on the same afternoon.

The clinical lead asks: *"Do patients who start with higher blood pressure drop more? I want to know if we should be targeting the severe patients."* You compute the correlation between baseline SBP and change from baseline and get **r = −0.46, p < 10⁻¹³**. Strongly negative, highly significant: higher baseline, bigger drop. The lead is delighted.

**That correlation is guaranteed to be negative before anyone is enrolled.** It would appear in a trial of pure water. It is an artefact of how `CHG` is constructed, and reporting it as a finding would be a genuine error in a CSR.

Meanwhile a device engineer asks: *"Our new cuff correlates with the reference monitor at r = 0.96. Can we say they agree?"*

**No.** A device reading exactly 20 mmHg too high on every patient would correlate at r = 1.00. Correlation measures whether two things move together, not whether they give the same answer.

Both requests are about correlation, both have intuitive answers that are wrong, and both come up constantly. This lesson is about what a correlation coefficient actually measures — and, just as importantly, the four things it does not.

## Intuition

Correlation asks one narrow question: **when one variable is above its mean, is the other one also above its mean?**

Take each subject's baseline SBP and subtract the group mean, giving a deviation that is positive or negative. Do the same for the other variable. Multiply the two deviations together:

- Both above average → positive × positive = **positive**
- Both below average → negative × negative = **positive**
- One above, one below → **negative**

Add those products across subjects. A large positive sum means the variables move together; a large negative sum means they move oppositely; a sum near zero means knowing one tells you nothing about the other.

The only remaining problem is scale. That sum depends on the units — measuring in mmHg versus kPa would change it. Dividing by the product of the two standard deviations strips the units out and forces the result into $[-1, +1]$. That is Pearson's $r$.

:::why[Why exactly $[-1, +1]$, and why is $\pm 1$ unreachable unless the points are on a line?]
The Cauchy–Schwarz inequality guarantees $|r| \le 1$, with equality only when one variable is an exact linear function of the other. Intuitively: $r$ is the cosine of the angle between the two centred data vectors. Cosine lives in $[-1, 1]$ by construction; $r = 1$ means the vectors point in exactly the same direction, which means every point lies on one straight line.

The cosine picture also explains the least intuitive property of $r$: it is entirely **blind to slope**. Rotating a line changes its slope but not the fact that all points lie on it, so $r$ stays at 1. Correlation tells you how *tightly* points cluster around a line, never how *steep* that line is.
:::

::widget{name="regression-diagnostics"}

## Clinical context

| Where correlation is used well | Where it is misused |
|---|---|
| Choosing a baseline covariate for ANCOVA | Claiming a baseline predicts response, using CHG |
| Assessing collinearity among predictors | Concluding causation from association |
| Checking a surrogate endpoint's association with a clinical one | Concluding two assays *agree* |
| Describing the within-subject correlation for an MMRM covariance structure | Comparing correlations across studies with different ranges |
| Exploratory screening of biomarker panels | Reporting the largest of 200 screened correlations as a finding |

The first row is the practically important one. In VTX221-201 the correlation between baseline and Week 12 SBP is $r = 0.304$ — modest, but enough that adjusting for baseline in the ANCOVA reduces the residual SD from 11.53 to 10.27 mmHg and shrinks the standard error of the treatment difference by about 11%. **That is the main legitimate use of a correlation in a clinical trial: deciding what to adjust for.**

:::standard{kind="convention"}
Labels like "weak" (r < 0.3), "moderate" (0.3–0.7) and "strong" (> 0.7) are conventions with no formal basis, and their meaning changes completely by field. An r of 0.3 between a biomarker and a clinical outcome may be scientifically important; an r of 0.95 between two assays that are supposed to measure the same analyte may be unacceptable. Report the coefficient with its confidence interval and say what it means in context, rather than reaching for an adjective.
:::

## Formal concept

### Pearson's product-moment correlation

$$
r = \frac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_i (x_i - \bar{x})^2}\sqrt{\sum_i (y_i - \bar{y})^2}}
= \frac{s_{xy}}{s_x s_y}
$$

It measures **linear** association only, and it is symmetric: $r_{xy} = r_{yx}$. There is no predictor and no outcome.

### Inference: the Fisher z transformation

The sampling distribution of $r$ is skewed — badly so when $|r|$ is large, because $r$ is bounded. Fisher's transformation fixes that:

$$
z = \frac{1}{2}\ln\!\left(\frac{1+r}{1-r}\right) = \operatorname{arctanh}(r),
\qquad
\operatorname{SE}(z) = \frac{1}{\sqrt{n-3}}
$$

Build the interval on the $z$ scale and transform back with $\tanh$.

:::number[Why $n - 3$ and not $n - 1$ or $n - 2$?]
Fisher derived the variance of $z$ as $1/(n-3)$ for bivariate normal data — it is a property of the transformation, not a degrees-of-freedom count in the usual "parameters estimated" sense. (The *test* of $H_0: \rho = 0$ does use $n-2$ degrees of freedom, because two means have been estimated.) The two coexist: $n-2$ for the t test, $n-3$ for the interval. Using $n-2$ in the interval is a common slip and makes it very slightly too narrow.
:::

For testing $H_0: \rho = 0$ specifically, there is an exact t test:

$$
t = \frac{r\sqrt{n-2}}{\sqrt{1-r^2}} \quad \text{on } n-2 \text{ df}
$$

### Spearman's rank correlation

Replace each value by its rank, then compute Pearson's $r$ on the ranks. It measures **monotone** association, not linear, and it is far less sensitive to outliers.

| | Pearson | Spearman |
|---|---|---|
| Measures | Linear association | Monotone association |
| Sensitive to outliers | **Very** | Much less |
| Assumes | Approximately bivariate normal for inference | Only that ranks are meaningful |
| Use when | Relationship is linear, no extreme outliers | Skewed data, ordinal variables, curved-but-monotone relationships |

:::number[How much can one outlier move Pearson's r?]
In a 20-point dataset with a genuine linear relationship, Pearson's $r = 0.969$ and Spearman's $\rho = 0.968$. Change the last point's $y$ from about 20 to −30 — one transcription error, one misplaced decimal — and Pearson collapses to **0.175** while Spearman only falls to **0.684**.

One bad value in twenty destroyed a Pearson correlation. This is why you plot the data before computing anything, and why a large Pearson/Spearman discrepancy is a diagnostic signal rather than a curiosity.
:::

### The four things correlation is not

**1. Not causation.** The standard warning, and the least often the actual problem in a randomized trial.

**2. Not agreement.** Two methods can correlate perfectly while differing by a constant bias or a scale factor. Agreement is assessed with a **Bland–Altman** plot — differences against means, with limits of agreement at $\bar{d} \pm 1.96 s_d$ — or with a concordance correlation coefficient, which penalises departure from the 45° line rather than from *any* line.

**3. Not slope.** $r$ and the regression slope $\beta$ are related by $\beta = r \cdot s_y/s_x$. Same $r$, different SDs, completely different clinical magnitude.

**4. Not comparable across samples with different ranges.** Restricting the range of $x$ shrinks $r$ even when the underlying relationship is unchanged. In this trial, age versus baseline SBP correlates at $r = 0.141$ across all 270 subjects; restricting to ages 50–60 drops it to $r = 0.107$ on 106 subjects. The biology did not change — the range did.

:::mistake[Correlating a change score with its own baseline]
$\operatorname{CHG} = \operatorname{AVAL} - \operatorname{BASE}$, so `BASE` appears in both variables with opposite signs. Even if `AVAL` and `BASE` were statistically independent, the correlation between `BASE` and `CHG` would be

$$\rho(\text{BASE}, \text{CHG}) = \frac{\rho\, s_{\text{AVAL}} - s_{\text{BASE}}}{\sqrt{s^2_{\text{AVAL}} + s^2_{\text{BASE}} - 2\rho\, s_{\text{AVAL}} s_{\text{BASE}}}}$$

which is negative whenever $\rho\, s_{\text{AVAL}} < s_{\text{BASE}}$ — the usual case. This is **mathematical coupling**, and it is the formal expression of regression to the mean. To ask whether baseline genuinely predicts response, fit `AVAL ~ BASE + TRT` and look at the baseline coefficient, or use ANCOVA. Never correlate a difference with one of its own components.
:::

## Worked example

Baseline systolic and diastolic blood pressure, all 270 ITT subjects.

**Step 1 — Pearson's r.**

$$
r = 0.2771
$$

**Step 2 — test $H_0: \rho = 0$.**

$$
t = \frac{0.2771\sqrt{268}}{\sqrt{1 - 0.2771^2}} = \frac{0.2771 \times 16.3707}{\sqrt{0.92319}} = \frac{4.5371}{0.96083} = 4.722
$$

on $n - 2 = 268$ df, giving $p = 3.8 \times 10^{-6}$.

**Step 3 — confidence interval via Fisher's z.**

$$
z = \operatorname{arctanh}(0.2771) = \tfrac{1}{2}\ln\!\left(\frac{1.2771}{0.7229}\right) = 0.28459
$$

$$
\operatorname{SE}(z) = \frac{1}{\sqrt{267}} = 0.061199
$$

$$
z \pm 1.96 \times 0.061199 = (0.16464,\; 0.40454)
$$

$$
\text{back-transform: } \tanh(0.16464) = 0.1632, \quad \tanh(0.40454) = 0.3838
$$

So $r = 0.277$ (95% CI 0.163 to 0.384).

**Step 4 — say what it means, carefully.** Systolic and diastolic pressure are positively associated, as physiology predicts. But $r^2 = 0.077$: knowing a subject's systolic pressure explains under 8% of the variation in their diastolic pressure. **A highly significant correlation that explains 8% of the variance** — the p-value reflects $n = 270$, not the strength of the relationship.

:::number[Why does $r^2$ deserve more attention than $r$?]
Because $r^2$ is the proportion of variance in one variable that is linearly predictable from the other, and it is the quantity with a concrete interpretation. The relationship is quadratic, so $r$ overstates the practical strength: $r = 0.3$ explains 9% of the variance; $r = 0.5$ explains 25%; $r = 0.7$ explains 49%. An $r$ of 0.5 sounds like "half", and it is not.
:::

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,AGE,SEX,BMIBL,SBPBL,DBPBL,ITTFL" rows="8" caption="ADSL — baseline characteristics available as candidate covariates"}

**Candidate covariates for the ANCOVA**, all 270 ITT subjects:

| Pair | Pearson r | 95% CI | p | Reading |
|---|---:|---|---:|---|
| SBPBL vs DBPBL | 0.277 | (0.163, 0.384) | 3.8 × 10⁻⁶ | Real but modest |
| BMIBL vs SBPBL | −0.022 | (−0.141, 0.097) | 0.71 | Nothing |
| AGE vs SBPBL | 0.141 | — | — | Weak |

:::number[BMI and blood pressure are strongly associated in the epidemiological literature. Why is r ≈ 0 here?]
Because these are not general-population subjects. Everyone was enrolled with screening SBP ≥ 140 mmHg, which is a **selection on the outcome variable** — and selecting on a variable attenuates its correlations with everything else, the same range-restriction mechanism as the age example. It is also plausible that the trial's BMI range is narrower than the population's (mean 30.8, SD 4.5).

The lesson generalises: **correlations computed inside a clinical trial population do not transfer to the general population**, because trial entry criteria always select. This is worth saying out loud whenever someone proposes using trial data to estimate an epidemiological association.
:::

**Baseline versus outcome, and baseline versus change** — the pair that matters:

| Pair | r | p | Legitimate? |
|---|---:|---:|---|
| BASE vs AVAL (Week 12) | **+0.304** | 1.7 × 10⁻⁶ | **Yes** — this is what justifies ANCOVA |
| BASE vs CHG | **−0.464** | 3.9 × 10⁻¹⁴ | **No** — mathematically coupled |

The second row is the trap from the opening. `CHG = AVAL − BASE`, so `BASE` is inside both variables with opposite signs. Plug the observed SDs ($s_{\text{BASE}} = 9.01$, $s_{\text{AVAL}} = 11.21$) and $\rho = 0.304$ into the coupling formula:

$$
\frac{0.304 \times 11.21 - 9.01}{\sqrt{11.21^2 + 9.01^2 - 2(0.304)(11.21)(9.01)}} = \frac{-5.5983}{12.0559} = -0.4644
$$

**Exactly the observed value.** The correlation is fully explained by the arithmetic of subtraction; there is no biological content in it at all.

**Anscombe's quartet** — four datasets, all with $r = 0.816$, identical means, identical regression slopes of 0.50, identical $R^2 = 0.666$:

| Set | What it actually looks like |
|---|---|
| 1 | A genuine linear relationship with scatter |
| 2 | A perfect **curve** — linear correlation is the wrong summary |
| 3 | A perfect line plus **one outlier** dragging the fit |
| 4 | All x identical except **one point** that creates the entire correlation |

Four completely different pictures, one correlation coefficient. **Plot first.**

## Code

::::tabs
:::tab[SAS]
```sas
proc corr data=adsl pearson spearman fisher(rho0=0 biasadj=no);
  where ittfl = 'Y';
  var sbpbl dbpbl bmibl age;
run;

/* A scatter plot matrix — look before you quote */
proc sgscatter data=adsl;
  where ittfl = 'Y';
  matrix sbpbl dbpbl bmibl age / diagonal=(histogram);
run;
```

:::lines
1: `pearson spearman` requests both. A large gap between them is a diagnostic: either outliers, or a monotone-but-non-linear relationship. `fisher` adds the Fisher-z confidence interval, which PROC CORR does **not** produce by default — without it you get a p-value and no interval, which is exactly the wrong pair of outputs. `biasadj=no` turns off the small-sample bias adjustment so the interval matches R's `cor.test()`. With `biasadj=yes` (the SAS default inside the `fisher` option) the numbers differ slightly, which is a real and confusing QC discrepancy.
2: `where ittfl = 'Y'` — correlations are population-specific, so the analysis population must be stated as deliberately here as anywhere else.
8: PROC CORR handles missing values pairwise by default (each pair uses all subjects with both values), so different cells can have different n. `nomiss` switches to listwise deletion. The two give different answers and the SAP should say which.
:::
:::

:::tab[R]
```r
itt <- adsl |> filter(ITTFL == "Y")

cor.test(itt$SBPBL, itt$DBPBL)                      # Pearson + CI + test
cor.test(itt$SBPBL, itt$DBPBL, method = "spearman") # Spearman

# Fisher's z by hand, to see where the interval comes from
r  <- cor(itt$SBPBL, itt$DBPBL)
n  <- sum(complete.cases(itt$SBPBL, itt$DBPBL))
z  <- atanh(r)
se <- 1 / sqrt(n - 3)
tanh(c(z - 1.96 * se, z + 1.96 * se))

# A correlation matrix — note the missing-value policy
cor(itt[, c("SBPBL", "DBPBL", "BMIBL", "AGE")],
    use = "pairwise.complete.obs")
```

:::lines
3: `cor.test()` gives the coefficient, the test and the Fisher-z interval together. `cor()` alone gives only the coefficient — a number with no uncertainty attached, which is rarely what you want in a report.
9: `atanh()` is R's arctanh and is exactly Fisher's z. Writing the interval out once makes clear why the SE involves n − 3 rather than n − 2.
15: **`use = "pairwise.complete.obs"` is not the default** — `cor()` defaults to `use = "everything"`, which returns `NA` for any pair containing a missing value. Pairwise deletion can also produce a correlation matrix that is not positive definite, which breaks downstream methods like PCA or factor analysis. `"complete.obs"` (listwise) avoids that at the cost of dropping subjects.
:::
:::

:::tab[Python]
```python
from scipy import stats

r, p = stats.pearsonr(itt.SBPBL, itt.DBPBL)
rho, p_s = stats.spearmanr(itt.SBPBL, itt.DBPBL)

# SciPy 1.9+ gives the Fisher-z interval directly
res = stats.pearsonr(itt.SBPBL, itt.DBPBL)
res.confidence_interval(confidence_level=0.95)

itt[["SBPBL", "DBPBL", "BMIBL", "AGE"]].corr()          # pandas: pairwise by default
itt[["SBPBL", "DBPBL", "BMIBL", "AGE"]].corr(method="spearman")
```

:::lines
3: `stats.pearsonr` returns the coefficient and p-value. Older SciPy versions return a plain tuple with no interval; the `confidence_interval()` method arrived in 1.9.
10: **pandas `.corr()` uses pairwise deletion by default**, the opposite of base R's `cor()`. Two languages, two defaults, and a correlation matrix computed on different subject sets in each — a QC discrepancy that is easy to miss because no value is obviously wrong.
:::
:::
::::

## Output

```text
                              The CORR Procedure

              Pearson Correlation Coefficients, N = 270
                     Prob > |r| under H0: Rho=0

                      SBPBL       DBPBL       BMIBL         AGE
        SBPBL       1.00000     0.27715    -0.02233     0.14087
                                 <.0001      0.7149      0.0206

        DBPBL       0.27715     1.00000     0.01843    -0.22989
                     <.0001                  0.7631      0.0001

     Pearson Correlation Statistics (Fisher's z Transformation)
                                              95% Confidence Limits
     Variable  With Variable    N        r    Lower      Upper
     SBPBL     DBPBL          270  0.27715  0.16317    0.38382
```

:::mistake[Reading a correlation matrix as a set of findings]
The matrix above contains 6 distinct correlations. Screening a panel of 20 biomarkers produces 190, and at α = 0.05 you would expect about 9 "significant" ones with no real associations at all. A correlation matrix is an exploratory tool for spotting structure and collinearity — not a source of results. If a correlation is going to be reported as a finding, it should have been pre-specified, and the multiplicity handled.
:::

## Interpretation

> Baseline systolic and diastolic blood pressure were positively correlated (r = 0.28, 95% CI 0.16 to 0.38, n = 270), consistent with the expected physiological relationship. Baseline systolic pressure was also correlated with Week 12 systolic pressure (r = 0.30), supporting its pre-specified inclusion as a covariate in the primary ANCOVA model.

Note what that paragraph does *not* contain: any correlation involving `CHG`, any causal language, and any adjective substituting for a number.

:::clinical
For a clinician, the most useful translation of r = 0.28 is that it explains under 8% of the variation — systolic and diastolic pressure are related, but knowing one leaves most of the other unexplained, which is exactly why both are measured and why isolated systolic hypertension is a recognised entity. The more consequential correlation in this trial is the 0.30 between baseline and Week 12: it says that a patient's starting pressure carries real but limited information about where they end up, which is both why baseline adjustment helps the analysis and why individual response cannot be predicted from baseline alone.
:::

## Common mistakes

:::mistake[Correlating change with baseline]
Mathematical coupling guarantees a negative correlation. The observed −0.464 is reproduced exactly by the coupling formula from the SDs alone. To ask whether baseline predicts response, model `AVAL ~ BASE + TRT` instead.
:::

:::mistake[Using correlation to assess agreement between two methods]
A device reading 20 mmHg high on every subject correlates at r = 1.00. Use a Bland–Altman analysis: plot differences against means, report the mean bias and the limits of agreement ($\bar{d} \pm 1.96 s_d$), and decide in advance what limits are clinically acceptable.
:::

:::mistake[Comparing correlations across populations with different ranges]
Restriction of range attenuates r mechanically. The age–SBP correlation falls from 0.141 to 0.107 when the sample is restricted to ages 50–60, with no change in the underlying relationship. Trial populations are always range-restricted by entry criteria, so correlations computed in them systematically understate population associations.
:::

:::mistake[Reporting r without n or an interval]
"r = 0.6" means something very different at n = 10 (95% CI −0.02 to 0.89) than at n = 1000 (0.56 to 0.64). Always report the coefficient with its confidence interval and the sample size.
:::

:::mistake[Computing without plotting]
Anscombe's four datasets share r = 0.816, identical means, identical slopes and identical R². One is linear, one is a perfect curve, one is a line plus an outlier, one is a single influential point. No summary statistic distinguishes them; a five-second scatter plot does.
:::

## Knowledge check

::quiz{ids="stats.cr.coupling,stats.cr.agreement,stats.cr.r-squared,stats.cr.range-restriction"}

## Hands-on exercise

::practice{ids="stats.cr.fisher-z,stats.cr.t-statistic,stats.cr.pearson-vs-spearman,stats.cr.r-code" title="Practice: computing and interpreting correlations"}

## Challenge exercise

::practice{ids="stats.cr.missing-policy,stats.cr.matrix-screening,stats.cr.surrogate-open" title="Challenge: missing data, screening and surrogate endpoints"}

## Industry note

**The one place a correlation belongs in a SAP.** Justifying a covariate. "Baseline value is included as a covariate because it is correlated with the endpoint" is a legitimate and expected sentence — the correlation is what makes the adjustment worth doing. Beyond that, correlations in a clinical trial report are almost always exploratory and should be labelled as such.

**Bland–Altman, not correlation, for method comparison.** Any time two measurement methods, two devices, two assays or two readers are being compared, the question is agreement and the tool is Bland–Altman with pre-specified limits. Reporting a correlation instead is a well-known error in the method-comparison literature and a reliable way to be asked for a reanalysis.

**Surrogate endpoint validation needs much more than correlation.** A biomarker correlating with a clinical outcome is necessary but nowhere near sufficient for it to serve as a surrogate. The standard framework requires showing that the *treatment effect* on the surrogate predicts the *treatment effect* on the clinical endpoint — typically across multiple trials, using a surrogate-threshold or meta-analytic approach. The history of surrogate endpoints contains several cases where a well-correlated biomarker moved in the right direction while mortality moved in the wrong one, which is why regulators are cautious about them.

:::standard{kind="official"}
FDA and NIH jointly publish the BEST (Biomarkers, EndpointS, and other Tools) Resource, which defines the distinction between a biomarker, a surrogate endpoint and a clinical endpoint, and describes the levels of evidence required for each. It is the reference to cite when someone proposes using a correlated biomarker as an endpoint.
:::

:::interview[A colleague shows you a correlation of 0.85 between a new biomarker and disease severity, and proposes it as a trial endpoint. What questions do you ask?]
Work outward from the number. First, the basics anyone should ask: what is n, what is the confidence interval, and have they plotted it — an r of 0.85 from 12 patients is compatible with almost anything, and Anscombe's quartet is the standing reminder that a coefficient does not describe a shape.

Then the population question: in whom was this measured? If it is a case-control sample of very healthy and very sick people, the correlation is inflated by range extension, and it will shrink in a trial population selected to be homogeneous.

Then the one that usually settles it: correlation with severity at a point in time is not what an endpoint needs to do. An endpoint has to *respond to treatment* in a way that tracks clinical benefit. The question is not "does the biomarker correlate with disease?" but "does the treatment effect on the biomarker predict the treatment effect on the outcome patients care about?" — and that requires longitudinal data, ideally across multiple trials with known clinical results. I'd point at the BEST framework and ask which level of evidence they think they have.

Finally I'd ask what happens if we are wrong: if the biomarker moves and the clinical outcome does not, what have we learned and what have we exposed patients to? The honest version of this conversation usually ends with the biomarker as a secondary or exploratory endpoint in a trial powered on something else — which is a good outcome, not a rejection.
:::
