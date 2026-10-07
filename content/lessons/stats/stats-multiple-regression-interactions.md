## What problem are we trying to solve?

You fit the primary model and SAS hands you this:

```text
                  Estimate  Std. Error  t value  Pr(>|t|)
(Intercept)       83.83333    11.11907    7.540   < 0.0001
TRTPVTX-221 10 mg -4.55909     1.63939   -2.781   0.00586
TRTPVTX-221 20 mg -7.71518     1.64753   -4.683   < 0.0001
BASE              -0.58660     0.07444   -7.880   < 0.0001
```

Three arms went in. **Two treatment rows came out.** Where did placebo go?

And the baseline coefficient is **negative** — −0.587. Higher baseline means *more* reduction? Last lesson, regressing `AVAL` on `BASE`, the slope was *positive* (+0.379). Same data, same two variables, opposite signs.

Neither is an error. Both are consequences of things the output does not tell you: how a categorical variable becomes numbers, and what "holding everything else constant" does to a coefficient's meaning.

This lesson covers the three things that make multiple regression different from simple regression in kind, not just in degree:

- **Dummy coding** — how a three-level factor becomes two columns, why one level vanishes, and why SAS and R pick different ones to vanish
- **Adjusted effects** — why a coefficient's meaning depends on what else is in the model
- **Interactions** — how to ask whether the treatment effect *differs* by subgroup, and why that is not the same as testing each subgroup separately

## Intuition

Simple regression fits a line. Multiple regression fits a **plane** (two predictors) or a hyperplane (more), and each coefficient is the slope of that surface in one direction *with the others held fixed*.

That last phrase carries all the weight. In `CHG ~ TRTP + BASE`:

- The **treatment** coefficients compare arms **among subjects with the same baseline**
- The **baseline** coefficient describes the baseline relationship **within a treatment arm**

Adjustment does two useful things at once. It **removes confounding**: if the arms happened to differ in baseline, the unadjusted comparison would partly reflect that rather than treatment. And it **removes noise**: variation in the outcome that baseline explains leaves the residual, which shrinks every standard error in the model.

In a randomized trial the second is the real prize. Randomization already prevents systematic confounding, so adjustment is not correcting a bias — it is buying precision. In this trial adjusting for baseline cuts the residual SD from 11.53 to 10.27 mmHg and the treatment effect's standard error from 1.835 to 1.639, an 11% gain for free.

:::why[If randomization already balances the arms, why adjust at all?]
Randomization balances arms **on average over repeated trials**, not exactly in the one trial you ran. Here baseline SBP was 149.47 on placebo and 151.16 on 20 mg — a 1.7 mmHg imbalance, entirely consistent with chance and entirely real in this dataset. Adjusting removes its influence from the estimate.

But the precision argument is the stronger one and applies even under perfect balance. A covariate that predicts the outcome soaks up residual variance, and every standard error in the model shrinks accordingly. That is why regulators expect the primary analysis to adjust for pre-specified baseline covariates — and why those covariates must be named in the SAP *before* unblinding, since choosing them afterwards on the basis of which gives the best p-value is selection.
:::

:::standard{kind="official"}
The FDA's 2023 guidance *Adjusting for Covariates in Randomized Clinical Trials for Drugs and Biological Products* addresses this directly: it states that covariate adjustment can improve precision, that covariates should be pre-specified, and that adjusting for a small number of prognostic baseline covariates is generally acceptable and often preferred. The EMA's *Guideline on adjustment for baseline covariates in clinical trials* (2015) takes a compatible position.
:::

## Clinical context

| Model | What it is used for |
|---|---|
| `CHG ~ TRT + BASE` | The standard ANCOVA — primary analysis of most continuous endpoints |
| `CHG ~ TRT + BASE + STRATUM` | ANCOVA including the randomization strata, as ICH E9 expects |
| `AVAL ~ TRT + BASE + AGE + SEX` | Adjusting for additional pre-specified prognostic factors |
| `CHG ~ TRT * SUBGROUP` | Testing whether the treatment effect differs by subgroup |
| `logAUC ~ DOSE + WEIGHT + CRCL` | Population PK covariate models |
| `YIELD ~ TEMP + PH + SUPPLIER` | Manufacturing process characterisation |

## Formal concept

### Dummy coding: how a factor becomes columns

A categorical variable with $k$ levels becomes $k - 1$ indicator columns, because the $k$-th is redundant — knowing a subject is not in any of the first $k-1$ levels tells you they are in the last one.

With reference-cell (treatment) coding and Placebo as reference:

| Arm | `TRT10` | `TRT20` |
|---|---:|---:|
| Placebo | 0 | 0 |
| VTX-221 10 mg | 1 | 0 |
| VTX-221 20 mg | 0 | 1 |

The model $\operatorname{CHG} = \beta_0 + \beta_1 \operatorname{TRT10} + \beta_2 \operatorname{TRT20} + \beta_3 \operatorname{BASE}$ then means:

- **Placebo** subject: $\beta_0 + \beta_3 \operatorname{BASE}$
- **10 mg** subject: $\beta_0 + \beta_1 + \beta_3 \operatorname{BASE}$
- **20 mg** subject: $\beta_0 + \beta_2 + \beta_3 \operatorname{BASE}$

:::number[So where did placebo go? Into the intercept.]
Placebo is not missing — it is the **baseline against which the other two are measured**. $\beta_1 = -4.559$ is not "the effect of 10 mg"; it is "10 mg *minus placebo*", at a given baseline value. The reference level is absorbed into $\beta_0$.

This is why the reference level matters so much, and why the software's choice of it is a trap:

- **R** uses the **first factor level**, which for a character column is alphabetically first.
- **SAS `PROC GLM`** uses the **last** level in sort order.
- **SAS `PROC LOGISTIC`** defaults to **effect coding** (−1/0/1), which is different again.

Same data, same model, different-looking coefficients. In `PROC GLM` you fix it with `REF=` on the `CLASS` statement; in R with `relevel()` or by setting factor levels explicitly. **Always set it deliberately** — and note that the *fitted values* and the *treatment comparisons* are identical either way. Only the parameterisation moves.
:::

### Adjusted coefficients

In a multiple regression,

$$
\hat{\beta}_j = \text{effect of a one-unit change in } x_j \text{, holding all other predictors fixed}
$$

The coefficient for a predictor can change — in size or in sign — when other predictors enter. That is not instability; it is the model answering a different question.

### The standard error and variance inflation

$$
\operatorname{SE}(\hat{\beta}_j) = \frac{\hat{\sigma}}{\sqrt{S_{jj}}} \times \sqrt{\frac{1}{1 - R_j^2}}
$$

where $R_j^2$ is the $R^2$ from regressing $x_j$ on all the *other* predictors. The second factor is $\sqrt{\text{VIF}}$ — the **variance inflation factor**.

:::why[Why does correlation among predictors inflate standard errors?]
Because the model has to separate effects that the data present together. If two predictors move almost in lockstep, many different coefficient pairs fit the data almost equally well, so each individual coefficient is poorly determined — even though their *sum* and the model's *predictions* may be estimated precisely.

A VIF of 1 means the predictor is orthogonal to the others; VIF = 4 doubles the standard error; VIF = 10 triples it. Thresholds of 5 or 10 are conventions, not rules, and collinearity does **not** bias the coefficients or damage prediction — it only makes individual coefficients imprecise and unstable.
:::

### Interactions

An interaction asks whether the effect of one predictor **depends on** another:

$$
\operatorname{CHG} = \beta_0 + \beta_1 \operatorname{TRT} + \beta_2 \operatorname{BASE} + \beta_3 (\operatorname{TRT} \times \operatorname{BASE})
$$

Now the treatment effect is $\beta_1 + \beta_3 \operatorname{BASE}$ — it varies with baseline. And critically:

:::mistake[Reading a main effect in the presence of an interaction]
When `TRT * BASE` is in the model, $\beta_1$ is the treatment effect **at BASE = 0** — a blood pressure of zero. It is not "the average treatment effect". Its p-value tests something meaningless.

**Centre the covariate.** Fitting `TRTP * I(BASE - 150)` makes $\beta_1$ the treatment effect at a baseline of 150 mmHg, which is interpretable and inside the data. The interaction coefficient and its test are unchanged; only the main effects are reparameterised. This is why interaction models are essentially always fitted on centred covariates.
:::

## Worked example

Two models on the same 238 subjects.

**Model A — unadjusted:** `CHG ~ TRTP`

| Comparison | Estimate | SE |
|---|---:|---:|
| 10 mg − placebo | −5.528 | 1.835 |
| 20 mg − placebo | −8.976 | 1.841 |

**Model B — ANCOVA:** `CHG ~ TRTP + BASE`

| Term | Estimate | SE | t | p |
|---|---:|---:|---:|---:|
| Intercept | 83.833 | 11.119 | 7.540 | < 0.0001 |
| 10 mg − placebo | **−4.559** | **1.639** | −2.781 | 0.0059 |
| 20 mg − placebo | **−7.715** | **1.648** | −4.683 | < 0.0001 |
| BASE | **−0.587** | 0.074 | −7.880 | < 0.0001 |

Residual SD 10.271 on 234 df; $R^2 = 0.283$.

**Read what adjustment did.** The treatment effects moved a little (−5.53 → −4.56; −8.98 → −7.72) and the standard errors fell by about 11% (1.835 → 1.639). The estimates moved because of the small baseline imbalance; the standard errors fell because baseline explains outcome variance.

:::number[Why is the BASE coefficient negative (−0.587) when the AVAL-on-BASE slope was positive (+0.379)?]
Because the outcome changed. Write $\operatorname{CHG} = \operatorname{AVAL} - \operatorname{BASE}$. If $\operatorname{AVAL} = \alpha + 0.379\operatorname{BASE}$, then

$$\operatorname{CHG} = \alpha + 0.379\operatorname{BASE} - \operatorname{BASE} = \alpha - 0.621\operatorname{BASE}$$

A slope of −0.621 — close to the −0.587 estimated here, the small difference being the treatment terms in the model. **The two coefficients differ by exactly 1**, because the two outcomes differ by exactly `BASE`.

The practical consequence is the important one: **ANCOVA on `CHG` and ANCOVA on `AVAL` give the identical treatment effect.** Only the baseline coefficient differs, by 1. So the choice between them is a presentation decision, not a statistical one — which surprises most people and is a good thing to be able to demonstrate in a QC discussion.
:::

**Model C — adding age and sex:** `CHG ~ TRTP + BASE + AGE + SEX`

| Term | Estimate | SE | p |
|---|---:|---:|---:|
| 10 mg − placebo | −4.463 | 1.646 | 0.0072 |
| 20 mg − placebo | −7.618 | 1.651 | < 0.0001 |
| BASE | −0.587 | 0.075 | < 0.0001 |
| AGE | −0.008 | 0.068 | 0.910 |
| SEX (M vs F) | −1.729 | 1.341 | 0.199 |

Residual SD 10.28 on 232 df; $R^2 = 0.289$.

:::number[Two more covariates, two more degrees of freedom spent, and the residual SD went *up* slightly (10.271 → 10.280). Why?]
Because neither age nor sex predicts the outcome here. Adding a useless predictor reduces $SSE$ by a trivial amount (enough to nudge $R^2$ from 0.283 to 0.289) while costing a degree of freedom in the divisor $n - p$. When the numerator barely falls and the denominator does, $\hat\sigma^2 = SSE/(n-p)$ can rise.

**This is exactly why covariates are pre-specified and kept few.** Adding covariates until something looks better is a search over models, and it inflates the type I error of the treatment test while producing no precision gain. Adjusted $R^2$ (0.273 versus 0.283) is the diagnostic that penalises this directly.
:::

**Model D — interaction:** `CHG ~ TRTP * I(BASE - 150)`

| Term | Estimate | SE | t | p |
|---|---:|---:|---:|---:|
| Intercept | −4.201 | 1.188 | −3.536 | 0.0005 |
| 10 mg − placebo | −4.538 | 1.649 | −2.753 | 0.0064 |
| 20 mg − placebo | −7.614 | 1.656 | −4.599 | < 0.0001 |
| BASE − 150 | −0.616 | 0.133 | −4.647 | < 0.0001 |
| 10 mg × (BASE − 150) | 0.149 | 0.186 | 0.803 | 0.423 |
| 20 mg × (BASE − 150) | −0.054 | 0.182 | −0.294 | 0.769 |

**The joint test of the interaction**, comparing Model D against Model B:

$$
F(2, 232) = 0.669, \qquad p = 0.513
$$

No evidence that the treatment effect varies with baseline pressure. The treatment effect estimated at a baseline of 150 mmHg (−4.54 and −7.61) is close to the main-effects estimate (−4.56 and −7.72), as it should be when the interaction is null.

:::why[Why test the two interaction terms jointly rather than individually?]
Because "does the treatment effect depend on baseline?" is **one** question, and a three-level factor needs two coefficients to express it. Testing each separately would give two p-values for one hypothesis, with no control over the error rate and no clear conclusion if they disagree.

The joint test — an F test comparing the model with and without the interaction, on 2 numerator degrees of freedom — is the right instrument. The same logic applies to any multi-level factor: test the whole term, then look at components only if the overall test is significant.
:::

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,AGE,SEX,BMIBL,SBPBL,DIABFL,ITTFL" rows="8" caption="ADSL — candidate baseline covariates"}

Putting the four models side by side, with the 20 mg effect:

| Model | 20 mg − placebo | SE | Residual SD | df | Adj R² |
|---|---:|---:|---:|---:|---:|
| A: `CHG ~ TRTP` | −8.976 | 1.841 | 11.53 | 235 | 0.086 |
| B: `CHG ~ TRTP + BASE` | −7.715 | **1.648** | **10.27** | 234 | 0.274 |
| C: `+ AGE + SEX` | −7.618 | 1.651 | 10.28 | 232 | 0.273 |
| D: `+ TRTP × (BASE−150)` | −7.614 | 1.656 | 10.29 | 232 | 0.272 |

The story in one table: **Model B does all the work.** Baseline is the covariate that matters; age, sex and the interaction add nothing but cost degrees of freedom. A pre-specified SAP containing exactly Model B would have been the right call, and finding that out afterwards is not a licence to change it.

:::mistake[Deciding the model after seeing the results]
Everything above is a *post hoc* comparison, and it is shown here to teach how the pieces behave — not as a model-selection procedure. In a confirmatory trial the model is fixed in the SAP before unblinding. Running four models and reporting the one with the smallest p-value inflates the type I error in a way no amount of disclosure repairs. Exploratory analyses are labelled as such.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc glm data=w12;
  class trtp (ref='Placebo');
  model chg = trtp base / solution clparm;
  lsmeans trtp / pdiff cl adjust=dunnett;
run;
quit;

/* Interaction, with the covariate centred */
data w12c;
  set w12;
  base_c = base - 150;
run;

proc glm data=w12c;
  class trtp (ref='Placebo');
  model chg = trtp base_c trtp*base_c / solution;
run;
quit;
```

:::lines
2: `class trtp (ref='Placebo')` sets the reference level explicitly. **Without `ref=`, PROC GLM uses the LAST level in sort order** — so `VTX-221 20 mg` would become the reference and every coefficient would flip meaning. R uses the *first* level. Set it deliberately in both.
3: `solution` prints the parameter estimates. GLM suppresses them by default when a `CLASS` statement is present, because under its default parameterisation individual estimates are not uniquely defined (it produces a singular design matrix and reports the biased-estimate note). `clparm` adds confidence limits for those estimates.
4: `LSMEANS ... PDIFF CL` gives the adjusted means per arm and the pairwise differences with intervals. **This is what goes in the efficacy table**, not the raw parameter estimates — LS means are evaluated at the mean covariate value, which is the convention.
16: SAS has no inline equivalent of R's `I()`, so centring is done in a DATA step. `trtp*base_c` in the MODEL statement creates the interaction; SAS requires the main effects to be listed first.
:::
:::

:::tab[R]
```r
w12$TRTP <- relevel(factor(w12$TRTP), ref = "Placebo")

fit <- lm(CHG ~ TRTP + BASE, data = w12)
summary(fit)
confint(fit)

# LS means — what the efficacy table reports
library(emmeans)
emmeans(fit, ~ TRTP)
pairs(emmeans(fit, ~ TRTP), adjust = "dunnett")

# Interaction, centred, tested jointly
fit_int <- lm(CHG ~ TRTP * I(BASE - 150), data = w12)
anova(fit, fit_int)     # F(2, 232) = 0.669, p = 0.513

# Collinearity
car::vif(lm(CHG ~ TRTP + BASE + AGE + BMIBL, data = w12))
```

:::lines
1: `relevel()` sets the reference level. Without it a character column becomes a factor in **alphabetical** order — here `Placebo` happens to sort first, which is lucky and not something to rely on. An arm called `Active` would silently become the reference.
9: `emmeans` computes least-squares means — model predictions at the mean covariate value. `summary(fit)` gives coefficients, which are differences; the efficacy table usually wants the means themselves.
14: `anova(fit, fit_int)` is the **joint** F test of both interaction terms — one test for one question. Reading the two individual interaction p-values instead would be two tests of one hypothesis.
17: `car::vif()` on a model with factors returns generalised VIFs (GVIF), which are scaled differently. Compare `GVIF^(1/(2*Df))` against the usual thresholds, not GVIF itself.
:::
:::

:::tab[Python]
```python
import statsmodels.formula.api as smf
import statsmodels.api as sm

fit = smf.ols("CHG ~ C(TRTP, Treatment('Placebo')) + BASE", data=w12).fit()
print(fit.summary())

fit_int = smf.ols(
    "CHG ~ C(TRTP, Treatment('Placebo')) * center(BASE)", data=w12
).fit()
sm.stats.anova_lm(fit, fit_int)       # joint test of the interaction

from statsmodels.stats.outliers_influence import variance_inflation_factor
```

:::lines
5: `C(TRTP, Treatment('Placebo'))` sets the reference explicitly. Without the `Treatment()` argument, patsy uses the first level alphabetically — the same trap in a third syntax.
9: patsy has a `center()` transform, so centring can be done inline as R does with `I(BASE - 150)`.
10: `anova_lm(fit, fit_int)` gives the nested F test. Note the models must be nested and fitted on **exactly the same rows** — if a covariate has missing values, statsmodels silently drops different subjects from each model and the comparison is invalid.
:::
:::
::::

## Output

```text
                              The GLM Procedure

Dependent Variable: CHG

Source                  DF    Type III SS    Mean Square   F Value   Pr > F
trtp                     2     2333.19352     1166.59676     11.06   <.0001
base                     1     6550.90387     6550.90387     62.10   <.0001

                                          Standard
Parameter            Estimate                Error    t Value    Pr > |t|
Intercept          83.8333333 B          11.1190700       7.54      <.0001
trtp   Placebo       0.0000000 B           .                .         .
trtp   10 mg        -4.5590900 B           1.6393900      -2.78      0.0059
trtp   20 mg        -7.7151800 B           1.6475300      -4.68      <.0001
base               -0.5866000               0.0744400      -7.88      <.0001
```

:::number[What does the "B" next to the estimates mean, and why is placebo's estimate exactly 0?]
The `B` is SAS warning you that the estimate is **not unique** — it is one solution among infinitely many, chosen by setting the last (or reference) level's parameter to zero. PROC GLM builds a singular design matrix with one column per level plus an intercept, then solves it with a generalized inverse. The note in the log reads "The X'X matrix has been found to be singular, and a generalized inverse was used… Estimates followed by the letter 'B' are not uniquely estimable."

That is not an error. The **estimable functions** — differences between levels, and LS means — are unique regardless of the parameterisation, which is why you report those rather than raw parameters.

Placebo reads exactly 0.0000000 because it *is* the reference: its effect is defined to be zero and absorbed into the intercept.
:::

## Interpretation

> At Week 12, the least-squares mean change from baseline in seated systolic blood pressure was −11.77 mmHg on VTX-221 20 mg and −4.05 mmHg on placebo, a difference of **−7.72 mmHg (95% CI −10.96 to −4.47; p < 0.0001)**, from an ANCOVA model with treatment as a factor and baseline systolic blood pressure as a covariate. There was no evidence that the treatment effect varied with baseline pressure (interaction F(2, 232) = 0.67, p = 0.51).

:::clinical
Two things a clinician should take from this. The effect is estimated **at a common baseline**, so it is not confounded by the 1.7 mmHg baseline imbalance between arms — the comparison is like-for-like. And the null interaction means the drug works about as well for patients starting at 140 as for patients starting at 170; there is no evidence here to support targeting the more severe patients preferentially. That second finding is genuinely useful for a treatment-guideline discussion, and it is a finding the unadjusted analysis could not have produced.
:::

## Common mistakes

:::mistake[Not setting the reference level]
R uses the first factor level (alphabetical for a character column); SAS PROC GLM uses the last in sort order; PROC LOGISTIC defaults to effect coding. Set it explicitly every time. The fitted values and the treatment comparisons are identical either way, but the printed coefficients are not, and a table built from the wrong coefficients is wrong in a way that looks plausible.
:::

:::mistake[Interpreting a main effect when an interaction is in the model]
With `TRT * BASE` in the model, the treatment coefficient is the effect at `BASE = 0`. Centre the covariate so it becomes the effect at a meaningful value, and say in the text where it was evaluated.
:::

:::mistake[Adding covariates until the p-value improves]
Each covariate costs a degree of freedom and, if it does not predict the outcome, can increase the residual SD rather than reduce it. Selecting covariates on the basis of results inflates the type I error. Pre-specify a small number of prognostic covariates and stop.
:::

:::mistake[Testing subgroups separately instead of testing the interaction]
"Significant in men, not in women" compares two p-values, which differ partly because the subgroups differ in size. The question is whether the effect *differs*, which is a single interaction test — usually underpowered, which is itself worth reporting.
:::

:::mistake[Reading raw parameter estimates into the efficacy table]
The table wants **LS means** and their differences, evaluated at the mean covariate value. The parameter estimates are differences from a reference level and, in PROC GLM's parameterisation, not uniquely defined. Use `LSMEANS` / `emmeans`.
:::

## Knowledge check

::quiz{ids="stats.mr.reference-level,stats.mr.base-sign,stats.mr.interaction-main-effect,stats.mr.vif"}

## Hands-on exercise

::practice{ids="stats.mr.dummy-columns,stats.mr.adjusted-prediction,stats.mr.joint-test,stats.mr.r-code" title="Practice: coding, adjustment and interaction tests"}

## Challenge exercise

::practice{ids="stats.mr.ref-level-bug,stats.mr.chg-vs-aval,stats.mr.subgroup-open" title="Challenge: reference levels, equivalent models and subgroup claims"}

## Industry note

**ANCOVA is the default primary analysis for continuous endpoints**, and this is that model. The efficacy table reports LS means per arm and their differences with confidence intervals; the model statement in the SAP names the covariates; and the covariates are almost always the baseline value plus the randomization stratification factors.

**Type I, II and III sums of squares diverge once the design is unbalanced.** Type I is sequential and depends on the order terms appear; Type III tests each term with all others present. SAS PROC GLM prints Types I and III by default; R's `anova()` gives Type I, while `car::Anova(fit, type = 3)` gives Type III. **A plain `anova()` call in R on a multi-factor model is one of the most common sources of a QC mismatch against SAS** — the numbers differ because the question differs, not because either is wrong. Note also that Type III tests of main effects in the presence of an interaction depend on the contrast coding and are easy to misread; the usual advice is to test the interaction first and interpret main effects only in its absence.

:::standard{kind="convention"}
Reporting LS means (SE) per arm and the between-arm difference with a 95% CI is the standard layout for an ANCOVA efficacy table, and LS means are conventionally evaluated at the mean of the covariate in the analysis set. This is a widely used convention reflected in sponsor shell libraries rather than a regulatory requirement; what binds you is the shell and the SAP.
:::

**Subgroup analyses live and die on the interaction test.** A forest plot of subgroup-specific effects is standard in a CSR and standard to over-read. The disciplined presentation shows each subgroup's estimate with its interval, reports the interaction p-value, and states that the analysis is exploratory and not powered to detect interactions — which is nearly always true, because detecting an interaction typically needs about four times the sample size of detecting the main effect.

:::interview[Why adjust for baseline in a randomized trial, when randomization should have balanced it?]
Two reasons, and candidates who give only the first are giving the weaker one.

**Chance imbalance.** Randomization balances in expectation, not in any single trial. In this study baseline systolic pressure was 149.5 on placebo and 151.2 on the high dose — a real 1.7 mmHg difference, well within chance, and still present in the estimate if you do not adjust.

**Precision, which is the bigger prize.** A covariate that predicts the outcome absorbs residual variance. Here adjusting for baseline cut the residual SD from 11.53 to 10.27 mmHg and the treatment effect's standard error from 1.835 to 1.639 — an 11% gain, equivalent to enrolling about 25% more subjects, at no cost. That is why the FDA's 2023 covariate-adjustment guidance is supportive of adjustment rather than merely tolerant of it.

Then the caveat that shows judgement: the covariates must be **pre-specified**. Choosing them after seeing the data is selection, and it inflates the type I error of the treatment test. And you adjust for **baseline** variables only — never for anything measured after randomization, which can be affected by treatment and will bias the estimate. That last point is the one interviewers use to separate people who have read the guidance from people who have applied it.
:::
