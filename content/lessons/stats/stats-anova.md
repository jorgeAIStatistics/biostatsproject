## What problem are we trying to solve?

VTX221-201 has three arms: placebo, 10 mg and 20 mg. The Week 12 mean changes in systolic BP are −3.30, −8.83 and −12.28 mmHg.

The obvious move is three t tests — 10 vs placebo, 20 vs placebo, 20 vs 10. But you already know from the hypothesis-testing lesson what that costs: three tests at α = 0.05 give a family-wise error rate near 14%, and the SAP will not let you do it without a plan.

So the first question is: **is there any difference among these three arms at all?** One test, one p-value, and only if it is significant do you start asking which pairs differ. That is what ANOVA does.

But the more valuable question for a dose-ranging trial is a different one entirely. Nobody really wants to know "are the three means not all equal". They want to know **does the effect increase with dose?** — because a dose-response relationship is evidence of a real pharmacological effect in a way that three scattered means are not. That question is answered by a **contrast**, it is more powerful than the overall F test, and it is the kind of thing a SAP pre-specifies.

This lesson is also where **degrees of freedom stop being a number you look up** and start being something you can count on your fingers.

## Intuition

ANOVA is a strange name for what it does: it compares **means** by comparing **variances**. Here is why that works.

Look at the 238 change-from-baseline values as one cloud. They vary — total variability. Now ask where that variability comes from. Two sources:

1. **Between groups.** The arm means differ from each other (−3.30, −8.83, −12.28). Part of why any subject's value is far from the overall average is simply which arm they were in.
2. **Within groups.** Even inside one arm, subjects differ enormously. That is patient-to-patient variability — noise, as far as the treatment comparison is concerned.

Now the key move. **If the treatment did nothing, the arm means would still differ a bit**, purely by chance, and the size of that chance variation is governed by the within-group variability. So:

$$
F = \frac{\text{variability between the arm means}}{\text{variability within the arms}}
$$

If $F \approx 1$, the arm means are scattered about as much as random allocation would scatter them — no evidence of an effect. If $F$ is large, the means are further apart than noise alone explains.

:::why[Why does $F \approx 1$ mean "no effect" rather than $F \approx 0$?]
Because under $H_0$ both the numerator and the denominator are estimating the *same* quantity — the common within-group variance $\sigma^2$. Their ratio is therefore around 1. An $F$ near 0 would mean the group means are suspiciously *closer together* than chance allows, which happens so rarely that a very small $F$ is a signal to check for fabricated or over-cleaned data rather than evidence of no effect.
:::

## Clinical context

| Where ANOVA-type reasoning appears | What is being compared |
|---|---|
| Dose-ranging trials (phase II) | Several dose levels plus placebo |
| Multi-arm trials with a common control | Several experimental regimens |
| The overall treatment test in an ANCOVA table | Several arms, adjusted for baseline |
| Laboratory and manufacturing comparisons | Several batches, sites, analysts or instruments |
| The F test printed above every regression | All predictors jointly versus none |

In a clinical SAP you will almost never see a bare one-way ANOVA as the primary analysis — it will be **ANCOVA** with baseline as a covariate, which is the same machinery plus a continuous predictor. But the decomposition, the degrees of freedom and the F test are identical, so everything here carries straight over.

:::standard{kind="convention"}
The "test the overall F first, then look at pairwise comparisons only if it is significant" rule is known as Fisher's protected LSD. It controls the family-wise error rate for three groups but **not** for four or more, which is a detail that surprises people. Modern SAPs more often pre-specify the specific contrasts of interest with an explicit multiplicity strategy, rather than relying on protection from the omnibus test. Either way, what governs is what the SAP says.
:::

## Formal concept

### The decomposition

With $k$ groups, group $i$ having $n_i$ subjects, $\bar{x}_i$ its mean, and $\bar{x}$ the grand mean:

$$
\underbrace{\sum_{i}\sum_{j}(x_{ij} - \bar{x})^2}_{SS_{\text{total}}}
=
\underbrace{\sum_{i} n_i(\bar{x}_i - \bar{x})^2}_{SS_{\text{between}}}
+
\underbrace{\sum_{i}\sum_{j}(x_{ij} - \bar{x}_i)^2}_{SS_{\text{within}}}
$$

Every subject's distance from the grand mean splits exactly into "how far my group's mean is from the grand mean" plus "how far I am from my group's mean" — and when you square and sum, the cross-terms vanish, so the split is exact.

### Degrees of freedom — counted, not looked up

| Source | df | Why |
|---|---|---|
| Between groups | $k - 1$ | $k$ group means, but one constraint: they must average (weighted) to the grand mean |
| Within groups | $N - k$ | $N$ observations, minus one mean estimated per group |
| Total | $N - 1$ | $N$ observations, minus the grand mean |

:::number[Where does "df = 2" come from in a three-arm trial?]
$k - 1 = 3 - 1 = 2$. Think of it as: knowing how far two of the arm means sit from the grand mean determines the third, because the weighted deviations must sum to zero. Equivalently, comparing three groups requires two independent comparisons (10 vs placebo and 20 vs placebo); the third (20 vs 10) is their difference and carries no new information. **This is the same counting as the $n-1$ in a sample SD** — one degree of freedom is consumed by each quantity estimated from the data.
:::

### Mean squares and F

A sum of squares divided by its degrees of freedom is a **mean square** — a variance estimate:

$$
MS_{\text{between}} = \frac{SS_{\text{between}}}{k-1},
\qquad
MS_{\text{within}} = \frac{SS_{\text{within}}}{N-k},
\qquad
F = \frac{MS_{\text{between}}}{MS_{\text{within}}}
$$

Under $H_0: \mu_1 = \mu_2 = \dots = \mu_k$, $F \sim F_{k-1,\,N-k}$.

$MS_{\text{within}}$ is the multi-group version of the pooled variance $s_p^2$ from the t-test lesson, and $\sqrt{MS_{\text{within}}}$ is the residual SD you will see printed under every regression output.

:::why[Why is the F test one-sided when $H_0$ is "all means equal"?]
Because any departure from equality — in any direction — makes the group means more spread out, which makes $SS_{\text{between}}$ *larger*. There is no way for a real effect to produce a small $F$. So you reject only in the upper tail, and there is no doubling of the p-value. This is why the "two-sided p is twice the one-sided p" rule from t-tests does **not** apply to F or chi-square tests.
:::

### Contrasts: asking a specific question

The F test answers a vague question. A **contrast** answers a precise one. It is a weighted combination of group means whose weights sum to zero:

$$
L = \sum_i c_i \bar{x}_i, \qquad \sum_i c_i = 0
$$

$$
\operatorname{SE}(L) = \sqrt{MS_{\text{within}} \sum_i \frac{c_i^2}{n_i}},
\qquad
t = \frac{L}{\operatorname{SE}(L)} \quad \text{on } N-k \text{ df}
$$

| Question | Placebo | 10 mg | 20 mg |
|---|---:|---:|---:|
| Is 10 mg different from placebo? | −1 | +1 | 0 |
| Is 20 mg different from placebo? | −1 | 0 | +1 |
| Is there a linear trend across doses 0, 10, 20? | −1 | 0 | +1 |
| Is the drug (either dose) different from placebo? | −2 | +1 | +1 |

:::number[Why are the linear-trend coefficients (−1, 0, +1) and not (0, 10, 20)?]
Because trend coefficients are the dose levels **centred on their mean**: the doses are 0, 10, 20 with mean 10, so the centred values are −10, 0, +10, and dividing by 10 gives −1, 0, +1. Contrast coefficients are only defined up to a scale factor — multiplying all of them by a constant scales $L$ and $\operatorname{SE}(L)$ identically, so $t$ and the p-value are unchanged. Only the *pattern* matters.

A consequence specific to equally spaced doses: here the linear contrast is *numerically identical* to the "20 mg versus placebo" contrast. With unequally spaced doses — 0, 5, 20, say — they would differ, and the linear contrast would be the more sensible pre-specification.
:::

Note the crucial advantage: the SE uses $MS_{\text{within}}$, pooled across **all three arms**, so a contrast has $N - k = 235$ degrees of freedom rather than the ~156 a two-arm t test would have. Borrowing information from the arms not in the comparison is what makes contrasts more precise.

## Worked example

Week 12 change from baseline, all three arms:

| Arm | $n_i$ | $\bar{x}_i$ | $s_i$ |
|---|---:|---:|---:|
| Placebo | 77 | −3.3000 | 11.6100 |
| VTX-221 10 mg | 81 | −8.8284 | 11.4842 |
| VTX-221 20 mg | 80 | −12.2762 | 11.4967 |
| **Total** | **238** | **−8.1987** | |

**Step 1 — the grand mean.** Not the average of the three arm means (that would be −8.1349) but the mean of all 238 values, which weights by arm size:

$$
\bar{x} = \frac{77(-3.3000) + 81(-8.8284) + 80(-12.2762)}{238} = -8.1987
$$

**Step 2 — between-group sum of squares.**

$$
\begin{aligned}
SS_{\text{between}} &= 77(-3.3000 + 8.1987)^2 + 81(-8.8284 + 8.1987)^2 + 80(-12.2762 + 8.1987)^2 \\
&= 77(4.8987)^2 + 81(-0.6297)^2 + 80(-4.0775)^2 \\
&= 1847.81 + 32.12 + 1330.06 \\
&= 3209.99
\end{aligned}
$$

**Step 3 — within-group sum of squares.** Each arm contributes $(n_i - 1)s_i^2$:

$$
SS_{\text{within}} = 76(11.6100)^2 + 80(11.4842)^2 + 79(11.4967)^2 = 31236.75
$$

**Step 4 — the ANOVA table.**

| Source | SS | df | MS | F | p |
|---|---:|---:|---:|---:|---:|
| Treatment | 3210.02 | 2 | 1605.01 | 12.07 | 1.02 × 10⁻⁵ |
| Residual | 31236.75 | 235 | 132.92 | | |
| **Total** | **34446.77** | **237** | | | |

:::number[Where do df = 2 and df = 235 come from?]
Between: $k - 1 = 3 - 1 = 2$. Within: $N - k = 238 - 3 = 235$. Total: $N - 1 = 237$, and $2 + 235 = 237$ — the degrees of freedom partition exactly as the sums of squares do. That check is worth doing on any ANOVA table you build or review: if the df don't add up, something is wrong with the model specification.
:::

**Step 5 — the F statistic.**

$$
F = \frac{1605.01}{132.92} = 12.07
$$

The critical value is $F_{0.95,\,2,\,235} = 3.03$, so reject. Also note $\sqrt{MS_{\text{within}}} = \sqrt{132.92} = 11.53$ mmHg — the pooled residual SD, close to each arm's individual SD as you would expect when the equal-variance assumption holds.

**Step 6 — the contrast that actually answers the clinical question.** Linear trend, $c = (-1, 0, +1)$:

$$
L = -(-3.3000) + 0 + (-12.2762) = -8.9762 \text{ mmHg}
$$

$$
\operatorname{SE}(L) = \sqrt{132.92\left(\frac{1}{77} + \frac{0}{81} + \frac{1}{80}\right)} = \sqrt{132.92 \times 0.025487} = 1.8406
$$

$$
t = \frac{-8.9762}{1.8406} = -4.877 \quad \text{on 235 df}, \quad p = 2.0 \times 10^{-6}
$$

A clear dose-response signal — and a smaller p-value than the omnibus F test, because it asked a sharper question.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — the three-arm Week 12 comparison"}

**The omnibus test.** $F(2, 235) = 12.07$, $p = 1.02 \times 10^{-5}$: the three arms are not all the same. That is all it says. It does not say which differ, nor in what direction, nor by how much.

$R^2 = SS_{\text{between}}/SS_{\text{total}} = 3210.02/34446.77 = 0.093$ — treatment arm explains about 9% of the variability in Week 12 change. **A highly significant effect that explains under a tenth of the variation** is entirely normal in clinical data, and worth internalising: most of why one patient's blood pressure fell more than another's has nothing to do with which arm they were in.

**The pairwise contrasts**, each using the pooled $MS_{\text{within}}$ on 235 df:

| Contrast | Difference | SE | t | p (unadjusted) | p (Bonferroni ×2) | p (Holm) |
|---|---:|---:|---:|---:|---:|---:|
| 10 mg − placebo | −5.528 | 1.835 | −3.013 | 0.00287 | 0.00574 | 0.00287 |
| 20 mg − placebo | −8.976 | 1.841 | −4.877 | 0.0000020 | 0.0000040 | 0.0000040 |

:::number[Why does Holm give 0.00287 for the first row but Bonferroni gives 0.00574?]
Holm is a **step-down** procedure. Order the p-values smallest first: the smallest is compared against $\alpha/2$ (equivalently, multiply it by 2), and if it passes, the *next* is compared against $\alpha/1$ (multiply by 1 — no penalty at all). So the larger p-value escapes adjustment entirely once the smaller one has been rejected.

Holm is uniformly more powerful than Bonferroni and controls the family-wise error rate under exactly the same (i.e. no) assumptions. There is no situation in which you should prefer plain Bonferroni to Holm — which makes it slightly odd how often Bonferroni still appears in SAPs.
:::

::widget{name="multiplicity-simulator"}

**Comparing to the two-sample t test.** Earlier you computed the 20 mg versus placebo pooled t test as $t = -4.867$ on 156 df. The contrast gives $t = -4.877$ on 235 df. Slightly different, and better, because $MS_{\text{within}}$ borrows the 10 mg arm's 80 subjects to estimate the common variance.

:::number[If the F test is about means, why is $F = t^2$ for two groups?]
Because with $k = 2$ the two tests are the same test. Dropping the 10 mg arm and running a two-arm ANOVA gives $F(1, 155) = 23.688$, and the pooled two-sample t test gives $t = 4.867$ — and $4.867^2 = 23.688$ exactly. The F test with 1 numerator degree of freedom *is* the squared t test; squaring is what turns a two-sided t into a one-sided F, which is why F tests have no doubling rule.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc glm data=w12;
  class trtp;
  model chg = trtp;
  means trtp;
  /* Specific pre-specified questions */
  estimate 'Linear trend'     trtp -1  0  1;
  estimate '10 mg vs placebo' trtp -1  1  0;
  estimate '20 mg vs placebo' trtp -1  0  1;
  lsmeans trtp / pdiff adjust=dunnett cl;
run;
quit;
```

:::lines
2: `class trtp` declares the treatment as categorical. Omitting it would make SAS treat the variable as continuous — and if `trtp` were numeric, SAS would happily fit a straight line through the dose levels instead of separate means, with no error.
3: `model chg = trtp` fits the one-way ANOVA. The F test for `trtp` is the omnibus test.
6: `estimate` statements take coefficients in the order SAS orders the class levels — **alphabetical by default**. `'Placebo' < 'VTX-221 10 mg' < 'VTX-221 20 mg'` happens to be the order we want here, but relying on that is fragile. Use a numeric `TRTPN` or an explicit `ORDER=` so the coefficients cannot silently attach to the wrong arms.
9: `adjust=dunnett` adjusts the comparisons-to-control for multiplicity. Dunnett is more powerful than Bonferroni for this specific structure because it accounts for the correlation induced by every comparison sharing the same control arm. `adjust=` also accepts `bon`, `sidak`, `tukey` and `simulate`.
:::
:::

:::tab[R]
```r
w12$TRTP <- factor(w12$TRTP,
                   levels = c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg"))

fit <- aov(CHG ~ TRTP, data = w12)
summary(fit)

# A contrast, computed explicitly so every term is visible
msw <- summary(fit)[[1]][["Mean Sq"]][2]
m   <- tapply(w12$CHG, w12$TRTP, mean)
n   <- tapply(w12$CHG, w12$TRTP, length)

contrast <- function(cf) {
  L  <- sum(cf * m)
  se <- sqrt(msw * sum(cf^2 / n))
  df <- sum(n) - length(n)
  c(estimate = L, se = se, t = L / se, p = 2 * pt(-abs(L / se), df))
}

contrast(c(-1, 0, 1))    # linear trend
contrast(c(-1, 1, 0))    # 10 mg vs placebo

# Multiplicity adjustment across a set of p-values
p.adjust(c(0.00287, 0.0000020), method = "holm")
```

:::lines
1: Setting the factor levels explicitly is not cosmetic — it fixes which arm is the reference and therefore what the contrast coefficients mean. A character column becomes a factor in alphabetical order, which is how coefficients end up attached to the wrong arms.
6: `summary(fit)[[1]][["Mean Sq"]][2]` pulls the residual mean square out of the ANOVA table — the second row is the residual line.
14: The SE uses the pooled `msw` and the contrast coefficients, exactly as in the formula. Writing it out once makes clear that a contrast is not a separate test but a linear combination evaluated against the shared residual variance.
22: `p.adjust()` implements holm, bonferroni, BH and others. Note it adjusts a **set** of p-values you supply — it cannot know what your family is, so deciding what belongs in the family is your job and the SAP's.
:::
:::

:::tab[Python]
```python
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.multitest import multipletests

model = ols("CHG ~ C(TRTP, Treatment(reference='Placebo'))", data=w12).fit()
print(sm.stats.anova_lm(model, typ=2))

# Contrast via the fitted model's covariance matrix
import numpy as np
cf = np.array([0, 0, 1])            # 20 mg vs placebo, given the reference coding
est = cf @ model.params
se  = np.sqrt(cf @ model.cov_params() @ cf)

multipletests([0.00287, 0.0000020], method="holm")
```

:::lines
6: `C(TRTP, Treatment(reference='Placebo'))` sets the reference level explicitly. Without it, patsy picks the first level alphabetically — the same trap as R and SAS, in a third syntax.
7: `typ=2` requests Type II sums of squares. For a one-way model with a single factor, Types I, II and III are identical; they diverge once you add a second factor, which is the subject of the multiple-regression lesson.
12: With treatment coding, the model parameters are already differences from the reference, so the "20 mg vs placebo" contrast is just picking out that coefficient. This is the same object as the SAS `estimate` statement, expressed through the design matrix instead.
:::
:::
::::

## Output

```text
                             The GLM Procedure

Dependent Variable: CHG

                                  Sum of
Source              DF           Squares     Mean Square    F Value    Pr > F
Model                2       3210.020100     1605.010050      12.07    <.0001
Error              235      31236.749600      132.922339
Corrected Total    237      34446.769700

        R-Square     Coeff Var      Root MSE       CHG Mean
        0.093188     -140.6217      11.52919      -8.198700

Contrast / Estimate Statements

Parameter               Estimate    Standard Error   t Value   Pr > |t|
Linear trend          -8.9762500        1.84063846     -4.88     <.0001
10 mg vs placebo      -5.5283705        1.83501299     -3.01     0.0029
20 mg vs placebo      -8.9762500        1.84063846     -4.88     <.0001
```

:::number[Why is Coeff Var negative (−140.62)?]
The coefficient of variation is $100 \times \text{Root MSE} / \text{mean}$, and the mean change from baseline is negative (−8.20 mmHg), so the ratio is negative. SAS prints it anyway. **CV is meaningless for a variable that can be negative or that crosses zero** — it is designed for strictly positive quantities like concentrations or weights. Seeing a negative CV is a signal to ignore that cell, not to investigate it.
:::

## Interpretation

> Mean change from baseline in seated systolic blood pressure differed significantly across the three arms (F(2, 235) = 12.07, p < 0.0001). A pre-specified linear trend contrast across doses was significant (−8.98 mmHg per two dose levels, p < 0.0001), indicating a dose-related effect. Both active doses differed from placebo (10 mg: −5.53 mmHg, Holm-adjusted p = 0.0029; 20 mg: −8.98 mmHg, Holm-adjusted p < 0.0001).

:::clinical
The dose-response pattern is the clinically important finding, and it is stronger evidence than either pairwise comparison alone. A monotone increase in effect with dose is what you expect from a genuine pharmacological mechanism and is hard to produce by chance or by bias. It also feeds directly into dose selection for phase III: the 20 mg dose gives roughly 3.4 mmHg more reduction than 10 mg, and that benefit has to be weighed against its safety profile — in this trial, 54.5% of 20 mg subjects had a treatment-emergent adverse event versus 35.6% on 10 mg. Efficacy monotone in dose, tolerability monotone in the other direction: the dose-selection conversation in one sentence.
:::

## Common mistakes

:::mistake[Running all pairwise t tests without an adjustment]
Three arms give three pairwise comparisons and a family-wise error rate near 14%; five arms give ten comparisons and 40%. Pre-specify which comparisons matter and how multiplicity is handled. Often only the comparisons against control matter, and Dunnett's procedure handles exactly that structure more powerfully than Bonferroni.
:::

:::mistake[Treating a significant F test as the finding]
"The arms differed (p < 0.0001)" tells a reader nothing actionable — not which arms, not by how much, not in which direction. The F test is a gatekeeper, not a result. Always follow it with estimates and intervals for the comparisons the trial was designed to make.
:::

:::mistake[Using a numeric treatment variable without CLASS]
If `TRTPN` is 0, 1, 2 and you write `model chg = trtpn;` without a `class` statement, SAS fits a **straight line through the dose levels** with 1 df instead of estimating three separate means with 2 df. No error, no warning, a different model and a different answer. The df column is where you catch it: `Model DF = 1` when you expected 2.
:::

:::mistake[Averaging the group means to get the grand mean]
With unequal group sizes, $(\bar{x}_1 + \bar{x}_2 + \bar{x}_3)/3 = -8.1349$ but the true grand mean is −8.1987. Using the unweighted average corrupts $SS_{\text{between}}$ and everything downstream. The grand mean is the mean of all the data.
:::

:::mistake[Assuming the doubling rule applies to F]
The F test is intrinsically one-tailed — any departure from equal means inflates the numerator. There is no two-sided F p-value to compute and no factor of 2 to apply. The same is true of chi-square tests.
:::

## Knowledge check

::quiz{ids="stats.av.df-count,stats.av.f-near-one,stats.av.omnibus-limit,stats.av.contrast-coefficients"}

## Hands-on exercise

::practice{ids="stats.av.ss-between,stats.av.f-statistic,stats.av.contrast-se,stats.av.r-code" title="Practice: building an ANOVA table and a contrast"}

## Challenge exercise

::practice{ids="stats.av.missing-class,stats.av.holm-vs-bonferroni,stats.av.dose-open" title="Challenge: model specification, multiplicity and dose selection"}

## Industry note

**One-way ANOVA is rarely the final model.** The primary analysis of a continuous endpoint is almost always ANCOVA — the same decomposition with baseline added as a continuous covariate, which reduces the residual variance and increases power. In this trial the residual SD falls from 11.53 (ANOVA) to 10.27 (ANCOVA adjusting for baseline), and the standard error of the treatment difference drops by about 11%. That is a free power gain from a covariate you already measured, and it is why ANCOVA is the default.

**Type I, II and III sums of squares.** With one factor they are identical, which is why the distinction never comes up in a one-way ANOVA. Add a second factor or an unbalanced design and they diverge, sometimes substantially. SAS `PROC GLM` prints Types I and III by default; R's `anova()` gives Type I (sequential, order-dependent) while `car::Anova()` gives Types II and III. **An unadjusted `anova()` call in R on a multi-factor model is one of the most common sources of a QC mismatch against SAS**, because R's default is sequential and SAS's reported default is not.

:::standard{kind="convention"}
Dunnett's procedure for many-to-one comparisons and Holm's step-down procedure for general families are both standard and widely accepted; neither is mandated by any guidance. ICH E9 §5.6 requires that the approach to multiplicity be specified in the protocol or SAP, not that any particular method be used. What is not acceptable is choosing the adjustment after seeing the p-values.
:::

**Pre-specified contrasts are a design decision, not an analysis decision.** The linear trend contrast above was more powerful than the omnibus F test because it encoded a real scientific hypothesis: that the effect increases with dose. Writing that contrast into the SAP before unblinding costs nothing and buys power. Discovering it after seeing the means is data dredging. This is one of the clearest places where a statistician adds value early rather than late.

:::interview[You have a four-arm dose-ranging trial. How would you analyse it?]
Start with the question, not the test. What is the trial *for*? In dose-ranging it is usually dose selection, which means the useful analyses are a dose-response assessment and estimates of each dose versus control — not an omnibus "are the four arms different".

So: a pre-specified linear (and possibly quadratic) trend contrast to establish dose-response, and Dunnett-adjusted comparisons of each dose against control, with estimates and confidence intervals for all of them. Adjust for baseline in an ANCOVA rather than a bare ANOVA, since it is free power. State the multiplicity strategy in the SAP.

Then the caveats that show you have done this: the omnibus F test is nearly useless on its own here — it can be significant when only the top dose works, which tells the team nothing about dose selection. And if the dose-response might be non-monotone or plateau, mention that MCP-Mod exists — it tests several candidate dose-response shapes with multiplicity control and is explicitly recognised by EMA for phase II dose-finding. Knowing when the standard toolkit is not the right tool is usually what the question is probing.
:::
