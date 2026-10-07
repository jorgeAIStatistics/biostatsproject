## What problem are we trying to solve?

You have ADTTE and you need a Kaplan–Meier curve, a log-rank test and a hazard ratio. In R that is three function calls.

Before any of them, one line decides whether your entire analysis is right:

```r
pfs$event <- 1 - pfs$CNSR
```

**On the CBX417-301 data that line produces negative values on 52 rows**, and `Surv()` responds with a warning you will probably not read:

```text
Warning message:
In Surv(AVAL, event) : Invalid status value, converted to NA
```

Fifty-two subjects silently dropped. The curves still render. The hazard ratio still computes. Every number is wrong.

The correct line is `as.integer(pfs$CNSR == 0)`, and the reason is that **ADaM's censoring convention is the opposite of R's** — and ADaM allows `CNSR` values above 1 to record *why* a subject was censored.

This lesson is the survival package as a clinical programmer needs it: the CNSR conversion, the ties argument that differs between SAS and R, and the proportional-hazards check that decides whether a hazard ratio means anything.

## Intuition

Survival analysis exists because of one problem: **you do not observe everyone's event.**

Some subjects have not progressed by the data cut-off. Some started a new therapy. Some were lost. You know their event time is *greater than* what you observed, and nothing more. Throwing them away wastes information and biases the result; treating their last observation as an event is worse.

Censoring is how you use what they told you. A subject censored at 8 months contributes to the risk set for 8 months and then leaves — they inform every estimate up to that point and none after.

:::why[Why does this make the median more reliable than the mean?]
The mean survival time requires knowing everyone's event time, which you do not. It can only be estimated by assuming something about the tail — an exponential decay, or a truncation at the last observed time — and the answer depends heavily on that assumption.

The **median** needs only the point where the curve crosses 0.5, which is usually well inside the observed follow-up. That is why oncology reports medians and almost never means.

And when the curve never reaches 0.5 — fewer than half the subjects have had events — **the median is not estimable**. `survfit` returns `NA`, correctly. A trial reporting "median not reached" is stating a fact about follow-up, and it is a good sign for the drug.
:::

## Clinical context

| Task | Function |
|---|---|
| Kaplan–Meier curve and medians | `survfit()` |
| Log-rank test, stratified or not | `survdiff()` |
| Hazard ratio with covariates and strata | `coxph()` |
| Proportional-hazards check | `cox.zph()` |
| Survival probability at a fixed time | `summary(fit, times = ...)` |

**These four cover almost every time-to-event analysis in a CSR.** Parametric models appear mainly in health-economic extrapolation; the confirmatory analysis is nearly always KM, stratified log-rank and Cox.

## Formal concept

### The `Surv()` object

```r
Surv(time, event)
```

`event` must be `1` for an event and `0` for censored — **or** `TRUE`/`FALSE`, **or** a factor where the second level is the event. Anything else becomes `NA` with a warning.

:::number[Why does `1 - CNSR` fail on this study specifically?]
Because ADaM permits `CNSR` values greater than 1 to distinguish **censoring reasons**. In CBX417-301:

| `CNSR` | Meaning | n |
|---:|---|---:|
| 0 | Event (progression or death) | 332 |
| 1 | No PD or death by cut-off | 36 |
| 2 | No adequate post-baseline assessment | 9 |
| 3 | New anticancer therapy before PD | 28 |
| 4 | PD or death after ≥2 missed assessments | 15 |

`1 - CNSR` gives `-1`, `-2` and `-3` for the 52 subjects with `CNSR` above 1. `Surv()` rejects them and sets them to `NA`, and those subjects vanish from the analysis.

**`CNSR == 0` is correct for every study**, including ones that only use 0 and 1. It is not a special case — it is the definition. `1 - CNSR` happens to work when only 0 and 1 appear, which is exactly why the habit survives until it meets a study like this one.
:::

### `survfit()` — Kaplan–Meier

```r
fit <- survfit(Surv(AVAL, event) ~ TRTP, data = pfs, conf.type = "log-log")
summary(fit)$table
```

**`conf.type` matters and the default is not what most SAPs specify.** R's default is `"log"`; SAS `PROC LIFETEST` defaults to `"log-log"`, and most SAPs specify log-log because it keeps the confidence limits inside [0, 1].

The `summary(fit)$table` gives records, events, median and the median's confidence limits — the row of a KM summary table.

For survival at a specific timepoint:

```r
summary(fit, times = c(6, 12))$surv
```

### `survdiff()` — log-rank

```r
survdiff(Surv(AVAL, event) ~ TRTP + strata(STRAT1R, STRAT2R), data = pfs)
```

`strata()` inside the formula makes it a **stratified** log-rank, which is what a trial with stratified randomization requires.

`survdiff` reports a chi-square but no p-value column; compute it with `pchisq(sd$chisq, df, lower.tail = FALSE)`.

:::mistake[Adding a stratification factor as a covariate instead of a stratum]
```r
survdiff(Surv(AVAL, event) ~ TRTP + STRAT1R, ...)   # WRONG
survdiff(Surv(AVAL, event) ~ TRTP + strata(STRAT1R), ...)  # stratified
```

Without `strata()`, `survdiff` treats the combination of treatment and stratum as a **single grouping variable** and tests whether all the resulting groups differ — a completely different hypothesis with more degrees of freedom.

The symptom is a df greater than 1 in the output. A two-arm stratified log-rank has **1** degree of freedom no matter how many strata there are.
:::

### `coxph()` — hazard ratios, and the ties argument

```r
coxph(Surv(AVAL, event) ~ TRTP + strata(STRAT1R, STRAT2R),
      data = pfs, ties = "efron")
```

When two subjects have the same event time, the partial likelihood has no exact closed form and an approximation is needed:

| Method | Default in | Notes |
|---|---|---|
| **Efron** | **R `coxph`** | More accurate with many ties |
| **Breslow** | **SAS `PROC PHREG`** | Simpler, slightly biased toward the null with heavy ties |
| Exact | neither | Computationally expensive, rarely used |

:::number[How much do the two differ on real data?]
On CBX417-301's PFS analysis:

$$
\text{Efron: } \widehat{\text{HR}} = 1.469320
\qquad
\text{Breslow: } \widehat{\text{HR}} = 1.460700
$$

A difference of 0.0086 — in the **third decimal**, which is small enough to be invisible in a rounded table and large enough to fail a QC comparison that checks four decimals.

**This is a cross-language QC discrepancy waiting to happen**, and neither program is wrong. The SAP should name the method. If production is SAS and QC is R, one of them must pass `ties=` explicitly.
:::

### Which direction is the hazard ratio?

`coxph` uses the **first factor level as the reference**, and for a character column that is alphabetical. On this study `"CBX-417 + Docetaxel"` sorts before `"Placebo + Docetaxel"`, so the reported HR of **1.469** is *placebo versus CBX*.

The clinically meaningful direction is CBX versus placebo: $1/1.469 = 0.681$.

**Set the reference level deliberately** rather than inverting afterwards:

```r
pfs$TRTP <- relevel(factor(pfs$TRTP), ref = "Placebo + Docetaxel")
```

Then the coefficient reads directly as the experimental arm versus control, and the confidence limits come out the right way round without manual reciprocals.

### `cox.zph()` — checking proportional hazards

A hazard ratio is a single number summarising the whole follow-up. That only means something if the ratio is **constant over time** — the proportional-hazards assumption.

```r
cox.zph(fit)
```

```text
       chisq df    p
TRTP   0.195  1 0.66
GLOBAL 0.195  1 0.66
```

The test is based on **Schoenfeld residuals**: if hazards are proportional, those residuals have no trend against time. A significant result means the ratio changes, and a single HR is then an average of a moving quantity.

:::why[What do you do when proportional hazards fails?]
Not much, and that is the honest answer — which is why the check belongs in the SAP with a pre-specified response rather than as a post-hoc discovery.

The options: report the HR as a time-averaged summary and say so; present the KM curves prominently, since they show the shape the HR hides; or use a measure that does not assume proportionality — **restricted mean survival time** (RMST) compares the area under the curves up to a fixed horizon and is interpretable whether or not hazards are proportional.

This matters most in immuno-oncology, where delayed separation of the curves is common and the PH assumption routinely fails. A trial in that setting that has not pre-specified an alternative is in an awkward position when the check comes back significant.

Here $p = 0.66$, so there is no evidence against proportionality and the hazard ratio is a reasonable summary.
:::

## Worked example

The full PFS analysis, as the SAP would specify it.

```r
library(survival); library(dplyr)

pfs <- adtte |>
  filter(PARAMCD == "PFS") |>
  mutate(
    event = as.integer(CNSR == 0),        # NOT 1 - CNSR
    months = AVAL / 30.4375
  )

stopifnot(all(pfs$event %in% c(0, 1)))    # catch the conversion error

km <- survfit(Surv(months, event) ~ TRTP, data = pfs, conf.type = "log-log")
summary(km)$table[, c("records", "events", "median", "0.95LCL", "0.95UCL")]
```

```text
                         records events median 0.95LCL 0.95UCL
TRTP=CBX-417 + Docetaxel     210    155 6.9322  5.5524  8.2793
TRTP=Placebo + Docetaxel     210    177 4.1725  3.9754  5.4867
```

**Step 1 — `as.integer(CNSR == 0)`.** The conversion that the whole analysis depends on.

**Step 2 — the assertion.** `all(event %in% c(0, 1))` catches a bad conversion immediately rather than letting `Surv()` warn and continue. One line, and it is the difference between a caught error and 52 silently dropped subjects.

**Step 3 — `conf.type = "log-log"`** to match what the SAP specifies and what SAS produces by default.

:::number[Why divide by 30.4375 to get months?]
Because $365.25 / 12 = 30.4375$ — the average month length including the leap-year quarter-day.

ADTTE stores `AVAL` in days (`AVALU = "DAYS"`), and oncology reports medians in months, so the conversion happens at analysis time. **The divisor is a convention** and sponsors differ: 30.4375 is the most common, 30.4167 ($365/12$) and a flat 30 also appear.

That choice moves a median of 6.93 months by about 0.02 — invisible in a rounded table and enough to fail a four-decimal QC comparison. The SAP should state it.
:::

**The hazard ratio and its assumption:**

```r
cox <- coxph(Surv(months, event) ~ TRTP + strata(STRAT1R, STRAT2R),
             data = pfs, ties = "efron")

exp(coef(cox))       # 1.469320  — placebo vs CBX (alphabetical reference)
1 / exp(coef(cox))   # 0.680587  — CBX vs placebo

cox.zph(cox)         # chisq 0.195, p = 0.66 — PH holds
```

## Data example

::dataset{id="oncology/adam/adtte" cols="USUBJID,PARAMCD,AVAL,AVALU,CNSR,EVNTDESC,CNSDTDSC,TRTP,STRAT1R,STRAT2R" rows="8" caption="ADTTE — note CNSR taking values 0 through 4"}

**The censoring breakdown** is the part a textbook never shows:

| `CNSR` | `EVNTDESC` / `CNSDTDSC` | n |
|---:|---|---:|
| 0 | Disease progression or death | **332** |
| 1 | No PD or death (alive, progression-free) | 36 |
| 2 | No baseline or adequate post-baseline assessment | 9 |
| 3 | New anticancer therapy before PD or death | 28 |
| 4 | PD or death after ≥2 missed assessments | 15 |

Four different censoring rules, each with its own date derivation, each specified in the SAP. **Deriving ADTTE takes far longer than fitting the model** — and this table is why.

:::number[Why do rules 3 and 4 exist at all? Those subjects had events.]
Because both new anticancer therapy and a long assessment gap are **informative** — they happen disproportionately to subjects who are doing badly.

A subject who starts a new therapy and progresses two months later: was that progression attributable to the study drug, or to the disease having outrun both? You cannot tell, so the SAP censors at the last assessment before the new therapy and stops following them.

Similarly for rule 4: if a subject missed two scheduled scans and then progressed, the progression may have occurred during the unobserved gap. Counting it at the date it was *detected* would overstate their progression-free time. Censoring at the last adequate assessment is the conservative choice.

**These rules exist to stop the analysis attributing to the drug events that something else caused** — and they are exactly what makes two independent ADTTE derivations disagree.
:::

**Survival probabilities at fixed timepoints**, which is what a KM figure's footnote usually reports:

```r
summary(km, times = c(6, 12))$surv
```

| Arm | 6 months | 12 months |
|---|---:|---:|
| CBX-417 + Docetaxel | 53.7% | 25.7% |
| Placebo + Docetaxel | 34.4% | 15.3% |

## Code

::::tabs
:::tab[SAS]
```sas
proc lifetest data=adtte method=km conftype=loglog
              plots=survival(atrisk=0 to 24 by 3);
  where paramcd = 'PFS';
  time aval * cnsr(1, 2, 3, 4);
  strata trtp;
run;

proc phreg data=adtte;
  where paramcd = 'PFS';
  class trtp (ref='Placebo + Docetaxel');
  model aval * cnsr(1, 2, 3, 4) = trtp / ties=efron rl;
  strata strat1r strat2r;
  assess ph / resample;
run;
```

:::lines
4: **`cnsr(1, 2, 3, 4)` lists every value that means censored.** This is SAS's equivalent of `CNSR == 0`, expressed the other way round — you name the censoring values rather than the event value. Writing only `cnsr(1)` would treat values 2, 3 and 4 as *events*, which is the SAS version of the `1 - CNSR` bug.
5: `STRATA trtp` in `PROC LIFETEST` means "compare these groups" — the opposite of `STRATA` in `PROC PHREG`, where it means "stratify the baseline hazard". The same keyword, two different meanings, in two procedures you use together.
11: `ref=` sets the reference level explicitly. Without it PROC PHREG uses the last level in sort order, which is a different direction from R's first-level default.
12: `ties=efron` to match R. **SAS's default is `BRESLOW`**, so a QC comparison against R needs one side or the other to be explicit.
14: `ASSESS PH / RESAMPLE` is SAS's proportional-hazards check — a simulation-based test, different from `cox.zph`'s Schoenfeld-residual approach. The two will not give identical p-values.
:::
:::

:::tab[R]
```r
library(survival); library(dplyr)

pfs <- adtte |>
  filter(PARAMCD == "PFS") |>
  mutate(event = as.integer(CNSR == 0),
         months = AVAL / 30.4375)

stopifnot(all(pfs$event %in% c(0, 1)))

pfs$TRTP <- relevel(factor(pfs$TRTP), ref = "Placebo + Docetaxel")

km <- survfit(Surv(months, event) ~ TRTP, data = pfs, conf.type = "log-log")

cox <- coxph(Surv(months, event) ~ TRTP + strata(STRAT1R, STRAT2R),
             data = pfs, ties = "efron")

cox.zph(cox)
```

:::lines
5: `as.integer(CNSR == 0)`, never `1 - CNSR`. The latter produces negative values whenever a study uses censoring-reason codes.
8: The assertion. `Surv()` would only warn, and a warning in a long script is a warning nobody reads.
10: Setting the reference level so the hazard ratio reads as experimental versus control. Without it, alphabetical order makes CBX the reference and the HR comes out inverted.
12: `conf.type = "log-log"` — R defaults to `"log"`, SAS to `"log-log"`, and most SAPs specify log-log.
15: `ties = "efron"` is R's default, stated explicitly so the reader does not have to know that.
:::
:::

:::tab[Python]
```python
from lifelines import KaplanMeierFitter, CoxPHFitter
from lifelines.statistics import logrank_test

pfs = adtte.query("PARAMCD == 'PFS'").assign(
    event=lambda d: (d.CNSR == 0).astype(int),
    months=lambda d: d.AVAL / 30.4375,
)

kmf = KaplanMeierFitter().fit(pfs.months, pfs.event)
kmf.median_survival_time_

cph = CoxPHFitter().fit(
    pfs[["months", "event", "TRTPN"]],
    duration_col="months", event_col="event",
)
cph.check_assumptions(pfs[["months", "event", "TRTPN"]])
```

:::lines
5: `(d.CNSR == 0).astype(int)` — the same conversion, the same reason.
13: lifelines uses **Efron** for ties, like R and unlike SAS.
16: `check_assumptions()` is lifelines' proportional-hazards check; it also uses Schoenfeld residuals, so it is closer to `cox.zph` than to SAS's `ASSESS PH`.
:::
:::
::::

## Output

```text
> cox.zph(cox)
       chisq df    p
TRTP   0.195  1 0.66
GLOBAL 0.195  1 0.66
```

:::number[Why are the `TRTP` row and the `GLOBAL` row identical?]
Because the model has only one covariate. `GLOBAL` is a joint test across all covariates, and with a single term the joint test *is* that term's test.

Add a covariate and the rows separate: each term gets its own test of whether its effect is constant over time, plus a global test of whether any of them varies.

**Note what is not in this model:** the stratification factors. `strata()` terms are not tested by `cox.zph`, because stratification does not assume proportionality — each stratum gets its own baseline hazard, and they are free to have any shape. **Stratifying on a variable is itself the fix for that variable violating PH**, which is a useful thing to know when a check comes back significant on a prognostic factor.
:::

## Interpretation

> Median progression-free survival was **6.93 months (95% CI 5.55 to 8.28)** on CBX-417 plus docetaxel and **4.17 months (95% CI 3.98 to 5.49)** on placebo plus docetaxel. The stratified Cox model gave a hazard ratio of **0.681 (95% CI 0.546 to 0.849)** in favour of CBX-417, with a stratified log-rank p-value of **0.00064**. There was no evidence against proportional hazards (p = 0.66).

:::clinical
A hazard ratio of 0.68 means the instantaneous risk of progression is about 32% lower on CBX-417 at any given moment among subjects still at risk. In median terms that is roughly 2.8 additional months before progression.

Whether 2.8 months justifies the toxicity is a clinical judgement, and it is the conversation the design should have anticipated. The confidence interval helps: the data are compatible with anything from a 45% reduction in hazard to a 15% one, and the lower end of that range is a meaningfully smaller benefit than the point estimate suggests.

The 6- and 12-month survival probabilities — 54% versus 34%, and 26% versus 15% — are often more useful to a clinician than the hazard ratio, because they describe what happens to a cohort of patients rather than an instantaneous rate.
:::

## Common mistakes

:::mistake[`1 - CNSR`]
It produces negative values whenever a study uses censoring-reason codes above 1 — 52 subjects in this study. `Surv()` converts them to `NA` with a warning and those subjects disappear. Always `as.integer(CNSR == 0)`, and assert the result is 0/1.
:::

:::mistake[Leaving `ties` to the default in a cross-language comparison]
R defaults to Efron, SAS to Breslow. Here they differ in the third decimal of the hazard ratio — invisible in a rounded table, enough to fail a QC check. The SAP should name the method.
:::

:::mistake[Letting alphabetical order pick the reference arm]
`coxph` uses the first factor level. On this study that makes CBX the reference and the reported HR is placebo-versus-CBX, the reciprocal of what you want. Set the reference with `relevel()`.
:::

:::mistake[Adding a stratification factor as a covariate]
`~ TRTP + STRAT1R` fits a different model from `~ TRTP + strata(STRAT1R)`. In `survdiff` the first tests whether all treatment-by-stratum combinations differ; the symptom is a degrees-of-freedom greater than 1.
:::

:::mistake[Reporting a hazard ratio without checking proportional hazards]
A single HR summarises a ratio assumed constant over time. When it is not, the number is a time-average of something moving, and the KM curves show a shape the HR hides. Check it, report it, and pre-specify what happens if it fails.
:::

## Knowledge check

::quiz{ids="r.surv.cnsr-conversion,r.surv.ties-default,r.surv.reference-level,r.surv.ph-meaning"}

## Hands-on exercise

::practice{ids="r.surv.event-derive,r.surv.km-medians,r.surv.stratified-cox,r.surv.code" title="Practice: the full time-to-event analysis"}

## Challenge exercise

::practice{ids="r.surv.silent-drop,r.surv.ph-failure,r.surv.open" title="Challenge: silent subject loss and non-proportional hazards"}

## Industry note

**Deriving ADTTE is most of the work.** The model is three lines; the censoring rules are a page of the SAP and a week of programming. Two independent derivations of the same endpoint routinely disagree on a handful of subjects, and reconciling them is standard practice before database lock.

**Number-at-risk tables are expected** under a KM figure. `survminer::ggsurvplot()` produces them in R; `PROC LIFETEST`'s `PLOTS=SURVIVAL(ATRISK=...)` does it in SAS. A KM figure without a risk table is incomplete, because the tail of a curve based on three remaining subjects looks identical to one based on three hundred.

:::standard{kind="official"}
The FDA guidance *Clinical Trial Endpoints for the Approval of Cancer Drugs and Biologics* discusses PFS and OS as endpoints and addresses the need to pre-specify censoring rules. It does not prescribe a specific rule set — the five-rule pattern used in this study's SAP is a common industry approach, not a regulatory requirement.
:::

**Restricted mean survival time is gaining ground** as a complement to the hazard ratio, particularly in immuno-oncology where delayed treatment effects make proportional hazards implausible. RMST compares the area under the curves up to a pre-specified horizon, is interpretable in months rather than as a rate ratio, and does not assume proportionality. `survRM2::rmst2()` implements it. It is not yet a standard primary analysis, but it appears increasingly as a pre-specified sensitivity analysis.

:::interview[How would you check whether a hazard ratio is trustworthy?]
Answer in two parts — the derivation and the assumption — because a correct model on a wrong dataset is the more common failure.

"First I'd check the data feeding it. The conversion from `CNSR` is where this goes wrong most often: ADaM uses `CNSR = 0` for an event, the opposite of R's convention, and studies that record censoring *reasons* have `CNSR` values above 1. So `1 - CNSR` produces negatives, `Surv()` converts them to `NA` with a warning, and subjects vanish silently — 52 of them in the study I've been working with. I'd assert the derived event indicator is only 0 and 1.

Then the event counts against the SAP's target, and the censoring reasons broken down, because that breakdown tells you whether the informative-censoring rules are doing what was intended.

Second, the assumption. A hazard ratio is one number summarising a ratio assumed constant over time, so I'd run `cox.zph()` and look at the Schoenfeld residual plot. If it fails, the HR is a time-average of something moving and the KM curves show a shape it hides — and the honest responses are to report it as a time-averaged summary, to lead with the curves, or to use RMST, which doesn't assume proportionality.

I'd also check the direction. `coxph` uses the first factor level as the reference, which is alphabetical for a character column, so the HR can easily come out as control-versus-experimental. And I'd check `ties` — R defaults to Efron and SAS to Breslow, which differ in the third decimal, enough to fail a QC comparison where neither program is wrong."
:::
