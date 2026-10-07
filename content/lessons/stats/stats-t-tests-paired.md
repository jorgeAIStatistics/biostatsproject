## What problem are we trying to solve?

Your SAP says the secondary analysis of Week 12 systolic blood pressure is "a two-sample t test". You open PROC TTEST, run it, and SAS gives you **two answers**:

```text
Method           Variances        DF    t Value    Pr > |t|
Pooled           Equal           156     -3.01      0.0031
Satterthwaite    Unequal      155.41     -3.01      0.0031
```

Which row goes in the table? SAS won't tell you. R picks one silently (Welch). SciPy picks the *other* one silently (pooled). Three tools, three behaviours, and the SAP said "a two-sample t test" as though there were only one.

Then a different question arrives. A colleague analysing the same trial writes: *"Each subject's Week 12 reading is compared to their own baseline, so I used a paired t test and got t = −9.55 instead of −7.99. Paired is more powerful, right?"*

They are right about the power and wrong about the analysis — and the reason why is the most useful thing in this lesson. **Pairing is not something you choose. It is something the design either gives you or doesn't.**

## Intuition

Every t test has the same shape:

$$
t = \frac{\text{the effect you observed}}{\text{how much that effect would wobble by chance}}
$$

What changes between the three versions is only what goes in the denominator.

**Two-sample, pooled.** You believe both arms have the same underlying variability, so you estimate *one* SD by combining both arms' data and use it for both. More data behind the estimate means a more stable denominator and slightly more power — if the belief is true.

**Two-sample, Welch.** You don't assume that. Each arm's variability is estimated from its own subjects. You pay a little in precision and in degrees of freedom, and you buy robustness to the assumption being wrong.

**Paired.** Something entirely different. You aren't comparing two groups at all — you compute **one number per subject** (the difference) and test whether those differences average to zero. Every source of variation that is constant within a subject — their baseline physiology, their habits, their genetics — subtracts out of their own difference and disappears from the analysis.

:::why[Why does pairing help so much?]
Because it removes between-subject variation from the denominator. Formally, for a difference $D = X_2 - X_1$ measured on the same subject,

$$\operatorname{Var}(D) = \sigma_1^2 + \sigma_2^2 - 2\rho\sigma_1\sigma_2$$

The $-2\rho\sigma_1\sigma_2$ term is the refund. Whenever the two measurements are positively correlated ($\rho > 0$) — and repeat measurements on a person almost always are — the variance of the difference is smaller than it would be for two unrelated people, and the more strongly correlated they are, the bigger the refund.

In the worked example below, $\rho = 0.75$ and the standard error drops from 3.35 to 1.90 — the paired design is doing the work of roughly three times the subjects.
:::

The catch: you only get the refund if the data are genuinely paired. Applying a paired test to unpaired data isn't conservative — it is meaningless, because the "pairs" are arbitrary.

## Clinical context

| Design | Correct test | Why |
|---|---|---|
| Parallel-group trial, arm A vs arm B | Two-sample (Welch or pooled) | Different subjects in each arm — no pairing available |
| Crossover trial, each subject gets both treatments | **Paired**, on the within-subject difference | The design deliberately created pairs |
| Pre/post within one arm | Paired — but see the warning below | Genuinely paired, but not an efficacy analysis |
| Matched case-control | **Paired**, on matched sets | Matching created the pairs |
| Two eyes, two knees, left/right lesions | **Paired** | The subject is the pairing unit |
| Change from baseline, arm A vs arm B | **Two-sample** on the CHG values | The pairing is already inside CHG; the arms are still independent |

That last row is the one people get wrong, and it's worth stating twice. When your outcome variable is *already* a change from baseline, the within-subject pairing has been used up in computing `CHG`. Comparing `CHG` between arms is a **two-sample** problem. There is no second pairing to exploit.

:::mistake[Using a within-arm paired test as evidence of efficacy]
A paired test of Week 12 versus baseline in the treated arm gives t = −9.55, p < 10⁻¹⁴ in this trial. It is a valid paired test and it is not evidence that the drug works, because the *placebo* arm also drops — from regression to the mean, the placebo effect, and familiarity with the measurement. Efficacy is a between-arm comparison. A within-arm p-value belongs in a descriptive table at most, and several sponsors' standards exclude it entirely to stop it being quoted.
:::

## Formal concept

### Two-sample, pooled variance

Assume $\sigma_1 = \sigma_2 = \sigma$. Estimate it from both arms at once:

$$
s_p^2 = \frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1 + n_2 - 2}
$$

$$
t = \frac{\bar{x}_1 - \bar{x}_2}{s_p\sqrt{\dfrac{1}{n_1} + \dfrac{1}{n_2}}}, \qquad \mathrm{df} = n_1 + n_2 - 2
$$

:::number[Why is $s_p^2$ weighted by $n-1$ and not by $n$?]
Because each arm's variance estimate carries $n_i - 1$ degrees of freedom, and the pooled estimate should weight each contribution by the amount of information behind it. The weights sum to $n_1 + n_2 - 2$, which is exactly the df of the resulting test — two degrees of freedom spent estimating the two means. This is the same accounting as the $n-1$ in a single-sample SD, applied twice.
:::

### Two-sample, Welch (Satterthwaite)

No equal-variance assumption:

$$
t = \frac{\bar{x}_1 - \bar{x}_2}{\sqrt{\dfrac{s_1^2}{n_1} + \dfrac{s_2^2}{n_2}}}
$$

with approximate degrees of freedom

$$
\nu = \frac{\left(\dfrac{s_1^2}{n_1} + \dfrac{s_2^2}{n_2}\right)^{\!2}}
{\dfrac{(s_1^2/n_1)^2}{n_1-1} + \dfrac{(s_2^2/n_2)^2}{n_2-1}}
$$

:::number[Why is the Welch df a decimal like 155.41?]
Because the denominator of the Welch statistic is a weighted sum of two chi-square variables, which is not itself chi-square. Satterthwaite's approximation finds the single chi-square distribution with the same first two moments — and the df that achieves that is generally not an integer. The value always lies between $\min(n_1,n_2) - 1$ and $n_1 + n_2 - 2$: closest to the lower bound when the variances and group sizes are badly mismatched, and close to the upper bound when the arms look alike, as here (155.41 versus a maximum of 156).
:::

### Paired

Reduce each subject to one number, $d_i = x_{2i} - x_{1i}$, then run a **one-sample** test on the differences:

$$
t = \frac{\bar{d}}{s_d/\sqrt{n}}, \qquad \mathrm{df} = n - 1
$$

where $n$ is the number of **pairs**, not the number of measurements.

### The rank-based alternatives

When the outcome is badly skewed or the sample is small, the distributional assumption is doing real work and you may prefer a test that doesn't make it:

| Parametric | Rank-based analogue | What it actually tests |
|---|---|---|
| Two-sample t | **Wilcoxon rank-sum** (= Mann–Whitney U) | Whether one group tends to give larger values; equals a test of medians only under a location-shift assumption |
| Paired t | **Wilcoxon signed-rank** | Whether the differences are symmetrically distributed about zero |

:::standard{kind="simplification"}
"The Wilcoxon rank-sum test compares medians" is a teaching shortcut. It tests $P(X > Y) = 0.5$ — a stochastic-dominance statement. It coincides with a test of medians only when the two distributions have the same shape and differ by a shift. If the distributions have different shapes, the rank-sum test can be significant when the medians are identical. Say "tends to be larger", not "the medians differ", unless you are willing to assume the shift model.
:::

:::mistake[Reaching for a rank test because a normality test was significant]
Running Shapiro–Wilk and switching tests on the result makes your analysis data-dependent, exactly like using the F test to pick between pooled and Welch. It is also badly calibrated: with n = 500 a normality test detects trivial departures that the t-test handles perfectly well, and with n = 15 it detects nothing even when it matters. Pre-specify in the SAP, based on what you know about the outcome — PK concentrations are log-normal, AE counts are skewed, blood pressure is not.
:::

## Worked example

Eight subjects in a within-subject study; seated systolic BP (mmHg) before and after four weeks of treatment:

| Subject | Pre | Post | $d$ = Post − Pre |
|---|---:|---:|---:|
| 1 | 158 | 142 | −16 |
| 2 | 146 | 139 | −7 |
| 3 | 162 | 145 | −17 |
| 4 | 151 | 148 | −3 |
| 5 | 149 | 136 | −13 |
| 6 | 167 | 150 | −17 |
| 7 | 155 | 141 | −14 |
| 8 | 144 | 137 | −7 |

**Step 1 — reduce to one number per subject.** That column of differences *is* the dataset now. There are 8 observations, not 16.

**Step 2 — mean difference.** The eight differences sum to −94:

$$
\bar{d} = \frac{-94}{8} = -11.75 \text{ mmHg}
$$

**Step 3 — SD of the differences.** Deviations from −11.75 are $-4.25, 4.75, -5.25, 8.75, -1.25, -5.25, -2.25, 4.75$; their squares sum to 201.5:

$$
s_d = \sqrt{\frac{201.5}{7}} = \sqrt{28.7857} = 5.3652
$$

**Step 4 — standard error and t.**

$$
\operatorname{SE} = \frac{5.3652}{\sqrt{8}} = 1.8969
\qquad
t = \frac{-11.75}{1.8969} = -6.1943
$$

**Step 5 — p-value and interval.** With $df = 8 - 1 = 7$ and $t_{0.975,7} = 2.3646$:

$$
p = 0.000448
\qquad
-11.75 \pm 2.3646 \times 1.8969 = (-16.24,\; -7.26)
$$

### Now do it wrong, on purpose

Ignore the pairing and run a two-sample test on "8 pre values versus 8 post values":

| | Paired (correct) | Unpaired (wrong) |
|---|---:|---:|
| t | **−6.194** | −3.510 |
| df | 7 | 11.83 |
| p | **0.00045** | 0.0044 |
| SE of the difference | **1.897** | 3.347 |

:::number[Where did the extra precision come from? Nothing was added to the data.]
From the correlation between each subject's two readings, which is $\rho = 0.751$ here. The unpaired denominator treats the 16 values as 16 unrelated people:

$$\operatorname{SE}_{\text{unpaired}} = \sqrt{\frac{8.000^2}{8} + \frac{5.064^2}{8}} = 3.347$$

The paired denominator uses the variance of the differences, which the correlation shrinks:

$$s_d^2 = \sigma_{\text{pre}}^2 + \sigma_{\text{post}}^2 - 2\rho\,\sigma_{\text{pre}}\sigma_{\text{post}} = 64.00 + 25.64 - 2(0.751)(8.000)(5.064) = 28.79$$

Subject 6 starts at 167 and Subject 8 at 144 — a 23 mmHg spread that is pure between-subject noise in the unpaired analysis. In the paired analysis it cancels inside each subject's own difference. **The information was always there; the unpaired test throws it away.**
:::

**The signed-rank alternative.** All eight differences are negative, so the Wilcoxon signed-rank statistic is $V = 0$ with $p = 0.0078$ — the smallest p-value obtainable from 8 pairs, since $2/2^8 = 0.0078$. With small samples, rank tests have a floor on how much evidence they can express, which is itself worth knowing before you choose one.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — AVAL and BASE are paired within subject; CHG has already used that pairing"}

**The between-arm comparison (this is the efficacy analysis).** Week 12 `CHG`, 10 mg versus placebo:

| Method | t | df | p | 95% CI |
|---|---:|---:|---:|---|
| Pooled | −3.0084 | 156 | 0.00306 | (−9.158, −1.899) |
| Welch | −3.0076 | 155.41 | 0.00307 | (−9.159, −1.897) |

Identical to three decimals, because the arms' SDs (11.48 and 11.61) and sizes (81 and 77) are nearly equal. **This is the normal case**, and it is why people go years without discovering that the two methods differ.

**The within-arm paired comparison (this is not efficacy).** `AVAL` versus `BASE` in the 20 mg arm, 80 subjects:

| Analysis | t | df | p | SE |
|---|---:|---:|---:|---:|
| Paired (correct for this comparison) | −9.551 | 79 | 8.2 × 10⁻¹⁵ | 1.285 |
| Two-sample (wrong for this comparison) | −7.989 | 156.73 | 2.8 × 10⁻¹³ | 1.537 |

Here $\rho = 0.302$ — much weaker than in the worked example, because 12 weeks and an active drug separate the two readings. The standard error still falls by 16%, but the gain is modest. **Pairing helps whenever $\rho > 0$, and how much it helps is exactly how correlated the measurements are.**

And to say it once more: neither row above is evidence of efficacy. Both describe a within-arm change that placebo subjects also experienced.

## Code

::::tabs
:::tab[SAS]
```sas
/* Two-sample: SAS prints BOTH rows and lets you choose */
proc ttest data=advs alpha=0.05;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12
        and trtp in ('Placebo', 'VTX-221 10 mg');
  class trtp;
  var chg;
run;

/* Paired: two variables joined by an asterisk, no CLASS statement */
proc ttest data=w12_20mg;
  paired aval * base;
run;

/* Rank-based alternatives */
proc npar1way data=advs wilcoxon;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12
        and trtp in ('Placebo', 'VTX-221 20 mg');
  class trtp;
  var chg;
run;
```

:::lines
5: `class trtp` makes it a two-sample test on independent groups.
10: The `PAIRED` statement replaces both `CLASS` and `VAR`. The asterisk syntax `aval * base` names the two columns that form each pair; SAS computes `aval - base` per row. There is no `class` statement in a paired analysis because there are no groups.
15: `PROC NPAR1WAY ... WILCOXON` gives the rank-sum test. For the **signed-rank** test on paired data you use `PROC UNIVARIATE` on the differences, which reports it as the "Signed Rank S" statistic — a genuinely confusing split that catches people out.
:::
:::

:::tab[R]
```r
w12 <- advs |> filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12)

# Two-sample — R defaults to Welch
t.test(CHG ~ TRTP, data = filter(w12, TRTP %in% c("VTX-221 10 mg", "Placebo")))
t.test(CHG ~ TRTP, data = filter(w12, TRTP %in% c("VTX-221 10 mg", "Placebo")),
       var.equal = TRUE)

# Paired
arm20 <- filter(w12, TRTP == "VTX-221 20 mg")
t.test(arm20$AVAL, arm20$BASE, paired = TRUE)

# Rank-based
wilcox.test(CHG ~ TRTP, data = filter(w12, TRTP %in% c("VTX-221 20 mg", "Placebo")))
wilcox.test(arm20$AVAL, arm20$BASE, paired = TRUE)
```

:::lines
4: R's `t.test()` defaults to `var.equal = FALSE` — Welch. This differs from SciPy and from what many SAS programmers expect, and it is the most common cause of a cross-language QC mismatch on a t-test.
10: `paired = TRUE` requires the two vectors to be **in the same subject order**. R will not warn you if they are not; it silently pairs row 1 with row 1. Sort both by `USUBJID`, or better, compute the difference in the data frame and run a one-sample test so the pairing is visible in the data rather than implied by row order.
14: `wilcox.test()` computes an exact p-value for small samples without ties and a normal approximation otherwise; with ties it warns and uses the approximation. SAS's default differs, so exact-versus-approximate is another thing to pin down in the SAP.
:::
:::

:::tab[Python]
```python
from scipy import stats

d10 = w12.loc[w12.TRTP == "VTX-221 10 mg", "CHG"]
pbo = w12.loc[w12.TRTP == "Placebo", "CHG"]

stats.ttest_ind(d10, pbo, equal_var=False)   # Welch
stats.ttest_ind(d10, pbo, equal_var=True)    # pooled — SciPy's DEFAULT

arm20 = w12.query("TRTP == 'VTX-221 20 mg'")
stats.ttest_rel(arm20.AVAL, arm20.BASE)      # paired

stats.mannwhitneyu(d10, pbo)                 # rank-sum
stats.wilcoxon(arm20.AVAL, arm20.BASE)       # signed-rank
```

:::lines
7: **`equal_var` defaults to `True` in SciPy** — the opposite of R. Two languages, two defaults, one SAP that says only "a two-sample t test". Always write the argument.
10: `ttest_rel` is SciPy's paired test ("related samples"). Like R, it pairs by position and will not detect a misaligned order.
12: `mannwhitneyu` and `wilcoxon` are the same two tests R calls `wilcox.test`; SciPy splits them into separate functions, which is arguably clearer.
:::
:::
::::

## Output

```text
                             The TTEST Procedure

                              Variable:  CHG

trtp             N        Mean     Std Dev     Std Err
--------------------------------------------------------
Placebo         77     -3.3000     11.6100      1.3231
VTX-221 10 mg   81     -8.8284     11.4842      1.2760
Diff (1-2)               5.5284     11.5462      1.8377

Method           Variances        DF    t Value    Pr > |t|
-------------------------------------------------------------
Pooled           Equal           156       3.01      0.0031
Satterthwaite    Unequal      155.41       3.01      0.0031
```

:::number[Why is the Welch df (155.41) so close to the pooled df (156)?]
Because the Welch df equals the pooled df exactly when the two arms have identical variances and identical sizes, and falls below it as they diverge. Here the SDs are 11.61 and 11.48 and the sizes are 77 and 81 — nearly identical on both counts — so the penalty is 0.59 of a degree of freedom. Seeing a Welch df far below $n_1+n_2-2$ is a signal worth reading: it means the arms really do differ in variability, and that in turn may be telling you something clinical about the treatment.
:::

## Interpretation

> At Week 12, mean change from baseline in seated systolic blood pressure was −8.83 mmHg on VTX-221 10 mg and −3.30 mmHg on placebo. The difference of −5.53 mmHg (95% CI −9.16 to −1.90) was statistically significant (two-sample t test, p = 0.0031).

Note the direction is stated as drug minus placebo even though SAS printed +5.53 — the sign was corrected deliberately, not by editing the number.

:::clinical
A 5.5 mmHg greater reduction than placebo is a meaningful effect for an antihypertensive — roughly the magnitude associated with measurable cardiovascular risk reduction in observational data. The confidence interval matters as much as the point estimate: the lower end (1.9 mmHg) is at the edge of clinical relevance, so the trial establishes that the drug works while leaving real uncertainty about how well. That is the honest summary, and it is the one that should reach the clinical team.
:::

## Common mistakes

:::mistake[Letting the language's default choose pooled versus Welch]
R defaults to Welch, SciPy defaults to pooled, SAS prints both. If the SAP says only "a two-sample t test", it is under-specified — raise it. In production code, write `var.equal =` or `equal_var =` explicitly even when you are choosing the default, so the next reader does not have to know which language's conventions apply.
:::

:::mistake[Running a paired test on unpaired data]
If the two vectors are not measurements on the same units, pairing them by row order is arbitrary. The result is not conservative or anti-conservative; it is meaningless. The giveaway is unequal group sizes — a paired test requires exactly equal n, and if your software errors on length, that error is telling you something true.
:::

:::mistake[Pairing by row order when the rows are not aligned]
`t.test(x, y, paired = TRUE)` pairs element 1 with element 1 and will not check that they belong to the same subject. If one vector was sorted differently, or one subject is missing from one side, every pair after that point is wrong and nothing warns you. Merge on `USUBJID`, compute the difference as a column, and test that column.
:::

:::mistake[Pairing twice]
`CHG` already contains the within-subject difference. Comparing `CHG` between two arms is a two-sample problem; there is no further pairing to exploit. Trying to "pair" arms in a parallel-group trial has no meaning — there is no correspondence between subject 5 on placebo and subject 5 on drug.
:::

:::mistake[Choosing the test after looking at the data]
Whether by an F test for variances, a Shapiro–Wilk for normality, or a glance at which gives the smaller p — selecting the analysis after seeing the data invalidates the error rate you claim. Pre-specify. Welch is the safe default for the two-sample case; a rank test is a defensible pre-specification when you know the outcome is badly behaved.
:::

## Knowledge check

::quiz{ids="stats.tt.pooled-vs-welch,stats.tt.when-paired,stats.tt.chg-not-paired,stats.tt.rank-test-claim"}

## Hands-on exercise

::practice{ids="stats.tt.paired-hand,stats.tt.pooled-sd,stats.tt.correlation-benefit,stats.tt.r-code" title="Practice: computing t tests and seeing what pairing buys"}

## Challenge exercise

::practice{ids="stats.tt.misaligned-pairs,stats.tt.default-mismatch,stats.tt.design-open" title="Challenge: alignment, defaults and design"}

## Industry note

**Where two-sample t tests actually appear.** Rarely as the primary analysis of a modern trial — the primary is usually ANCOVA adjusting for baseline (more powerful, and pre-specified for that reason) or an MMRM (handles dropout under MAR). The t test appears as a secondary or supportive analysis, in descriptive comparisons, and constantly in early-phase and exploratory work. It is also the analysis most often used to *check* a more complex model: if your MMRM's Week 12 contrast is wildly different from a simple t test on complete cases, one of them deserves investigation.

**The paired design is a sample-size strategy.** Crossover trials exist because pairing is so efficient — the worked example above achieved with 8 subjects what would have needed roughly 24 in a parallel design. The cost is real: crossovers need a washout period, they assume no carryover effect, they cannot study outcomes that change the subject permanently (mortality, cure, disease progression), and dropout is more damaging because a lost subject takes a whole pair with them. In oncology, crossover designs for efficacy are generally impossible for exactly these reasons.

:::standard{kind="convention"}
Specifying Welch (Satterthwaite) rather than the pooled test as the default two-sample analysis is increasingly common in SAPs, on the grounds that it costs little when variances are equal and protects when they are not. This is a methodological convention, not a regulatory requirement — ICH E9 asks that the analysis be pre-specified, not that it be any particular one.
:::

:::interview[When would you use a paired t test instead of a two-sample t test?]
The answer interviewers want has a principle and an example, and then a boundary case. The principle: pairing is a property of the **design**, not a choice made at analysis time — you use a paired test when each observation in one set corresponds to a specific observation in the other, because they come from the same subject, the same matched pair, or the same experimental unit. Examples: crossover trials, pre/post within subject, matched case-control, left eye versus right eye.

Then explain *why* it matters, which is where most candidates stop short: the paired test removes between-subject variation from the denominator, so it is substantially more powerful whenever the two measurements are positively correlated — and the gain is exactly a function of that correlation.

The boundary case that separates strong candidates: change from baseline. If the outcome is already `CHG`, the pairing has been used up, and comparing `CHG` between two arms is a two-sample problem. Candidates who volunteer that unprompted are telling you they have analysed a real trial.
:::
