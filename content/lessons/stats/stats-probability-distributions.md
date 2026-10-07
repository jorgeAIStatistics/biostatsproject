## What problem are we trying to solve?

The safety physician on the VTX-221 study team looks at the first unblinded adverse-event summary and asks three questions in one meeting:

1. "Dizziness occurred in 16 of 88 treated subjects on 20 mg. Placebo runs at about 6%. If 20 mg really had the same risk as placebo, how unusual would 16 cases be?"
2. "No placebo subject had syncope. Does zero out of 90 mean the placebo risk is zero?"
3. "For the oncology program, the protocol assumes a control median PFS of 4.2 months. What fraction of control patients does that imply will be progression-free at 6 months?"

None of these needs a complicated model. Each needs the right **probability distribution** — a mathematical description of how a random quantity behaves — and the ability to compute a probability from it in SAS, R or Python. Distributions are also the machinery under every test in this lab: t tests use the t distribution, chi-square tests the chi-square distribution, ANOVA the F distribution, survival analysis the exponential as its simplest model.

## Intuition

Pick the distribution by asking **what process generated the number**:

- **Counting yes/no outcomes among a fixed number of subjects** (responders, subjects with dizziness) → **binomial**. Each subject is a coin flip with the same probability $p$; you count heads out of $n$.
- **Counting events over time or exposure, with no fixed upper limit** (number of AEs, hypoglycemic episodes, exacerbations) → **Poisson**. Events happen independently at a constant average rate.
- **A measurement influenced by many small factors** (blood pressure, height, change from baseline) → **normal**. Sums and averages of many small independent pieces tend to be bell-shaped.
- **Time until an event when the risk per unit time is constant** → **exponential**. The simplest survival model: no matter how long you have waited, the chance of the event in the next month is the same.
- **Distributions of test statistics**, built from normal data: **t** (a mean divided by an estimated SE), **chi-square** (sums of squared standard normals), **F** (a ratio of two variance estimates).

Every distribution answers the same three kinds of question: *how likely is exactly this value* (probability mass or density), *how likely is this value or less* (the cumulative distribution function, CDF), and *what value cuts off a given probability* (the quantile, used for critical values).

## Clinical context

| Distribution | Models | Trial example | Parameters | Mean, variance |
|---|---|---|---|---|
| Binomial | Number of "yes" among $n$ independent subjects | Responders; subjects with ≥1 TEAE | $n$, $p$ | $np$, $np(1-p)$ |
| Poisson | Number of events in a fixed exposure | AE counts; exacerbations per patient-year | rate $\lambda$ | $\lambda$, $\lambda$ |
| Normal | Continuous measurements; averages | SBP, change from baseline, LS means | $\mu$, $\sigma$ | $\mu$, $\sigma^2$ |
| t | Mean ÷ estimated SE | t tests, CIs for means, regression coefficients | degrees of freedom $\nu$ | 0, $\nu/(\nu-2)$ |
| Chi-square | Sum of $k$ squared standard normals | Contingency-table tests, log-rank test | $k$ df | $k$, $2k$ |
| F | Ratio of two independent chi-squares ÷ df | ANOVA, ANCOVA, overall model tests | $\nu_1$, $\nu_2$ | — |
| Exponential | Time to event with constant hazard | Design assumptions for PFS/OS sample sizes | hazard rate $\lambda$ | $1/\lambda$, $1/\lambda^2$ |

The binomial and Poisson describe the *data* you count in safety tables; the t, chi-square and F describe the *test statistics* in efficacy analyses; the exponential appears in almost every event-driven sample-size calculation.

## Formal concept

A **discrete** random variable has a probability mass function $P(X = x)$; a **continuous** one has a density $f(x)$, and probabilities are areas under it. The **CDF** is $F(x) = P(X \le x)$ for both. The **quantile function** inverts the CDF: $F^{-1}(0.975)$ is the value with 97.5% of the distribution below it.

**Binomial**, $X \sim \text{Bin}(n, p)$:

$$
P(X = k) = \binom{n}{k} p^k (1-p)^{n-k}, \qquad k = 0, 1, \dots, n
$$

**Poisson**, $X \sim \text{Pois}(\lambda)$ (for exposure $t$ and rate $r$, $\lambda = rt$):

$$
P(X = k) = \frac{e^{-\lambda}\lambda^k}{k!}, \qquad k = 0, 1, 2, \dots
$$

**Normal**, $X \sim N(\mu, \sigma^2)$, standardized by $Z = (X - \mu)/\sigma \sim N(0, 1)$:

$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}}\exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)
$$

**Exponential**, time $T$ with constant hazard $\lambda$:

$$
S(t) = P(T > t) = e^{-\lambda t}, \qquad \text{median} = \frac{\ln 2}{\lambda}
$$

**Test-statistic distributions.** If $Z_1, \dots, Z_k$ are independent standard normals, $\sum Z_i^2 \sim \chi^2_k$. If $Z \sim N(0,1)$ and $V \sim \chi^2_\nu$ are independent, $Z / \sqrt{V/\nu} \sim t_\nu$. If $V_1 \sim \chi^2_{\nu_1}$ and $V_2 \sim \chi^2_{\nu_2}$ are independent, $(V_1/\nu_1)/(V_2/\nu_2) \sim F_{\nu_1, \nu_2}$.

Useful relationships you will use constantly:

- $Z^2 \sim \chi^2_1$, so the chi-square critical value for 1 df is $1.96^2 = 3.841$.
- $t_\nu^2 \sim F_{1,\nu}$: a two-sided t test is the same test as an F test with 1 numerator df.
- $t_\nu \to N(0,1)$ as $\nu \to \infty$; the t has heavier tails for small $\nu$ because the SD is itself estimated.
- $\text{Bin}(n, p) \approx \text{Pois}(np)$ when $n$ is large and $p$ small; $\text{Bin}(n,p) \approx N(np, np(1-p))$ when $np$ and $n(1-p)$ are both reasonably large.

::widget{name="t-distribution"}

## Worked example

### 1. How unusual is 16 of 88?

Suppose the true dizziness risk on 20 mg were $p = 0.06$ (roughly the placebo rate). The number of subjects with dizziness among $n = 88$ would be $X \sim \text{Bin}(88, 0.06)$:

- Expected count: $np = 88 \times 0.06 = 5.28$.
- SD: $\sqrt{np(1-p)} = \sqrt{88 \times 0.06 \times 0.94} = 2.23$.
- The question is "16 **or more**": $P(X \ge 16) = 1 - P(X \le 15) = 6.4 \times 10^{-5}$.

:::number[Why P(X ≤ 15) and not P(X ≤ 16)?]
"At least 16" includes 16. Its complement is "at most 15", so $P(X \ge 16) = 1 - F(15)$. Writing `1 - pbinom(16, 88, 0.06)` computes $P(X \ge 17) = 1.7 \times 10^{-5}$ — an off-by-one error that makes the observation look almost four times more extreme than it is.
:::

Sixteen cases is about $(16 - 5.28)/2.23 = 4.8$ SDs above the expected count: very unlikely if 20 mg carried the placebo risk. This is not yet a formal comparison of two arms (that is Fisher's exact test, in the categorical-tests lesson, which accounts for uncertainty in the placebo rate too), but it is exactly the reasoning behind it.

### 2. Zero out of 90

No placebo subject had syncope. The observed proportion is $0/90 = 0$, but the true risk need not be zero. The largest risk still reasonably compatible with seeing zero events is the $p$ for which $P(X = 0) = (1-p)^{90} = 0.05$:

$$
p_{\text{upper}} = 1 - 0.05^{1/90} = 0.0327
$$

The **rule of three** approximates this as $3/n = 3/90 = 0.0333$. So zero events in 90 subjects is compatible with a true risk of up to about 3%. (For a two-sided 95% Clopper–Pearson interval, use 0.025 instead of 0.05: upper bound 4.0%.)

:::why[Where does the "3" come from?]
$(1-p)^n \approx e^{-np}$ for small $p$. Setting $e^{-np} = 0.05$ gives $np = -\ln 0.05 = 2.996 \approx 3$.
:::

### 3. An exponential design assumption

The CBX-417 oncology protocol assumes a control-arm median PFS of 4.2 months and a hazard ratio of 0.70. Under an exponential model:

- Control hazard: $\lambda_C = \ln 2 / 4.2 = 0.1650$ per month.
- Progression-free at 6 months: $S_C(6) = e^{-0.1650 \times 6} = 0.371$.
- Treatment hazard: $\lambda_T = 0.70 \times 0.1650 = 0.1155$ per month, so the median is $\ln 2 / 0.1155 = 6.0$ months, and $S_T(6) = 0.50$.

:::number[Why does HR = 0.70 turn a 4.2-month median into 6.0 months?]
Under exponential survival the median is $\ln 2/\lambda$, so multiplying the hazard by 0.70 multiplies the median by $1/0.70 = 1.43$: $4.2 / 0.70 = 6.0$ months. This neat conversion holds only under the exponential (constant-hazard) assumption; with real data, a hazard ratio does not translate exactly into a ratio of medians.
:::

## Data example

### Is baseline SBP normal?

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,SBPBL,SBPGR1,STRAT1R" rows="6" sort="SBPBL desc" caption="Highest baseline SBP values"}

Across all 270 randomized subjects, baseline SBP has mean 150.42 and SD 9.386 mmHg. A normal model with these values predicts:

| Event | Normal model | Observed |
|---|---:|---:|
| SBP ≥ 160 mmHg | $P(Z \ge 1.02) = 15.4\%$ | 50/270 = 18.5% |
| SBP < 135 mmHg | 5.0% | 11/270 = 4.1% |
| SBP < 130 mmHg | 1.5% | 0/270 = 0% |

The middle of the distribution is fitted well, but the **tails are wrong for a structural reason**: the protocol excluded baseline SBP below 130 or at/above 180 mmHg, so the data are *truncated*. No subject can be below 130 no matter what the normal curve says. Always ask how eligibility criteria shape a distribution before you trust a tail probability.

### Do AE counts look Poisson?

In the 20 mg safety population (88 subjects), there are 70 treatment-emergent AE records: 0.7955 per subject over roughly 12 weeks. If each subject's count were Poisson with mean 0.7955:

| TEAEs per subject | 0 | 1 | 2 | ≥3 |
|---|---:|---:|---:|---:|
| Observed subjects | 40 | 34 | 9 | 5 |
| Poisson expected | 39.7 | 31.6 | 12.6 | 4.1 |

:::number[Where does 39.7 come from?]
$P(X = 0) = e^{-0.7955} = 0.4514$, and $0.4514 \times 88 = 39.7$ subjects. The other cells use $P(X = 1) = 0.7955\,e^{-0.7955}$, $P(X = 2) = 0.7955^2 e^{-0.7955}/2$, and $P(X \ge 3) = 1 - P(X \le 2)$.
:::

The fit is reasonable, but the variance of the counts (0.923) is larger than the mean (0.795). Real AE counts are usually **overdispersed**: some subjects are simply more AE-prone than others. That is why count analyses in trials often use the negative binomial rather than the Poisson.

## Code

::::tabs
:::tab[SAS]
```sas title="distribution_calcs.sas"
data probs;
  p_ge16   = sdf('BINOMIAL', 15, 0.06, 88);
  p_upper0 = 1 - 0.05**(1/90);
  p_zero   = pdf('POISSON', 0, 0.7955);
  p_sbp160 = sdf('NORMAL', 160, 150.42, 9.386);
  t_crit   = quantile('T', 0.975, 234);
  chi_crit = quantile('CHISQ', 0.95, 1);
  f_crit   = quantile('F', 0.95, 2, 234);
  lambda_c = log(2) / 4.2;
  s6_ctrl  = exp(-lambda_c * 6);
  put p_ge16= e12. p_upper0= 6.4 p_zero= 6.4 p_sbp160= 6.4 / t_crit= 6.4 chi_crit= 6.4 f_crit= 6.4 lambda_c= 6.4 s6_ctrl= 6.4;
run;
```

:::lines
2: `SDF` is the survival function $P(X > x)$. $P(X > 15) = P(X \ge 16)$ for a count. The binomial arguments are the value, then $p$, then $n$.
3: The exact zero-event upper bound needs no function — it is algebra.
4: `PDF` for a discrete distribution returns $P(X = x)$.
5: `SDF('NORMAL', x, mean, sd)` is the upper-tail area.
6-8: `QUANTILE` returns critical values: $t_{0.975, 234}$, $\chi^2_{0.95, 1}$ and $F_{0.95; 2, 234}$.
9-10: The exponential survival is written directly with the rate, which avoids any doubt about how a function parametrizes the exponential.
11: Writes each value as `name=value` to the log with a readable format (`E12.` shows the tiny binomial tail in scientific notation).
:::
:::
:::tab[R]
```r title="distribution_calcs.R"
pbinom(15, size = 88, prob = 0.06, lower.tail = FALSE)  # P(X >= 16)
1 - 0.05^(1/90)                                          # zero-event upper bound
dpois(0, lambda = 0.7955)                                # P(X = 0)
pnorm(160, mean = 150.42, sd = 9.386, lower.tail = FALSE)
qt(0.975, df = 234); qchisq(0.95, df = 1); qf(0.95, 2, 234)
lambda_c <- log(2) / 4.2
pexp(6, rate = lambda_c, lower.tail = FALSE)             # S(6) = exp(-6 * lambda)
```

:::lines
1: R's naming: `d` = mass/density, `p` = CDF, `q` = quantile, `r` = random draws. `lower.tail = FALSE` gives $P(X > 15)$.
4: `pnorm` with `lower.tail = FALSE` is the upper tail.
5: Critical values for t, chi-square and F.
7: `pexp` uses the **rate** parametrization.
:::
:::
:::tab[Python]
```python title="distribution_calcs.py"
import numpy as np
from scipy import stats

stats.binom.sf(15, 88, 0.06)               # P(X >= 16)
stats.poisson.pmf(0, 0.7955)
stats.norm.sf(160, loc=150.42, scale=9.386)
stats.t.ppf(0.975, 234), stats.chi2.ppf(0.95, 1), stats.f.ppf(0.95, 2, 234)
lam = np.log(2) / 4.2
stats.expon.sf(6, scale=1 / lam)            # SciPy uses scale = 1/rate
```

:::lines
4: `sf` (survival function) is $P(X > x)$, like SAS `SDF`.
9: SciPy parametrizes the exponential by **scale** $= 1/\lambda$. Passing the rate as the scale is a silent, common error.
:::
:::
::::

## Output

Expected log lines from the PUT statement (values computed in R; SAS was not run here):

```log
p_ge16=6.4488E-05 p_upper0=0.0327 p_zero=0.4514 p_sbp160=0.1538
t_crit=1.9702 chi_crit=3.8415 f_crit=3.0344 lambda_c=0.1650 s6_ctrl=0.3715
```

:::number[Why is the t critical value 1.9702 rather than 1.96?]
With 234 degrees of freedom the t distribution is very close to normal but still slightly heavier-tailed. With 9 df (a sample of 10) the critical value is 2.262, and with 4 df it is 2.776 — small samples pay a real price for estimating the SD.
:::

## Interpretation

- **A probability computed under a model is only as good as the model.** 16/88 is extremely unlikely *if* the 20 mg risk were 6% — that is evidence against the "no difference" model, not proof of a specific risk.
- **Zero events is not zero risk.** Report 0/90 with an upper bound (about 3–4%), especially for rare but serious events such as syncope.
- **Truncation and overdispersion are the usual reasons models misfit.** Eligibility windows cut the tails of baseline measurements; subject-to-subject variation inflates the variance of counts.
- **The exponential is a planning tool.** Design assumptions (medians, hazard ratios) are almost always translated through it; the final analysis uses Kaplan–Meier and Cox models that do not assume constant hazards.

## Common mistakes

:::mistake[Off-by-one in "at least" probabilities]
$P(X \ge k) = 1 - P(X \le k - 1)$. With discrete distributions, the boundary value matters: `1 - pbinom(16, …)` is "at least 17". Prefer the explicit upper-tail form `pbinom(15, …, lower.tail = FALSE)` and say in a comment which event it computes.
:::

:::mistake[Using the density when you need the CDF]
`dbinom(16, 88, 0.06)` is the probability of *exactly* 16. For "16 or more" you need the tail sum. The same confusion appears with `pdf` versus `cdf` in SAS and `pmf` versus `sf` in SciPy.
:::

:::mistake[Mixing up rate and scale]
R's `pexp(rate = λ)`, SciPy's `expon(scale = 1/λ)`: the same distribution with reciprocal parameters. The same trap exists for the gamma and Weibull distributions — always check the documentation's formula before plugging in a number.
:::

:::mistake[Treating a proportion as a rate]
"70 AEs in 88 subjects" is 0.80 events per subject, not a probability; 48 of 88 subjects (54.5%) had at least one TEAE. Counting subjects gives a binomial proportion; counting events gives a Poisson-type rate, which should be expressed per unit of exposure (for example, per 100 patient-years) when follow-up differs between subjects.
:::

:::mistake[Trusting the normal approximation with small counts]
A normal approximation to the binomial is poor when $np$ or $n(1-p)$ is small (a common rule of thumb is below 5–10). With 5 expected cases, use the exact binomial.
:::

## Knowledge check

::quiz{ids="stats.dist.classify-scenarios,stats.dist.relationships,stats.dist.t-vs-z,stats.dist.rule-of-three"}

## Hands-on exercise

::practice{ids="stats.dist.binom-tail,stats.dist.poisson-zero,stats.dist.normal-tail,stats.dist.exp-median,stats.dist.exp-survival" title="Practice: computing probabilities"}

## Challenge exercise

::practice{ids="stats.dist.offbyone-hotspot,stats.dist.overdispersion" title="Debug and interpret"}

## Industry note

- **Safety physicians think in "how surprising is this?"** Being able to answer with a quick binomial or Poisson calculation — and to say what it does *not* prove — is valuable in data review meetings.
- **Design assumptions live in the protocol.** Sample-size sections state assumed medians, rates and hazard ratios; the exponential translation between medians, hazards and event probabilities is how statisticians check those assumptions for consistency (the power lesson derives the CBX-417 event count).
- **Software parametrizations differ.** SAS, R and SciPy all implement these distributions, but argument order and parametrization (rate vs scale, $P(X \le x)$ vs $P(X > x)$) differ. QC programs that disagree in the third decimal often disagree for this reason.

:::interview[Why do we use the t distribution instead of the normal for a confidence interval of a mean?]
"Because the SD is estimated from the same data. The ratio of the mean's error to its *estimated* standard error has more variability than if σ were known, so it follows a t distribution with n − 1 degrees of freedom, which has heavier tails. With large samples the difference vanishes — the 97.5th percentile is 2.262 with 9 df, 2.045 with 29 df and 1.970 with 234 df, versus 1.960 for the normal."
:::

:::ai[If an AI assistant computes a probability for you…]
Check which event it computed (equal to, at most, at least), which tail it used, and how it parametrized the distribution. Ask it to state the formula; then check one value by hand or with a second tool.
:::
