## What problem are we trying to solve?

You fit the primary ANCOVA and R prints this:

```text
Coefficients:
                   Estimate Std. Error t value Pr(>|t|)
(Intercept)        83.83333   11.11907   7.540 1.03e-12
TRTPVTX-221 10 mg  -4.55909    1.63939  -2.781  0.00586
TRTPVTX-221 20 mg  -7.71518    1.64753  -4.683 4.80e-06
BASE               -0.58660    0.07444  -7.880 1.23e-13
```

Beautiful for reading. **Useless for programming.**

You cannot subset it, filter it or join it. It has no confidence intervals. Getting the treatment effect into a table means either retyping it — which is how transcription errors enter a CSR — or writing fragile code that indexes `summary(fit)$coefficients[3, 1]` and breaks the moment someone adds a covariate.

A clinical table program needs model output as **data**: one row per term, columns for estimate, standard error, confidence limits and p-value, ready to filter, format and write out.

That is what `broom` does, and it is the difference between a model you can read and a model you can build a pipeline on.

## Intuition

R's model objects are **lists containing everything** — coefficients, residuals, the model frame, the QR decomposition, the call. `print()` and `summary()` are display methods over that list, designed for a human at a console.

broom provides three verbs that extract the three genuinely different shapes of information a model holds:

| Verb | One row per | Use it for |
|---|---|---|
| `tidy()` | **model term** | The efficacy table: estimates, SEs, CIs, p-values |
| `glance()` | **model** | Fit summary: R², sigma, df, AIC — one row |
| `augment()` | **observation** | Diagnostics: fitted values, residuals, leverage, Cook's D |

:::why[Why three verbs instead of one?]
Because the three have different grains, and mixing grains in one data frame is exactly the mistake the rest of this curriculum warns about.

A model with 4 terms fitted to 238 observations has 4 coefficient rows, 1 model row and 238 observation rows. There is no sensible single table containing all three — you would have to repeat the model-level values 238 times, or pad the coefficient rows with `NA`.

Keeping them separate means each one can be filtered, joined and summarised on its own terms. `tidy()` output joins to a shell's row labels; `augment()` output joins back to the subject identifiers.
:::

## Clinical context

| Task | Verb |
|---|---|
| Efficacy table: treatment effect with CI and p | `tidy(fit, conf.int = TRUE)` |
| Reporting R² and residual SD in the ADRG | `glance(fit)` |
| Diagnostics: influential subjects to investigate | `augment(fit)` |
| Forest plot across subgroups | `tidy()` on each fit, then `bind_rows()` |
| Odds ratios from a logistic model | `tidy(fit, exponentiate = TRUE)` |
| Hazard ratios from a Cox model | `tidy(fit, exponentiate = TRUE)` |

**The last three are where broom earns its place.** Fitting the same model in several subgroups and assembling a forest plot is three lines with `tidy()` and a page of index arithmetic without it.

:::mistake[Indexing into `summary(fit)$coefficients`]
```r
summary(fit)$coefficients[3, 1]   # the 20 mg estimate — today
```

It works until someone adds a covariate, changes the reference level, or reorders the model formula. Then row 3 is a different term, the code still runs, and the table contains the wrong number.

`tidy(fit) |> filter(term == "TRTPVTX-221 20 mg")` selects by **name**, which is stable under all three of those changes. Positional indexing into model output is one of the most reliable ways to produce a silently wrong clinical table.
:::

## Formal concept

### `tidy()` — one row per term

```r
tidy(fit, conf.int = TRUE)
```

```text
               term   estimate  std.error statistic      p.value   conf.low  conf.high
1       (Intercept) 83.8333281 11.1190700  7.539599 1.032357e-12 61.9270518 105.739604
2 TRTPVTX-221 10 mg -4.5590948  1.6393906 -2.780969 5.861034e-03 -7.7889462  -1.329244
3 TRTPVTX-221 20 mg -7.7151784  1.6475319 -4.682870 4.795395e-06 -10.9610693 -4.469288
4              BASE -0.5866025  0.0744403 -7.880171 1.229791e-13 -0.7332614  -0.439944
```

**`conf.int = TRUE` is not the default**, and it should be. A coefficient without its interval is the regression equivalent of a p-value without an effect size.

The column names are deliberately generic — `estimate`, `std.error`, `statistic`, `p.value` — and identical across model types. `statistic` is a t for `lm`, a z for `glm`, a z for `coxph`. That consistency is what makes a table program work unchanged across model families.

### `glance()` — one row per model

```r
glance(fit)
```

```text
  r.squared adj.r.squared    sigma statistic      p.value df df.residual nobs
1 0.2833633     0.2741756 10.27107  30.84176 7.738899e-17  3         234  238
```

`sigma` is the residual standard deviation — the same quantity SAS prints as `Root MSE`. `statistic` and `p.value` here are the **overall F test**, not any individual term's.

`nobs = 238` is worth checking every time: it is the number of observations the model actually used, after dropping any row with a missing value in any model variable. If it differs from what you expected, a covariate has missing values you did not know about.

### `augment()` — one row per observation

```r
augment(fit)
```

```text
    CHG  BASE    .fitted    .resid       .hat     .cooksd .std.resid
1 -10.0 161.7 -18.735477  8.735477 0.01886881 0.003544638  0.8586323
2  15.6 148.7  -3.394466 18.994466 0.01298838 0.011399158  1.8614445
```

Every diagnostic from the regression-diagnostics lesson, as columns: `.fitted`, `.resid`, `.hat` (leverage), `.cooksd`, `.std.resid`.

:::number[Why do broom's added columns start with a dot?]
To avoid colliding with your data's own column names. A clinical dataset could plausibly have a column called `fitted` or `resid`; `.fitted` and `.resid` will not clash.

It also makes them selectable as a group: `select(starts_with("."))` picks out everything broom added, and `select(-starts_with("."))` gets you back to the original columns.
:::

**Pass the original data to keep the identifiers:**

```r
augment(fit, data = w12) |>
  select(USUBJID, .fitted, .resid, .cooksd) |>
  arrange(desc(.cooksd))
```

Without `data =`, `augment()` returns only the model frame — the variables in the formula — so `USUBJID` is absent and the diagnostics cannot be traced to a subject. A diagnostics table naming row numbers instead of subjects is useless to a data manager.

### `glm()` and the `family` argument

```r
glm(RESP ~ TRTP, data = w12, family = binomial)
```

The `family` chooses the likelihood and the link:

| Outcome | `family` | Default link | `exponentiate = TRUE` gives |
|---|---|---|---|
| Binary | `binomial` | logit | **Odds ratio** |
| Count | `poisson` | log | Rate ratio |
| Continuous | `gaussian` | identity | (same as `lm`) |

:::mistake[Forgetting that `glm` coefficients are on the link scale]
A logistic model's coefficients are **log odds ratios**. Reporting them unexponentiated gives numbers around 1.2 where the odds ratio is 3.3, and they look like plausible effect sizes.

```r
tidy(g, exponentiate = TRUE, conf.int = TRUE)
```

`exponentiate = TRUE` transforms the estimate **and** the confidence limits, which is correct — the interval is built on the log scale and exponentiated, so the result is asymmetric around the point estimate. It does **not** exponentiate the standard error, which stays on the log scale, because an exponentiated SE is not a meaningful quantity.

That asymmetry is the check: an odds-ratio interval that is symmetric around its estimate has been computed wrongly.
:::

## Worked example

Building the efficacy table rows from the model, with no retyping.

```r
library(dplyr); library(broom)

w12$TRTP <- relevel(factor(w12$TRTP), ref = "Placebo")
fit <- lm(CHG ~ TRTP + BASE, data = w12)

efficacy <- tidy(fit, conf.int = TRUE) |>
  filter(startsWith(term, "TRTP")) |>
  mutate(
    arm   = sub("^TRTP", "", term),
    cell  = sprintf("%.2f (%.2f, %.2f)", estimate, conf.low, conf.high),
    p_fmt = if_else(p.value < 0.0001, "<0.0001", sprintf("%.4f", p.value))
  ) |>
  select(arm, estimate, std.error, conf.low, conf.high, cell, p_fmt)
```

```text
            arm  estimate std.error   conf.low conf.high                    cell   p_fmt
1 VTX-221 10 mg -4.559095  1.639391  -7.788946 -1.329244  -4.56 (-7.79, -1.33)  0.0059
2 VTX-221 20 mg -7.715178  1.647532 -10.961069 -4.469288 -7.72 (-10.96, -4.47) <0.0001
```

**Step 1 — `filter(startsWith(term, "TRTP"))`** selects the treatment rows by name. The intercept and the baseline covariate are nuisance parameters and do not belong in the table.

**Step 2 — keep the numeric columns alongside the formatted string.** The formatted `cell` goes in the table; the numeric `estimate` and `conf.low` stay so a QC program can compare values rather than strings. Comparing formatted text hides a real difference behind identical rounding.

:::number[Why format the p-value as `<0.0001` rather than printing it?]
Because a p-value of `4.795e-06` carries more precision than the model can support. The far tail of a t distribution is where the normal approximation and the model's distributional assumptions are least trustworthy, so the extra digits are not information.

Most sponsors' standards truncate at four decimals for exactly this reason. **Know the actual value** — `4.8 × 10⁻⁶` here — because "how small was it really?" gets asked, and because a p-value printing as exactly `0.0000` is a red flag for a programming error rather than a very strong result.
:::

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="6" caption="ADVS — the Week 12 records feeding the model"}

**The same model, three ways:**

```r
glance(fit)$nobs      # 238  — observations used
glance(fit)$sigma     # 10.27 — residual SD
glance(fit)$r.squared # 0.283
```

These match the ANCOVA lesson exactly: 238 subjects, residual SD 10.27 on 234 degrees of freedom.

**A logistic model on the same data:**

```r
w12$RESP <- as.integer(w12$AVAL < 140)
g <- glm(RESP ~ TRTP, data = w12, family = binomial)
tidy(g, exponentiate = TRUE, conf.int = TRUE)
```

```text
               term  estimate std.error statistic      p.value conf.low conf.high
1       (Intercept) 0.3508772 0.2598918 -4.029827 5.581790e-05 0.205855 0.5735609
2 TRTPVTX-221 10 mg 2.3965909 0.3424880  2.552052 1.070905e-02 1.235520 4.7513107
3 TRTPVTX-221 20 mg 3.3121622 0.3432588  3.488916 4.849826e-04 1.708871 6.5894247
```

:::number[The 20 mg odds ratio is 3.3121622 — exactly the value computed by hand from the 2×2 table.]
That is not a coincidence. A logistic regression with a single categorical predictor and no covariates is **algebraically identical** to the 2×2 odds ratio:

$$OR = \frac{43 \times 57}{37 \times 20} = \frac{2451}{740} = 3.3122$$

The confidence intervals differ slightly — `tidy()` reports profile-likelihood limits (1.709, 6.589) by default, while the Woolf formula from the categorical lesson gives (1.690, 6.491). Profile limits are generally more accurate in small samples and are what `confint.glm` computes; `confint.default` would give the Woolf-style Wald interval.

**That discrepancy is worth knowing before it appears in a QC comparison**, because both are defensible and the SAP should say which.
:::

Note also that the intercept's `estimate` of 0.351 is the **odds** of response on placebo — $20/57 = 0.351$ — because exponentiating the intercept of a logistic model with treatment coding gives the reference group's odds, not an odds ratio.

## Code

::::tabs
:::tab[SAS]
```sas
proc glm data=w12;
  class trtp (ref='Placebo');
  model chg = trtp base / solution clparm;
  lsmeans trtp / pdiff cl;
  ods output ParameterEstimates = pe
             LSMeanDiffCL       = diffs
             FitStatistics      = fit;
run;
quit;
```

:::lines
6: **`ODS OUTPUT` is SAS's `broom`.** Each printed table has a name, and naming it on an `ODS OUTPUT` statement captures it as a dataset instead of only printing it. `ParameterEstimates` corresponds to `tidy()`, `FitStatistics` to `glance()`. There is no direct `augment()` equivalent — diagnostics come from the `OUTPUT OUT=` statement in `PROC REG` instead.
7: `LSMeanDiffCL` is what an efficacy table actually wants: the LS mean differences with confidence limits, rather than the raw parameter estimates.
8: To find a table's ODS name, run `ods trace on;` before the procedure and the log lists every table it produces.
:::
:::

:::tab[R]
```r
library(broom); library(dplyr)

fit <- lm(CHG ~ TRTP + BASE, data = w12)

tidy(fit, conf.int = TRUE)       # one row per term
glance(fit)                      # one row per model
augment(fit, data = w12)         # one row per observation

# Straight into a table
tidy(fit, conf.int = TRUE) |>
  filter(startsWith(term, "TRTP")) |>
  mutate(cell = sprintf("%.2f (%.2f, %.2f)", estimate, conf.low, conf.high))
```

:::lines
5: `conf.int = TRUE` is **not** the default. Always pass it — a coefficient without its interval is not a reportable result.
7: `data = w12` keeps `USUBJID` and every other original column. Without it you get only the model frame, and the diagnostics cannot be traced to a subject.
11: Filtering by `term` name rather than row position. This survives adding a covariate, changing the reference level or reordering the formula.
:::
:::

:::tab[Python]
```python
import statsmodels.formula.api as smf
import pandas as pd

fit = smf.ols("CHG ~ C(TRTP, Treatment('Placebo')) + BASE", data=w12).fit()

# statsmodels' equivalent of tidy()
tidy = pd.DataFrame({
    "term": fit.params.index,
    "estimate": fit.params.values,
    "std_error": fit.bse.values,
    "statistic": fit.tvalues.values,
    "p_value": fit.pvalues.values,
}).join(fit.conf_int().set_axis(["conf_low", "conf_high"], axis=1).reset_index(drop=True))
```

:::lines
7: statsmodels has no `broom` equivalent, so the tidy frame is assembled by hand from `params`, `bse`, `tvalues`, `pvalues` and `conf_int()`.
13: `fit.conf_int()` returns a DataFrame indexed by term; the `set_axis` renames its unhelpful `0` and `1` columns. Building this once as a helper function is worth it — the alternative is repeating five attribute accesses at every call site, which is the same fragility as positional indexing in R.
:::
:::
::::

## Output

```text
> glance(fit)
  r.squared adj.r.squared    sigma statistic      p.value df df.residual nobs
1 0.2833633     0.2741756 10.27107  30.84176 7.738899e-17  3         234  238
```

:::number[Why does `df` say 3 when the model has 4 coefficients?]
Because `df` in `glance()` is the **model** degrees of freedom — the number of parameters *excluding* the intercept, which is also the numerator df of the overall F test.

Four coefficients: intercept, two treatment dummies, one covariate. Three of them are model terms, so $F(3, 234)$.

`df.residual = 234` is $238 - 4$, counting the intercept. So the two columns use different conventions in the same row — a genuine source of confusion, and the reason it is worth reading `df.residual` rather than computing it.
:::

## Interpretation

> The estimated difference in mean change from baseline at Week 12 was **−7.72 mmHg (95% CI −10.96 to −4.47; p < 0.0001)** for VTX-221 20 mg versus placebo, from an ANCOVA model adjusting for baseline systolic blood pressure.

Every number in that sentence came from `tidy(fit, conf.int = TRUE)` without being retyped, which removes an entire class of transcription error from the table program.

:::clinical
The logistic model tells the same story on a different scale: the odds of achieving controlled blood pressure were 3.31 times higher on 20 mg than on placebo (95% CI 1.71 to 6.59). Two models, two scales, one conclusion — and the agreement is itself reassuring, because a continuous endpoint and its dichotomised version pointing different ways would need explaining.

Note which one belongs in patient-facing material: neither, directly. The number a clinician acts on is the **absolute** difference — 27.8 percentage points more subjects controlled — because odds are not how anyone outside statistics reasons about risk.
:::

## Common mistakes

:::mistake[Indexing model output by position]
`summary(fit)$coefficients[3, 1]` breaks silently when the model changes. Filter by `term` name.
:::

:::mistake[Omitting `conf.int = TRUE`]
It is not the default. A table row with an estimate and a p-value but no interval fails what ICH E9 §5.5 asks for.
:::

:::mistake[Reporting `glm` coefficients unexponentiated]
Logistic coefficients are log odds ratios. `exponentiate = TRUE` transforms the estimate and both confidence limits — but deliberately not the standard error, which has no meaning exponentiated.
:::

:::mistake[Calling `augment()` without `data =`]
You get the model frame only, so subject identifiers are missing and a diagnostics table names row numbers instead of subjects.
:::

:::mistake[Comparing formatted strings in QC]
Keep the numeric columns alongside the formatted cell. Two programs rounding to the same two decimals can agree on the string while differing in the third decimal — which is a real discrepancy hidden by the formatting.
:::

## Knowledge check

::quiz{ids="r.models.three-verbs,r.models.exponentiate,r.models.term-filter,r.models.nobs"}

## Hands-on exercise

::practice{ids="r.models.tidy-table,r.models.glance-check,r.models.augment-diag,r.models.logistic-or" title="Practice: turning model output into table rows"}

## Challenge exercise

::practice{ids="r.models.positional-bug,r.models.subgroup-forest,r.models.open" title="Challenge: fragile indexing, forest plots and model reporting"}

## Industry note

**`tidy()` output is the natural input to a table program.** The pattern that scales: fit the model, `tidy()` it, join to the shell's row labels by term, format, write out. Changing the model changes one line and the table program is untouched.

**Fitting the same model across subgroups** is where this compounds:

```r
subgroups |>
  group_by(SUBGROUP) |>
  group_modify(~ tidy(lm(CHG ~ TRTP + BASE, data = .x), conf.int = TRUE)) |>
  filter(startsWith(term, "TRTP"))
```

One pipeline producing every row of a forest plot. The same thing in base R is a loop with index arithmetic, and in SAS a `BY` statement plus `ODS OUTPUT` — all workable, none as short.

Worth remembering from the subgroups discussion in the statistics lab: a forest plot built this way is **exploratory**, the interaction test is the analysis, and the plot should say so.

:::standard{kind="convention"}
`{broom}` is a tidymodels package, widely used and not part of any clinical standard. For regulatory work the pharmaverse equivalents — `{rtables}`, `{tfrmt}` — handle the full table structure including nesting, indentation and footnotes. broom is the layer that gets model output into a data frame; those handle turning a data frame into a CSR table.
:::

**Not every model has a `tidy()` method**, and the coverage for the survival and mixed-model packages varies by version. `tidy(coxph_fit)` works; `tidy()` on an `nlme::gls` object may not give what you expect. Check the output against the model's own `summary()` the first time you use broom with an unfamiliar model class — the failure mode is a tidy frame missing rows rather than an error.

:::interview[How would you get a model's results into a clinical table?]
The answer worth giving names the fragility you are avoiding, not just the tool.

"I'd use `broom::tidy(fit, conf.int = TRUE)` to get one row per term as a data frame, then filter to the treatment terms **by name** and format from there.

The thing I'd avoid is indexing into `summary(fit)$coefficients` by position. That works until someone adds a covariate or changes the reference level, and then row 3 is a different term, the code still runs, and the table has the wrong number in it. Filtering by term name survives all of that.

I'd also keep the numeric columns alongside the formatted string, so QC compares values rather than text — two programs can round to the same two decimals and still differ in the third.

For the model-level numbers — residual SD, R², the number of observations actually used — `glance()`. I check `nobs` every time, because if it differs from the population count then a covariate has missing values I did not know about.

And for an ANCOVA specifically, the table usually wants **LS means and their differences** rather than raw coefficients, so that is `emmeans` rather than `tidy` — `tidy` gives the parameter estimates, which are differences from a reference level and depend on the parameterisation."

That last point is the one that shows you have built the table rather than read about it.
:::
