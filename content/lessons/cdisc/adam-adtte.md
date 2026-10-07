## What problem are we trying to solve?

The primary endpoint of CBX417-301 is progression-free survival. The analysis is three lines of R. The dataset those three lines read is a page of the SAP and a week of programming, and here is why.

Take one subject: `CBX417-301-1001-0008`, randomized 2023-01-19. They started a new anticancer therapy before any adequate tumour assessment was recorded, and they died on 2023-09-12.

Their two ADTTE records:

```text
PARAMCD  STARTDT     ADT         AVAL  CNSR  EVNTDESC
PFS      2023-01-19  2023-01-19     1     3  NEW ANTICANCER THERAPY BEFORE PD OR DEATH
OS       2023-01-19  2023-09-12   237     0  DEATH
```

The same subject, the same follow-up, and the two endpoints disagree completely. PFS says: censored on day 1, we know nothing about their progression. OS says: died on day 237, that is an event.

Neither record is wrong. The PFS record implements a censoring rule the SAP states, because a subject who switches therapy before any assessment tells you nothing about *this* drug's effect on progression. The OS record implements a different rule, because death is death whatever therapy they were on.

**ADTTE is where those rules become data.** Every row is a subject, a parameter, a time, and a number saying whether that time ended in the event or in a decision to stop looking — plus two text variables saying *which* event and *which* decision, so a reviewer can check the classification without rerunning the derivation.

:::number[929 records, and what is in them]
`data/oncology/adam/adtte.csv`:

| `PARAMCD` | `PARAM` | Records |
|---|---|---:|
| `PFS` | Progression-free Survival (days) | 420 |
| `OS` | Overall Survival (days) | 420 |
| `DOR` | Duration of Response (days) | 89 |

PFS and OS have one record for every ITT subject. `DOR` has one only for the 89 confirmed responders — a parameter can legitimately have fewer records than the population, and that is a structural fact a reviewer will check.

`AVAL = ADT − STARTDT + 1` on all 929 records. The minimum `AVAL` is **1**, on 12 subjects — because there is no day zero, and a subject censored on their randomization date has one day of follow-up, not none.
:::

## Intuition

A time-to-event record answers two questions at once, and `AVAL` alone answers neither.

**How long did we watch?** That is `AVAL`, in days, from `STARTDT` to `ADT`.

**Why did we stop?** That is `CNSR`. Zero means the event happened. Anything else means we stopped watching for some other reason, and the subject's true event time is *later than* `AVAL` — which is genuinely different information from "no event ever happened".

:::why[`CNSR = 0` means event. Why is the convention backwards from every statistical package?]
Because `CNSR` is named for what it records: **whether the observation is censored.** Zero censoring means an event. It is internally consistent; it is simply the opposite of R's `Surv(time, event)` and of most textbooks.

That would be a minor annoyance except for a second rule: **ADaM permits `CNSR` values above 1**, using them to record *why* the subject was censored. CBX417-301 uses all of them:

| `CNSR` | Meaning | PFS records |
|---:|---|---:|
| 0 | Event — progression or death | 332 |
| 1 | No PD or death by the cutoff | 36 |
| 2 | No baseline or adequate post-baseline assessment | 9 |
| 3 | New anticancer therapy before PD or death | 28 |
| 4 | PD or death after two or more missed assessments | 15 |

So the habitual conversion `event <- 1 - CNSR` produces `−1`, `−2` and `−3` for the **52** subjects with `CNSR` above 1. `Surv()` rejects negative status values, converts them to `NA`, and warns once. Those subjects vanish.

**`CNSR == 0` is correct for every study**, including ones that only use 0 and 1. It is not a special case — it is the definition. `1 - CNSR` happens to work when only 0 and 1 appear, which is exactly why the habit survives until it meets a study like this one.
:::

## Clinical context

The variables on an ADTTE record and what each one is for:

| Variable | Holds |
|---|---|
| `PARAMCD`, `PARAM`, `PARAMN` | Which endpoint, its description with unit, its display order |
| `STARTDT` | The time origin — randomization for PFS and OS, first response for DOR |
| `ADT` | The event or censoring date |
| `AVAL`, `AVALU` | `ADT − STARTDT + 1`, in days |
| `CNSR` | 0 = event; 1 and above = censored, with the value encoding the reason |
| `EVNTDESC` | What happened, in words — populated on **every** record |
| `CNSDTDSC` | Where the censoring date came from — populated **only** when censored |
| `SRCDOM`, `SRCVAR`, `SRCSEQ` | The source of `ADT` |
| `TRTP`, `STRAT1R`, `STRAT2R`, subgroup covariates | Copied from ADSL, so the model needs no join |

:::standard{kind=official}
ADaMIG v1.3 treats time-to-event data as a **BDS** dataset — one record per subject per parameter, with a single analysis timepoint per parameter — and defines `STARTDT` (Time-to-Event Origin Date), `CNSR` (Censor), `EVNTDESC` (Event or Censoring Description) and `CNSDTDSC` (Censoring Date Description).

`CNSR = 0` denotes an event. ADaMIG v1.3 permits values greater than 1 to distinguish censoring reasons; **any non-zero value means censored.**
:::

:::standard{kind=convention}
**The censoring rules themselves are entirely study-specific.** ADaM defines how to record the result; the protocol and SAP define what the rules are. CBX417-301's five PFS rules are a common industry pattern, not a standard, and the FDA guidance *Clinical Trial Endpoints for the Approval of Cancer Drugs and Biologics* discusses the need to pre-specify censoring rules without prescribing a particular set.

Whether a study uses `CNSR` 0/1 only, with the reason in `CNSDTDSC`, or the numbered scheme above, is also a sponsor choice. Both are conformant; only one of them breaks `1 - CNSR`.
:::

## Formal concept

### The censoring table is a chain of IF statements, and the order is the specification

CBX417-301's PFS rules, from SAP Section 9.4, applied **in this order**:

| Order | Condition | `ADT` | `CNSR` | n |
|---:|---|---|---:|---:|
| 1 | No baseline or adequate post-baseline assessment, and no death within 91 days of randomization | `RANDDT` | 2 | 9 |
| 2 | New anticancer therapy started before the first progression or death | Last adequate assessment on or before the new therapy (`RANDDT` if none) | 3 | 28 |
| 3 | Progression or death preceded by ≥ 2 consecutive missed scheduled assessments | Last adequate assessment before the gap (`RANDDT` if none) | 4 | 15 |
| 4 | Progression or death on or before `DCUTDT` | Date of progression or death | 0 | 332 |
| 5 | Otherwise | Last adequate assessment | 1 | 36 |

:::why[Why do rules 2 and 3 come before rule 4? Those subjects had events.]
Because both situations make the observed event **uninformative about the study drug**, and the order is what enforces that.

A subject who starts a new anticancer therapy and then progresses two months later: was that progression attributable to the study drug, or did the disease outrun both drugs? You cannot tell. Rule 2 fires first, so the derivation censors at the last assessment before the switch and stops looking. Move rule 4 above it and those 28 subjects become events, at dates that reflect a different therapy.

Rule 3 is the same argument in the time dimension. If a subject missed two scheduled scans and then progressed, the progression may have occurred during the unobserved gap. Counting it at the date it was *detected* would overstate their progression-free time — so the derivation censors at the last adequate assessment.

**Both rules are conservative in the same direction: they refuse to attribute to the drug an event that something else may have caused.** They are also exactly what makes two independent ADTTE derivations disagree, because "last adequate assessment" and "two consecutive missed assessments" both need definitions the sentence does not contain.
:::

:::number[What happens to `AVAL` under each rule]
| `CNSR` | n | min `AVAL` | median | max |
|---:|---:|---:|---:|---:|
| 0 (event) | 332 | 12 | 127 | 904 |
| 1 (alive, progression-free) | 36 | 42 | 530 | 970 |
| 2 (no adequate assessment) | 9 | 1 | 1 | 1 |
| 3 (new therapy first) | 28 | 1 | 45 | 296 |
| 4 (event after missed assessments) | 15 | 39 | 47 | 254 |

**The `CNSR = 2` rows are all `AVAL = 1`** — censored at randomization, contributing one day of follow-up each. Nine subjects with no usable tumour data at all.

**The `CNSR = 1` rows have the longest follow-up** (median 530 days) and that is exactly what you expect: subjects still alive and progression-free at the data cutoff have been in the study longest. If this group had *short* follow-up, something would be wrong with the cutoff logic.

**The `CNSR = 4` rows are short** (median 47 days) because the rule censors at the last adequate assessment *before* the gap, which discards the follow-up during and after it.
:::

### `EVNTDESC` and `CNSDTDSC` — the two text variables that make it checkable

```text
CNSR  EVNTDESC                                              CNSDTDSC                                                  n
   0  DISEASE PROGRESSION                                   (null)                                                  301
   0  DEATH                                                 (null)                                                   31
   1  NO PD OR DEATH (ALIVE WITHOUT DOCUMENTED PROGRESSION) LAST ADEQUATE TUMOR ASSESSMENT                            36
   2  NO BASELINE OR NO ADEQUATE POST-BASELINE ASSESSMENT   RANDOMIZATION DATE                                         9
   3  NEW ANTICANCER THERAPY BEFORE PD OR DEATH             LAST ADEQUATE ASSESSMENT ON OR BEFORE NEW ANTICANCER…     25
   3  NEW ANTICANCER THERAPY BEFORE PD OR DEATH             RANDOMIZATION DATE (NO ADEQUATE ASSESSMENT BEFORE …)       3
   4  PD OR DEATH AFTER >=2 MISSED ASSESSMENTS              LAST ADEQUATE ASSESSMENT BEFORE MISSED ASSESSMENTS        15
```

`EVNTDESC` is populated on every record, including events — it says *what happened*. `CNSDTDSC` is populated only when `CNSR > 0` — it says *where the date came from*.

:::why[Why two variables, when `CNSR` already encodes the reason?]
Because they answer different questions, and the `CNSR = 3` rows above prove it.

Twenty-eight subjects were censored for starting a new anticancer therapy. All 28 share an `EVNTDESC`. But 25 of them had at least one adequate assessment before the switch and were censored at it, while 3 had none and were censored at randomization. Same reason, two different date derivations — and `CNSDTDSC` is the only place that distinction appears.

That matters for QC. Those 3 subjects have `AVAL = 1`, which looks identical to the `CNSR = 2` subjects until you read `CNSDTDSC`. Without it, a reviewer checking "why does this subject have one day of follow-up" has to go back to the raw assessment records.

**And `EVNTDESC` on the event rows is not redundant with `CNSR = 0`.** It separates the 301 progressions from the 31 deaths — two clinically different events that the analysis treats identically and the CSR narrative does not.
:::

## Worked example

The primary analysis, and the one line it all depends on.

```r
library(survival); library(dplyr)

pfs <- adtte |>
  filter(PARAMCD == "PFS") |>
  mutate(event  = as.integer(CNSR == 0),     # NOT 1 - CNSR
         months = AVAL / 30.4375)

stopifnot(all(pfs$event %in% c(0, 1)), nrow(pfs) == 420)

pfs$TRTP <- relevel(factor(pfs$TRTP), ref = "Placebo + Docetaxel")

km  <- survfit(Surv(months, event) ~ TRTP, data = pfs, conf.type = "log-log")
lr  <- survdiff(Surv(months, event) ~ TRTP + strata(STRAT1R, STRAT2R), data = pfs)
cox <- coxph(Surv(months, event) ~ TRTP + strata(STRAT1R, STRAT2R),
             data = pfs, ties = "efron")
```

```text
Median PFS (months, 95% CI log-log)
  CBX-417 + Docetaxel   6.932238   (5.552361, 8.279261)   155 events / 210
  Placebo + Docetaxel   4.172485   (3.975359, 5.486653)   177 events / 210

Stratified log-rank    chisq = 11.649379 on 1 df, p = 0.00064224
Stratified Cox (Efron) HR = 0.680587  (0.545588, 0.848991)
```

:::number[Why the assertion on line 8 is not optional]
`as.integer(CNSR == 0)` is correct for every study. `1 - CNSR` gives `−1`, `−2` and `−3` for the 52 subjects with `CNSR` above 1.

`Surv()` does not error on those. It converts them to `NA`, warns **once**, and continues:

```text
Warning message:
In Surv(months, event) : Invalid status value, converted to NA
```

The curves still render, the hazard ratio still computes, and 52 subjects — 12% of the study — are gone.

**The nastiest part is which 52.** All 332 events have `CNSR = 0`, so no event is affected; only *censored* subjects are lost. The event count still matches the SAP, which is the number most people check first. The denominator is wrong and the statistic you verified is right.

`stopifnot(all(event %in% c(0, 1)), nrow(pfs) == 420)` turns a silent 12% data loss into an immediate failure. Two conditions, and the second one catches it even if the conversion changes.
:::

::widget{name="km-study" endpoint="PFS"}

## Data example

::dataset{id="oncology/adam/adtte" cols="USUBJID,PARAMCD,PARAM,STARTDT,ADT,AVAL,AVALU,CNSR,EVNTDESC,CNSDTDSC,SRCDOM,SRCVAR,SRCSEQ,TRTP,STRAT1R,STRAT2R" rows="10" caption="ADTTE — one record per subject per parameter, 929 records"}

### Where `ADT` comes from, by parameter

`SRCDOM` on an ADTTE record points at the source of the **analysis date**, and it varies by what happened to the subject:

| `PARAMCD` | `SRCDOM` | Records | The date is |
|---|---|---:|---|
| PFS | `RS` | 377 | A tumour assessment — progression, or the last adequate one |
| PFS | `DS` | 43 | A disposition record — death, or randomization |
| OS | `DS` | 365 | Death, or a disposition milestone |
| OS | `SS` | 27 | A survival-status contact |
| OS | `EX` | 27 | A last-dose date, where that is the last known contact |
| OS | `TR` | 1 | A tumour assessment, for one subject whose last contact was a scan |
| DOR | `RS` | 83 | A tumour assessment |
| DOR | `DS` | 6 | A disposition record |

:::why[Why does one dataset's `SRCDOM` take six different values?]
Because "last known alive date" is a maximum over everything that proves the subject was alive, and different subjects were last seen doing different things.

For the 64 OS-censored subjects, `ADT` is `ADSL.LSTALVDT` — the latest of every visit, assessment, dosing and survival-contact date on or before the cutoff. For one subject that maximum happened to be a tumour scan; for 27 it was a dosing record; for 27 a survival follow-up phone call.

**This is why the pointer is worth having.** A reviewer asking "how do you know this subject was alive on that date" gets a specific record, in a specific domain, rather than a derivation rule they would have to re-run over four datasets.

**And it is why `SRCDOM` must be read before `SRCSEQ` is joined.** A QC program that joins `SRCSEQ` to `RS` for every ADTTE record resolves 377 of the 420 PFS records and silently produces nulls for the other 43.
:::

::widget{name="ph-diagnostics"}

## Code

::::tabs
:::tab[SAS]
```sas
proc lifetest data=adam.adtte method=km conftype=loglog
              plots=survival(atrisk=0 to 24 by 3);
  where paramcd = 'PFS';
  time aval * cnsr(1, 2, 3, 4);
  strata trtp;
run;

proc phreg data=adam.adtte;
  where paramcd = 'PFS';
  class trtp (ref='Placebo + Docetaxel');
  model aval * cnsr(1, 2, 3, 4) = trtp / ties=efron rl;
  strata strat1r strat2r;
run;
```

:::lines
4: **`cnsr(1, 2, 3, 4)` lists every value that means censored.** This is SAS's expression of `CNSR == 0`, written the other way round — you name the censoring values rather than the event value. Writing only `cnsr(1)` would treat values 2, 3 and 4 as **events**, which is the SAS form of the `1 - CNSR` bug and affects the same 52 subjects.
5: `STRATA trtp` in `PROC LIFETEST` means "compare these groups". The same keyword in `PROC PHREG` on line 12 means "stratify the baseline hazard" — the opposite. Two procedures used in the same program, one keyword, two meanings.
10: `ref=` sets the reference level explicitly. Without it `PROC PHREG` uses the last level in sort order, which is a different direction from R's first-level default.
11: `ties=efron` to match R. **SAS's default is `BRESLOW`**, which gives a different hazard ratio in the third decimal — enough to fail a four-decimal QC comparison with neither program wrong.
12: `STRATA strat1r strat2r` — stratified, matching the randomization. These are the IxRS values from ADSL, not values re-derived from the CRF.
:::
:::

:::tab[R]
```r
library(survival); library(dplyr)

pfs <- adtte |>
  filter(PARAMCD == "PFS") |>
  mutate(event  = as.integer(CNSR == 0),
         months = AVAL / 30.4375)

stopifnot(all(pfs$event %in% c(0, 1)), nrow(pfs) == 420)

pfs$TRTP <- relevel(factor(pfs$TRTP), ref = "Placebo + Docetaxel")

km  <- survfit(Surv(months, event) ~ TRTP, data = pfs, conf.type = "log-log")
cox <- coxph(Surv(months, event) ~ TRTP + strata(STRAT1R, STRAT2R),
             data = pfs, ties = "efron")
```

:::lines
5: `as.integer(CNSR == 0)`, never `1 - CNSR`. The latter produces negative values whenever a study uses censoring-reason codes.
6: `AVAL / 30.4375` — ADTTE stores days (`AVALU = "DAYS"`) and oncology reports months. The divisor is `365.25 / 12` and it is a **sponsor convention**: 30.4167 and a flat 30 also appear, and the choice moves a median of 6.93 months by about 0.02.
8: The assertion. Two conditions: the event indicator is 0/1, and no subject was lost. `Surv()` would only warn, and a warning in a long script is a warning nobody reads.
10: Setting the reference level so the hazard ratio reads as experimental versus control. Without it, alphabetical order makes CBX the reference and the reported HR is its reciprocal, with the confidence limits inverted and swapped.
12: `conf.type = "log-log"` — R defaults to `"log"`, SAS `PROC LIFETEST` to `"log-log"`, and most SAPs specify log-log because it keeps the limits inside [0, 1].
13-14: `strata()` inside the formula, not a covariate. `~ TRTP + STRAT1R` fits a different model entirely.
:::
:::
::::

## Output

```text
Median PFS and event counts
                         records events   median  0.95LCL  0.95UCL
TRTP=Placebo + Docetaxel     210    177  4.172485 3.975359 5.486653
TRTP=CBX-417 + Docetaxel     210    155  6.932238 5.552361 8.279261

Stratified log-rank:  chisq 11.649379 on 1 df,  p = 0.00064224
Stratified Cox HR:    0.680587  (0.545588, 0.848991)
```

## Interpretation

> Median progression-free survival was **6.93 months (95% CI 5.55 to 8.28)** on CBX-417 plus docetaxel and **4.17 months (3.98 to 5.49)** on placebo plus docetaxel. The stratified Cox model gave a hazard ratio of **0.68 (0.55 to 0.85)** in favour of CBX-417, with a stratified log-rank p-value of **0.0006**.

:::clinical
A hazard ratio of 0.68 means the instantaneous risk of progression or death is about 32% lower on CBX-417 at any given moment among subjects still at risk. In median terms that is roughly 2.8 additional months before progression.

**Read the event counts alongside it.** 155 events against 177 is the treatment effect showing up as data: fewer subjects on CBX-417 progressed during follow-up. A hazard ratio without event counts is a ratio with no sense of how much information is behind it.

**And read the censoring breakdown**, because it is where the estimate is fragile. Twenty-eight subjects were censored for starting a new anticancer therapy — 23 on CBX-417 and 5 on placebo. That imbalance is itself informative: placebo subjects progressed sooner, so they reached the event before they could switch. A sensitivity analysis that counts those events instead of censoring them is specified in SAP Section 9.6 for exactly this reason.
:::

## Common mistakes

:::mistake[`event <- 1 - CNSR`]
It produces negative values whenever a study uses censoring-reason codes — 52 subjects here. `Surv()` converts them to `NA` with a single warning and those subjects disappear. Only *censored* subjects are lost, so the event count still matches the SAP and the error hides behind the number most people check. Always `as.integer(CNSR == 0)`, and assert the result.
:::

:::mistake[Writing `cnsr(1)` in SAS]
`TIME AVAL * CNSR(1)` names 1 as the only censoring value, so 2, 3 and 4 are treated as **events**. Same 52 subjects, opposite direction: instead of vanishing they become events at dates the SAP deliberately chose not to count. List every censoring value.
:::

:::mistake[Reordering the censoring rules]
Rules 2 and 3 fire before rule 4 precisely so that subjects who switched therapy or missed assessments are censored rather than counted as events. Applying rule 4 first turns 43 censored subjects into events at dates that reflect a different therapy or an unobserved gap.
:::

:::mistake[Joining `SRCSEQ` to a single domain]
`SRCDOM` takes six values across this dataset — `RS`, `DS`, `EX`, `SS` and `TR`. A QC program that assumes `RS` resolves 377 of 420 PFS records and silently nulls the rest. Branch on `SRCDOM` first.
:::

:::mistake[Expecting one record per subject]
ADTTE has one record per subject **per parameter**. 929 records over 420 subjects, and `DOR` exists for only the 89 confirmed responders. A check asserting 420 rows fails; the right check is one record per subject per parameter and the expected count per parameter.
:::

:::mistake[Treating `AVAL` as a duration without the `+ 1`]
`AVAL = ADT − STARTDT + 1`. There is no day zero, so a subject censored on their randomization date has `AVAL = 1` — twelve subjects here. Recomputing as a plain difference gives zero, which `Surv()` will silently drop or error on depending on the version.
:::

## Knowledge check

::quiz{ids="adam.adtte.cnsr-convention,adam.adtte.rule-order,adam.adtte.evntdesc,adam.adtte.structure"}

## Hands-on exercise

::practice{ids="adam.adtte.event-derive,adam.adtte.censor-classify,adam.adtte.aval-check,adam.adtte.srcdom" title="Practice: building and checking a time-to-event dataset"}

## Challenge exercise

::practice{ids="adam.adtte.silent-loss,adam.adtte.open-derivation" title="Challenge: the analysis that lost 52 subjects"}

## Industry note

**Deriving ADTTE takes far longer than fitting the model.** The Cox model is one line; the censoring rules are a page of the SAP and a week of programming. Two independent derivations of the same endpoint routinely disagree on a handful of subjects, and reconciling them before database lock is standard practice.

**The disagreements cluster in the same places every time:** what counts as an "adequate" assessment, what counts as two "consecutive missed" assessments when the visit schedule slipped, and whether a death with no preceding assessment falls under rule 1 or rule 4. Those are definition gaps in the SAP, not bugs — and the fix is a sentence, not a patch.

**ADTTE must be built after ADRS and ADSL.** It needs progression dates from ADRS, randomization and last-known-alive dates from ADSL, and subsequent-therapy dates from SDTM `CM`. The ADRG states the dependency explicitly, because a reviewer trying to reproduce the censoring decisions needs to know which datasets to ask for.

:::standard{kind=official}
The FDA guidance *Clinical Trial Endpoints for the Approval of Cancer Drugs and Biologics* discusses progression-free survival and overall survival as endpoints and addresses the need to pre-specify censoring rules and to consider the effect of missing assessments. It does not prescribe a particular rule set; the five-rule pattern used here is a common industry approach, not a regulatory requirement.
:::

:::interview[How would you QC a time-to-event dataset?]
"I'd check the derivation before the model, because a correct model on a wrong dataset is the more common failure and much harder to see.

**Structure first.** One record per subject per parameter — 929 records over 420 subjects on the study I worked with, with `DOR` present only for the 89 confirmed responders. A check asserting 420 rows fails on a correct dataset, which is the kind of over-strict check that gets 'fixed' the wrong way.

**Then `AVAL = ADT − STARTDT + 1` on every record**, which is arithmetic and either holds or does not. The `+ 1` matters: there's no day zero, so twelve subjects censored on their randomization date have `AVAL = 1`, not 0.

**Then the censoring distribution against the SAP.** Events by arm against the target, and the breakdown by reason. On that study PFS was 332 events, 36 alive and progression-free, 9 with no adequate assessment, 28 censored for a new anticancer therapy and 15 for an event after missed assessments. That breakdown is where two independent derivations disagree, and a handful of subjects differing is normal and worth reconciling before lock.

**Then `EVNTDESC` and `CNSDTDSC` for consistency with `CNSR`.** `EVNTDESC` on every record, `CNSDTDSC` exactly when `CNSR > 0`. And the pair catches something `CNSR` alone can't: 28 subjects share the new-therapy reason, but 25 were censored at their last adequate assessment and 3 at randomization because they had none. Those 3 look identical to the no-assessment group by `AVAL` and only `CNSDTDSC` separates them.

**Then the sanity checks on `AVAL` by reason.** Subjects censored as alive and progression-free should have the *longest* follow-up — median 530 days on that study — because they're the ones still in the trial at the cutoff. If that group had short follow-up, the cutoff logic is wrong.

**Then the conversion into the model**, which is where the classic failure lives. ADaM uses `CNSR = 0` for an event, the opposite of R, and studies recording censoring *reasons* have values above 1. `1 - CNSR` gives negatives, `Surv()` converts them to `NA` with one warning, and 52 subjects vanish. The nasty part is that all the events have `CNSR = 0`, so only censored subjects are lost — the event count still matches the SAP, which is the number most people verify. In SAS the mirror-image error is `cnsr(1)` instead of `cnsr(1,2,3,4)`, which turns those 52 into events.

And I'd check `SRCDOM` before joining anything. It takes five different values across that dataset, because 'last known alive date' is a maximum over visits, assessments, dosing and survival contacts. A join that assumes `RS` resolves 377 of 420 PFS records and silently nulls the rest."
:::
