## What problem are we trying to solve?

Here is a regression output. You will see thousands of these.

```text
Coefficients:
            Estimate Std. Error t value Pr(>|t|)
(Intercept) 84.90260   11.57944   7.332 3.60e-12
BASE         0.37860    0.07715   4.907 1.72e-06

Residual standard error: 10.7 on 236 degrees of freedom
Multiple R-squared:  0.0926,  Adjusted R-squared:  0.08875
F-statistic: 24.08 on 1 and 236 DF,  p-value: 1.722e-06
```

Twelve numbers. Most people learn to read two of them — the slope and its p-value — and treat the rest as decoration.

That is a mistake, because those other ten numbers are where the work is. **Where does 11.57944 come from?** **Why 236 and not 238?** **Why is the intercept's p-value so tiny when the intercept is clinically meaningless here?** **Why is R² only 0.09 when the slope is overwhelmingly significant?**

By the end of this lesson you will be able to derive every number in that block from the data, by hand. That matters for three reasons: regression is the engine under ANCOVA, logistic regression and Cox models, so understanding it once pays off everywhere; QC work requires reproducing numbers, not admiring them; and an interviewer asking "what is the standard error of a slope?" is really asking whether you have ever looked inside the box.

## Intuition

You have a cloud of points and you want one line through it. Infinitely many lines are available. Which one?

**Least squares picks the line that makes the vertical misses as small as possible** — specifically, the line minimising the sum of *squared* vertical distances from each point to the line.

Three choices are buried in that sentence, and each is a real decision:

**Vertical distances, not perpendicular ones.** Regression treats $x$ as known and $y$ as the thing being predicted. The asymmetry is deliberate: regressing $y$ on $x$ gives a different line from regressing $x$ on $y$. If both variables are measured with error and neither is naturally the outcome, ordinary regression is the wrong tool.

**Squared, not absolute.** Squaring makes the problem solvable in closed form — one line of calculus, no iteration — and it makes the answer the maximum-likelihood estimate under normal errors. The price: squaring means a point twice as far away counts four times as much, so **least squares is sensitive to outliers by construction**.

**Sum, not maximum.** You are minimising total miss, not worst miss.

:::why[Why does minimising squared error give a formula rather than requiring a search?]
Because the sum of squared errors is a quadratic function of the two parameters, and a quadratic has exactly one minimum, found by setting the derivatives to zero. Differentiating $\sum(y_i - \beta_0 - \beta_1 x_i)^2$ with respect to each parameter gives two linear equations — the *normal equations* — which solve directly. That is why OLS fits instantly while logistic regression and Cox models, whose likelihoods are not quadratic, require iteration.
:::

## Clinical context

| Where regression appears | What it does |
|---|---|
| **ANCOVA** — the primary analysis of most continuous endpoints | Treatment effect adjusted for baseline |
| Dose–response and exposure–response modelling | Effect as a function of dose or concentration |
| Bioanalytical calibration curves | Concentration from instrument response |
| Pharmacokinetic terminal slope | Elimination rate from log-concentration versus time |
| Baseline covariate exploration | Which variables predict the outcome |
| Manufacturing process characterisation | Yield or purity as a function of process parameters |

The first row is the one that matters most: **ANCOVA is regression**. A model with a treatment indicator and a baseline covariate *is* a multiple regression, and the LS means in your efficacy table are predictions from it. Everything here is the foundation of that.

:::mistake[Regressing change on baseline to "adjust" for baseline]
Fitting `CHG ~ BASE` and interpreting the slope as "how much baseline predicts response" runs straight into mathematical coupling — `BASE` is inside `CHG` with a negative sign, so the slope is biased downward by construction. The correct model is `AVAL ~ BASE + TRTP`, or equivalently `CHG ~ BASE + TRTP` with the coupling understood: both give the *same* treatment effect, which is the quantity you actually want.
:::

## Formal concept

### The model

$$
y_i = \beta_0 + \beta_1 x_i + \varepsilon_i, \qquad \varepsilon_i \stackrel{iid}{\sim} N(0, \sigma^2)
$$

Four assumptions hide in that line, conventionally remembered as **LINE**:

- **L**inearity — the mean of $y$ really is a straight-line function of $x$
- **I**ndependence — observations do not inform each other
- **N**ormality — of the *errors*, not of $x$ or $y$
- **E**qual variance (homoscedasticity) — spread of errors is constant across $x$

:::why[Which assumption matters most?]
**Independence**, by a distance. Violating it — repeated measurements treated as independent, clustered data ignored — can make standard errors wrong by large factors, and no amount of data fixes it.

**Linearity** is next: if the relationship is curved, you are estimating the slope of the wrong thing.

**Normality** matters least, especially at large $n$, because the CLT protects the sampling distribution of the coefficients. And note it is an assumption about the **residuals**, not about $x$ or $y$ — a strongly skewed outcome can still have well-behaved residuals once the predictors are accounted for.
:::

### The estimates

$$
\hat{\beta}_1 = \frac{S_{xy}}{S_{xx}} = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sum (x_i - \bar{x})^2},
\qquad
\hat{\beta}_0 = \bar{y} - \hat{\beta}_1 \bar{x}
$$

Two facts worth carrying:

$$
\hat{\beta}_1 = r \cdot \frac{s_y}{s_x}
$$

The slope is the correlation rescaled by the two SDs. And the second formula says the fitted line **always passes through $(\bar{x}, \bar{y})$** — a useful check when you compute one by hand.

### Residual variance

$$
\hat{\sigma}^2 = \frac{\sum (y_i - \hat{y}_i)^2}{n - 2} = \frac{SSE}{n-2}
$$

:::number[Why $n - 2$?]
Two parameters were estimated from the data — the intercept and the slope — and each costs one degree of freedom. Same accounting as the $n-1$ in a sample SD (one mean estimated) and the $N-k$ in ANOVA ($k$ group means estimated). In the real-data example below, $n = 238$ and the output says 236: $238 - 2$.

$\hat{\sigma}$ is printed as "Residual standard error" in R and "Root MSE" in SAS. It is in the units of $y$ and it is the single most useful number for judging whether a model is any good — far more so than $R^2$.
:::

### Standard error of the slope

$$
\operatorname{SE}(\hat{\beta}_1) = \frac{\hat{\sigma}}{\sqrt{S_{xx}}}
$$

:::why[Why does spreading out the x values make the slope more precise?]
$S_{xx}$ is in the denominator, so a wider spread of $x$ gives a smaller standard error. Picture estimating a line's slope from two points: if they are an inch apart, a small vertical wobble swings the slope wildly; if they are a yard apart, the same wobble barely moves it. A long lever arm is more stable.

This has a direct design consequence. In a dose–response study, doses spread across a wide range estimate the slope far more precisely than doses bunched together — at the cost of having fewer observations near the middle, where you might want precision for prediction. It is also why range restriction damages regression as well as correlation.
:::

Then, on $n-2$ degrees of freedom:

$$
t = \frac{\hat{\beta}_1}{\operatorname{SE}(\hat{\beta}_1)},
\qquad
\text{95\% CI} = \hat{\beta}_1 \pm t_{0.975,\,n-2}\operatorname{SE}(\hat{\beta}_1)
$$

### R², and why it is overrated

$$
R^2 = 1 - \frac{SSE}{SST} = \frac{SSR}{SST}
$$

the proportion of variance in $y$ explained by the model. In simple regression $R^2 = r^2$.

:::mistake[Judging a model by R²]
$R^2$ answers "how much of the variation did I explain?", which is rarely the question. A treatment effect can be real, important and precisely estimated in a model with $R^2 = 0.05$, because most of the variation between patients has nothing to do with treatment. Conversely, $R^2$ rises whenever you add a predictor, even a random one — which is what adjusted $R^2$ partially corrects.

For a clinical model the numbers that matter are the **coefficient** (is the effect big enough to care about?), its **confidence interval** (how sure are we?), and the **residual SD** (how well can we predict an individual?). Report $R^2$ if asked; do not evaluate a model with it.
:::

## Worked example

Eight subjects, baseline systolic BP ($x$) and Week 12 systolic BP ($y$), both mmHg:

| Subject | $x$ | $y$ |
|---|---:|---:|
| 1 | 142 | 128 |
| 2 | 155 | 146 |
| 3 | 148 | 133 |
| 4 | 161 | 152 |
| 5 | 139 | 131 |
| 6 | 167 | 149 |
| 7 | 151 | 140 |
| 8 | 145 | 137 |

**Step 1 — means.** $\sum x = 1208$ and $\sum y = 1116$, so $\bar{x} = 151.0$ and $\bar{y} = 139.5$.

**Step 2 — the three sums of squares and cross-products.**

$$
S_{xx} = \sum(x_i - \bar{x})^2 = 642, \qquad
S_{yy} = \sum(y_i - \bar{y})^2 = 542, \qquad
S_{xy} = \sum(x_i - \bar{x})(y_i - \bar{y}) = 543
$$

:::number[Where does $S_{xx} = 642$ come from?]
The deviations $x_i - 151$ are $-9, 4, -3, 10, -12, 16, 0, -6$. Squaring gives $81, 16, 9, 100, 144, 256, 0, 36$, which sum to 642. Note the deviations sum to zero — always true, and a good arithmetic check before going further.
:::

**Step 3 — the slope.**

$$
\hat{\beta}_1 = \frac{543}{642} = 0.8458
$$

**Step 4 — the intercept.**

$$
\hat{\beta}_0 = 139.5 - 0.8458 \times 151.0 = 139.5 - 127.7149 = 11.785
$$

**Step 5 — check the line passes through the means.** $11.785 + 0.8458 \times 151.0 = 139.5$. ✓

**Step 6 — residuals and SSE.** Fitted values $\hat{y}_i = 11.785 + 0.8458 x_i$; residuals $y_i - \hat{y}_i$:

$$
-3.888,\; 3.117,\; -3.963,\; 4.042,\; 1.650,\; -4.033,\; 0.500,\; 2.575
$$

$$
SSE = \sum e_i^2 = 82.734
$$

:::number[Why do the residuals sum to zero (to rounding)?]
It is forced by the normal equations. Fitting an intercept requires $\sum e_i = 0$ — that is literally one of the two equations least squares solves. The second is $\sum x_i e_i = 0$: residuals are uncorrelated with the predictor. These are not properties of good data; they hold for *any* OLS fit with an intercept, which is why "the residuals sum to zero" is never evidence that a model fits.
:::

**Step 7 — residual standard deviation.**

$$
\hat{\sigma} = \sqrt{\frac{82.734}{8-2}} = \sqrt{13.789} = 3.713 \text{ mmHg}
$$

**Step 8 — standard error of the slope.**

$$
\operatorname{SE}(\hat{\beta}_1) = \frac{3.713}{\sqrt{642}} = \frac{3.713}{25.338} = 0.14655
$$

**Step 9 — t, p and interval.** With $n - 2 = 6$ df and $t_{0.975,6} = 2.4469$:

$$
t = \frac{0.8458}{0.14655} = 5.771, \qquad p = 0.0012
$$
$$
\text{95\% CI} = 0.8458 \pm 2.4469 \times 0.14655 = (0.487,\; 1.204)
$$

**Step 10 — R².**

$$
R^2 = 1 - \frac{82.734}{542} = 1 - 0.15264 = 0.8474
$$

**Step 11 — the F test.** $F = 33.31$ on 1 and 6 df — and note $t^2 = 5.771^2 = 33.31$. **For a single predictor the F test is exactly the squared t test**, which is why software prints both and why the two p-values are always identical in simple regression.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — BASE and AVAL for the Week 12 records"}

The same model on all 238 subjects with a Week 12 measurement — `AVAL ~ BASE`:

| Quantity | Value | Where it comes from |
|---|---:|---|
| $n$ | 238 | Subjects with `ANL01FL = 'Y'` at Week 12 |
| $\bar{x}$ (BASE) | 149.824 | |
| $\bar{y}$ (AVAL) | 141.625 | |
| $S_{xx}$ | 19235.63 | |
| $S_{xy}$ | 7282.52 | |
| $\hat{\beta}_1$ | **0.37860** | $7282.52 / 19235.63$ |
| $\hat{\beta}_0$ | **84.9026** | $141.625 - 0.3786 \times 149.824$ |
| $\hat{\sigma}$ | **10.70** | Residual SD, on 236 df |
| $\operatorname{SE}(\hat{\beta}_1)$ | **0.07715** | $10.70/\sqrt{19235.63}$ |
| $t$ | **4.907** | $0.3786 / 0.07715$ |
| 95% CI for slope | (0.227, 0.531) | $\pm\, t_{0.975,236} = 1.9701$ |
| $R^2$ | **0.0926** | $= r^2 = 0.3043^2$ |

Every number in the output block at the top of this lesson, reproduced from five summary statistics.

:::number[Why is $R^2$ only 0.0926 when the slope has $p = 1.7 \times 10^{-6}$?]
Because they answer different questions. The p-value asks "is the slope distinguishable from zero?", and with 238 subjects even a modest relationship clears that bar easily. $R^2$ asks "how much of the variation in Week 12 pressure does baseline explain?", and the answer is 9%.

Both are true and both matter. Baseline is a **useful** covariate — adjusting for it reduces the residual SD and tightens the treatment effect — and it is a **weak** predictor of any individual's outcome. A patient starting at 160 mmHg is expected to end around 145, but the residual SD of 10.7 mmHg means individual outcomes routinely land 20 mmHg either side of that.
:::

:::number[Why is the slope 0.379 rather than close to 1?]
Because of regression to the mean. A slope of 1 would mean everyone's Week 12 value tracks their baseline exactly. A slope of 0.379 means that for each 1 mmHg higher at baseline, Week 12 is only 0.379 mmHg higher on average — subjects who started high drift down toward the mean, and subjects who started low drift up.

This is Galton's original observation, and it has a precise relationship to the last lesson: $\hat{\beta}_1 = r \cdot s_y / s_x = 0.3043 \times 11.209/9.009 = 0.3786$. **Whenever $|r| < 1$, the slope pulls predictions toward the mean.** That is not a modelling artefact; it is what regression to the mean *is*, and it is why the placebo arm in this trial appeared to improve.
:::

:::mistake[Interpreting the intercept here]
$\hat{\beta}_0 = 84.90$ is the predicted Week 12 pressure for a subject with a **baseline of zero** — a blood pressure of 0 mmHg. Its tiny p-value tests whether that meaningless quantity differs from zero, which is not a question anyone asked.

Intercepts are interpretable only when $x = 0$ is a real, observed state. If you want a meaningful intercept, **centre the predictor**: fitting `AVAL ~ I(BASE - 150)` gives an intercept of 141.69, the predicted Week 12 value for a subject with a baseline of 150 mmHg. The slope, its SE and $R^2$ are all unchanged — only the intercept's meaning moves.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc reg data=w12 plots(only)=(diagnostics fitplot);
  model aval = base / clb;
  output out=resids p=pred r=resid rstudent=rstud h=lev cookd=cook;
run;
quit;

/* PROC GLM for the same fit, when categorical predictors are coming next */
proc glm data=w12;
  model aval = base / solution clparm;
run;
quit;
```

:::lines
2: `plots(only)=(diagnostics fitplot)` produces the residual panel and the fitted line. `only` suppresses the default plot set so you get just these.
3: `clb` adds confidence limits for the coefficients. **PROC REG does not print them by default** — without `clb` you get estimates and p-values but no intervals, which is the wrong pair of outputs to hand a reviewer.
4: The `output` statement writes diagnostics back as a dataset: predicted values, raw residuals, studentized residuals, leverage and Cook's D. These are the inputs to the diagnostics lesson, and saving them at fit time is cheaper than refitting later.
10: PROC GLM handles `CLASS` variables, so it is what ANCOVA uses. For a purely continuous model REG and GLM give identical coefficients; REG has richer diagnostics, GLM has `LSMEANS`.
11: `solution` is needed to print coefficients in GLM — unlike REG, GLM suppresses them by default when a CLASS statement is present, on the grounds that individual parameter estimates are not uniquely defined under its default parameterisation.
:::
:::

:::tab[R]
```r
fit <- lm(AVAL ~ BASE, data = w12)
summary(fit)
confint(fit)

# Every component, by hand
x <- w12$BASE; y <- w12$AVAL; n <- length(x)
Sxx <- sum((x - mean(x))^2)
Sxy <- sum((x - mean(x)) * (y - mean(y)))
b1  <- Sxy / Sxx
b0  <- mean(y) - b1 * mean(x)
sse <- sum((y - (b0 + b1 * x))^2)
sig <- sqrt(sse / (n - 2))
se1 <- sig / sqrt(Sxx)
c(b0 = b0, b1 = b1, sigma = sig, se_b1 = se1, t = b1 / se1)

# Centring makes the intercept mean something
lm(AVAL ~ I(BASE - 150), data = w12)
```

:::lines
3: `confint()` is a separate call — `summary()` gives p-values but not intervals. Reporting a coefficient without its interval is the regression equivalent of reporting a p-value without an effect size.
14: Computing it by hand once is worth an hour. Every quantity in `summary(fit)` comes from `Sxx`, `Sxy`, the two means and `n`.
17: `I(BASE - 150)` centres the predictor at a clinically meaningful value. The `I()` is essential: without it, `-` would be interpreted as formula syntax for *removing* a term rather than as arithmetic.
:::
:::

:::tab[Python]
```python
import statsmodels.formula.api as smf

fit = smf.ols("AVAL ~ BASE", data=w12).fit()
print(fit.summary())
fit.conf_int()

# The diagnostics live on an influence object
infl = fit.get_influence()
infl.hat_matrix_diag        # leverage
infl.cooks_distance[0]      # Cook's D
infl.resid_studentized_external

# sklearn gives you coefficients and nothing else
from sklearn.linear_model import LinearRegression
LinearRegression().fit(w12[["BASE"]], w12.AVAL).coef_
```

:::lines
4: `statsmodels` prints a full regression table with standard errors, t statistics, p-values and intervals — the statistical toolkit. Use it for anything that goes in a report.
14: **`sklearn` is a machine-learning library, not an inference library.** It returns coefficients and offers no standard errors, no p-values and no intervals, because prediction accuracy rather than parameter inference is its purpose. Reaching for `sklearn` in a clinical analysis is a category error, and a visible one in a code review.
:::
:::
::::

## Output

```text
                              The REG Procedure

                          Analysis of Variance

                                 Sum of           Mean
Source                   DF     Squares         Square    F Value    Pr > F
Model                     1     2757.11        2757.11      24.08    <.0001
Error                   236    27019.04         114.4875
Corrected Total         237    29776.16

Root MSE             10.69988    R-Square     0.0926
Dependent Mean      141.62521    Adj R-Sq     0.0888
Coeff Var             7.55507

                           Parameter Estimates

                    Parameter      Standard
Variable     DF      Estimate         Error   t Value   Pr > |t|
Intercept     1      84.90260      11.57944      7.33     <.0001
BASE          1       0.37860       0.07715      4.91     <.0001
```

:::number[Where does Root MSE = 10.69955 come from, and why does it equal the residual standard error?]
`Root MSE` $= \sqrt{MSE} = \sqrt{114.4875} = 10.6999$, and $MSE = SSE/(n-2) = 27019.04/236$. R calls the same quantity "Residual standard error" and ANOVA calls it $\sqrt{MS_{\text{within}}}$. **Three names, one number**: the estimated SD of the errors, in the units of $y$.

It is the most practically useful number in the block. It says that even knowing a subject's baseline, your prediction of their Week 12 pressure will typically be off by about 11 mmHg.
:::

## Interpretation

> Week 12 systolic blood pressure increased by 0.379 mmHg (95% CI 0.227 to 0.531) for each 1 mmHg higher baseline pressure. Baseline explained 9.3% of the variance in Week 12 pressure, with a residual standard deviation of 10.7 mmHg.

Each phrase carries weight: **"for each 1 mmHg higher"** states the units the slope is in; **"95% CI"** gives its precision; **"9.3% of the variance"** is honest about how much is left unexplained; **"residual SD 10.7"** tells the reader what individual prediction is worth.

:::clinical
For a clinician, the actionable content is the slope's distance from 1 and the size of the residual SD. A slope of 0.38 means a patient starting at 170 mmHg is expected to be around 149 at Week 12, not 170 — most of that apparent improvement is regression to the mean and measurement variability, not treatment. And with a residual SD of 10.7, individual patients routinely land 20 mmHg either side of their predicted value. **Neither fact supports predicting an individual patient's course from their baseline**, which is exactly why treatment decisions are made on measured response rather than on predicted response.
:::

## Common mistakes

:::mistake[Interpreting an intercept when x = 0 is impossible]
A predicted Week 12 pressure of 84.9 mmHg for a subject with a baseline of 0 mmHg is not a finding. Centre the predictor at a meaningful value if you want an interpretable intercept, and otherwise ignore that row of the table.
:::

:::mistake[Extrapolating beyond the observed range of x]
The model is fitted on baselines from 130 to 173 mmHg. It says nothing about a subject with a baseline of 200 — not because the arithmetic fails but because nothing in the data constrains the relationship out there. Regression is interpolation; extrapolation is assertion.
:::

:::mistake[Judging a model by R²]
$R^2 = 0.09$ here with an overwhelmingly significant slope. A low $R^2$ with a useful coefficient is the normal state of clinical data, because most between-patient variation is not explained by anything you measured.
:::

:::mistake[Treating a significant slope as causal]
`BASE` predicts `AVAL` in this model, but the relationship is dominated by regression to the mean and by whatever makes a patient's pressure high in the first place. Regression estimates association; causal interpretation requires the design to supply it — which is precisely what randomization does for the treatment variable and does not do for baseline covariates.
:::

:::mistake[Reversing the roles of x and y]
Regressing $y$ on $x$ and $x$ on $y$ give different lines — the two slopes multiply to $r^2$, not to 1. Choose the outcome by the scientific question, not by which fits better.
:::

## Knowledge check

::quiz{ids="stats.lr.df-count,stats.lr.intercept-meaning,stats.lr.r2-vs-p,stats.lr.slope-precision"}

## Hands-on exercise

::practice{ids="stats.lr.slope-hand,stats.lr.se-slope,stats.lr.residual-sd,stats.lr.r-code" title="Practice: deriving every number in the output"}

## Challenge exercise

::practice{ids="stats.lr.regression-to-mean,stats.lr.centring,stats.lr.extrapolation-open" title="Challenge: regression to the mean, centring and extrapolation"}

## Industry note

**Simple regression is rarely the final analysis, and always the foundation.** The primary efficacy model in most trials is ANCOVA — a regression with a treatment indicator and a baseline covariate. Logistic regression replaces the normal errors with a binomial likelihood; Cox regression replaces the outcome with a hazard. All three inherit the structure here: coefficients, standard errors from the information matrix, Wald tests, and degrees of freedom counted by parameters estimated.

**Calibration curves are regression, and they are regulated.** Bioanalytical method validation requires a fitted calibration curve with specified acceptance criteria for accuracy and precision at each level. The regression is usually weighted ($1/x$ or $1/x^2$) because assay variability grows with concentration, which is a direct response to the equal-variance assumption failing. If you work near a bioanalytical group, this is where regression meets a regulatory guidance document.

:::standard{kind="official"}
The ICH M10 guideline on bioanalytical method validation specifies requirements for calibration curves, including the number of calibration standards, the acceptance criteria, and the requirement that the regression model and any weighting be pre-specified. It is a good example of a place where the choice of regression model is not a matter of analyst preference.
:::

**Weighted least squares is the standard fix for non-constant variance.** When residual spread grows with the fitted value, ordinary least squares still gives unbiased coefficients but wrong standard errors. The remedies are weighting (if you know the variance structure), a transformation (log, for multiplicative error), or robust "sandwich" standard errors. Which one is right depends on why the variance is changing, which is a question the residual plots answer — the subject of the diagnostics lesson.

:::interview[What is the standard error of a regression slope, and what makes it small?]
Start with the formula and then say what each part means, because the formula alone sounds memorised.

$\operatorname{SE}(\hat\beta_1) = \hat\sigma / \sqrt{S_{xx}}$, where $\hat\sigma$ is the residual standard deviation and $S_{xx}$ is the total squared spread of the predictor.

So three things make it small: **less residual noise** (a better model, or a less variable outcome), **more spread in x**, and **more observations** — the last because $S_{xx}$ grows with $n$.

The part that distinguishes a good answer is the middle one, because it is a design lever rather than a fact about the data. Spreading the predictor out gives you a longer lever arm: estimating a slope from points far apart is much more stable than from points bunched together. In a dose–response study that argues for widely spaced doses; in an exposure–response analysis it argues against restricting enrolment to a narrow dose range. It is also the reason range restriction damages a regression, and the same mechanism that attenuates correlations.

If the interviewer pushes, the multiple-regression version is worth having ready: the SE picks up a variance-inflation factor $1/(1-R_j^2)$, where $R_j^2$ is how well the other predictors explain this one — which is exactly why collinearity inflates standard errors.
:::
