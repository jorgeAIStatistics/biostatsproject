## What problem are we trying to solve?

You have fitted the primary ANCOVA. The treatment effect is −7.72 mmHg, p < 0.0001, and the table is ready.

Then your QC colleague asks the question that should have come first: **"How do you know the model is right?"**

Least squares will fit a line to anything. It does not complain if the relationship is curved, if the variance grows with the fitted value, if the residuals are wildly skewed, or if one subject is dragging the entire estimate. It returns coefficients, standard errors and p-values with exactly the same confidence in every case.

Diagnostics are how you find out whether those numbers mean what they claim. And the payoff is concrete:

- A **curved** relationship means your slope is the slope of the wrong thing.
- **Growing variance** means your coefficients are fine but your standard errors and p-values are not.
- **One influential subject** can move a treatment effect enough to change a trial's conclusion — and nothing in the output warns you.

This lesson is also where a distinction gets made that most people never make: **an outlier and an influential point are different things**, and only one of them matters.

## Intuition

Everything the model failed to explain is in the residuals. If the model is right, the residuals should be **structureless** — a shapeless cloud with no pattern in any direction. Any pattern you can see is signal that belongs in the model and isn't.

Three distinct ways a single observation can be unusual, and they are independent of each other:

**An outlier** has an unusual **y** — its actual value is far from what the model predicts. Large residual.

**A high-leverage point** has an unusual **x** — an extreme predictor value. It sits far from the centre of the predictor cloud, so the fitted line has to pay attention to it whether it wants to or not.

**An influential point** is one whose **removal would change the fit**. That requires *both* an unusual x and an unusual y.

:::why[Why isn't a big outlier automatically influential?]
Because leverage determines how much pull a point has. Picture a seesaw: the fitted line pivots around the centroid of the data. A point sitting near the middle of the x range has almost no lever arm — you can move it a long way vertically and the line barely tilts. A point at the far end of the x range has a long lever arm, so even a modest vertical displacement swings the line.

That is why you need **both** pieces of information. Cook's distance combines them into one number, and it is the quantity that actually answers "would my conclusion change?"

In the real data below there is a subject with a studentized residual of −3.42 — a genuine outlier by any standard — whose removal changes the treatment effect by **0.065 mmHg**. It is unusual and it does not matter.
:::

::widget{name="regression-diagnostics"}

## Clinical context

| When diagnostics matter most | Why |
|---|---|
| Small studies (phase I, pilots, PK) | One subject is a large share of the data |
| Skewed outcomes (labs, PK, cytokines, costs) | Equal-variance and normality assumptions are most at risk |
| Dose–response models | Curvature is common and a linear slope would mislead |
| Anything going into a regulatory submission | A reviewer may ask, and "we didn't look" is not an answer |
| Manufacturing and assay data | Outliers may be genuine process excursions worth investigating |

:::standard{kind="convention"}
There is no regulatory requirement to include residual plots in a CSR, and they normally live in the analysis documentation rather than the report body. What *is* expected is that the analysis is appropriate for the data, and a reviewer can ask how that was established. Most sponsors' standard practice is to run diagnostics, document them, and pre-specify in the SAP what would trigger a sensitivity analysis — so the response to an outlier is decided before anyone knows which subject it is.
:::

:::mistake[Deleting an outlier because it is an outlier]
Removing a subject because their value is extreme, after seeing that it hurts your result, is data manipulation — however it is described. The legitimate sequence is: (1) investigate it as a **data** question — is it a transcription error, a unit error, a protocol violation? (2) if it is an error, correct or query it through data management, with an audit trail; (3) if it is genuine, **keep it** and run a pre-specified sensitivity analysis with and without it, reporting both.

"The result holds with and without subject 182" is a strong sentence. "We excluded subject 182" is a finding against you.
:::

## Formal concept

### Leverage

For observation $i$, the **hat value** $h_i$ is the $i$-th diagonal of the hat matrix $H = X(X'X)^{-1}X'$. It measures how far $x_i$ sits from the centre of the predictor space, and it satisfies

$$
\frac{1}{n} \le h_i \le 1, \qquad \sum_{i=1}^n h_i = p
$$

where $p$ is the number of parameters. So the **average leverage is exactly $p/n$**.

:::number[Where do the 2p/n and 3p/n thresholds come from?]
They are simply "two or three times the average". Since the hat values sum to $p$ and there are $n$ of them, the mean is $p/n$ by arithmetic necessity — so flagging points more than twice the average is a natural, if arbitrary, rule.

In the ANCOVA below, $p = 4$ (intercept, two treatment dummies, baseline) and $n = 238$, so the average leverage is $4/238 = 0.0168$ and the $2p/n$ threshold is 0.0336. **These are conventions, not tests** — a point above the threshold is worth looking at, not worth removing.
:::

### Residuals: three kinds

| Type | Formula | What it is for |
|---|---|---|
| **Raw** | $e_i = y_i - \hat{y}_i$ | In the units of $y$; not comparable across observations |
| **Standardized (internally studentized)** | $e_i / (\hat{\sigma}\sqrt{1-h_i})$ | Corrects for the fact that high-leverage points have *smaller* residual variance |
| **Studentized (externally studentized)** | $e_i / (\hat{\sigma}_{(i)}\sqrt{1-h_i})$ | Uses $\hat\sigma$ estimated **without** observation $i$ |

:::why[Why do high-leverage points have smaller residuals?]
Because the fitted line is pulled toward them. $\operatorname{Var}(e_i) = \sigma^2(1 - h_i)$, so as $h_i \to 1$ the residual variance goes to zero — a point with leverage 1 is fitted *exactly*, with a residual of precisely zero.

This is a trap for the unwary: **the most influential points can have the smallest raw residuals**, because they have succeeded in dragging the line to themselves. Scanning raw residuals for large values systematically misses exactly the observations you most need to find. Dividing by $\sqrt{1-h_i}$ is the correction.

The externally studentized version goes further by excluding the point from its own variance estimate — so a genuine outlier cannot inflate the $\hat\sigma$ that it is being judged against. Under the model it follows a $t$ distribution with $n - p - 1$ degrees of freedom, which is why $|r_i| > 3$ is a reasonable flag.
:::

### Cook's distance

$$
D_i = \frac{e_i^2}{p\,\hat{\sigma}^2} \cdot \frac{h_i}{(1-h_i)^2}
$$

The first factor is the outlyingness in $y$; the second is the leverage in $x$. **Cook's D is large only when both are.**

Its meaning is direct: $D_i$ measures how far *all* the fitted values move when observation $i$ is deleted. Common thresholds are $D_i > 1$ (serious) and $D_i > 4/n$ (worth a look) — again conventions, not tests.

### The four plots

| Plot | Checks | What a problem looks like |
|---|---|---|
| Residuals vs fitted | Linearity, equal variance | Curvature (a smile or frown); a funnel or fan shape |
| Q–Q plot of residuals | Normality | Systematic departure from the line, especially in the tails |
| Scale–location ($\sqrt{|\text{std resid}|}$ vs fitted) | Equal variance, more sensitively | An upward trend |
| Residuals vs leverage, with Cook's D contours | Influence | Points beyond a Cook's D contour |

:::mistake[Testing for normality instead of looking at the residuals]
Shapiro–Wilk, Kolmogorov–Smirnov and their relatives are badly calibrated for this job. At $n = 1000$ they detect departures far too small to affect anything; at $n = 20$ they detect nothing even when it matters. Worse, switching analyses based on the result makes your procedure data-dependent and invalidates the error rate you claim.

Look at the Q–Q plot, decide whether the departure is large enough to matter given your sample size, and pre-specify the analysis in the SAP. A formal test is reportable as description; it should not be a decision rule.
:::

## Worked example

The primary ANCOVA, `CHG ~ TRTP + BASE`, on 238 subjects. Here $p = 4$ and $n = 238$.

**Step 1 — leverage.** Average leverage is $p/n = 4/238 = 0.01681$. The threshold $2p/n = 0.03361$.

Maximum observed leverage: **0.0412**, at observation 150 (whose Cook's D is only 0.0166 — extreme in x, unremarkable in y). Four observations exceed $2p/n$.

:::number[Why is the maximum leverage only 0.041 when leverage can reach 1?]
Because with 238 observations and only one continuous predictor spanning a modest range, no single subject is far from the centre of the predictor space. High leverage requires an *unusual combination* of predictor values, and with one covariate the only way to be unusual is to have an extreme baseline — and the most extreme baseline here (173 mmHg) is just 2.5 SDs from the mean.

Leverage becomes a real concern with many predictors, small $n$, or a predictor with genuine outliers. A rough guide: with $p$ predictors the maximum possible leverage grows, and with $n$ small, $p/n$ itself becomes large. At $n = 20$ and $p = 4$ the average leverage is 0.2, and a single subject can easily exceed 0.5.
:::

**Step 2 — outliers.** Externally studentized residuals: maximum $|r_i| = 3.415$, at observation 182. Three observations exceed 3; seven exceed 2.

With $n = 238$ under a correct model you would *expect* about $238 \times 0.0027 = 0.6$ observations beyond $\pm 3$ and about 11 beyond $\pm 2$. Finding 3 and 7 is unremarkable.

**Step 3 — influence.** Maximum Cook's D: **0.0763**, also at observation 182. The $4/n$ threshold is 0.0168, and 10 observations exceed it. **No observation exceeds 1** — not remotely.

**Step 4 — look at the worst offender.**

| | Observation 182 |
|---|---|
| Arm | VTX-221 10 mg |
| Baseline | 133.7 mmHg |
| Change from baseline | −33.0 mmHg |
| Leverage | 0.0266 (above average, well below threshold) |
| Studentized residual | −3.415 (a genuine outlier) |
| Cook's D | 0.0763 (nowhere near 1) |

This subject started at a relatively *low* baseline and dropped 33 mmHg — a much larger fall than the model predicts for someone starting there.

**Step 5 — the test that matters: refit without them.**

| | 20 mg − placebo |
|---|---:|
| All 238 subjects | −7.7152 |
| Excluding observation 182 | −7.6504 |

**A difference of 0.065 mmHg.** The most extreme observation in the dataset moves the primary treatment effect by less than a tenth of a millimetre of mercury.

:::number[Why does a 3.4-sigma outlier barely move the estimate?]
Because its leverage is only 0.0266 — near the centre of the predictor space. Look at the two factors in Cook's D:

$$D_i = \underbrace{\frac{e_i^2}{p\hat\sigma^2}}_{\text{large}} \times \underbrace{\frac{h_i}{(1-h_i)^2}}_{\text{small}}$$

The outlyingness term is large, but $h_i/(1-h_i)^2 = 0.0266/0.9475 = 0.0281$ is small, and their product is 0.076.

**This is the whole point of the outlier/influence distinction.** With 238 subjects, one unusual value near the middle of the x range is absorbed by the other 237. The subject is real, the value is extreme, and the correct action is to leave it in the analysis.
:::

**Step 6 — assumptions overall.**

| Check | Result | Reading |
|---|---|---|
| Residual quantiles | −33.8, −6.3, −0.4, 7.1, 32.9 | Symmetric, median near zero |
| Shapiro–Wilk | W = 0.9956, p = 0.733 | No evidence against normality |
| Correlation of \|residual\| with fitted | 0.082 | No sign of growing variance |
| Max Cook's D | 0.076 | No influential observations |

The model is behaving. **That is worth documenting**, not just noting — "diagnostics were reviewed and no influential observations or assumption violations were identified" is a sentence a reviewer may ask you to support.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — the Week 12 records feeding the primary ANCOVA"}

What each diagnostic would look like if something *were* wrong:

| Symptom | Likely cause | What to do |
|---|---|---|
| Curvature in residuals vs fitted | Non-linear relationship | Add a quadratic term, transform, or use a spline — pre-specified |
| Funnel widening to the right | Variance grows with the mean | Log-transform (if multiplicative), weighted least squares, or robust SEs |
| Q–Q tails bending away | Heavy-tailed errors | Usually tolerable at large n; consider robust regression or a rank method |
| A few points far right on the leverage plot | Extreme predictor values | Check them as data; consider whether the range should be restricted |
| Cook's D above 1 | Genuinely influential observation | Investigate as data; sensitivity analysis with and without |
| Residuals clustered by subject | Repeated measures treated as independent | Wrong model — use MMRM or a mixed model |

:::mistake[The diagnostic that regression plots cannot show you]
A residuals-versus-fitted plot cannot reveal a violation of **independence** unless you plot the residuals against the grouping variable. If four visits per subject are in the model as if they were independent, the residual plots can look perfectly healthy while every standard error is wrong by a factor of two or three.

Independence is the assumption that matters most and the one diagnostics are worst at detecting. It is checked by knowing the **structure of your data**, not by looking at a plot — which is why "what is the grain of this dataset?" is the first question to ask about any analysis.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc reg data=w12 plots(only)=(residualbypredicted qqplot
                               rstudentbyleverage cooksd);
  model chg = trt10 trt20 base / influence r;
  output out=diag p=pred r=resid rstudent=rstud h=lev cookd=cook;
run;
quit;

/* Find the observations worth looking at */
proc sql;
  create table flagged as
  select *, 4/count(*) as cook_cut
  from diag
  having cook > calculated cook_cut
      or abs(rstud) > 3
      or lev > 4 * 4 / count(*);
quit;
```

:::lines
3: `influence` prints the full influence table — leverage, studentized residuals, Cook's D, DFFITS and DFBETAS for every observation. On a large dataset this is a lot of output, which is why the `output` dataset is usually the more practical route. `r` requests the residual analysis table. PROC REG has no `CLASS` statement, so treatment must be pre-coded into dummy variables (`trt10`, `trt20`). PROC GLM handles `CLASS` but has weaker diagnostics — a genuine annoyance, and the usual workaround is to fit in GLM for the inference and in REG for the diagnostics.
5: The `output` statement is the practical tool: it writes every diagnostic back as a dataset you can filter, plot and join to subject identifiers.
12: `4/count(*)` computes the Cook's D threshold from the data rather than hard-coding it, so the same program works on any dataset size.
:::
:::

:::tab[R]
```r
fit <- lm(CHG ~ TRTP + BASE, data = w12)

par(mfrow = c(2, 2))
plot(fit)              # the four standard diagnostic plots

# The numbers behind the plots
n <- nobs(fit); p <- length(coef(fit))
diag_tbl <- data.frame(
  USUBJID = w12$USUBJID,
  leverage = hatvalues(fit),
  rstudent = rstudent(fit),
  cooksd   = cooks.distance(fit)
)

subset(diag_tbl,
       leverage > 2 * p / n | abs(rstudent) > 3 | cooksd > 4 / n)

# The check that actually matters: does the conclusion move?
worst <- which.max(cooks.distance(fit))
coef(lm(CHG ~ TRTP + BASE, data = w12[-worst, ]))
```

:::lines
4: `plot(fit)` produces residuals-vs-fitted, a Q–Q plot, scale–location and residuals-vs-leverage with Cook's D contours. `which = 1:6` adds a Cook's D bar plot and a Cook's-vs-leverage plot.
8: `nobs(fit)` rather than `nrow(data)` — if any rows were dropped for missing values, they differ, and the leverage threshold would be computed against the wrong n.
11: **Keeping `USUBJID` alongside the diagnostics is the practical step.** A row number tells you nothing; a subject identifier lets you look them up in the raw data, check the CRF and ask data management.
20: Refitting without the most influential point is the only diagnostic that directly answers "would my conclusion change?". Everything else is a proxy for it.
:::
:::

:::tab[Python]
```python
import statsmodels.formula.api as smf
import statsmodels.api as sm
import numpy as np

fit  = smf.ols("CHG ~ C(TRTP) + BASE", data=w12).fit()
infl = fit.get_influence()

diag = w12.assign(
    leverage = infl.hat_matrix_diag,
    rstudent = infl.resid_studentized_external,
    cooksd   = infl.cooks_distance[0],
)

n, p = int(fit.nobs), len(fit.params)
diag.query("leverage > @2*@p/@n or abs(rstudent) > 3 or cooksd > 4/@n")

sm.graphics.influence_plot(fit)
```

:::lines
6: `get_influence()` returns an object holding every diagnostic; computing it once and reusing it is much cheaper than requesting each separately, since they share the hat matrix.
10: `cooks_distance` returns a **tuple** — `[0]` is the distances and `[1]` is the associated p-values. Forgetting the index gives an array of tuples and a confusing downstream error.
17: `influence_plot` draws studentized residuals against leverage with bubble sizes proportional to Cook's D — the single most informative diagnostic picture, since it shows all three quantities at once.
:::
:::
::::

## Output

```text
                              The REG Procedure

                      Output Statistics

           Hat Diag                 Cook's
Obs        H          RStudent      D
------------------------------------------------
182        0.0266      -3.415       0.0763
 82        0.0141       3.297       0.0373
116        0.0160      -3.079       0.0371
175        0.0222      -2.188       0.0268
 29        0.0153      -2.629       0.0262
150        0.0412      -1.246       0.0166

Sum of Hat Diag = 4.0000    (= number of parameters)
```

:::number[Why does the sum of the hat values equal exactly 4?]
Because $\sum_i h_i = \operatorname{trace}(H) = \operatorname{rank}(X) = p$, and $p = 4$ here (intercept, two treatment dummies, baseline). It is an algebraic identity, not a property of these data.

It is also a **useful check**: if the hat values in your output do not sum to the number of parameters, either the model is rank-deficient (collinear predictors) or you are not looking at the whole dataset. The same identity is why the average leverage is $p/n$ and why the thresholds are multiples of it.
:::

## Interpretation

> Model diagnostics were reviewed for the primary ANCOVA. Residuals were approximately symmetric with no evidence of non-normality (Shapiro–Wilk p = 0.73) and no relationship between residual magnitude and fitted value. Maximum leverage was 0.041 (against an average of 0.017) and maximum Cook's distance was 0.076; no observation exceeded conventional influence thresholds. Excluding the observation with the largest studentized residual (−3.42) changed the estimated treatment difference by 0.065 mmHg.

That last sentence is the one that settles the question. It is concrete, it is checkable, and it is far more persuasive than "diagnostics were satisfactory".

:::clinical
Subject 182 dropped 33 mmHg from a baseline of 134 — a large fall from an already modest starting pressure. Statistically it is an outlier and not influential. **Clinically it may still be worth a look**: a fall of that size could reflect a genuine strong response, a measurement or transcription error, a protocol deviation such as a concomitant antihypertensive, or a subject who was unwell at the visit. None of those change the analysis, and all of them are worth knowing before the data review meeting. Diagnostics are a way of finding subjects worth asking about, not only a way of validating a model.
:::

## Common mistakes

:::mistake[Scanning raw residuals for outliers]
$\operatorname{Var}(e_i) = \sigma^2(1-h_i)$, so high-leverage points have *smaller* residual variance — the observations that have most successfully dragged the line toward themselves have the smallest raw residuals. Use studentized residuals, which correct for this.
:::

:::mistake[Treating diagnostic thresholds as tests]
$2p/n$, $4/n$, $|r| > 3$ and $D > 1$ are conventions for deciding what to look at. Exceeding one is not a finding and not grounds for exclusion. The only question that matters is whether the conclusion changes, and the way to answer it is to refit.
:::

:::mistake[Excluding an outlier after seeing that it hurts the result]
Investigate it as data; if it is genuine, keep it and report a sensitivity analysis. Pre-specify the handling rule in the SAP, before anyone knows which subject it is.
:::

:::mistake[Relying on a normality test]
Underpowered at small n, oversensitive at large n, and using it as a decision rule makes the analysis data-dependent. Look at the Q–Q plot and judge whether the departure matters given the sample size.
:::

:::mistake[Believing residual plots can detect dependence]
They cannot, unless you plot residuals against the grouping variable. Four visits per subject in a model that assumes independence can produce beautiful diagnostic plots and standard errors that are wrong by a factor of three. Independence is verified from the data's structure, not from a plot.
:::

## Knowledge check

::quiz{ids="stats.rd.outlier-vs-influential,stats.rd.leverage-sum,stats.rd.small-residual-trap,stats.rd.normality-test"}

## Hands-on exercise

::practice{ids="stats.rd.average-leverage,stats.rd.cooks-components,stats.rd.refit-check,stats.rd.r-code" title="Practice: computing and reading diagnostics"}

## Challenge exercise

::practice{ids="stats.rd.funnel-shape,stats.rd.independence-miss,stats.rd.outlier-open" title="Challenge: variance, dependence and handling an outlier"}

## Industry note

**Diagnostics belong in the analysis documentation, not usually in the CSR body.** They are part of the evidence that the analysis was appropriate, and a reviewer can ask for them. The practical standard is: run them, save the outputs with the program, and be able to produce them on request.

**Pre-specify the response to outliers.** The strongest position is a SAP that says what will happen *before* anyone knows which subject is involved — for example, "the primary analysis will include all observed data; a sensitivity analysis excluding observations with Cook's distance exceeding 1 will be performed". Then the decision is procedural rather than discretionary, which is the whole point.

:::standard{kind="convention"}
Cook's distance thresholds of 1 (serious) and 4/n (worth examining) are widely used conventions from the applied regression literature, not regulatory criteria. Different textbooks give different cut-offs, and none of them is a hypothesis test. What matters is whether excluding the point changes the conclusion — which is a question you answer by refitting, not by comparing to a threshold.
:::

**Robust standard errors are increasingly common.** When equal variance is in doubt, heteroscedasticity-consistent ("sandwich", HC0–HC3) standard errors give valid inference without changing the coefficients or requiring you to choose a transformation. They are standard in econometrics, increasingly accepted in clinical work, and available in SAS (`PROC GENMOD` with `REPEATED`, or `HCCMETHOD=` in `PROC REG`), R (`sandwich::vcovHC`) and statsmodels (`cov_type="HC3"`). As with everything else, pre-specify — switching to robust SEs after seeing the ordinary ones is the same selection problem in a different costume.

**In practice, MMRM has absorbed much of this.** For a longitudinal endpoint the primary analysis is usually a mixed model with an unstructured covariance, which handles the within-subject correlation directly rather than assuming it away. The diagnostics above still apply to the residuals of that model — but the most common assumption violation in clinical data, dependence, is designed out rather than diagnosed.

:::interview[You find a subject with a Cook's distance of 2.5 in your primary analysis. What do you do?]
Work outward from the data, not from the statistics.

First, **look at the subject**. A Cook's D of 2.5 means removing them meaningfully moves the fit, so I want to know who they are: pull their record and check whether the value is plausible. Is it a unit error — pounds where kilograms were expected, mg/dL where the CRF wanted µmol/L? A transposed digit? A visit-window deviation? A concomitant medication that should have excluded them? Most large influence values I have seen turn out to be data issues, and the right route for a data issue is a query through data management with an audit trail, not a deletion in the analysis program.

Second, **check what the SAP says**. If it pre-specifies a handling rule for influential observations, follow it. If it does not, the default is to include all observed data in the primary analysis — the primary is the primary — and to run a sensitivity analysis excluding the subject.

Third, **report both**. "The estimated difference was −7.7 mmHg (95% CI …); excluding the one subject with Cook's distance above 1, it was −6.9 mmHg (…)" is a complete and honest presentation. If the two agree, the result is robust and I have said so. If they disagree materially, that is genuinely important information about how much the trial rests on one patient, and hiding it would be the worst available option.

What I would not do is quietly drop them. And I would want the investigation to happen before database lock if at all possible, because after lock the options narrow to documenting rather than resolving.
:::
