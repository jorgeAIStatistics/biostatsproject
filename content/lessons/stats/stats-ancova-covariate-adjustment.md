## What problem are we trying to solve?

This is the analysis. Not an analysis — **the** analysis. If you produce Table 14.2.1 for a trial with a continuous primary endpoint, this is the model behind it.

Here is the row your program has to produce:

```text
                              Placebo      VTX-221 20 mg
LS mean change (SE)        -4.05 (1.17)   -11.77 (1.15)
  Difference vs placebo                    -7.72 (1.65)
  95% CI                                 (-10.96, -4.47)
  p-value                                      <0.0001
```

Four questions you need to be able to answer about it, because a reviewer or an interviewer will ask:

**What is an "LS mean", and why is the placebo LS mean −4.05 when the observed placebo mean is −3.30?**

**Why adjust at all**, when randomization was supposed to balance the arms?

**Why is the treatment effect −7.72 here and −8.98 unadjusted?** Which one is right?

**Where does the SE of 1.65 come from**, and why is it smaller than the unadjusted 1.84?

ANCOVA is multiple regression with a treatment factor and a baseline covariate — machinery you already have. What this lesson adds is the layer on top: **least-squares means**, the conventions that govern how they are reported, and the regulatory expectations that make this the default rather than one option among many.

## Intuition

Two arms, and you want to compare their Week 12 change from baseline. Two problems with just subtracting the observed means:

**The arms did not start in exactly the same place.** Baseline SBP was 149.47 on placebo and 151.16 on 20 mg. Randomization balances *in expectation*, not exactly. Part of the observed difference in change reflects that gap rather than treatment.

**Baseline explains a lot of the noise.** Subjects starting higher tend to fall further. Variation that baseline can explain is currently sitting in the residual, inflating every standard error.

ANCOVA fixes both by fitting one line per arm with a **common slope** in baseline:

$$
\operatorname{CHG} = \beta_0 + \tau_{\text{arm}} + \beta\,\operatorname{BASE}
$$

Parallel lines, one per arm, separated vertically by the treatment effects $\tau$. The vertical gap between two lines is the treatment difference, and it is the same at every baseline value — which is what makes a single number a fair summary.

**The LS mean is the height of a line evaluated at the mean baseline.** Not the arm's observed mean, but the model's prediction for that arm *at a common covariate value*. That is exactly what makes the arms comparable: you are asking what each arm would have produced had its subjects started at the same place.

:::why[Why must the slopes be parallel?]
Because if they are not, there is no single treatment effect to report — the difference between arms would depend on baseline, and quoting one number would be a summary of something that varies.

That is precisely the treatment-by-baseline interaction from the previous lesson, and testing it is how you check the assumption. In this trial $F(2, 232) = 0.67$, $p = 0.51$: no evidence against parallelism, so a single treatment effect is a fair summary.

If the interaction *were* significant, the correct response is not to force parallel lines. It is to report the treatment effect as a function of baseline — or at several specified baseline values — and say clearly that the effect varies.
:::

## Clinical context

| Setting | The ANCOVA |
|---|---|
| Blood pressure, HbA1c, lung function, pain scores | `CHG ~ TRT + BASE` (+ strata) |
| Any continuous endpoint with a baseline measurement | The default primary model |
| Endpoints measured at several visits | MMRM, which is ANCOVA generalised across visits |
| Randomization used stratification | Include the strata as fitted, per ICH E9 |
| No meaningful baseline (e.g. time to first event) | ANCOVA does not apply |

:::standard{kind="official"}
The FDA's 2023 guidance *Adjusting for Covariates in Randomized Clinical Trials for Drugs and Biological Products* states that covariate adjustment can improve precision, that covariates should be pre-specified in the protocol or SAP, and that adjusting for a small number of prognostic baseline covariates is generally acceptable and frequently preferred. The EMA's 2015 *Guideline on adjustment for baseline covariates in clinical trials* is compatible and is more explicit that the baseline value of the primary endpoint should normally be included. ICH E9 §5.7 adds that stratification factors used in randomization should generally be accounted for in the analysis.
:::

:::mistake[Adjusting for a post-baseline variable]
Only **baseline** variables belong in the model. A variable measured after randomization can itself be affected by treatment, and adjusting for it removes part of the treatment effect you are trying to estimate — or induces a spurious one. Adjusting for "compliance", "duration of exposure", or a Week 4 biomarker are all examples of this error, and it is one that survives review surprisingly often because the variable sounds prognostic.

The rule is mechanical and worth applying without exception: if it was measured after the subject was randomized, it is not a covariate.
:::

## Formal concept

### The model

For subject $i$ in arm $j$:

$$
\operatorname{CHG}_{ij} = \mu + \tau_j + \beta\left(\operatorname{BASE}_{ij}\right) + \varepsilon_{ij},
\qquad \varepsilon_{ij} \sim N(0, \sigma^2)
$$

with the usual constraint that makes $\tau$ identifiable (one arm as reference, or $\sum\tau_j = 0$).

**Assumptions**, beyond the LINE assumptions of any regression:

1. **Parallel slopes** — no treatment-by-covariate interaction. Testable.
2. **Covariate measured before randomization** — not testable; a design property.
3. **Covariate measured without substantial error** — measurement error in a covariate attenuates its coefficient and reduces the precision gain.

### Least-squares means

An LS mean is a model prediction at a specified covariate value. For arm $j$ at the overall mean baseline $\overline{\operatorname{BASE}}$:

$$
\widehat{\text{LSM}}_j = \hat\mu + \hat\tau_j + \hat\beta\,\overline{\operatorname{BASE}}
$$

Writing it as $L'\hat\beta$ for a contrast vector $L$, the standard error is

$$
\operatorname{SE}(L'\hat\beta) = \sqrt{L'\widehat{\operatorname{Var}}(\hat\beta)\,L}
$$

:::number[Why is the placebo LS mean −4.05 when the observed placebo mean is −3.30?]
Because the LS mean is evaluated at the **overall** mean baseline of 149.824 mmHg, while the placebo arm's own mean baseline was lower — 149.47 in the ITT set, and lower still among the 77 placebo subjects with a Week 12 value.

The model says each 1 mmHg of extra baseline produces 0.587 mmHg more reduction. Placebo subjects started below the overall average, so at a *common* baseline of 149.824 they would be predicted to fall slightly further than they actually did: −4.05 rather than −3.30.

**That correction is the entire point.** The LS means compare arms as if every subject had started at the same baseline, which is what makes the comparison fair.
:::

:::why[Why evaluate at the mean baseline rather than somewhere else?]
Convention, and a good one. Because the lines are parallel, the *difference* between two LS means is identical at every covariate value — so the treatment effect does not depend on where you evaluate. Only the individual LS means move.

The mean is chosen because it is inside the data, it is where the model is most precisely estimated (standard errors for a prediction are smallest at the centroid), and it needs no arbitrary decision. SAS's `LSMEANS` and R's `emmeans` both default to it.

A consequence worth knowing: if you evaluated at baseline = 0, the LS means would be the raw intercepts — meaningless, wildly imprecise, and still giving the *same* treatment difference.
:::

### Why the standard error shrinks

$$
\operatorname{SE}(\hat\tau_{\text{diff}}) \approx \hat\sigma\sqrt{\frac{1}{n_1} + \frac{1}{n_2}} \times \sqrt{1 + \frac{(\bar{x}_1-\bar{x}_2)^2}{\ldots}}
$$

The dominant term is $\hat\sigma$. Adjusting for a covariate that predicts the outcome reduces the residual SD, and everything downstream shrinks with it.

In this trial: residual SD **11.53 → 10.27**, and the treatment-effect SE **1.841 → 1.648**.

:::number[How much sample size is that gain worth?]
Sample size scales with the square of the standard error. The ratio is $1.841/1.648 = 1.117$, so

$$(1.117)^2 = 1.248$$

Adjusting for baseline delivers the precision of a trial **25% larger** — about 59 extra subjects in a 238-subject study — at no cost beyond a covariate you already measured.

The theoretical relationship is $\operatorname{Var}_{\text{adj}} \approx \operatorname{Var}_{\text{unadj}}(1 - \rho^2)$ where $\rho$ is the baseline–outcome correlation. Here $\rho = 0.304$, so $1 - \rho^2 = 0.907$, predicting a 9.3% variance reduction. The observed reduction is slightly larger because the model also absorbs the baseline imbalance. **A more strongly correlated covariate would buy more**: at $\rho = 0.7$ you would halve the variance.
:::

## Worked example

`CHG ~ TRTP + BASE` on 238 subjects with a Week 12 measurement. Mean baseline = **149.824** mmHg. Residual SD = **10.271** on **234** df.

**Step 1 — the fitted model.**

$$
\widehat{\operatorname{CHG}} = 83.833 - 4.559\,[\text{10 mg}] - 7.715\,[\text{20 mg}] - 0.5866\,\operatorname{BASE}
$$

**Step 2 — LS means**, evaluating at $\operatorname{BASE} = 149.824$:

$$
\text{Placebo: } 83.833 - 0.5866(149.824) = -4.054
$$
$$
\text{10 mg: } 83.833 - 4.559 - 0.5866(149.824) = -8.613
$$
$$
\text{20 mg: } 83.833 - 7.715 - 0.5866(149.824) = -11.769
$$

**Step 3 — compare with the observed means.**

| Arm | Observed mean | LS mean | Shift |
|---|---:|---:|---:|
| Placebo | −3.300 | −4.054 | −0.754 |
| VTX-221 10 mg | −8.828 | −8.613 | +0.215 |
| VTX-221 20 mg | −12.276 | −11.769 | +0.507 |

Placebo is pulled **down** (its subjects started lower than average) and the active arms are pulled **up** (they started higher). Each arm is being repositioned to a common baseline.

**Step 4 — LS means with intervals.** Using $t_{0.975,234} = 1.9702$:

| Arm | LS mean | SE | 95% CI |
|---|---:|---:|---|
| Placebo | −4.054 | 1.174 | (−6.368, −1.740) |
| VTX-221 10 mg | −8.613 | 1.142 | (−10.862, −6.364) |
| VTX-221 20 mg | −11.769 | 1.150 | (−14.035, −9.503) |

**Step 5 — the differences**, which are what the trial is about:

| Comparison | Difference | SE | 95% CI | t | p |
|---|---:|---:|---|---:|---:|
| 10 mg − placebo | −4.559 | 1.639 | (−7.789, −1.329) | −2.781 | 0.0059 |
| 20 mg − placebo | −7.715 | 1.648 | (−10.961, −4.469) | −4.683 | < 0.0001 |
| 20 mg − 10 mg | −3.156 | 1.619 | (−6.347, +0.034) | −1.949 | 0.0525 |

:::number[Why is the SE of a difference (1.639) larger than the SE of either LS mean (1.174, 1.142)?]
Because a difference carries the uncertainty of both quantities. Roughly $\sqrt{1.174^2 + 1.142^2} = 1.638$ — and it is only *roughly*, because the two LS means are not independent: they share the estimated intercept and the estimated baseline slope, so their covariance enters too.

That is why LS mean differences are computed as $L'\hat\beta$ with $\operatorname{SE} = \sqrt{L'\operatorname{Var}(\hat\beta)L}$ rather than by combining the individual standard errors. The full variance–covariance matrix is needed, which is exactly what `LSMEANS ... PDIFF` and `emmeans ... pairs()` handle for you.
:::

**Step 6 — the 20 mg versus 10 mg comparison deserves a note.** It gives $p = 0.0525$ — just above 0.05. This is the dose-selection question from the ANOVA lesson, and it is a good illustration of why a bright line is unhelpful: the data provide moderate, inconclusive evidence that 20 mg is better than 10 mg, and the interval (−6.35, +0.03) says the true difference could be anywhere from a substantial 6 mmHg benefit to essentially nothing.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — the Week 12 analysis records"}

**Four analyses of the same Week 12 data:**

| Analysis | 10 mg − pbo (SE) | 20 mg − pbo (SE) |
|---|---:|---:|
| Week 12 value only (`AVAL ~ TRTP`) | −3.88 (1.735) | −6.83 (1.741) |
| Change score, unadjusted (`CHG ~ TRTP`) | −5.53 (1.835) | −8.98 (1.841) |
| **ANCOVA (`CHG ~ TRTP + BASE`)** | **−4.56 (1.639)** | **−7.72 (1.648)** |
| ANCOVA on `AVAL` (`AVAL ~ TRTP + BASE`) | −4.56 (1.639) | −7.72 (1.648) |

Three things to read from that table.

**The first two rows disagree substantially** — −6.83 versus −8.98 for the 20 mg comparison. Neither adjusts for baseline, and they handle the baseline imbalance in opposite directions: analysing the raw value ignores it entirely, while analysing the change score over-corrects (it implicitly assumes a slope of exactly 1, when the true slope is 0.379).

**ANCOVA sits between them** and has the smallest standard error of the three.

**The last two rows are identical** — same estimate, same SE, to every decimal. Once baseline is a covariate, analysing `CHG` and analysing `AVAL` are the same model; only the baseline coefficient differs, by exactly 1. **The SAP's choice between them is a presentation decision**, which is worth knowing when a team spends an hour debating it.

:::number[Why does the unadjusted change-score analysis over-correct?]
Because subtracting baseline is equivalent to forcing the baseline slope to be exactly **1**, when the fitted slope is 0.379 (on `AVAL`). Change scores fully remove the baseline, the raw-value analysis removes none of it, and ANCOVA estimates the right amount from the data.

This is Lord's paradox in its practical form: two reasonable-looking analyses of the same data give different answers, and ANCOVA is the one that does not assume a slope it has not estimated. It is also why "just analyse change from baseline" is not a substitute for adjustment.
:::

**Adding the randomization stratum.** Subjects were randomized stratified by baseline BP group, so ICH E9 says the analysis should account for it. Adding `factor(STRAT1RN)`:

| | 10 mg − placebo | 20 mg − placebo |
|---|---:|---:|
| ANCOVA with baseline only | −4.559 (1.639) | −7.715 (1.648) |
| ANCOVA + stratum | −4.59 (1.646) | −7.76 (1.660) |

Barely any change, because the stratum is a coarse function of the baseline value already in the model. **That is the expected result, and getting it is reassuring rather than disappointing** — it says the continuous covariate is doing the work the stratification was designed to do.

## Code

::::tabs
:::tab[SAS]
```sas
proc glm data=w12;
  class trtp (ref='Placebo');
  model chg = trtp base / solution clparm;
  lsmeans trtp / pdiff cl adjust=dunnett;
  ods output LSMeans = lsm
             LSMeanDiffCL = diffs;
run;
quit;

/* Check the parallel-slopes assumption */
proc glm data=w12;
  class trtp (ref='Placebo');
  model chg = trtp base trtp*base;
run;
quit;
```

:::lines
2: `ref='Placebo'` sets the reference level explicitly. Without it PROC GLM uses the **last** level in sort order, and every treatment coefficient reverses meaning.
3: The model statement is the ANCOVA. **Order matters for Type I sums of squares but not for Type III**, and GLM prints both — the SAP should say which the analysis uses. For a balanced design they agree.
4: `LSMEANS trtp / PDIFF CL` is the statement that produces the efficacy table: adjusted means per arm, pairwise differences, and confidence limits. `adjust=dunnett` controls multiplicity for the comparisons against control. By default `LSMEANS` evaluates at the **mean of the continuous covariates**. `AT base=150` would evaluate elsewhere — which changes the individual LS means but not their differences.
5: `ODS OUTPUT` captures the results as datasets so the table program consumes them directly rather than parsing printed output.
13: The interaction model is the assumption check. If `trtp*base` is significant, the parallel-slopes assumption fails and a single treatment effect is not a fair summary.
:::
:::

:::tab[R]
```r
library(emmeans)

w12$TRTP <- relevel(factor(w12$TRTP), ref = "Placebo")
fit <- lm(CHG ~ TRTP + BASE, data = w12)

# LS means and their differences
lsm <- emmeans(fit, ~ TRTP)
summary(lsm, infer = TRUE)
pairs(lsm, adjust = "dunnett", infer = TRUE)

# Parallel slopes check — the joint test
anova(fit, lm(CHG ~ TRTP * BASE, data = w12))

# Equivalence of CHG and AVAL analyses
coef(summary(lm(AVAL ~ TRTP + BASE, data = w12)))["TRTPVTX-221 20 mg", ]
```

:::lines
6: `emmeans(fit, ~ TRTP)` evaluates the model at the mean of every other predictor — the same convention as SAS `LSMEANS`. It is the right function; `predict()` on arbitrary data is not.
8: `infer = TRUE` adds confidence intervals **and** p-values. Without it `emmeans` prints intervals only, and `pairs()` prints p-values only — a small asymmetry that catches people out.
9: `adjust = "dunnett"` for comparisons against a control; `"tukey"` is the default for `pairs()` and adjusts for *all* pairwise comparisons, which is more conservative than usually needed when only the comparisons to control matter.
12: The joint F test of both interaction terms — one test for the parallel-slopes assumption.
15: Confirms the CHG/AVAL equivalence numerically. Worth running once so you can settle the argument with a number.
:::
:::

:::tab[Python]
```python
import statsmodels.formula.api as smf
import statsmodels.api as sm
import numpy as np

fit = smf.ols("CHG ~ C(TRTP, Treatment('Placebo')) + BASE", data=w12).fit()

# LS means by hand: build the contrast vector and use the covariance matrix
mb = w12.BASE.mean()
L_pbo = np.array([1, 0, 0, mb])
L_20  = np.array([1, 0, 1, mb])

for name, L in [("Placebo", L_pbo), ("20 mg", L_20)]:
    est = L @ fit.params
    se  = np.sqrt(L @ fit.cov_params() @ L)
    print(f"{name}: {est:.4f} (SE {se:.4f})")

# The difference
L_diff = L_20 - L_pbo
fit.t_test(L_diff)
```

:::lines
9: statsmodels has no direct `emmeans` equivalent, so LS means are built as contrast vectors. The column order must match `fit.params` exactly — print it and check rather than assuming.
16: `L @ fit.cov_params() @ L` is the general formula for the variance of a linear combination. This is exactly what SAS and emmeans do internally, and writing it once makes clear why the SE of a difference is not the naive combination of two individual SEs.
19: `fit.t_test(L)` gives the estimate, standard error, t statistic, p-value and confidence interval for any contrast in one call.
:::
:::
::::

## Output

```text
                              The GLM Procedure
                         Least Squares Means

                                            LSMEAN
trtp                 chg LSMEAN     Standard Error    Pr > |t|
Placebo              -4.0538333         1.1743869      0.0007
VTX-221 10 mg        -8.6128571         1.1415920      <.0001
VTX-221 20 mg       -11.7689474         1.1501063      <.0001

     Least Squares Means for effect trtp
      Pr > |t| for H0: LSMean(i)=LSMean(j)
   Dependent Variable: chg

   i/j              1             2             3
      1                      0.0059        <.0001
      2         0.0059                      0.0525
      3         <.0001        0.0525

    Differences of trtp Least Squares Means
                                        Standard
trtp        _trtp        Difference        Error    95% Confidence Limits
10 mg       Placebo      -4.5590900    1.6393900    -7.7889  -1.3292
20 mg       Placebo      -7.7151800    1.6475300   -10.9611  -4.4693
20 mg       10 mg        -3.1560900    1.6194000    -6.3466   0.0344
```

:::mistake[Reading the LS mean's own p-value as a treatment result]
The `Pr > |t|` column beside each LS mean tests whether **that arm's** adjusted mean differs from **zero** — that is, whether that arm changed at all. Placebo's p = 0.0007 does not mean placebo worked; it means the placebo arm's change differs from zero, which regression to the mean fully explains.

The treatment results are in the **Differences** table. This misreading is common enough that some sponsors' standards suppress the LS mean p-value column entirely.
:::

## Interpretation

> The primary analysis was an analysis of covariance with treatment as a fixed effect and baseline seated systolic blood pressure as a covariate. At Week 12, the LS mean change from baseline was −4.05 mmHg (SE 1.17) on placebo and −11.77 mmHg (SE 1.15) on VTX-221 20 mg. The difference of **−7.72 mmHg (95% CI −10.96 to −4.47) was statistically significant (p < 0.0001)**. The treatment-by-baseline interaction was not significant (p = 0.51), supporting the parallel-slopes assumption.

Every element earns its place: the model is stated, the LS means are given with their SEs, the difference carries a confidence interval, and the key assumption is reported as checked.

:::clinical
A 7.7 mmHg greater reduction than placebo is a clinically meaningful antihypertensive effect — at the upper end of what a single agent typically achieves as monotherapy, and in the range associated with measurable cardiovascular risk reduction in the epidemiological literature. The confidence interval (4.5 to 11.0 mmHg of additional reduction) is entirely within the clinically useful range, so the trial establishes not just that the drug works but that it works by an amount worth having.

The remaining clinical question is not efficacy but the dose. The 20 mg versus 10 mg difference of 3.2 mmHg (p = 0.053) is real but not established, and it has to be set against roughly double the adverse-event burden at the higher dose.
:::

## Common mistakes

:::mistake[Adjusting for a post-randomization variable]
Only baseline variables. A post-randomization variable can be affected by treatment, so adjusting for it removes part of the effect you are estimating. Compliance, exposure duration and on-treatment biomarkers are all disqualified, however prognostic they look.
:::

:::mistake[Selecting covariates after seeing the data]
Pre-specify. Choosing covariates on the basis of which gives the best treatment p-value inflates the type I error, and no disclosure repairs it. A small number of pre-specified prognostic covariates is what both FDA and EMA guidance describe.
:::

:::mistake[Reporting raw means in an ANCOVA table]
If the analysis is ANCOVA, the table reports **LS means**, not observed means. Mixing the two — LS mean differences beside observed arm means — produces a table where the difference does not equal the difference of the two means shown, which a reviewer will notice immediately.
:::

:::mistake[Ignoring the parallel-slopes assumption]
It is testable and it is the assumption that licenses a single treatment effect. Test it, report it. If it fails, report the effect as a function of the covariate rather than forcing one number.
:::

:::mistake[Assuming CHG and AVAL analyses differ]
With baseline as a covariate they are the same model, with identical treatment effects, standard errors and p-values. Only the baseline coefficient differs, by exactly 1. Teams lose hours to this.
:::

## Knowledge check

::quiz{ids="stats.ac.lsmean-definition,stats.ac.why-adjust,stats.ac.post-baseline,stats.ac.parallel-slopes"}

## Hands-on exercise

::practice{ids="stats.ac.lsmean-hand,stats.ac.precision-gain,stats.ac.diff-se,stats.ac.r-code" title="Practice: computing LS means and quantifying the gain"}

## Challenge exercise

::practice{ids="stats.ac.lords-paradox,stats.ac.wrong-means-table,stats.ac.sap-open" title="Challenge: Lord's paradox, table construction and SAP judgement"}

## Industry note

**MMRM is ANCOVA generalised across visits.** When the endpoint is measured at several visits and dropout is expected, the modern default is a mixed model for repeated measures: treatment, visit, treatment-by-visit, baseline and baseline-by-visit, with an unstructured covariance matrix per subject. It uses all observed post-baseline data rather than complete cases at the final visit, which makes it valid under MAR rather than requiring MCAR.

In this trial the difference matters: complete-case ANCOVA gives −7.72 mmHg for the 20 mg comparison, while MMRM gives **−8.35 mmHg**. Lack-of-efficacy dropout was most common on placebo, so placebo *completers* are the better responders — which flatters the placebo arm in a complete-case analysis and shrinks the estimated treatment difference. MMRM uses the pre-dropout visits of subjects who left, and under MAR corrects for it.

:::standard{kind="convention"}
The MMRM specification with an unstructured covariance and Kenward–Roger degrees of freedom is a widely adopted industry standard for longitudinal continuous endpoints, but it is a convention reflected in sponsor standards rather than a requirement in any single guidance. ICH E9(R1) frames the choice in terms of the **estimand**: what treatment effect are you estimating, and how are intercurrent events handled? The model follows from that answer rather than the other way round.
:::

**The estimand question comes before the model.** ICH E9(R1) asks you to specify the population, the variable, the handling of intercurrent events (discontinuation, rescue medication, death), and the population-level summary — *before* choosing an analysis. A complete-case ANCOVA at Week 12 implicitly answers "the effect among those who stayed", which is rarely the question anyone intended to ask. Getting the estimand explicit first is what makes the model choice defensible rather than conventional.

**Stratified randomization means stratified analysis.** If the trial randomized within strata, include them. And use the stratum **as randomized** (from the IWRS), not as later corrected on the CRF — this trial has 3 subjects whose corrected baseline puts them in a different stratum from the one they were randomized into, and the primary analysis uses the randomization value with a sensitivity analysis using the corrected one.

:::interview[Walk me through the primary analysis of a continuous endpoint.]
Start with the estimand, not the model — that is what separates a current answer from a 2005 one.

"First I'd want the estimand pinned down: the population, the endpoint and visit, how intercurrent events like discontinuation or rescue medication are handled, and the population-level summary. That determines the model, not the other way round."

Then the model: "For a continuous endpoint with a baseline measurement, the standard is ANCOVA — treatment as a fixed effect, the baseline value as a covariate, plus any randomization stratification factors, which ICH E9 expects. If the endpoint is measured at multiple visits and dropout is meaningful, MMRM with an unstructured covariance, which uses all observed data and is valid under MAR rather than MCAR."

Then what you report: "LS means per arm with standard errors, the between-arm difference with a 95% confidence interval, and the p-value last. Not raw means — the table has to be internally consistent."

Then the checks: "Test the parallel-slopes assumption with a treatment-by-baseline interaction. Review residual diagnostics and influence. And run the pre-specified sensitivity analyses — a different missing-data assumption, usually, and the per-protocol population."

Then the discipline: "All of it pre-specified in the SAP before unblinding, including the covariates. Covariate selection after seeing results inflates the type I error."

If there is time, the number that shows you have actually done it: "And it is worth saying why we adjust at all — in a trial like this, adjusting for baseline cut the standard error by about 11%, which is the precision of a trial 25% larger, for a covariate we already collected."
:::
