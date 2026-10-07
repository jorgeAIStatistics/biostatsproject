## What problem are we trying to solve?

VTX221-201 is a dose-ranging hypertension study: 270 subjects randomized 1:1:1 to placebo, VTX-221 10 mg and VTX-221 20 mg, primary endpoint the change from baseline in seated systolic blood pressure at Week 12.

The observed mean change at Week 12 looks decisive:

| Arm | n | Mean change (SD) |
|---|---:|---|
| Placebo | 77 | −3.30 (11.61) |
| VTX-221 10 mg | 81 | −8.83 (11.48) |
| VTX-221 20 mg | 80 | −12.28 (11.50) |

Except that 270 subjects were randomized and those three columns add to 238. Thirty-two subjects have no Week 12 blood pressure, and **they did not drop out at random**.

Here is what those subjects looked like at Week 2, before anyone left:

| Arm | Later had a Week 12 value | Did not | Difference |
|---|---:|---:|---:|
| Placebo | n = 75, **−2.71** | n = 12, **+2.98** | 5.69 |
| VTX-221 10 mg | n = 77, −5.69 | n = 8, −5.95 | −0.26 |
| VTX-221 20 mg | n = 77, −8.04 | n = 8, −6.20 | 1.84 |

**On placebo, the subjects who left were the ones whose blood pressure was going up.** Their Week 2 change averaged +2.98 mmHg while the subjects who stayed averaged −2.71. On active treatment the two groups are indistinguishable.

So the placebo column of that table is not "the placebo effect". It is the placebo effect **among placebo subjects who responded well enough to stay in the study** — and because the comparison is against that column, every treatment difference in the table is too small.

`CHG` is two characters of arithmetic. Everything difficult about change from baseline is what happens after you compute it.

:::number[Where these numbers come from]
Computed from `data/cardio/advs.csv`: `PARAMCD == "SYSBP"`, `ANL01FL == "Y"`. The Week 12 row uses `AVISITN == 12`; the completer comparison takes `AVISITN == 2` records and splits them on whether the subject also has an `AVISITN == 12` record.

The dropout mechanism is built into the study: the chance of stopping for lack of efficacy after Week 2 rises with the last *observed* systolic pressure, and placebo subjects have higher pressures. That is missing at random — the missingness depends on observed data — which is exactly the condition under which a model using the pre-dropout visits can recover the right answer and a complete-case analysis cannot.
:::

## Intuition

`CHG = AVAL − BASE` is subtraction. The three questions that make it hard are:

**Which rows get one?** Not the baseline record, in most conventions. Not records where `BASE` is missing.

**What is the denominator of the summary?** Subjects with a value at that visit — which is not the randomized population, and shrinks over time.

**What does the mean of it actually estimate?** A mean change at Week 12 estimates the mean change *among subjects observed at Week 12*. If who is observed depends on how they were doing, that is a different quantity from the one the protocol asked about.

:::why[Why not just report the mean value at Week 12 instead of the change?]
You can, and it is a legitimate analysis — but it throws away information and it is more variable.

On these data the three analyses of the same 238 subjects give:

| Analysis | 10 mg − placebo (SE) | 20 mg − placebo (SE) |
|---|---:|---:|
| Week 12 value only (`AVAL ~ TRTP`) | −3.88 (1.735) | −6.83 (1.741) |
| Change score, unadjusted (`CHG ~ TRTP`) | −5.53 (1.835) | −8.98 (1.841) |
| ANCOVA (`CHG ~ TRTP + BASE`) | −4.56 (1.639) | −7.72 (1.648) |

Three different point estimates and three different standard errors, from the same subjects. **The change score is not automatically better than the raw value** — here it has the *largest* standard error of the three, because subtracting a noisy baseline adds its variance.

The ANCOVA is smallest because it uses baseline as a covariate rather than subtracting it, which lets the model choose how much weight baseline deserves. On these data the fitted baseline coefficient is −0.587, not −1, so a pure change score over-corrects.

`CHG` still belongs in the dataset. It is what the shells display and what clinicians read. But the *analysis* of change is a modelling decision, and storing `CHG` does not make it one.
:::

## Clinical context

The two derived variables and the rules around them:

| Variable | Definition | Null when |
|---|---|---|
| `CHG` | `AVAL − BASE` | on the baseline record; when `BASE` is missing; when `AVAL` is missing |
| `PCHG` | `100 × (AVAL − BASE) / BASE` | the same, plus when `BASE = 0` |

:::standard{kind=official}
ADaMIG v1.3 defines `CHG` as the change from baseline, `AVAL − BASE`, and `PCHG` as the percent change from baseline, `100 × (AVAL − BASE) / BASE`. Both are permissible BDS variables and both are derived from `AVAL` and `BASE` on the same record.
:::

:::standard{kind=convention}
**Whether `CHG` is null or zero on the baseline record is a sponsor convention**, not a standard. ADaMIG v1.3 does not mandate either.

CBX417-301 and VTX221-201 both use null. Verified: no record with `ABLFL = "Y"` has a non-missing `CHG` in either study.

The argument for null: the baseline record is not a change, and including a column of exact zeros in a summary of change deflates the standard deviation and inflates the n. The argument for zero: a figure of mean change over time wants a point at zero on the baseline visit, and null forces the plotting program to add it.

Either is defensible. **Not knowing which your study uses is not**, because `n` at the baseline visit differs by the whole population between the two.
:::

## Formal concept

### The percent-change trap

Percent change has a denominator, and the denominator is a measured quantity with its own error. That produces three problems that a plain change does not have.

**It is unbounded above and bounded below.** A value can rise by 5,000%; it can only fall by 100%. On CBX417-301's ALT the observed range of `PCHG` is −47% to **+5,477%**.

:::number[The +5,477%]
Subject `CBX417-301-1029-0001`: baseline ALT 26 U/L, Cycle 3 Day 1 value 1,450 U/L. That is `CHG = 1424` and `PCHG = 5476.92`.

It is a real grade 4 hepatotoxicity — the upper limit of normal is 50 U/L — and it should be in the dataset and in the listings. What it should not be is 1 of 147 values entering a mean.

**Mean against median at Cycle 4 Day 1, CBX-417 arm:**

| Statistic | `CHG` | `PCHG` |
|---|---:|---:|
| Mean | 5.34 | 26.74 |
| Median | 2 | 10 |

The mean percent change is 2.7 times the median. The mean change is 2.7 times its median too — but "5.34 U/L" is a quantity a clinician can size against a normal range of 10–50, and "26.7%" reads as though a typical subject's ALT rose by a quarter, which is not what happened.
:::

**Small baselines explode.** `PCHG` is most extreme exactly where `BASE` is smallest, so the parameters with the widest percent changes are the ones whose baselines sit near zero. CBX417-301's neutrophils range from −99.8% to +98.2%, and the −99.8% is a baseline of 8.50 falling to 0.02 — clinically enormous, and the percent scale happens to represent it well. ALT's +5,477% comes from a baseline of 26. The scale is not comparable between parameters.

**A zero baseline is undefined.** `PCHG` must be null when `BASE = 0`. On CBX417-301 no laboratory baseline is zero, but a tumor-size dataset for a subject with no measurable disease, or a count that legitimately reaches zero, will produce one.

:::why[So when is percent change the right variable?]
When the quantity is naturally multiplicative and the baseline is bounded away from zero.

**Tumor size is the clearest case.** RECIST defines response in percentage terms — a 30% decrease in the sum of diameters is a partial response — because a 10 mm shrinkage means something completely different in a 20 mm lesion and a 200 mm one. CBX417-301's ADTR carries `BPCHG`, best percent change from baseline in sum of diameters, as a parameter in its own right, and the waterfall plot is built from it.

**Blood pressure is the clearest counter-case.** A 10 mmHg reduction has the same clinical meaning at 150 and at 170, and the guidelines are stated in absolute terms. VTX221-201 populates `PCHG`, and nothing in the SAP uses it.

The test is whether the clinical statement you want to make has a percent in it. If the guideline, the endpoint definition or the response criterion is written as a percentage, use `PCHG`. If it is written in the measurement's own units, use `CHG` and leave `PCHG` for the listings.
:::

### Shift tables — change as a category

Not all change is arithmetic. A shift table cross-tabulates the baseline category against the worst post-baseline category, and it exists because a clinician cares whether a subject *crossed a threshold*, not by how much a number moved.

This is why `BNRIND` and `BTOXGR` are broadcast onto every record. Both categories sit on the same row, so the table is a cross-tabulation with no join:

```text
ALT, CBX-417 + docetaxel, on-treatment records, 203 subjects with a grade

                   Worst post-baseline grade
Baseline grade      0     1     2     3     4
        0         166    20     5     9     3
```

Every subject in this arm with an ALT grade had a normal baseline, and 12 of 203 reached grade 3 or 4.

:::number[Why 203 and not 209?]
209 subjects received CBX-417. This table counts subjects with at least one **on-treatment** ALT record carrying a grade — `ONTRTFL = "Y"`, which SAP Section 10.3.2 defines as `TRTSDT < ADT ≤ TRTEDT + 30`.

Six subjects have no such record: they were dosed but have no post-baseline ALT inside the treatment window. They belong in the table's "missing post-baseline" category, not in the 203 — and a shift table that silently drops them has a denominator nobody can reconstruct.

**The worst grade is computed at reporting time**, not stored: `max(ATOXGRN)` over the subject's `ONTRTFL = "Y"` records. The ADRG says so explicitly, which is what makes it a documented choice rather than a gap.
:::

## Worked example

The primary analysis of VTX221-201, and the reason it is not the table from the opening.

```r
library(dplyr)

w12 <- advs |> filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12)

fit <- lm(CHG ~ TRTP + BASE, data = w12)
summary(fit)$coefficients
```

```text
                    Estimate Std. Error t value  Pr(>|t|)
(Intercept)       83.8333281 11.1190700   7.540 1.032e-12
TRTPVTX-221 10 mg -4.5590948  1.6393906  -2.781 5.861e-03
TRTPVTX-221 20 mg -7.7151784  1.6475319  -4.683 4.795e-06
BASE              -0.5866025  0.0744403  -7.880 1.230e-13
```

**The least-squares means**, evaluated at the analysis set's mean baseline of 149.82 mmHg:

| Arm | n | LS mean change (SE) | 95% CI |
|---|---:|---|---|
| Placebo | 77 | −4.05 (1.174) | −6.37 to −1.74 |
| VTX-221 10 mg | 81 | −8.61 (1.142) | −10.86 to −6.36 |
| VTX-221 20 mg | 80 | −11.77 (1.150) | −14.03 to −9.50 |

Compare the LS mean for placebo, **−4.05**, with the observed mean of **−3.30**. Adjusting for baseline moved it, because the placebo arm's completers had slightly different baselines from the other arms'.

:::why[The ANCOVA still uses 238 subjects. Has anything been fixed?]
No — and this is the point that separates the two problems.

ANCOVA fixes the *baseline imbalance* problem: the arms had different mean baselines among completers, and adjusting removes that. It does nothing at all about the *missingness* problem, because it never sees the 32 subjects with no Week 12 value.

The SAP's primary analysis is therefore an MMRM over all post-baseline visits, with the complete-case ANCOVA as a supportive analysis. The MMRM uses the Week 2, 4 and 8 records of subjects who later dropped out, which under a missing-at-random assumption recovers what their Week 12 value would have been:

| Comparison at Week 12 | Complete-case ANCOVA (SE) | MMRM (SE) |
|---|---:|---:|
| VTX-221 10 mg − placebo | −4.56 (1.639) | −5.42 (1.625) |
| VTX-221 20 mg − placebo | −7.72 (1.648) | −8.35 (1.631) |

**Both treatment effects get larger under the MMRM**, and the direction is predictable from the dropout table at the top of this lesson: placebo dropouts were doing badly, so excluding them made placebo look better, which shrank every difference measured against it.

`CHG` is the same variable in both analyses. The dataset does not and cannot decide this — which is why "change from baseline" names a variable and an analysis, and they are not the same thing.
:::

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,PARAMCD,AVISIT,AVISITN,ADY,AVAL,BASE,CHG,PCHG,ABLFL,ANL01FL" rows="10" caption="VTX221-201 ADVS — CHG null on the baseline and screening records"}

Note two things in the extract:

**`CHG` is null on the screening record.** Screening precedes baseline, so its `BASE` is a value measured *later* and a "change" from it would be a change backwards in time. VTX221-201 leaves it null; ADaM does not require this, and studies differ.

**`CHG` is null on the baseline record itself.** Verified: zero records with `ABLFL = "Y"` have a non-missing `CHG` in either study.

::widget{name="tlf" id="t-lab-chg"}

## Code

::::tabs
:::tab[SAS]
```sas
data advs;
  set advs_base;
  if not missing(base) and not missing(aval) then do;
    if ablfl ne 'Y' then chg = aval - base;
    if ablfl ne 'Y' and base ne 0 then pchg = 100 * (aval - base) / base;
  end;
run;

proc mixed data=advs method=reml;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn > 0;
  class usubjid trtp avisit;
  model chg = trtp avisit trtp*avisit base base*avisit / ddfm=kr;
  repeated avisit / subject=usubjid type=un;
  lsmeans trtp*avisit / diff cl;
run;
```

:::lines
3: **Both operands checked before the arithmetic.** In SAS a missing value propagates silently through subtraction, so `chg` would be missing anyway — but writing the condition makes the intent explicit and stops `pchg` dividing by a missing baseline.
4: `ablfl ne 'Y'` implements this study's convention that the baseline record has no change. Change it to always compute and you get a column of exact zeros in the baseline row of every summary.
5: The extra `base ne 0` guard. A zero denominator is the one case where `PCHG` must be null rather than infinite.
12: The MMRM: treatment, visit, their interaction, and baseline interacted with visit. `ddfm=kr` is the Kenward–Roger denominator degrees of freedom, which most SAPs specify for an unstructured covariance.
13: `type=un` — an unstructured covariance, a separate variance at each visit and a free correlation for every pair. It is the least restrictive choice and the one that makes the missing-at-random argument work.
14: `lsmeans` with `diff cl` produces the treatment differences at each visit with confidence limits.
:::
:::

:::tab[R]
```r
library(dplyr); library(nlme)

advs <- advs_base |>
  mutate(
    CHG  = if_else(!is.na(ABLFL) | is.na(BASE), NA_real_, AVAL - BASE),
    PCHG = if_else(!is.na(ABLFL) | is.na(BASE) | BASE == 0, NA_real_,
                   100 * (AVAL - BASE) / BASE)
  )

pb <- advs |>
  filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN > 0) |>
  mutate(AVISIT = factor(AVISITN))

mm <- gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, data = pb,
          correlation = corSymm(form = ~ as.integer(AVISIT) | USUBJID),
          weights     = varIdent(form = ~ 1 | AVISIT),
          method      = "REML")
```

:::lines
5: `!is.na(ABLFL)` is the baseline-record test. `ABLFL` is `"Y"` or null, never `"N"`, so `== "N"` would never be true and every record would get a change.
6-7: The three `PCHG` guards in one condition: not the baseline record, `BASE` not missing, `BASE` not zero.
12: `factor(AVISITN)` rather than `factor(AVISIT)`. The numeric variable orders the levels correctly; the character one would order Week 12 before Week 2.
14-16: The MMRM. `corSymm` is a free correlation for every pair of visits and `varIdent` a separate variance per visit — together, the unstructured covariance that `type=un` gives in SAS.
17: `method = "REML"`, matching `PROC MIXED`'s default. `nlme` does not offer Kenward–Roger degrees of freedom, so its intervals are slightly narrower than the SAS ones — a known and expected cross-language difference rather than a discrepancy to chase.
:::
:::
::::

## Output

```text
> pb |> group_by(AVISITN, TRTP) |> summarise(n = n(), mean = mean(CHG), sd = sd(CHG))

  AVISITN TRTP             n   mean    sd
        2 Placebo         87  -1.93  7.86
        2 VTX-221 10 mg   85  -5.72  8.14
        2 VTX-221 20 mg   85  -7.87  6.63
        4 Placebo         84  -3.05  9.83
        4 VTX-221 10 mg   85  -6.71  8.59
        4 VTX-221 20 mg   81 -10.80  8.33
        8 Placebo         82  -3.28 10.22
        8 VTX-221 10 mg   79  -7.88 10.36
        8 VTX-221 20 mg   82 -12.27 10.18
       12 Placebo         77  -3.30 11.61
       12 VTX-221 10 mg   81  -8.83 11.48
       12 VTX-221 20 mg   80 -12.28 11.50
```

## Interpretation

Three things in that table are worth reading carefully.

**The n column falls in every arm**, from 87/85/85 at Week 2 to 77/81/80 at Week 12. Every by-visit summary of change has a different denominator per row, and the shell must print it. A table reporting a single n in the column header is describing a study that did not happen.

**The standard deviation rises with time** — 7.9 to 11.6 on placebo. Subjects diverge as follow-up lengthens, which is why an unstructured covariance with a separate variance per visit is the right model and why compound symmetry, which assumes one variance, would misstate the standard errors.

**The placebo arm shows a change of −3.3 mmHg**, and there is no placebo drug. Part of it is regression to the mean: eligibility required a screening systolic pressure of at least 140, so the enrolled group is enriched for subjects who happened to be measured high that day, and their next measurement drifts back. Screening mean was 151.3 and baseline mean 150.4 — a 0.9 mmHg drop before anyone took a tablet.

**That is the entire argument for a control arm in a change-from-baseline endpoint.** The single-arm statement "systolic pressure fell by 12.3 mmHg on 20 mg" is true and means almost nothing. The comparative statement "8.35 mmHg more than placebo" is the estimate that has a drug in it.

## Common mistakes

:::mistake[Reporting a mean change without the denominator that produced it]
The n behind each cell changes by visit and by arm: 87 at Week 2, 77 at Week 12 on placebo. Without n on the row, a reader cannot tell a stable effect from a shrinking, increasingly selected sample.
:::

:::mistake[Treating a complete-case mean change as the treatment effect]
It is the effect among subjects who were observed. On this study placebo dropouts were rising by +2.98 mmHg at Week 2 while placebo completers were falling by −2.71 — so excluding them flatters placebo and shrinks every difference measured against it. The MMRM moves the 20 mg difference from −7.72 to −8.35.
:::

:::mistake[Computing `CHG` on the baseline record when the study's convention is null]
A column of exact zeros in the baseline row inflates n and deflates the standard deviation. The reverse mistake — nulls where the convention is zero — makes a mean-change figure start at the Week 2 visit instead of at zero. Either convention is fine; not knowing which your study uses is not.
:::

:::mistake[Using `!= "N"` to test a record-level flag]
`ABLFL` takes `"Y"` or null. `ABLFL != "N"` is true for both, so every record gets a change including the baseline record. Record-level flags are tested with `== "Y"` or `is.na()`, never with a negation against `"N"`.
:::

:::mistake[Averaging percent change]
`PCHG` is unbounded above and bounded at −100% below, so its mean is dominated by a handful of large rises. CBX417-301's ALT at Cycle 4: mean `PCHG` 26.7%, median 10%. Report the median, or report `CHG`, or report both — and never let a mean percent change stand alone.
:::

:::mistake[Forgetting the zero-denominator guard on `PCHG`]
`BASE = 0` makes the percent change undefined. No laboratory baseline in this study is zero, but a tumor-size or count parameter will produce one, and an infinity in a dataset propagates into every summary that touches it.
:::

## Knowledge check

::quiz{ids="adam.chg.baseline-row,adam.chg.denominator,adam.chg.pchg-trap,adam.chg.ancova-vs-mmrm"}

## Hands-on exercise

::practice{ids="adam.chg.derive-code,adam.chg.flag-negation,adam.chg.completer-bias,adam.chg.shift-table" title="Practice: change, its denominators and what it estimates"}

## Challenge exercise

::practice{ids="adam.chg.missing-baseline,adam.chg.open-completer" title="Challenge: the placebo arm that looks better than it is"}

## Industry note

**`CHG` belongs in the dataset even when the analysis does not use it.** The shells display mean change by visit, the figures plot it, and clinicians read it. Storing it makes those outputs filters rather than derivations. What storing it does *not* do is decide the analysis — a stored `CHG` feeds an ANCOVA, an MMRM and a listing equally well.

**Baseline imbalance and missing data are different problems with different fixes.** Adjusting for baseline handles the first; it does nothing for the second. A SAP that specifies ANCOVA on completers as the primary analysis of a longitudinal endpoint has answered one of the two questions.

:::standard{kind=official}
The ICH E9(R1) addendum on estimands and sensitivity analysis requires the treatment effect to be defined precisely — including how intercurrent events such as treatment discontinuation are handled — before the analysis method is chosen. Under that framework, "complete-case mean change at Week 12" and "mean change at Week 12 had subjects remained on treatment" are different estimands, not two ways of estimating one thing.
:::

**Interviewers ask "what does a mean change from baseline mean" because the honest answer has a denominator in it.** "The average improvement" is the answer of someone who has not looked at who is in the table. "The average change among subjects still observed at that visit, which on my study differed systematically from the subjects who left" is the answer of someone who has.

:::interview[Your Week 12 change-from-baseline table shows a 12 mmHg reduction on active drug and 3 mmHg on placebo. What questions do you ask before believing it?]
"Three, and the first one is about who is in the table.

**How many of the randomized subjects are in each cell, and how did the others differ?** On the study I worked with, 270 were randomized and 238 had a Week 12 value. That's not a rounding issue — the 32 missing subjects broke down by arm in a way that matters. Splitting the Week 2 records on whether the subject later had a Week 12 value, placebo subjects who dropped out were at **+2.98** mmHg at Week 2 while those who stayed were at **−2.71**. On active drug the two groups were indistinguishable. So the placebo column isn't the placebo effect — it's the placebo effect among subjects who were doing well enough to stay, and because every difference is measured against that column, every treatment effect in the table is too small.

That's a missing-at-random mechanism, which is the condition under which an MMRM over all post-baseline visits can recover the right answer using the pre-dropout data. On these data it moves the 20 mg difference from −7.72 to −8.35.

**Second: is that 3 mmHg on placebo real?** Partly regression to the mean. Eligibility required a screening pressure of at least 140, so the enrolled group is enriched for people measured high that day, and their next reading drifts back. Screening mean 151.3, baseline mean 150.4 — nearly a millimetre lost before anyone took a tablet. Which is exactly why the single-arm statement is useless and the comparison to control is the estimate.

**Third: was baseline adjusted for, and is that the same question as the missing data?** It isn't. ANCOVA fixes baseline imbalance between the arms; it doesn't touch the missingness, because it never sees the subjects who left. A SAP that specifies complete-case ANCOVA as the primary analysis of a longitudinal endpoint has answered one of the two questions.

And I'd want to know what the estimand is. Under E9(R1), 'mean change among subjects still on treatment at Week 12' and 'mean change had everyone remained on treatment' are different targets, not two estimators of one target. The table can't tell you which one it is."
:::
