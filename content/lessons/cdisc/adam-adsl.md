## What problem are we trying to solve?

Open the CBX417-301 CSR at the safety section and read the column headers of three consecutive tables:

| Table | Population | Column header, CBX-417 arm |
|---|---|---|
| 14.1.2 Demographics | Intent-to-treat | `N = 210` |
| 14.3.1.1 Overview of TEAEs | Safety | `N = 209` |
| 14.2.3 Objective response | Intent-to-treat | `N = 210` |

Same study, same arm, two different denominators one page apart. A reviewer who thinks those should match will raise a query, and the answer has to be a sentence, not an investigation.

Now try to answer it from SDTM. `DM.ARM` gives you 210. Getting 209 requires knowing who was dosed (`EX`), what they were actually dosed with (`EX` joined to the kit list), and that a subject randomized to placebo who received a CBX-417 kit is analyzed in the CBX column. Three joins and a rule from Section 4 of the SAP.

**ADSL is the dataset that makes both numbers a `COUNT` with a `WHERE`.** One row per randomized subject, 420 rows, and on that row: which arm the subject was randomized to, which they actually got, whether they are in each population, when they started and stopped, and how the study ended for them.

Every denominator in the entire CSR comes from this one dataset. That is not an exaggeration — it is the design.

:::number[420, 416, 411, 388]
Verified from `data/oncology/adam/adsl.csv`:

| Flag | `Y` | `N` |
|---|---:|---:|
| `RANDFL` / `ITTFL` | 420 | 0 |
| `SAFFL` | 416 | 4 |
| `EFFFL` | 411 | 9 |
| `PPROTFL` | 388 | 32 |

Every one of those is a denominator somewhere in the CSR. Note that all four are populated on all 420 rows with `Y` or `N` — never null. A null population flag is not "probably N"; it is a defect, because it means the derivation did not reach that subject.
:::

## Intuition

ADSL is a **key** and a **cache**.

As a key, it defines the study population. If a subject is not in ADSL they are not in any analysis. The 48 screen failures in CBX417-301 exist in SDTM `DM` and nowhere in ADaM, because no analysis is about them.

As a cache, it holds every subject-level fact that any other dataset might need, so that ADAE, ADLB and ADTTE can copy rather than re-derive. `ADLB.TRTA` is `ADSL.TRT01A`. `ADTTE.STRAT1R` is `ADSL.STRAT1R`. The copying looks redundant and is deliberate: it guarantees that a subject's treatment is the same string in every analysis dataset, because it came from one place.

:::why[Why copy instead of joining to ADSL at analysis time?]
Because a join can be got wrong and a copy cannot.

If every table program joined to ADSL, each one would choose its own join type. An inner join silently drops subjects; a left join from the wrong side silently adds them. A programmer summarising adverse events who joins `ADSL` to `ADAE` rather than the other way round gets 420 rows for the four subjects with no events, and a denominator that looks right.

Copying the variables into each dataset at build time means the join happened once, in a program that was reviewed, and every downstream program sees the result. It also means each analysis dataset is self-sufficient — you can hand ADAE to someone and they can produce the AE overview table without ADSL.

The cost is storage and the discipline of rebuilding downstream datasets when ADSL changes. Both are cheap compared to one wrong denominator in a CSR.
:::

## Clinical context

The variable groups on an ADSL row, and what each one is for:

| Group | Variables (CBX417-301) | Used by |
|---|---|---|
| **Identifiers** | `STUDYID`, `USUBJID`, `SUBJID`, `SITEID`, `COUNTRY`, `REGION1` | Everything; `REGION1` is a subgroup factor |
| **Demographics & baseline covariates** | `AGE`, `AGEGR1`, `SEX`, `RACE`, `BMIBL`, `BSABL`, `ECOGBL`, `HISTOL`, `PDL1CAT` | Table 14.1.2, subgroup forests, model covariates |
| **Treatment** | `TRT01P`, `TRT01PN`, `TRT01A`, `TRT01AN` | Every table's column assignment |
| **Stratification as randomized** | `STRAT1R`, `STRAT2R` | The stratified log-rank and stratified Cox |
| **Dates** | `RANDDT`, `TRTSDT`, `TRTEDT`, `TRTDURD`, `LSTALVDT`, `DTHDT`, `DCUTDT` | Study day, treatment-emergent windows, censoring |
| **Disposition** | `EOTSTT`, `DCTREAS`, `DCTDT`, `EOSSTT`, `DCSREAS`, `EOSDT` | Table 14.1.1 |
| **Population flags** | `RANDFL`, `ITTFL`, `SAFFL`, `EFFFL`, `PPROTFL` | Every denominator |

:::standard{kind=official}
ADaMIG v1.3 requires ADSL to have **exactly one record per subject** and specifies the naming patterns `TRTxxP` / `TRTxxA` for planned and actual treatment in period *xx*, with the numeric companions `TRTxxPN` / `TRTxxAN`. `STUDYID`, `USUBJID` and `SUBJID` are required; `TRT01P` is required in ADSL.

For a single-period study like CBX417-301, period 01 is the whole study and `TRT01P` / `TRT01A` are the treatment variables. A crossover study would carry `TRT01P`, `TRT02P` and so on.
:::

:::standard{kind=convention}
The specific flag names `ITTFL`, `SAFFL`, `EFFFL` and `PPROTFL` are conventional sponsor practice and are widely used, but the set of populations a study defines comes from its own protocol and SAP, not from ADaMIG. ADaMIG v1.3 names the `xxxFL` pattern for subject-level population flags; it does not enumerate which populations a study must have.
:::

## Formal concept

### `TRT01P` and `TRT01A` — the two treatments

| | `TRT01P` | `TRT01A` |
|---|---|---|
| Means | Randomized to | Actually received |
| Source | IxRS / `DM.ARM` | Dispensing records joined to the kit list |
| Used by | Efficacy analyses (ITT principle) | Safety analyses |
| Null when | Never (all ADSL subjects were randomized) | The subject was never dosed |

The rule that produces `TRT01A` on this study is in SAP Section 4: **a subject who received at least one CBX-417 kit is analyzed as CBX-417 + docetaxel**, whatever they were randomized to. It is deliberately asymmetric — it attributes any drug-related harm to the active arm rather than diluting it into placebo.

:::number[The three dispensing errors, and what they do to the denominators]
| `TRT01P` | `TRT01A` | n |
|---|---|---:|
| CBX-417 + Docetaxel | CBX-417 + Docetaxel | 207 |
| CBX-417 + Docetaxel | Placebo + Docetaxel | **1** |
| CBX-417 + Docetaxel | (null — never dosed) | 2 |
| Placebo + Docetaxel | CBX-417 + Docetaxel | **2** |
| Placebo + Docetaxel | Placebo + Docetaxel | 206 |
| Placebo + Docetaxel | (null — never dosed) | 2 |

Efficacy denominators (ITT, by `TRT01P`): 210 and 210.
Safety denominators (by `TRT01A`, `SAFFL = "Y"`): **209** and **207**.

Three subjects appear in a different column in the safety tables than in the efficacy tables. That is correct and it is a sentence in the ADRG. Without that sentence a reviewer reasonably reads it as an inconsistency.
:::

### The dates, and the invariants between them

```text
RANDDT ──► TRTSDT ──► TRTEDT ──► TRTEDT + 30 ──► LSTALVDT / DTHDT ──► DCUTDT
   │          │          │            │                │                │
randomized  first      last     treatment-      last contact       data cutoff
            dose       dose     emergent window
```

On CBX417-301 these hold for every row and are worth asserting in the QC program:

- `TRTDURD = TRTEDT − TRTSDT + 1`, and null whenever `SAFFL = "N"`. Verified: true on all 420 rows.
- No `LSTALVDT` after `DCUTDT`. Verified: maximum `LSTALVDT` is 2025-03-31, the cutoff itself.
- `DCTREAS` is populated exactly when `EOTSTT = "DISCONTINUED"` (393 rows) and null when `EOTSTT = "ONGOING"` (27 rows).

:::why[Why does `TRTEDT` need a special rule at the data cutoff?]
Because 27 subjects were still on treatment when the database was cut.

Those subjects have no last dose — they have a *most recent* dose. If `TRTEDT` were left null, the treatment-emergent window `TRTSDT ≤ ASTDT ≤ TRTEDT + 30` would be undefined and every adverse event for those 27 subjects would fall out of the safety tables.

The rule is to set `TRTEDT` to the last dose date on or before `DCUTDT`. It makes the window computable, and it slightly *understates* exposure for ongoing subjects — which is the conservative direction for a safety analysis, because it cannot invent treatment-emergent events that were not observed.

It also means `TRTEDT` is not "the end of treatment". `EOTSTT = "ONGOING"` is what says the subject had not stopped. A reader who takes `TRTEDT` as a discontinuation date gets 420 discontinuations instead of 393.
:::

### Population flags are `Y`/`N`, record flags are `Y`/null

This asymmetry is not arbitrary.

A **subject-level** flag answers a question about a subject that always has an answer: is this subject in the safety population? Yes or no. Leaving it null would mean "we did not evaluate this subject", which for a population flag is a defect.

A **record-level** flag such as `ABLFL` or `ANL01FL` answers "is this *the* record". Only one record per group gets `Y`; the others are not "N", they simply were not selected. Setting them to `N` would invite `where ANL01FL ne "N"` and a wrong answer on any record where the flag was never evaluated.

:::standard{kind=official}
ADaMIG v1.3 states that subject-level population flags take `Y` or `N` and record-level analysis flags take `Y` or null. Following the convention means `if SAFFL = "Y"` and `if ANL01FL = "Y"` are both safe, and negations are safe only on the subject-level flags.
:::

## Worked example

Build the disposition table's discontinuation section from ADSL alone, then check it against the treatment-status variables.

```r
adsl |> count(EOTSTT, DCTREAS)
```

```text
  EOTSTT       DCTREAS                                           n
1 DISCONTINUED ADVERSE EVENT                                    67
2 DISCONTINUED DEATH                                            27
3 DISCONTINUED PHYSICIAN DECISION                                6
4 DISCONTINUED PROGRESSIVE DISEASE                             278
5 DISCONTINUED RANDOMIZED BY MISTAKE WITHOUT STUDY TREATMENT     1
6 DISCONTINUED WITHDRAWAL BY SUBJECT                            14
7 ONGOING      NA                                               27
```

`67 + 27 + 6 + 278 + 1 + 14 = 393`, plus 27 ongoing, is 420. The table balances.

Now the study-level disposition, which is a different question with a different answer:

```text
  EOSSTT       DCSREAS                   n
1 DISCONTINUED DEATH                   356
2 DISCONTINUED LOST TO FOLLOW-UP         2
3 DISCONTINUED WITHDRAWAL BY SUBJECT      9
4 ONGOING      NA                        53
```

:::why[393 discontinued treatment but only 367 discontinued the study — how?]
Because stopping treatment and leaving the study are different events, and in an oncology trial with an overall survival endpoint the gap between them is the point.

A subject who progresses stops study drug — `EOTSTT = "DISCONTINUED"`, `DCTREAS = "PROGRESSIVE DISEASE"` — and then enters survival follow-up. They are still in the study: still contributing to OS, still being contacted, `EOSSTT = "ONGOING"` or discontinued later for death. Of the 420 subjects, **53 were still in the study at the cutoff** while only 27 were still on treatment.

This is exactly why ADSL carries two status variables and two reason variables rather than one of each. A programmer who summarises "discontinuation" without saying *of what* produces a table nobody can interpret, and `DCSREAS = "PROGRESSIVE DISEASE"` would be a category error — progression is a reason to stop treatment, not a reason to leave the study.

**The only reasons a subject leaves this study are death, withdrawal of consent and loss to follow-up.** That short list is a design property of a survival trial: you keep following people until the endpoint or until they tell you to stop.
:::

## Data example

::dataset{id="oncology/adam/adsl" cols="USUBJID,TRT01P,TRT01A,RANDDT,TRTSDT,TRTEDT,TRTDURD,EOTSTT,DCTREAS,EOSSTT,DCSREAS,ITTFL,SAFFL,EFFFL,PPROTFL,STRAT1R,ECOGBL" rows="10" caption="ADSL — one row per randomized subject, 420 rows"}

### The stratification variables have a subtlety worth knowing

`STRAT1R` is the ECOG stratum **as entered in the IxRS at randomization**. `ECOGBL` is the baseline ECOG **as recorded on the CRF**. They are not the same variable and they do not always agree.

On CBX417-301 they disagree for **16 subjects**:

| `STRAT1R` | `ECOGBL` | n |
|---|---:|---:|
| ECOG 0 | 0 | 155 |
| ECOG 0 | 1 | 11 |
| ECOG 0 | 2 | 1 |
| ECOG 1 | 0 | 4 |
| ECOG 1 | 1 | 235 |
| ECOG 1 | 2 | 14 |

:::number[Which one does the stratified analysis use, and why?]
`STRAT1R` — the IxRS value.

The stratified log-rank and the stratified Cox model exist to reflect **how randomization was actually performed**. Randomization balanced the arms within the strata the IxRS used. Analysing within CRF-derived strata would stratify on a different partition of the subjects than the one the allocation respected, which breaks the correspondence the stratified test relies on.

The 16 discordant subjects are a documented finding in the ADRG: *"Reviewers comparing `STRAT1R` with `ECOGBL` will therefore find discordant subjects by design."* A sensitivity analysis using CRF values is reported separately. A reviewer who finds the discrepancy and has not been warned files a query; a reviewer who reads the sentence does not.
:::

:::standard{kind=official}
ICH E9 Section 5.7 discusses the use of covariates and states that the primary analysis should generally account for the factors used in the randomization scheme. It does not prescribe the "as randomized" versus "as corrected" choice in the specific case of a mis-stratification, which is why the SAP has to state it and the ADRG has to explain it.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc sql;
  create table denom as
  select 'ITT'    as population length=8,
         trt01p   as trt        length=40,
         count(*) as n
  from   adam.adsl
  where  ittfl = 'Y'
  group by trt01p
  union all
  select 'Safety', trt01a, count(*)
  from   adam.adsl
  where  saffl = 'Y'
  group by trt01a;
quit;

proc sql noprint;
  select count(*) into :bad
  from   adam.adsl
  where  (saffl = 'Y' and missing(trt01a))
      or (saffl = 'N' and not missing(trtdurd))
      or  missing(ittfl) or missing(saffl);
quit;
%if &bad > 0 %then %put ERROR: &bad ADSL rows fail the population-flag invariants;
```

:::lines
3-8: `ittfl = 'Y'` with `trt01p` — the ITT population is always summarized by **planned** treatment.
10-13: `saffl = 'Y'` with `trt01a` — the safety population by **actual** treatment. Pairing the wrong flag with the wrong treatment variable is the single most common ADSL mistake, and it produces a table that looks entirely normal.
19-21: Three invariants worth asserting on every build: a dosed subject must have an actual treatment; a never-dosed subject must have no treatment duration; population flags must never be missing.
23: Failing the build is the point. A warning in a log is a warning nobody reads.
:::
:::

:::tab[R]
```r
library(dplyr)

denoms <- bind_rows(
  adsl |> filter(ITTFL == "Y") |> count(trt = TRT01P) |> mutate(population = "ITT"),
  adsl |> filter(SAFFL == "Y") |> count(trt = TRT01A) |> mutate(population = "Safety")
)

stopifnot(
  nrow(adsl) == n_distinct(adsl$USUBJID),
  !any(is.na(adsl$ITTFL)), !any(is.na(adsl$SAFFL)),
  all(adsl$ITTFL %in% c("Y", "N")), all(adsl$SAFFL %in% c("Y", "N")),
  all(!is.na(adsl$TRT01A[adsl$SAFFL == "Y"])),
  all(is.na(adsl$TRTDURD[adsl$SAFFL == "N"]))
)
```

:::lines
4-5: The pairing again: `ITTFL` with `TRT01P`, `SAFFL` with `TRT01A`.
9: One record per subject is ADaMIG's structural requirement for ADSL and the cheapest possible check.
10-11: Population flags must be populated and must be `Y` or `N` — never null, never blank, never `1`/`0`.
12-13: The two cross-variable invariants. A dosed subject with no actual treatment means the kit-list join failed; a never-dosed subject with a treatment duration means the exposure derivation ran on a subject with no exposure.
:::
:::
::::

## Output

```text
> denoms
  trt                     n population
1 CBX-417 + Docetaxel   210 ITT
2 Placebo + Docetaxel   210 ITT
3 CBX-417 + Docetaxel   209 Safety
4 Placebo + Docetaxel   207 Safety
```

Four numbers, and every table in the CSR uses one of them. A reviewer who sees 210 and 209 in adjacent sections needs the ADRG to say *why* in one sentence, not an investigation.

## Common mistakes

:::mistake[Pairing `SAFFL` with `TRT01P`]
The table runs, the totals still add to 416, and three subjects are in the wrong column. There is no error message and no imbalance to notice. The only defence is a convention — safety with actual, efficacy with planned — applied without exception, and a QC program that checks which variable each table used.
:::

:::mistake[Leaving a population flag null]
`SAFFL` null does not mean N; it means the derivation did not reach that subject. `where SAFFL ne "N"` then includes them and `where SAFFL = "Y"` excludes them, so two tables disagree about the same population. Subject-level flags are `Y` or `N` on every row, always.
:::

:::mistake[Treating `TRTEDT` as the discontinuation date]
For the 27 subjects still on treatment at the cutoff, `TRTEDT` is their last dose *before the cutoff*, not an end of treatment. `EOTSTT` is the variable that says whether they stopped. Using `TRTEDT` as a disposition date turns 393 discontinuations into 420.
:::

:::mistake[Confusing treatment disposition with study disposition]
393 subjects discontinued treatment; 367 discontinued the study; 53 were still in the study at the cutoff and 27 were still on treatment. `EOTSTT`/`DCTREAS` and `EOSSTT`/`DCSREAS` answer different questions, and progression is a valid `DCTREAS` but not a valid `DCSREAS`.
:::

:::mistake[Deriving stratification factors from the CRF]
`STRAT1R` is what the IxRS recorded at randomization, which is what the allocation respected. On this study it disagrees with `ECOGBL` for 16 subjects. Re-deriving it from the CRF quietly changes which subjects are in which stratum in the primary analysis.
:::

:::mistake[Putting screen failures in ADSL]
ADSL contains the 420 randomized subjects. SDTM `DM` contains all 468 screened. A disposition table that reports screening counts takes them from `DM` and `DS`, and the ADRG says so — because a reviewer counting ADSL rows will otherwise conclude that 48 subjects are missing.
:::

## Knowledge check

::quiz{ids="adam.adsl.trt-pairing,adam.adsl.flag-values,adam.adsl.two-dispositions,adam.adsl.strat-source"}

## Hands-on exercise

::practice{ids="adam.adsl.denominators,adam.adsl.invariants-code,adam.adsl.trtedt,adam.adsl.classify-vars" title="Practice: denominators and the invariants that protect them"}

## Challenge exercise

::practice{ids="adam.adsl.wrong-column,adam.adsl.new-flag,adam.adsl.open-review" title="Challenge: a safety table in the wrong column"}

## Industry note

**ADSL is built first and rebuilt often.** Every downstream dataset copies from it, so a change to `TRT01A` or a population flag invalidates ADAE, ADLB, ADVS, ADEG, ADRS, ADTR and ADTTE. Mature teams treat an ADSL change as a full rebuild rather than a patch, and the ADRG's dependency table exists so a reviewer can see the same thing.

**Population flags are a blinded decision.** `PPROTFL` on this study depends on the classification of major protocol deviations, which SAP Section 6.2 requires to be done **before** database lock and while still blinded. Assigning it afterwards means the decision could be influenced by the outcome, and that is the kind of finding that undermines an entire analysis rather than one table.

**Interviewers ask about `TRT01P` versus `TRT01A` because it separates people who have run a study from people who have read about one.** The tell is whether you can say how many subjects differ and what happens to them. On this study three subjects differ, and they appear in different columns in the safety and efficacy tables — which is right.

:::standard{kind=official}
ICH E9 Section 5.2 describes the intention-to-treat principle: the primary efficacy analysis should include all randomized subjects analyzed according to the treatment to which they were randomized. ICH E9 also notes that safety is conventionally evaluated in subjects who received treatment, according to the treatment received. That pairing — efficacy by planned, safety by actual — is why ADSL carries both variables.
:::

:::interview[How many denominators does a CSR have, and where do they come from?]
"As many as it has populations, and they all come from ADSL.

On the study I've worked with there are four subject-level flags — `ITTFL` at 420, `SAFFL` at 416, `EFFFL` at 411 and `PPROTFL` at 388 — and each one is the denominator for a different family of tables. Efficacy on ITT, safety on safety, response on efficacy-evaluable where the SAP says so, per-protocol as supportive.

But the count isn't the whole denominator, because the column matters too. The ITT columns come from `TRT01P` and the safety columns from `TRT01A`, and on this study those differ for three subjects — two randomized to placebo who received at least one CBX-417 kit, and one the other way. So the safety columns are 209 and 207 while the efficacy columns are 210 and 210. Three subjects sit in different columns in different halves of the CSR, and that's correct rather than an inconsistency. It's one sentence in the ADRG, and without that sentence it's a reviewer query.

The mistake I'd be watching for is pairing the wrong flag with the wrong treatment variable — `SAFFL` with `TRT01P`, say. The totals still add up to 416, nothing looks odd, and three subjects are in the wrong column. There's no way to notice it from the output, so it has to be a convention applied without exception and checked in QC.

And I'd want the flags to be `Y`/`N` and never null. A null population flag isn't 'no' — it means the derivation didn't reach that subject, and then `ne 'N'` and `= 'Y'` give different answers in two different tables."
:::
