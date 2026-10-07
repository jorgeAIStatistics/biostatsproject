## What problem are we trying to solve?

Table 14.2.3 in the CSR is the responder analysis. Its shell asks for one row per arm:

```text
                              Placebo        VTX-221 20 mg
Subjects with controlled BP   20 (26.0%)     43 (53.8%)
  Difference vs placebo                      27.8% (13.1%, 42.5%)
  p-value                                    0.0004
```

Three numbers you now have to produce, and each one hides a decision.

**The percentage.** 43 out of what? Everyone randomized, everyone treated, or everyone with a Week 12 measurement? The denominator changes the number and it is the single most common source of a QC finding in a safety or responder table.

**The effect measure.** A 27.8 percentage-point difference. Or a relative risk of 2.07. Or an odds ratio of 3.31. All three describe the same 2×2 table, all three are correct, and they tell a reader three different stories. Knowing which one the SAP asks for — and why an odds ratio is not a relative risk — is not pedantry; it is the difference between a clinician understanding your table and misreading it.

**The p-value.** Chi-square or Fisher? With or without continuity correction? Stratified by the randomization strata or not? SAS's `PROC FREQ` will print all of them if you ask, and the SAP has to have chosen one.

This lesson also covers the test that appears in almost every oncology and cardiovascular SAP and almost no statistics course: the **Cochran–Mantel–Haenszel** test, which compares two arms while respecting the strata subjects were randomized within.

## Intuition

Every categorical test asks the same question: **is the pattern of counts further from "no association" than chance alone would produce?**

Start with what "no association" looks like. In this trial 63 of 157 subjects with a Week 12 value had controlled blood pressure — 40.1% overall. If treatment made no difference, you would expect about 40.1% of *each* arm to be controlled:

- Placebo: $77 \times 0.401 = 30.9$ controlled
- 20 mg: $80 \times 0.401 = 32.1$ controlled

Those are the **expected counts**: what the table would look like if the row totals and column totals were exactly as observed, but the two variables were unrelated.

The observed counts are 20 and 43. The chi-square statistic measures the gap:

$$
\chi^2 = \sum_{\text{all cells}} \frac{(\text{observed} - \text{expected})^2}{\text{expected}}
$$

:::why[Why divide by the expected count?]
Because a discrepancy of 10 means something completely different depending on scale. If you expected 30 and saw 40, that is a big deal. If you expected 3,000 and saw 3,010, it is nothing. Dividing by the expected count converts an absolute discrepancy into a relative one — and it turns out to be exactly the right scaling to make the sum follow a chi-square distribution, because for a Poisson-like count the variance equals the mean.
:::

**Fisher's exact test** takes a different route entirely. Instead of approximating, it enumerates: holding the row and column totals fixed, it lists every table that could have arisen and computes the exact probability of each under independence. No approximation, hence "exact" — at the cost of conditioning on the margins, which is a real assumption and not merely a technicality.

## Clinical context

| Where categorical analysis appears | Typical measure |
|---|---|
| Adverse events by preferred term | n (%) per arm, often with a risk difference |
| Responder / non-responder analyses | Risk difference or relative risk with CI |
| Objective response rate in oncology | Proportion with exact (Clopper–Pearson) CI |
| Discontinuation, compliance, protocol deviations | n (%), usually descriptive only |
| Shift tables (normal → abnormal) | Counts, usually no test at all |
| Binary secondary endpoint | CMH stratified by randomization strata |

:::standard{kind="convention"}
Most safety tables in a CSR present counts and percentages **without p-values**. The reasoning: a safety database contains hundreds of preferred terms, so testing each one produces false positives by the dozen, and the purpose of a safety table is to describe rather than to test. Sponsor standards differ on this, and some include p-values for pre-specified events of special interest. It is a convention and a SAP decision, not a regulatory rule — but if you are asked to add p-values to every AE row, it is worth asking what multiplicity strategy governs them.
:::

:::mistake[Getting the denominator wrong]
"43 (53.8%)" — 53.8% of what? Here it is 43/80, the subjects **with a Week 12 measurement**. Using the 88 treated subjects gives 48.9%; using all 89 randomized gives 48.3%. All three are defensible under different estimands, and the shell must say which. In a responder analysis the choice is substantive: counting subjects with no measurement as non-responders is a real (and conservative) imputation decision that belongs in the SAP, not in a programmer's judgement.
:::

::widget{name="denominator-explorer"}

## Formal concept

### The 2×2 table

|  | Event | No event | Total |
|---|---:|---:|---:|
| Treated | $a$ | $b$ | $a+b$ |
| Control | $c$ | $d$ | $c+d$ |

With $\hat{p}_1 = a/(a+b)$ and $\hat{p}_0 = c/(c+d)$:

**Risk difference** — the absolute scale:

$$
RD = \hat{p}_1 - \hat{p}_0,
\qquad
\operatorname{SE} = \sqrt{\frac{\hat{p}_1(1-\hat{p}_1)}{a+b} + \frac{\hat{p}_0(1-\hat{p}_0)}{c+d}}
$$

**Relative risk** — the multiplicative scale. The CI is built on the **log** scale and exponentiated:

$$
RR = \frac{\hat{p}_1}{\hat{p}_0},
\qquad
\operatorname{SE}(\ln RR) = \sqrt{\frac{b}{a(a+b)} + \frac{d}{c(c+d)}}
$$

**Odds ratio** — the scale that logistic regression and case-control studies work on:

$$
OR = \frac{a/b}{c/d} = \frac{ad}{bc},
\qquad
\operatorname{SE}(\ln OR) = \sqrt{\frac{1}{a} + \frac{1}{b} + \frac{1}{c} + \frac{1}{d}}
$$

:::why[Why are RR and OR confidence intervals computed on the log scale?]
Because ratios are bounded below by 0 and unbounded above — a badly skewed sampling distribution. "No effect" is 1, but 0.5 and 2.0 are equally far from it in a multiplicative sense while being 0.5 and 1.0 away in an additive sense. Taking logs makes the scale symmetric around 0, the sampling distribution approximately normal, and the arithmetic valid. Exponentiating the two ends gives an interval that is **asymmetric around the point estimate** — which is why a forest plot's whiskers are unequal, and why an interval that looks symmetric around a hazard ratio is a sign something is wrong.
:::

:::mistake[Calling an odds ratio a relative risk]
An OR always sits further from 1 than the corresponding RR. In this trial RR = 2.07 but OR = 3.31 — the OR makes the effect sound 60% larger. They converge only when the event is rare (roughly under 10%), and a responder analysis at 26% and 54% is nowhere near rare. Say "the odds of control were 3.3 times higher", not "subjects were 3.3 times more likely to be controlled". The second sentence is a factual error about a 2×2 table you produced.
:::

### Chi-square and its assumptions

$$
\chi^2 = \sum \frac{(O-E)^2}{E}, \qquad E_{ij} = \frac{(\text{row}_i)(\text{col}_j)}{N}, \qquad \mathrm{df} = (r-1)(c-1)
$$

:::number[Why is df = 1 for a 2×2 table?]
$(2-1)(2-1) = 1$. Concretely: once the row totals and column totals are fixed, filling in **one** cell determines all four. Only one number in the table is free to vary, so there is one degree of freedom. The same counting gives df = 2 for a 2×3 table and df = 6 for a 3×4.
:::

The chi-square approximation needs adequate expected counts. The usual working rule — **all expected counts ≥ 5**, or at least 80% of cells ≥ 5 with none below 1 — is a convention, not a theorem.

:::standard{kind="convention"}
The "expected count ≥ 5" rule traces to Cochran's recommendations from the 1950s and appears in most textbooks. It is a rule of thumb about when the continuous chi-square distribution adequately approximates a discrete distribution, not a regulatory or mathematical threshold. Modern practice is more relaxed for large tables, and for small ones an exact test sidesteps the question entirely.
:::

**Yates' continuity correction** subtracts 0.5 from each $|O-E|$ before squaring, to compensate for approximating a discrete distribution with a continuous one. It makes the test more conservative. R's `chisq.test()` applies it **by default** for 2×2 tables; SAS does not. In this trial that is the difference between p = 0.00039 and p = 0.00071 — nearly a factor of two, from a default.

### Cochran–Mantel–Haenszel

Subjects in VTX221-201 were randomized **stratified by baseline systolic BP group**. Ignoring strata in the analysis wastes the design and, when the strata have different event rates, can bias the estimate.

CMH accumulates the observed-minus-expected across strata before squaring, rather than testing each stratum separately:

$$
\chi^2_{CMH} = \frac{\left[\sum_k \left(a_k - E_k\right)\right]^2}{\sum_k V_k}
$$

with $E_k$ and $V_k$ the hypergeometric mean and variance of $a_k$ within stratum $k$. The Mantel–Haenszel common odds ratio is

$$
OR_{MH} = \frac{\sum_k a_k d_k / n_k}{\sum_k b_k c_k / n_k}
$$

:::why[Why does stratifying make the test stronger here rather than weaker?]
Because the strata differ in their baseline event rates, and pooling mixes that heterogeneity into the noise. Subjects in the lower baseline-BP stratum are much more likely to reach control regardless of treatment. Comparing arms *within* stratum removes that source of variation from the comparison, exactly as pairing does in a paired t test. In this trial the unstratified chi-square is 12.60 and the CMH statistic is 14.03 — the same data, a sharper comparison.
:::

**Important caveat:** CMH assumes a *common* odds ratio across strata. If the treatment effect genuinely differs by stratum (a treatment-by-stratum interaction), a single pooled OR is the wrong summary, and the Breslow–Day test is the usual — though not very powerful — check.

## Worked example

Week 12 controlled hypertension (SBP < 140 mmHg), 20 mg versus placebo:

|  | Controlled | Not controlled | Total |
|---|---:|---:|---:|
| VTX-221 20 mg | 43 | 37 | 80 |
| Placebo | 20 | 57 | 77 |
| **Total** | **63** | **94** | **157** |

**Step 1 — the two proportions.** $\hat{p}_1 = 43/80 = 0.5375$; $\hat{p}_0 = 20/77 = 0.2597$.

**Step 2 — expected counts under independence.** The overall control rate is $63/157 = 0.40127$.

$$
E_{11} = \frac{80 \times 63}{157} = 32.102,
\qquad
E_{12} = \frac{80 \times 94}{157} = 47.898
$$
$$
E_{21} = \frac{77 \times 63}{157} = 30.898,
\qquad
E_{22} = \frac{77 \times 94}{157} = 46.102
$$

All four exceed 5 comfortably, so the chi-square approximation is fine.

:::number[Why do the expected counts sum to the same margins as the observed table?]
By construction: $E_{ij} = (\text{row}_i)(\text{col}_j)/N$, so summing across a row gives $(\text{row}_i)(\sum_j \text{col}_j)/N = \text{row}_i$. The expected table has *identical* row and column totals to the observed one — it differs only in how the total is distributed inside. That is the sense in which it represents "the same study, with no association".
:::

**Step 3 — the chi-square statistic.**

$$
\chi^2 = \frac{(43-32.102)^2}{32.102} + \frac{(37-47.898)^2}{47.898} + \frac{(20-30.898)^2}{30.898} + \frac{(57-46.102)^2}{46.102}
$$

$$
= 3.700 + 2.480 + 3.844 + 2.576 = 12.599
$$

With 1 df, $p = 0.00039$.

:::number[Why is $|O - E| = 10.898$ in all four cells?]
Because with fixed margins there is only one free cell. Whatever you add to the top-left must be subtracted from the top-right (to keep the row total) and from the bottom-left (to keep the column total), and added back to the bottom-right. The four discrepancies are $+10.898, -10.898, -10.898, +10.898$. This is the same fact as "df = 1", seen from the arithmetic side.
:::

**Step 4 — the three effect measures.**

$$
RD = 0.5375 - 0.2597 = 0.2778 \;(27.8 \text{ percentage points})
$$
$$
\operatorname{SE}(RD) = \sqrt{\frac{0.5375 \times 0.4625}{80} + \frac{0.2597 \times 0.7403}{77}} = 0.0749
$$
$$
95\% \text{ CI} = 0.2778 \pm 1.96 \times 0.0749 = (0.1310,\; 0.4245)
$$

$$
RR = \frac{0.5375}{0.2597} = 2.069, \qquad 95\% \text{ CI} = (1.348,\; 3.176)
$$

$$
OR = \frac{43 \times 57}{37 \times 20} = \frac{2451}{740} = 3.312, \qquad 95\% \text{ CI} = (1.690,\; 6.491)
$$

**Step 5 — number needed to treat.** $NNT = 1/RD = 1/0.2778 = 3.6$. About **4 patients** must be treated with 20 mg instead of placebo for one additional patient to reach controlled blood pressure at Week 12.

Notice the three intervals. The RD interval is symmetric around 0.2778. The RR and OR intervals are **not** symmetric around their point estimates — because they were built on the log scale and exponentiated.

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,SBPBL,SBPGR1,SBPGR1N,STRAT1R,ITTFL,SAFFL" rows="8" caption="ADSL — SBPGR1N is the baseline BP stratum subjects were randomized within"}

**Chi-square versus Fisher versus the correction**, on the 2×2 table above:

| Test | p-value |
|---|---:|
| Pearson chi-square, no correction | 0.000386 |
| Pearson chi-square, Yates' correction | 0.000707 |
| Fisher's exact | 0.000579 |

All agree that the effect is real, but they differ by nearly a factor of two. **With expected counts this large, the uncorrected chi-square is the appropriate choice**, and the corrected one is needlessly conservative. The point is that the SAP must say which.

**Now stratify by the randomization stratum** (`SBPGR1N`: 1 = baseline SBP < 150, 2 = ≥ 150):

| Stratum | Arm | Controlled | Not | OR |
|---|---|---:|---:|---:|
| 1 (SBP < 150) | 20 mg | 28 | 15 | 3.858 |
| | Placebo | 15 | 31 | |
| 2 (SBP ≥ 150) | 20 mg | 15 | 22 | 3.546 |
| | Placebo | 5 | 26 | |

CMH: $\chi^2 = 14.034$ on 1 df, $p = 0.00018$; common OR = **3.736** (95% CI 1.852 to 7.535).

:::number[Why is the stratified p-value (0.00018) smaller than the unstratified one (0.00039)?]
Because the strata have very different control rates — 43/89 in stratum 1 versus 20/68 in stratum 2 — and pooling them folds that variation into the comparison as noise. Stratifying removes it. The two stratum-specific odds ratios (3.86 and 3.55) are close to each other, which is what makes a common-OR summary sensible and is also why the stratified analysis is more efficient rather than merely different.

Note also that the common OR (3.736) is slightly *further* from 1 than the crude OR (3.312). That is the stratification correcting a small amount of confounding by baseline severity — a real, if modest, example of Simpson's-paradox-type behaviour.
:::

**Where Fisher earns its place.** Serious treatment-emergent AEs, 20 mg versus placebo:

|  | SAE | No SAE | Expected SAE |
|---|---:|---:|---:|
| VTX-221 20 mg | 3 | 85 | 1.98 |
| Placebo | 1 | 89 | 2.02 |

Both expected counts are below 5, so R warns *"Chi-squared approximation may be incorrect"*. Chi-square gives p = 0.301, Fisher gives p = 0.365. Neither is significant, but only one of them is trustworthy — and 3 events versus 1 could never establish anything either way. **This is the normal state of affairs for rare safety events**, and it is why safety signals are described rather than tested.

## Code

::::tabs
:::tab[SAS]
```sas
/* Everything at once: counts, tests, and all three effect measures */
proc freq data=resp order=data;
  tables trtp * resp / chisq riskdiff relrisk nocol nopercent;
  exact fisher;
run;

/* Stratified: CMH plus the Breslow-Day homogeneity test */
proc freq data=resp order=data;
  tables sbpgr1n * trtp * resp / cmh nocol nopercent;
run;
```

:::lines
2: `order=data` makes SAS use the order the levels appear in the dataset rather than alphabetical order. Without it, the risk difference may be computed in the opposite direction — and the number will look perfectly reasonable with the wrong sign.
3: `riskdiff` gives the risk difference with its CI; `relrisk` gives both the relative risk and the odds ratio. `chisq` produces Pearson, likelihood-ratio and continuity-adjusted chi-square in one table.
4: `exact fisher` requests Fisher's exact test. On a large table this can be slow; `exact fisher / maxtime=60` caps the computation.
9: **The three-way syntax `stratum * row * col` is the key to CMH.** The *first* variable is the stratification variable, and the last two form the 2×2 table within each stratum. Getting this order wrong silently analyses a different question. `cmh` also prints the Breslow–Day test of whether the odds ratios are homogeneous across strata.
:::
:::

:::tab[R]
```r
tab <- table(w12$TRTP, w12$RESP)

chisq.test(tab, correct = FALSE)   # Pearson
chisq.test(tab)                    # WITH Yates — R's DEFAULT for 2x2
fisher.test(tab)

chisq.test(tab, correct = FALSE)$expected   # always check these

# Effect measures, written out so each term is visible
a <- tab[1,1]; b <- tab[1,2]; c <- tab[2,1]; d <- tab[2,2]
p1 <- a / (a + b); p0 <- c / (c + d)

rd  <- p1 - p0
se  <- sqrt(p1 * (1 - p1) / (a + b) + p0 * (1 - p0) / (c + d))
c(rd, rd - 1.96 * se, rd + 1.96 * se)

or     <- (a * d) / (b * c)
se_lor <- sqrt(1/a + 1/b + 1/c + 1/d)
c(or, exp(log(or) - 1.96 * se_lor), exp(log(or) + 1.96 * se_lor))

# Stratified
mantelhaen.test(table(w12$TRTP, w12$RESP, w12$SBPGR1N), correct = FALSE)
```

:::lines
4: `chisq.test()` applies **Yates' continuity correction by default** for 2×2 tables. SAS does not. This single default difference produced p = 0.00071 versus 0.00039 on the table above — always pass `correct = FALSE` explicitly if you are matching SAS.
7: Print the expected counts before trusting the test. If any are below 5, switch to Fisher — and note that R will also warn you, which is a warning worth never suppressing.
20: The odds-ratio CI is computed on the log scale and exponentiated, which is why the result is asymmetric around the point estimate.
22: `mantelhaen.test()` expects the **stratum as the third dimension** of the array. `table(row, col, stratum)` builds it in that order. Getting the dimension order wrong produces a plausible number from the wrong analysis.
:::
:::

:::tab[Python]
```python
import numpy as np
from scipy import stats
from statsmodels.stats.contingency_tables import Table2x2, StratifiedTable

tab = np.array([[43, 37], [20, 57]])

stats.chi2_contingency(tab, correction=False)
stats.chi2_contingency(tab)          # correction=True is the DEFAULT
stats.fisher_exact(tab)

t = Table2x2(tab)
t.riskratio, t.riskratio_confint()
t.oddsratio, t.oddsratio_confint()
t.summary()

# Stratified
StratifiedTable([tab_stratum1, tab_stratum2]).test_null_odds()
```

:::lines
7: SciPy's `chi2_contingency` also defaults to `correction=True` for 2×2. Three languages, and the only one that does *not* apply Yates by default is SAS.
11: `Table2x2` from statsmodels gives all the effect measures with intervals in one object — `summary()` prints a compact table that is a good QC cross-check against PROC FREQ.
16: `StratifiedTable` is the statsmodels equivalent of CMH, with `test_null_odds()` for the test and `test_equal_odds()` for the Breslow–Day homogeneity check.
:::
:::
::::

## Output

```text
                              The FREQ Procedure

                    Table of trtp by resp

trtp             resp
Frequency    |Y       |N       |  Total
-------------+--------+--------+
VTX-221 20 mg|     43 |     37 |     80
             |  53.75 |  46.25 |
-------------+--------+--------+
Placebo      |     20 |     57 |     77
             |  25.97 |  74.03 |
-------------+--------+--------+
Total              63       94      157

Statistic                     DF       Value      Prob
------------------------------------------------------
Chi-Square                     1     12.5992    0.0004
Continuity Adj. Chi-Square     1     11.4245    0.0007
Likelihood Ratio Chi-Square    1     12.8248    0.0003
Fisher's Exact Test (2-sided)                   0.0006

Column 1 Risk Estimates
                    Risk    ASE    95% Confidence Limits
Row 1             0.5375  0.0558      0.4282      0.6468
Row 2             0.2597  0.0500      0.1618      0.3577
Difference        0.2778  0.0749      0.1310      0.4245

Estimates of the Relative Risk (Row1/Row2)
Type of Study               Value    95% Confidence Limits
Case-Control (Odds Ratio)  3.3122      1.6901      6.4908
Cohort (Col1 Risk)         2.0694      1.3483      3.1760
```

:::mistake[Reading the "Case-Control (Odds Ratio)" row as a relative risk]
SAS labels the odds ratio under "Case-Control" and the relative risk under "Cohort", which reflects the study designs each measure is natural for — and confuses nearly everyone the first time. This is a **randomized cohort**, so the relative risk row (2.0694) is the one describing how much more likely control was. The odds ratio row (3.3122) is the right measure only if the SAP asks for it, typically because a logistic model will be fitted. Pulling 3.3122 into a table labelled "relative risk" is a real and common QC finding.
:::

## Interpretation

> At Week 12, 43/80 subjects (53.8%) on VTX-221 20 mg had controlled blood pressure (SBP < 140 mmHg) compared with 20/77 (26.0%) on placebo — a difference of 27.8 percentage points (95% CI 13.1 to 42.5; CMH p = 0.0002, stratified by baseline BP group). The relative risk was 2.07 (95% CI 1.35 to 3.18).

:::clinical
The risk difference is the number a clinician can act on: treating 100 patients with 20 mg instead of placebo produces about 28 additional patients at goal, or roughly one in every four treated. The NNT of 3.6 makes that concrete. The relative risk says something different and equally real — a patient's chance of reaching goal roughly doubles — but relative measures can be misleading when the baseline risk is low, which is why regulators and guideline committees generally want the absolute difference alongside. The odds ratio of 3.3 should not appear in patient-facing material at all; nobody outside statistics reasons in odds.
:::

## Common mistakes

:::mistake[Letting the software choose the continuity correction]
R and SciPy apply Yates by default for 2×2 tables; SAS does not. On the table above that is p = 0.00071 versus p = 0.00039. Pre-specify, and write the argument explicitly in every program.
:::

:::mistake[Using chi-square with small expected counts]
The approximation degrades when expected counts fall below about 5. Check `$expected` (R) or the SAS warning before trusting the p-value. With 3 SAEs versus 1 the expected counts were 1.98 and 2.02 — use Fisher, and better still, report the counts and stop.
:::

:::mistake[Ignoring the randomization strata]
If subjects were randomized within strata, the analysis should respect them. Ignoring them wastes precision and, when strata differ in event rate, can bias the estimate. Here it cost a factor of two in the p-value and slightly understated the odds ratio.
:::

:::mistake[Quoting the Mantel–Haenszel common OR when the strata disagree]
CMH assumes a common odds ratio. When one stratum shows OR = 0.6 and another OR = 4.0, the pooled estimate summarises nothing. Look at the stratum-specific estimates before quoting the common one, and treat the Breslow–Day test as a weak check rather than a decision rule — it has poor power in exactly the situations that matter.
:::

:::mistake[Treating the p-value as the deliverable]
A 2×2 table's message is the effect measure and its interval. Report the counts, the percentages with their denominator stated, the difference with a CI, and the test last. A p-value with no effect size is not a result.
:::

## Knowledge check

::quiz{ids="stats.ct.or-vs-rr,stats.ct.expected-counts,stats.ct.yates-default,stats.ct.cmh-why"}

## Hands-on exercise

::practice{ids="stats.ct.chisq-hand,stats.ct.risk-difference,stats.ct.odds-ratio-ci,stats.ct.r-code" title="Practice: computing tests and effect measures from a 2×2"}

## Challenge exercise

::practice{ids="stats.ct.denominator-qc,stats.ct.sas-relrisk-row,stats.ct.safety-open" title="Challenge: denominators, mislabelled rows and safety judgement"}

## Industry note

**Which measure does a SAP specify?** For a randomized trial with a binary endpoint, the risk difference with a CI is the most interpretable and the most commonly pre-specified primary measure. Odds ratios appear when a logistic model is used for covariate adjustment, because that is the scale logistic regression works on. Relative risks appear in labelling and in benefit-risk discussion. Many SAPs ask for more than one — but they say which is primary.

**Stratified analyses are near-universal in confirmatory trials.** If a trial randomizes with stratification, the primary analysis almost always adjusts for the same strata — CMH for binary endpoints, stratified log-rank for time-to-event, ANCOVA including the stratification factors for continuous. The principle is that the analysis should reflect the design.

:::standard{kind="official"}
ICH E9 §5.7 addresses this directly: factors used for stratification in the randomization should generally be accounted for in the analysis. The guidance states the principle rather than prescribing CMH specifically — the method follows from the endpoint type.
:::

**Stratification variables come from the randomization system, not the CRF.** A subject can be randomized into the "SBP ≥ 150" stratum and later have a corrected baseline that puts them below 150. The primary analysis uses the value **as randomized** (`STRAT1R` in this study's ADSL), because that is what defined the randomization; the CRF value goes into a sensitivity analysis. This trial has 3 such subjects, and getting that rule right is exactly the sort of detail that distinguishes a programmer who reads the SAP from one who reads the data.

:::interview[When would you use Fisher's exact test instead of chi-square?]
The short answer is small expected counts — but the good answer keeps going.

First the rule: when expected cell counts fall below about 5, the chi-square approximation to a discrete distribution degrades, and Fisher's test computes the exact conditional probability instead. Say "expected", not "observed" — people get this backwards, and it is the observed margins that determine the expected counts.

Then the honest caveats, which is what separates candidates. Fisher's test conditions on both margins being fixed, which is genuinely true in very few designs — in a randomized trial the column totals are not fixed by design. That conditioning makes it **conservative**: its actual type I error is below the nominal level, sometimes well below, so it is not simply "the more accurate version". There is a long methodological argument about whether that conservatism is a price worth paying, and knowing the argument exists is more valuable than having a side.

And the practical point: with 3 events versus 1, no test will establish anything. The right output is the counts, an exact confidence interval on each rate, and a sentence saying the study cannot address this question. Reaching for a test at all is sometimes the mistake.
:::
