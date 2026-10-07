## What problem are we trying to solve?

The Week 12 analysis is done. The 20 mg arm reduced systolic blood pressure by 8.98 mmHg more than placebo, and your output says `p < 0.0001`.

The medical director reads it and says: *"So there's less than a 0.01% chance this is a fluke."*

The medical writer drafts: *"VTX-221 20 mg was significantly superior to placebo (p < 0.0001), demonstrating a highly significant treatment effect."*

Both sentences are wrong, in different ways, and both will be read by a regulator. **This lesson is about saying the true thing instead.**

Here is why it matters beyond wording. A p-value is a conditional probability — and the condition is the part everybody drops. Once you know exactly what the condition is, four things that seem like separate rules turn out to be one rule:

- why a p-value is not the probability that the drug doesn't work,
- why testing 20 endpoints gives you a 64% chance of a false positive,
- why "p = 0.06, so we looked at the per-protocol population instead" is a serious integrity problem,
- and why a statistically significant result can be clinically worthless, and a non-significant one clinically important.

## Intuition

A hypothesis test is a proof by contradiction that has made peace with noise.

You want to argue that the drug works. Direct proof is unavailable — you have 157 patients, not the universe. So you argue backwards:

1. **Suppose the drug does nothing.** Not "suppose it's bad" — suppose it is *exactly* equivalent to placebo. This is the null hypothesis, $H_0$.
2. **Ask what the data would look like in that world.** With no real effect, the observed difference between arms would still not be exactly zero — random allocation of patients guarantees some gap. You can compute the whole distribution of gaps you'd expect.
3. **Compare what you actually saw with that distribution.** If your observed difference is the kind of thing that happens all the time under $H_0$, you've learned nothing. If it is the kind of thing that almost never happens under $H_0$, then either something very unusual occurred, or the supposition was wrong.

The **p-value** is the answer to step 3, stated as a probability: *if $H_0$ were true, how often would I see a result at least this extreme?*

:::why[Why assume something you're trying to disprove?]
Because the null is the only hypothesis specific enough to compute with. "The drug works" doesn't tell you *how much* it works, so it doesn't define a distribution of outcomes. "The drug does exactly nothing" pins down the distribution completely. You can only measure how surprising your data are relative to a fully specified world, and $H_0$ is the one fully specified world available to you.

This is also why a test can never *confirm* $H_0$: failing to be surprised is not evidence that the surprising thing is absent.
:::

The single most important consequence follows directly. The p-value is

$$
P(\text{data this extreme} \mid H_0 \text{ true})
$$

and **not**

$$
P(H_0 \text{ true} \mid \text{data})
$$

Those are different quantities and swapping them is the same error as confusing "the probability of a positive test given disease" with "the probability of disease given a positive test" — the classic diagnostic-testing reversal. Every clinician knows that one. The p-value version is the same mistake wearing different clothes.

## Clinical context

Where the pieces live in a real trial:

| Concept | Where it appears in practice |
|---|---|
| $H_0$ and $H_1$ | Written in the SAP **before** unblinding, with the test, the population and the model fully specified |
| Significance level $\alpha$ | Almost always 0.05 two-sided for the primary endpoint; fixed in advance, never adjusted after seeing data |
| Type I error | Approving a drug that doesn't work — the error regulators protect against most fiercely |
| Type II error | Abandoning a drug that does work — the error sponsors care about most |
| Power ($1-\beta$) | The sample-size justification section of the protocol |
| Multiplicity | The testing hierarchy in the SAP: which endpoints, in what order, at what α |
| One- versus two-sided | Stated in the SAP and rarely one-sided; a one-sided 2.5% test is the usual compromise |

:::standard{kind="official"}
ICH E9 §5.5 states that the statistical analysis should normally be based on a pre-specified analysis plan, and §2.2.2 addresses the need to control the type I error rate in confirmatory trials. The convention of a two-sided 5% level (or a one-sided 2.5%) is stated in ICH E9 as conventional rather than mandated — what is binding is that the level and the testing strategy are pre-specified.
:::

:::standard{kind="convention"}
"p < 0.05 means significant" is a convention that traces to Fisher's tables, not to any regulation or biological threshold. Its persistence is social, and both the American Statistical Association's 2016 statement on p-values and a large methodological literature argue against treating 0.05 as a bright line. In regulatory practice the 0.05/0.025 level is nonetheless what confirmatory trials are held to — so know both that it is arbitrary and that it binds you.
:::

## Formal concept

### The machinery

**Null hypothesis** $H_0: \mu_1 - \mu_2 = 0$. **Alternative** $H_1: \mu_1 - \mu_2 \neq 0$ (two-sided).

A **test statistic** rescales the observed effect by its own uncertainty, so that it can be compared against a known distribution:

$$
t = \frac{\text{estimate} - \text{null value}}{\text{standard error of the estimate}}
= \frac{(\bar x_1 - \bar x_2) - 0}{\sqrt{s_1^2/n_1 + s_2^2/n_2}}
$$

:::why[Why divide by the standard error at all?]
Because "8.98 mmHg" is not interpretable on its own. Eight mmHg is enormous if the standard error is 0.5 and unremarkable if it is 20. Dividing converts the effect into units of its own noise, producing a number whose distribution under $H_0$ is known regardless of the units, the disease or the sample size. Every test statistic you will meet — $t$, $z$, $\chi^2$, $F$, the log-rank statistic — is some version of *signal divided by noise*.
:::

**The p-value** is the tail probability of the reference distribution beyond the observed statistic:

$$
p = P\!\left(|T| \ge |t_{\text{obs}}| \;\middle|\; H_0\right), \qquad T \sim t_\nu
$$

### The two errors

|  | $H_0$ is actually true | $H_0$ is actually false |
|---|---|---|
| **Reject $H_0$** | **Type I error** (probability $\alpha$) | Correct — "power", $1-\beta$ |
| **Do not reject $H_0$** | Correct | **Type II error** (probability $\beta$) |

The asymmetry is deliberate and regulatory. $\alpha$ is *chosen* and *controlled* — you fix it at 0.05 and the procedure guarantees it. $\beta$ depends on the true effect size, which you don't know; you can only design for a value you hope for.

:::number[Where does the 0.05 type I error rate actually show up?]
Simulate: draw two samples of 30 from the *same* normal distribution — a world where $H_0$ is exactly true — and run a t-test. Repeat 100,000 times. The share of runs with $p \le 0.05$ came out at **0.0497**, and the share with $p \le 0.01$ at **0.0101**. That is what $\alpha$ means, operationally: a 5% false-positive rate across repeated testing in a null world, not a statement about any single trial.
:::

### One-sided versus two-sided

A two-sided test puts $\alpha/2$ in each tail; a one-sided test puts all of $\alpha$ in one. A one-sided test is more powerful *in the direction you chose* and has **no power at all** to detect an effect in the other direction — it cannot distinguish "no effect" from "harmful".

:::mistake[Switching to one-sided after seeing p = 0.06]
A two-sided p of 0.06 becomes a one-sided p of 0.03 with no new data. If the one-sided test was not pre-specified, this is not a methodological choice; it is data-dependent selection of the analysis, and it inflates the true type I error. In a confirmatory trial it would be a serious finding. If you genuinely believe one-sided is appropriate, argue it in the SAP, before unblinding — and expect to be asked why a harmful effect doesn't need detecting.
:::

### Multiplicity

Every test at $\alpha = 0.05$ has a 5% false-positive rate. Run $k$ independent tests in a null world and the probability of at least one false positive is

$$
1 - (1-\alpha)^k
$$

| Number of tests $k$ | Chance of at least one false positive |
|---:|---:|
| 1 | 5.0% |
| 5 | 22.6% |
| 10 | 40.1% |
| 20 | **64.2%** |

::widget{name="multiplicity-simulator"}

Twenty endpoints, no real effects anywhere, and you'd expect a "significant" finding about two times in three. This is why the SAP fixes a testing hierarchy in advance, and why "we also looked at 14 secondary endpoints" is not a defence.

## Worked example

Twelve subjects in a single-arm pilot. Change from baseline in systolic BP (mmHg):

`-14, -6, -18, 2, -11, -9, -22, -4, -13, -7, -16, -2`

Test $H_0: \mu = 0$ (no mean change) against $H_1: \mu \neq 0$ at $\alpha = 0.05$.

**Step 1 — state the hypotheses before touching the data.** Done above. Two-sided, because a pilot should be able to detect a *rise* in blood pressure as well as a fall.

**Step 2 — the estimate and its standard error.** From the confidence-interval lesson: $\bar x = -10.00$, $s = 7.0065$, $\mathrm{SE} = 7.0065/\sqrt{12} = 2.0226$.

**Step 3 — the test statistic.**

$$
t = \frac{-10.00 - 0}{2.0226} = -4.9441
$$

:::number[Where does the 0 in the numerator come from?]
From $H_0$ itself. The general form is (estimate − null value) / SE, and here the null value is 0 because the hypothesis is "no change". If you were testing against a clinically relevant threshold of 5 mmHg reduction, the numerator would be $-10.00 - (-5) = -5.00$ and the statistic would be $-2.472$ — a different test of a different question, on the same data.
:::

**Step 4 — the reference distribution and the critical value.** Under $H_0$, $t \sim t_{11}$. The two-sided 5% critical value is $t_{0.975,11} = 2.2010$. Since $|-4.9441| > 2.2010$, reject.

**Step 5 — the p-value.**

$$
p = 2 \times P(T_{11} \le -4.9441) = 2 \times 0.000220 = 0.000440
$$

:::number[Why multiply by 2?]
Because the test is two-sided: "at least this extreme" means at least this far from zero *in either direction*. The $t$ distribution is symmetric, so each tail contributes 0.000220. A one-sided test in the pre-specified direction would report 0.000220 — exactly half. This factor of 2 is the single most common source of a QC discrepancy in p-values, and it is why you check `sides=` / `alternative=` before you check anything else.
:::

**Step 6 — say what it means.**

> Mean change from baseline was −10.0 mmHg (95% CI −14.5 to −5.5), $p = 0.0004$ against a null of no change.

Notice what that sentence does *not* say: nothing about the probability that the drug works, nothing about how large the effect is "likely" to be, and no adjective before "significant".

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — Week 12 systolic BP records feed the primary comparison"}

Week 12 change from baseline, VTX221-201, analysis records:

| Comparison | Difference | SE | Test | Statistic | df | p |
|---|---:|---:|---|---:|---:|---:|
| Placebo vs 0 (one-sample) | −3.30 | 1.32 | t | −2.494 | 76 | 0.0148 |
| 10 mg − placebo | −5.53 | 1.84 | Welch t | −3.008 | 155.41 | 0.0031 |
| 20 mg − placebo | −8.98 | 1.84 | Welch t | −4.866 | 154.64 | 0.0000028 |
| 20 mg − placebo | −8.98 | 1.84 | Pooled t | −4.867 | 155 | 0.0000028 |

Three things worth noticing in that table.

**The placebo arm is "significantly" different from zero** ($p = 0.0148$). Placebo did not lower anyone's blood pressure. What that row detects is regression to the mean (subjects were enrolled on a high screening reading), the placebo effect, and measurement conditions improving with familiarity. **This is exactly why trials have control arms**: a within-arm change is not a treatment effect, however small its p-value.

**Pooled and Welch agree to four decimals here** because the two arms have nearly equal SDs (11.50 and 11.61) and nearly equal sizes (80 and 77). They diverge when either assumption fails — and the SAP has to say which one you use.

:::number[Why is the p-value for the 20 mg comparison 0.0000028 rather than "< 0.0001"?]
`p < 0.0001` is a display convention, not the number. Most sponsor standards truncate at four decimals because further digits are not meaningful — they depend on distributional assumptions in the far tail, where the t approximation is least trustworthy. Report what the shell specifies. But know the actual value, because "how small was it really?" is a question that gets asked, and because a p-value of exactly 0.0000 in an output is a red flag for a programming error, not a very strong result.
:::

## Code

::::tabs
:::tab[SAS]
```sas
/* Two-sample test of the Week 12 difference */
proc ttest data=advs alpha=0.05 sides=2;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12
        and trtp in ('Placebo', 'VTX-221 20 mg');
  class trtp;
  var chg;
run;

/* One-sample test against a null of zero change */
proc ttest data=advs h0=0 sides=2;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12
        and trtp = 'Placebo';
  var chg;
run;
```

:::lines
2: `sides=2` is the default; writing it makes the two-sidedness explicit and reviewable. `sides=U` or `sides=L` request one-sided tests — and you should never see one appear in a program without a matching sentence in the SAP.
5: `class trtp` makes it a two-sample test. PROC TTEST always prints **both** the pooled and Satterthwaite rows plus an equality-of-variances test; the SAP says which row is the analysis.
10: `h0=0` sets the null value. The default is 0, but stating it matters when the null is something else — a non-inferiority margin, or a clinically relevant threshold.
:::
:::

:::tab[R]
```r
w12 <- advs |> filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12)

# Two-sample, Welch (R's default)
t.test(CHG ~ TRTP,
       data = filter(w12, TRTP %in% c("VTX-221 20 mg", "Placebo")),
       var.equal = FALSE, alternative = "two.sided")

# Pooled, to match the SAS pooled row
t.test(CHG ~ TRTP,
       data = filter(w12, TRTP %in% c("VTX-221 20 mg", "Placebo")),
       var.equal = TRUE)

# One-sample against zero
t.test(w12$CHG[w12$TRTP == "Placebo"], mu = 0)
```

:::lines
6: `var.equal = FALSE` is R's default (Welch). SciPy's default is the opposite. Write the argument in production code so the reader does not have to know which language's defaults are in play. `alternative = "two.sided"` is also the default. Making it explicit is cheap insurance: a one-sided test entering a program by accident is a serious error and an invisible one.
8: R orders the groups by factor level, which for a character column means alphabetical — so `Placebo` is group 1 and the printed difference is placebo minus drug. Check the sign against the shell, every time.
14: `mu = 0` is the null value for the one-sample test, the direct analogue of SAS's `h0=`.
:::
:::

:::tab[Python]
```python
from scipy import stats

w12 = advs.query("PARAMCD == 'SYSBP' and ANL01FL == 'Y' and AVISITN == 12")
d20 = w12.loc[w12.TRTP == "VTX-221 20 mg", "CHG"]
pbo = w12.loc[w12.TRTP == "Placebo", "CHG"]

stats.ttest_ind(d20, pbo, equal_var=False)   # Welch
stats.ttest_ind(d20, pbo, equal_var=True)    # pooled
stats.ttest_1samp(pbo, popmean=0)
```

:::lines
7: SciPy's `equal_var` **defaults to True** (pooled) — the opposite of R. This is the single most common cross-language QC discrepancy in two-sample tests. SciPy also accepts `alternative=` with values `'two-sided'`, `'less'` and `'greater'`; the default is two-sided.
9: `popmean` is SciPy's name for the null value, the analogue of SAS `h0=` and R `mu=`.
:::
:::
::::

## Output

```text
                             The TTEST Procedure

                              Variable:  CHG

Method           Variances        DF    t Value    Pr > |t|
-------------------------------------------------------------
Pooled           Equal           155      4.87      <.0001
Satterthwaite    Unequal      154.64       4.87      <.0001

                 Equality of Variances

Method      Num DF    Den DF    F Value    Pr > F
---------------------------------------------------
Folded F        76        79       1.02     0.9298
```

:::mistake[Using the equality-of-variances test to choose the analysis]
SAS prints the Folded F test right there, and it is tempting to use it as a decision rule: "F is non-significant, so use the pooled row." Don't. That makes your analysis data-dependent — a two-stage procedure whose actual type I error is not 0.05 — and the F test itself is sensitive to non-normality, so it is unreliable exactly when it matters. The SAP should specify one method in advance. Welch is the safer default because it is nearly as efficient when variances are equal and much better when they are not.
:::

## Interpretation

Four statements about the same result. One is correct.

| Statement | Verdict |
|---|---|
| "There is a 0.00028% chance the drug doesn't work." | **Wrong.** That is $P(H_0 \mid \text{data})$; the p-value is $P(\text{data} \mid H_0)$. |
| "The result is highly significant, proving efficacy." | **Wrong.** A single test does not prove; "highly significant" has no defined meaning; and significance is not a measure of effect size. |
| "If there were truly no difference, data this extreme would occur about 3 times in a million." | **Correct**, and this is the literal content of the p-value. |
| "The drug reduces systolic BP by 8.98 mmHg (95% CI 5.33 to 12.62), p < 0.0001." | **Correct and most useful** — estimate first, interval second, p-value last. |

:::clinical
The clinically important sentence is the one with the interval in it. A 5 to 13 mmHg reduction in systolic pressure is meaningful at the low end and substantial at the high end. If the same p-value had come from a 30,000-patient trial with a 0.4 mmHg difference, the p-value would look identical and the drug would be useless. **Statistical significance is a statement about evidence against a null; clinical significance is a statement about the size of the effect.** Only the confidence interval carries the second one, which is why regulators and journals ask for it.
:::

## Common mistakes

:::mistake[Interpreting p as the probability that the null is true]
$p = P(\text{data} \mid H_0)$, not $P(H_0 \mid \text{data})$. Getting the posterior probability of $H_0$ requires a prior — that is a Bayesian analysis, and it will generally give a number much larger than the p-value. Under plausible priors a p-value of 0.05 often corresponds to a posterior probability of the null around 20–30%, which is a useful thing to know when someone treats 0.05 as decisive.
:::

:::mistake[Treating "not significant" as "no effect"]
Failing to reject $H_0$ means the data were compatible with the null, not that the null is true. An underpowered trial fails to reject almost regardless of the truth. Always report the interval: (−0.4, 0.3) genuinely rules out meaningful effects; (−14, 6) rules out nothing. Same verdict, opposite science.
:::

:::mistake[Testing until something is significant]
Trying multiple endpoints, multiple populations, multiple time points or multiple models and reporting the one that reached 0.05 inflates the type I error far beyond the nominal level. This is why the SAP pre-specifies the primary endpoint, the analysis population, the model and the testing hierarchy — and why any deviation is documented as a deviation, not quietly absorbed.
:::

:::mistake[Reading a within-arm p-value as evidence of a treatment effect]
The placebo arm in this trial dropped 3.3 mmHg with $p = 0.0148$. That is regression to the mean and the placebo effect, not efficacy. A treatment effect is a **between-arm** comparison. Within-arm change p-values belong in a descriptive table at most, and some sponsors' standards forbid them outright for exactly this reason.
:::

:::mistake[Comparing p-values across subgroups]
"It's significant in men (p = 0.03) but not in women (p = 0.12), so it works better in men" is not valid. Those two p-values differ partly because the subgroups have different sizes. The correct question is whether there is a treatment-by-subgroup **interaction**, which is a single test on the whole dataset — and one that is typically underpowered, which is itself worth saying out loud.
:::

## Knowledge check

::quiz{ids="stats.ht.p-definition,stats.ht.not-significant,stats.ht.one-sided-switch,stats.ht.within-arm"}

## Hands-on exercise

::practice{ids="stats.ht.hand-t,stats.ht.two-sided-p,stats.ht.multiplicity-calc,stats.ht.r-code" title="Practice: computing and reporting a test"}

## Challenge exercise

::practice{ids="stats.ht.variance-test-trap,stats.ht.interpret-open,stats.ht.qc-p-halved" title="Challenge: defaults, hierarchies and discrepancies"}

## Industry note

**Estimate, interval, p-value — in that order.** Modern regulatory and journal practice puts the effect estimate first and the p-value last, if at all. The ICH E9(R1) addendum on estimands pushes this further: it asks you to define precisely *what* treatment effect you are estimating — in which population, handling intercurrent events how — before any test is chosen. A test without a clearly defined estimand answers a question nobody asked.

**Power is not a property of a result.** "Post-hoc power" computed from the observed effect is a deterministic function of the p-value and adds no information; a large literature says so and reviewers increasingly flag it. If a trial was negative and you want to know whether it was informative, report the confidence interval, not the retrospective power.

**The fragility of a borderline p.** A p-value of 0.049 and a p-value of 0.051 are the same evidence. Pretending otherwise is the bright-line thinking the ASA statement warns about. The useful habit is to ask how the conclusion would change under reasonable alternatives — a different missing-data assumption, a different analysis population, one more or one fewer event. If it flips, say so.

:::interview[Explain a p-value to a clinical colleague who is not a statistician.]
The strongest answers avoid both jargon and false simplification. Something like: "It's the probability of seeing a difference at least as big as ours if the drug truly did nothing. Small means our result would be unusual in a world where the drug is inert — so it's evidence against that world. It is *not* the probability the drug doesn't work; that's a different question and it needs assumptions about what we believed before the trial." Then pivot to what they actually want: "The number that answers your question is the confidence interval — it tells you how big the effect plausibly is, which is what you'll use in the clinic." Interviewers are listening for three things: the conditional direction stated correctly, an explicit rejection of the inverse-probability reading, and the instinct to move the conversation to effect size. A candidate who recites a definition without that last move sounds like a textbook; one who makes it sounds like a colleague.
:::
