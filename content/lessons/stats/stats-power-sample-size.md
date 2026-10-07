## What problem are we trying to solve?

Open the CBX417-301 protocol at the sample-size section and you find this:

> Approximately 420 subjects will be randomized 1:1. The primary analysis will be performed when **331 PFS events** have been observed, providing 90% power to detect a hazard ratio of 0.70 using a two-sided log-rank test at α = 0.05.

Four numbers — 420, 331, 90%, 0.70 — and a sponsor has committed tens of millions of dollars to them. Somebody produced them, somebody else checked them, and a regulator read them before the first patient was dosed.

**Where does 331 come from?** Not from software you trust blindly. It comes from one formula with four inputs, and by the end of this lesson you will derive it yourself and get 331 on the nose.

And a question that sounds like a technicality but is the whole design: **why is the protocol counting events rather than patients?** Enrolling 420 people is the logistics. Waiting for 331 of them to progress is the statistics. If you understand why those are different numbers, you understand why oncology trials are designed the way they are.

## Intuition

Four quantities are locked in a rigid relationship. Fix any three and the fourth is determined:

- **α** — how often you are willing to declare an effect that isn't there (type I error)
- **power** $(1-\beta)$ — how often you detect an effect that *is* there
- **effect size** — how big the effect you want to detect is
- **sample size** — how many subjects (or events) you collect

Picture two bell curves on the same axis: the distribution of your test statistic if the drug does nothing, and the distribution if the drug works as hoped. **Power is the overlap problem.** You reject $H_0$ when your statistic lands past a critical value; α is the slice of the null curve past that line, and power is the slice of the alternative curve past it.

Three ways to increase power, visible directly in the picture:

1. **Push the curves apart** — a bigger true effect. Not under your control.
2. **Make the curves narrower** — more subjects, less measurement noise, a better design (paired instead of parallel, adjusted for a strong baseline covariate). Under your control, and where design skill lives.
3. **Move the line left** — a larger α. Under your control and almost never acceptable, because regulators fix α.

::widget{name="power-calculator"}

Move the sliders. Two things to notice. Doubling the effect size does far more than doubling the sample size — power depends on $n$ but on $\delta^2$. And power near 90% gets expensive fast: going from 80% to 90% costs about 34% more subjects, and 90% to 95% costs another 24%.

:::why[Why is 90% power "enough"? Why not 99%?]
Because 99% power costs roughly twice the subjects of 90%, and every additional subject is a person exposed to an experimental drug plus real money and calendar time. 80% and 90% are conventions that balance those costs against the risk of abandoning a working drug. Nothing statistical distinguishes them; they are risk-appetite decisions that happen to have hardened into standards. A sponsor with one shot at a pivotal trial usually picks 90%.
:::

## Clinical context

Sample size is where statistics meets money, and it is one of the few places where a biostatistician's judgement directly determines whether a programme proceeds.

| Input | Who supplies it | Where it goes wrong |
|---|---|---|
| Effect size to detect | Clinical + commercial, with statistical challenge | Optimism. The single most common cause of failed phase III |
| Variability (SD) | Prior trials, literature, pilot data | Pilot SDs are themselves imprecise; using one without a margin is a trap |
| α | Convention and regulation | Rarely negotiable: 0.05 two-sided, or 0.025 one-sided |
| Power | Sponsor risk appetite | 80% for phase II, 90% for pivotal is typical |
| Dropout rate | Operations, prior experience | Forgetting to inflate for it is a classic protocol error |

:::standard{kind="official"}
ICH E9 §3.5 states that the number of subjects in a clinical trial should always be large enough to provide a reliable answer to the questions addressed, and that the method by which sample size is calculated should be given in the protocol, together with the estimates of any quantities used in the calculation. The protocol must show its work — which is why you need to be able to reproduce it.
:::

:::mistake[Designing for the effect you hope for instead of the effect that matters]
The clinically meaningful difference and the difference you expect are different numbers, and teams conflate them under commercial pressure. If a 5 mmHg reduction is what would change practice, power the trial for 5 mmHg — even if the phase II point estimate was 9. Phase II estimates are biased upward by selection (you advanced the compound *because* the estimate was good), and powering on them is the mechanism behind a large share of phase III failures.
:::

## Formal concept

### Two means

For a two-sample comparison of means with equal allocation, using the normal approximation:

$$
n_{\text{per arm}} = \frac{2(z_{1-\alpha/2} + z_{1-\beta})^2\,\sigma^2}{\delta^2}
$$

Every symbol earns its place:

- $z_{1-\alpha/2} = 1.95996$ for two-sided α = 0.05 — how far into the null tail the critical value sits
- $z_{1-\beta} = 1.28155$ for 90% power — how far the alternative distribution must be pushed so that 90% of it clears that line
- $\sigma$ — the SD of the outcome
- $\delta$ — the difference you want to detect
- the 2 — because **two** arms each contribute sampling variability

:::number[Why is it $\sigma^2/\delta^2$ and not $\sigma/\delta$?]
Because the test statistic is $\delta/\mathrm{SE}$ and $\mathrm{SE} \propto \sigma/\sqrt{n}$. Setting the statistic to the required threshold and solving for $n$ squares everything. The practical consequence is brutal: **halving the effect size you want to detect quadruples the sample size**, and a 10% error in your assumed SD changes $n$ by about 21%. The SD assumption is the most sensitive input in the whole calculation, which is why protocols justify it and why sensitivity tables over a range of SDs are standard practice.
:::

### Two proportions

$$
n_{\text{per arm}} = \frac{\left(z_{1-\alpha/2} + z_{1-\beta}\right)^2 \left[p_1(1-p_1) + p_2(1-p_2)\right]}{(p_1 - p_2)^2}
$$

Same shape. The binomial variance $p(1-p)$ replaces $\sigma^2$, and because that variance depends on $p$ itself, the sample size depends on *where* the rates sit, not only on their difference. A 10-point difference from 5% to 15% needs far fewer subjects than 45% to 55%.

### Time-to-event: the Schoenfeld formula

This is the one behind CBX417-301, and it is the one that behaves differently from everything else.

$$
d = \frac{4\left(z_{1-\alpha/2} + z_{1-\beta}\right)^2}{\left[\ln(\mathrm{HR})\right]^2}
$$

where $d$ is the required **number of events** — not subjects.

:::why[Why does a survival trial count events instead of patients?]
Because the information in a time-to-event analysis comes from events, not from enrolment. A subject who is enrolled, followed for two years and never progresses contributes almost nothing to the comparison of hazard rates — they tell you only that their event time exceeds two years. Statistical precision in a log-rank test or a Cox model is governed by how many events you observe.

This has a strategic consequence that defines oncology trial operations: you can reach your event target either by enrolling more subjects (events arrive faster) or by following the same subjects longer (events accumulate). Those are interchangeable statistically and completely different commercially. It is also why a *better-than-expected* drug can delay its own trial — fewer events means a longer wait for the analysis.
:::

:::number[Where does the 4 in the numerator come from?]
From the variance of the log hazard ratio. With 1:1 randomization and $d$ total events, $\operatorname{Var}\!\left(\ln \widehat{\mathrm{HR}}\right) \approx 4/d$. Setting $|\ln \mathrm{HR}| / \sqrt{4/d} = z_{1-\alpha/2} + z_{1-\beta}$ and solving for $d$ gives the formula. With unequal allocation the 4 becomes $1/[\pi(1-\pi)]$ where $\pi$ is the proportion on the experimental arm — so 4 is just the value at $\pi = 0.5$, and unequal allocation always needs more events.
:::

Note what is **absent** from the Schoenfeld formula: the number of subjects, the accrual rate, the median survival, the follow-up duration. Those determine *how long you wait* for $d$ events, not how many you need. Getting from $d$ to a subject count requires separate assumptions about accrual and the event-time distribution.

## Worked example

**Derive the 331 events in the CBX417-301 protocol.**

Inputs from the protocol: HR = 0.70, power = 90%, two-sided α = 0.05, 1:1 randomization.

**Step 1 — the two z values.**

$$
z_{1-\alpha/2} = z_{0.975} = 1.959964
\qquad
z_{1-\beta} = z_{0.90} = 1.281552
$$

:::number[Why $z_{0.90}$ for 90% power and not $z_{0.95}$?]
Because power is a **one-sided** quantity. You need 90% of the alternative distribution to fall beyond the critical value on one side — there is no need to also clear the opposite tail, since an effect in the wrong direction is not a success. Alpha is split between two tails because you would reject for a large effect in either direction; power is not. Using 1.645 here — a common error — would give 251 events and a badly underpowered trial.
:::

**Step 2 — the log hazard ratio.**

$$
\ln(0.70) = -0.356675
$$

:::number[Why the log of the hazard ratio?]
Because the Cox model estimates $\ln(\mathrm{HR})$, and it is $\ln(\widehat{\mathrm{HR}})$ — not $\widehat{\mathrm{HR}}$ — whose sampling distribution is approximately normal. Hazard ratios are bounded below by 0 and unbounded above, so they are skewed; logging makes them symmetric. This is the same reason confidence intervals for a HR are computed on the log scale and then exponentiated, which is why they are asymmetric around the point estimate when you read them off a forest plot.
:::

**Step 3 — assemble.**

$$
d = \frac{4(1.959964 + 1.281552)^2}{(-0.356675)^2}
= \frac{4 \times (3.241516)^2}{0.127217}
= \frac{4 \times 10.507424}{0.127217}
= \frac{42.029696}{0.127217}
= 330.38
$$

**Step 4 — round up.** $\lceil 330.38 \rceil = \mathbf{331}$ events.

That is the number in the protocol, reproduced from four inputs and one formula.

:::mistake[Rounding a sample size to nearest]
Always round **up**. 330 events would give slightly less than 90% power, and "we rounded down" is not a sentence anyone wants in a protocol. The same applies to subject counts — and to the per-arm count before you multiply by the number of arms.
:::

**Step 5 — from events to subjects.** The protocol randomizes 420. Getting there requires assumptions the formula does not contain: the accrual rate, the control-arm median PFS, the follow-up period and the dropout rate. With an assumed control median of 4.2 months and roughly 20 months of accrual, 420 subjects accrue 331 PFS events about 34 months after the first subject is randomized — which is why 420, not 331 or 700, is the enrolment target. The event count is fixed by statistics; the subject count is chosen so the events arrive on an acceptable timeline.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="6" caption="ADVS — the Week 12 records the VTX-221 design was sized for"}

**Sizing a continuous endpoint.** Suppose you are designing the next hypertension trial. From VTX221-201 the residual SD of Week 12 change is about **11.55 mmHg**. You want 90% power at two-sided α = 0.05 to detect a **5 mmHg** difference.

By the normal-approximation formula:

$$
n = \frac{2(1.959964 + 1.281552)^2 (11.55)^2}{5^2}
= \frac{2 \times 10.507424 \times 133.4025}{25}
= 112.14
$$

The exact t-based calculation (`power.t.test` in R, `PROC POWER` in SAS) gives **113.11**, so **114 per arm**, 228 total.

:::number[Why does the exact calculation give a slightly larger number than the formula?]
The closed-form formula uses normal quantiles, but the actual test uses the $t$ distribution, whose critical value is larger — you pay a small premium for estimating $\sigma$. The gap is about 1 subject per arm here and grows as $n$ shrinks. Use the software for the protocol number and the formula to understand and sanity-check it.
:::

**Then inflate for dropout.** If you expect 10% of subjects to have no Week 12 measurement:

$$
n_{\text{enrolled}} = \frac{113.11}{1 - 0.10} = 125.7 \;\rightarrow\; \mathbf{126} \text{ per arm}
$$

:::mistake[Subtracting the dropout rate instead of dividing by its complement]
$113 \times 1.10 = 124$ is wrong, and $113 + 10\% = 124$ is the same error. You need 113 subjects *with data*, so you must enrol $113/0.90 = 126$. The difference is small at 10% and large at 30%: dividing gives 161, multiplying gives 147 — a 14-subject shortfall that shows up as an underpowered trial two years later.
:::

**Power as a function of n**, for δ = 5 mmHg and SD = 11.55:

| n per arm | Power |
|---:|---:|
| 50 | 57.3% |
| 80 | 77.7% |
| 113 | **90.0%** |
| 150 | 96.2% |
| 200 | 99.1% |

The curve is steep in the middle and flat at the top. Going from 80 to 113 subjects per arm buys 12 points of power; going from 150 to 200 buys 3.

**Sizing a binary endpoint.** For the "controlled hypertension" responder endpoint — observed rates 26% on placebo and 46% on 10 mg — detecting that 20-point difference with 90% power needs **119 per arm**, slightly more than the continuous endpoint on the same underlying data. Dichotomizing a continuous outcome throws away information, and the sample size is where you pay for it.

## Code

::::tabs
:::tab[SAS]
```sas
/* Continuous: two-sample t test */
proc power;
  twosamplemeans
    test        = diff
    meandiff    = 5
    stddev      = 11.55
    alpha       = 0.05
    power       = 0.90
    npergroup   = .;
run;

/* Binary: two proportions */
proc power;
  twosamplefreq
    test        = pchi
    groupproportions = (0.26 0.46)
    alpha       = 0.05
    power       = 0.90
    npergroup   = .;
run;

/* Time to event: number of events for a given hazard ratio */
proc power;
  twosamplesurvival
    test        = logrank
    hazardratio = 0.70
    alpha       = 0.05
    power       = 0.90
    eventstotal = .;
run;
```

:::lines
9: `npergroup = .` is how you tell PROC POWER which quantity to **solve for** — the missing value marks the unknown. Fill it in and leave `power = .` instead, and the same statement computes power for a given n.
18: `test = pchi` is the chi-square test of two proportions. `test = fisher` requests the exact test, which needs a slightly larger sample because it is conservative.
27: `eventstotal = .` solves for the number of events, not subjects. To get a subject count you add `accrualtime=`, `followuptime=` and a reference survival curve, which introduces accrual assumptions the event calculation does not need.
:::
:::

:::tab[R]
```r
# Continuous
power.t.test(delta = 5, sd = 11.55, sig.level = 0.05, power = 0.90)

# Binary
power.prop.test(p1 = 0.26, p2 = 0.46, sig.level = 0.05, power = 0.90)

# Time to event: Schoenfeld, by hand
schoenfeld_events <- function(hr, alpha = 0.05, power = 0.90, ratio = 1) {
  za <- qnorm(1 - alpha / 2)
  zb <- qnorm(power)
  pi1 <- ratio / (1 + ratio)
  ceiling((za + zb)^2 / (pi1 * (1 - pi1) * log(hr)^2))
}

schoenfeld_events(0.70)   # 331
```

:::lines
2: `power.t.test` solves for whichever argument you **omit**. Leave out `n` and it returns n; leave out `power` and supply `n` and it returns power. Supply all five and it errors. `delta` is the difference in means and `sd` is the **common within-group** SD — not the SD of the difference. Passing the SD of the difference is a common error that understates the required n by about half.
8: Writing the Schoenfeld formula yourself is worth doing once. `pi1 * (1 - pi1)` equals 0.25 at 1:1 allocation, and dividing by it reproduces the 4 in the standard form.
15: Returns 331 for HR = 0.70 — the CBX417-301 protocol number.
:::
:::

:::tab[Python]
```python
from statsmodels.stats.power import TTestIndPower
from statsmodels.stats.proportion import proportion_effectsize
from statsmodels.stats.power import NormalIndPower
import numpy as np

# Continuous: statsmodels works in standardized effect size
effect = 5 / 11.55                      # Cohen's d
TTestIndPower().solve_power(effect_size=effect, alpha=0.05, power=0.90)

# Binary
h = proportion_effectsize(0.46, 0.26)   # arcsine-transformed effect size
NormalIndPower().solve_power(effect_size=h, alpha=0.05, power=0.90)

# Time to event
def schoenfeld_events(hr, alpha=0.05, power=0.90, ratio=1.0):
    from scipy.stats import norm
    za, zb = norm.ppf(1 - alpha / 2), norm.ppf(power)
    pi1 = ratio / (1 + ratio)
    return int(np.ceil((za + zb) ** 2 / (pi1 * (1 - pi1) * np.log(hr) ** 2)))
```

:::lines
7: statsmodels parameterizes by **standardized** effect size (Cohen's d), not by the raw difference and SD. You must divide yourself, and an unstandardized value silently produces a nonsense answer rather than an error.
11: `proportion_effectsize` returns Cohen's *h*, an arcsine-transformed effect size. It is not the raw risk difference, and results will differ slightly from `power.prop.test` in R, which uses a different approximation. For a protocol number, agree the method first.
:::
:::
::::

## Output

```text
                              The POWER Procedure
                  Two-sample t Test for Mean Difference

                          Fixed Scenario Elements

                  Distribution                  Normal
                  Method                         Exact
                  Mean Difference                    5
                  Standard Deviation             11.55
                  Alpha                           0.05
                  Nominal Power                    0.9

                             Computed N per Group

                             Actual      N per
                              Power      Group
                              -----      -----
                              0.901        114
```

:::number[Why does SAS report 114 while the calculation gave 113.11?]
SAS solves for the smallest **integer** n that achieves at least the nominal power, so it rounds 113.11 up to 114 and reports the *actual* power at that integer — 0.901, slightly above the 0.900 requested. R's `power.t.test` reports the fractional 113.11 and leaves the rounding to you. Both are right; they answer slightly different questions. Protocols quote integers, so use SAS's convention or round R's result up yourself.
:::

## Interpretation

For the protocol:

> Assuming a median PFS of 4.2 months in the control arm and a hazard ratio of 0.70, **331 PFS events** provide 90% power using a two-sided log-rank test at α = 0.05. Approximately 420 subjects randomized 1:1 over approximately 20 months of accrual are expected to yield this number of events about 34 months after the first subject is randomized.

Every clause is doing work: the assumed control median (drives event timing), the hazard ratio (the effect to detect), the event count (the statistical requirement), the subject count and accrual period (the operational plan to reach it).

:::clinical
A hazard ratio of 0.70 means the instantaneous risk of progression is 30% lower on the experimental arm at any given moment among those still at risk. With a control median PFS of 4.2 months, that corresponds to an experimental median of 4.2/0.70 = 6.0 months if hazards are proportional — about eight extra weeks before progression. Whether eight weeks justifies the toxicity profile is a clinical judgement, not a statistical one, and it is exactly the conversation the sample-size assumption should have prompted at design time. The statistician's job is to make sure the trial can detect the effect the clinicians say would matter, not the effect the team hopes for.
:::

## Common mistakes

:::mistake[Putting the wrong quantile in the wrong slot]
Two different confusions, in opposite directions, and both appear in hand-computed sample sizes.

**Using $z_{0.95} = 1.6449$ for power** instead of $z_{0.90} = 1.2816$ gives 409 events rather than 331 — the trial is over-sized and delivers 95% power while the protocol claims 90%. Expensive, not dangerous.

**Using $z_{0.95} = 1.6449$ for α** — the one-sided 5% value — where a two-sided test needs $z_{0.975} = 1.9600$ gives 270 events. That trial has about **83% power**, not the 90% its protocol claims. Dangerous, and invisible unless someone reproduces the calculation.

The check that catches both: α is two-sided so it takes the 0.975 quantile; power is one-sided so it takes the 0.90 quantile. They are never the same number.
:::

:::mistake[Post-hoc power]
Computing power from the observed effect after the trial is a deterministic function of the p-value and adds nothing. "The trial was negative because it was underpowered (observed power 23%)" is circular — a large p-value always implies low observed power. If you want to know whether a negative trial was informative, report the confidence interval.
:::

:::mistake[Ignoring the multiplicity cost of co-primary endpoints]
Two co-primary endpoints, both required to succeed, each tested at a reduced α, means a bigger sample than either alone. Two co-primary endpoints where *either* can succeed requires α splitting. Neither is free, and the sample-size section must state which structure applies.
:::

:::mistake[Treating a pilot SD as known]
An SD estimated from 20 subjects has a wide confidence interval of its own — roughly ±30% at that size. Because $n \propto \sigma^2$, that propagates to a factor of about 1.7 in the sample size. Use an upper confidence bound on the SD, or present a sensitivity table across a plausible range, and say in the protocol which you did.
:::

:::mistake[Powering the trial for the phase II point estimate]
Phase II estimates are selected on: the compound advanced *because* the estimate was favourable, so the estimate is biased upward. Powering phase III on it is the statistical mechanism behind a large share of phase III failures. Discount it, or power on the clinically meaningful difference instead.
:::

## Knowledge check

::quiz{ids="stats.pw.z-for-power,stats.pw.events-not-subjects,stats.pw.quadruple,stats.pw.post-hoc"}

## Hands-on exercise

::practice{ids="stats.pw.schoenfeld-hand,stats.pw.continuous-n,stats.pw.dropout-inflate,stats.pw.r-code" title="Practice: deriving the protocol numbers"}

## Challenge exercise

::practice{ids="stats.pw.sd-sensitivity,stats.pw.design-open,stats.pw.hr-from-events" title="Challenge: assumptions, sensitivity and design conversations"}

## Industry note

**The sample-size section is QC'd like a table.** A second statistician independently reproduces the number before the protocol is finalized — same inputs, independent implementation, matching result. If you join a biometrics group, reproducing someone else's sample size is a task you will be given early, and the four-input Schoenfeld derivation above is exactly the skill being tested.

**Event-driven trials change how the whole study is run.** Because the analysis triggers on event count rather than on a calendar date, the timing of the database lock is genuinely uncertain at design time. Blinded event tracking, event-rate monitoring and the phrase "data cut-off" all exist because of this. A data cut-off date (for CBX417-301, 2025-03-31) is chosen once the target event count is projected to be reached — and every analysis dataset is built relative to it.

:::standard{kind="convention"}
Reporting the sample-size calculation with all its assumptions — effect size, variability, α, power, allocation ratio, dropout, and the software or formula used — is standard protocol practice and is what ICH E9 §3.5 asks for in substance. The specific layout varies by sponsor template; what does not vary is that the calculation must be reproducible by a reader.
:::

**Blinded sample-size re-estimation exists.** If your nuisance parameter (the SD, or the overall event rate) turns out to be wrong, a pre-specified blinded re-estimation can adjust the sample size mid-trial without breaking the blind and without inflating α — because it uses only pooled data and does not look at the treatment effect. It must be written into the protocol in advance. This is a good thing to know exists; it is a very good thing to *not* propose doing unblinded without understanding the α penalty.

:::interview[A team wants 90% power to detect a hazard ratio of 0.75 instead of 0.70. What happens to the trial, and what would you tell them?]
Run the arithmetic out loud: $\ln(0.75) = -0.2877$, so $d = 4(3.2415)^2/0.2877^2 = 508$ events, up from 331 — a **54% increase**. Then say what that means operationally: at the same accrual rate you are waiting materially longer for the analysis, or enrolling substantially more subjects, or both, and the trial's read-out slips.

The strong answer doesn't stop at the number. Ask *why* 0.75 — if it is because the team now thinks the drug is weaker, that is a real design input and the cost is the cost. If it is because someone wants a safety margin, point out that the sample size should be driven by the smallest effect that would be clinically and commercially worth detecting, and that adding margin by shrinking the assumed HR is an expensive and indirect way to buy insurance. Offer the alternatives: 80% power at HR 0.75 needs 380 events, and a sensitivity table over HR from 0.70 to 0.80 lets the team see the trade-off and make the decision with their eyes open. Interviewers are listening for whether you can hold a design conversation, not just operate a formula.
:::
