## What problem are we trying to solve?

A medical monitor asks when subject `CBX417-301-1001-0002` progressed. You open `TR`, the domain that
holds tumour measurements, and read the subject's whole course:

```text
LNKGRP   SLD (mm)   % from baseline   % from nadir
A1           28          —                —          (baseline)
A2           21       -25.0              —           nadir
A3           22       -21.4            +4.8
A4           22       -21.4            +4.8
A5           24       -14.3           +14.3
A6           25       -10.7           +19.0
```

Every measurement is **below** baseline. The largest rise from the nadir is 19.0% and 4 mm — under both
of RECIST's progression thresholds, which need a 20% relative increase *and* a 5 mm absolute one.

`RS` records the subject's response at `A6` as **`PD`**.

Nothing in `TR` explains that, and nothing in `TR` is wrong. **A new lesion appeared**, and a new lesion
is unequivocal progression regardless of what the measured lesions are doing.

::dataset{id="oncology/sdtm/tr" cols="USUBJID,TRSEQ,TRLNKGRP,TRTESTCD,TRORRES,TRORRESU,TRSTRESN,TRSTAT,TRREASND,TRMETHOD,TREVAL,TRLOBXFL,VISIT,TRDTC,TRDY" rows="8" caption="TR — 2,346 records, all sum of diameters, linked to RS by TRLNKGRP"}

**Oncology response is the clearest case in SDTM of a domain that cannot be derived from the domain
next to it**, and understanding why is most of this lesson.

## Intuition

One imaging assessment produces up to three kinds of record, answering three different questions:

| Domain | Question | In CBX417-301 |
|---|---|---|
| `TU` | **Which lesions are there?** Identification and location of each one | **not submitted** |
| `TR` | **How big are they?** A measurement per lesion, or an aggregate | 2,346 records, all `SUMDIAM` |
| `RS` | **What does it mean?** The assessor's overall response | 1,928 `OVRLRESP` records |

Those three sit in a strict information hierarchy, and the arrow only points one way. `TU` identifies
what `TR` measures. `TR` feeds `RS`. But `RS` also depends on things that are **not measured at all** —
whether a non-target lesion has unequivocally progressed, and whether a new lesion has appeared — so you
cannot run the chain backwards.

:::why[Why isn't the overall response just a formula over the measurements?]
Because RECIST evaluates three things and only one of them is a number.

1. **Target lesions.** Up to five measurable lesions, two per organ, measured and summed. This is the
   arithmetic everyone knows: a 30% decrease from baseline is a partial response, a 20% increase from
   the nadir *plus* 5 mm absolute is progression.
2. **Non-target lesions.** Everything else that was recorded at baseline — too small to measure
   reliably, or not measurable in principle, like a pleural effusion or bone disease. These are judged,
   not measured: present, absent, or *unequivocally* progressed.
3. **New lesions.** Any lesion not present at baseline. A single unequivocal new lesion is progression,
   full stop, however well the target lesions are doing.

In CBX417-301's 324 progression records:

| Driver | Records |
|---|---:|
| Target lesions meet the 20% **and** 5 mm rule | 182 |
| A new lesion appeared | 106 |
| Unequivocal non-target progression | 36 |

**142 of 324 progressions — 44% — are invisible in `TR`.** A program that derives progression from the
sum of diameters finds 182 of them and misses the rest, and the ones it misses are not a random sample:
they are the subjects whose measured disease was stable or shrinking while something else happened.
:::

## Clinical context

:::standard{kind="official"}
**RECIST 1.1 is not a CDISC standard.** It is a published set of response evaluation criteria for solid
tumours, maintained by an academic and industry working group and revised in 2009 from the original
2000 criteria. It defines what a partial response *is*; it says nothing about datasets, variables or
domains.

What CDISC provides is the **tabulation** of assessments made under those criteria, and it names the
criteria used rather than embedding them. `RSCAT = "RECIST 1.1"` is a published submission value in the
NCI/CDISC codelist **ONCRSCAT (C124298)** ("Category of Oncology Response Assessment"), extensible, 96
terms — a list that also includes `CHESON LYMPHOMA 2008`, `CHOI GIST 2008` and dozens of other criteria
sets. The codelist exists precisely because the criteria are external and plural.

Keeping the two straight matters in practice: when the protocol says "per RECIST 1.1", the criteria
document governs what response a subject had, and SDTM governs where the answer is written down.
:::

::lesson{id="trials-oncology-response-recist" label="The criteria themselves, in clinical detail"}

CBX417-301's `RS` domain holds **two** unrelated things, which is normal and catches people:

| `RSCAT` | `RSTESTCD` | Records | What it is |
|---|---|---:|---|
| `RECIST 1.1` | `OVRLRESP` | 1,928 | The investigator's overall response at one imaging assessment |
| `ECOG` | `ECOG101` | 3,075 | Performance status, collected on the vital-signs page |

```text
RS = 5,003 records over 420 subjects
```

:::standard{kind="official"}
`OVRLRESP` ("Overall Response") is a published term in **ONCRTSCD (C96782)**, extensible, 48 terms,
paired with `Overall Response` in **ONCRTS (C96781)**. Its results use **ONCRSR (C96785)** ("Oncology
Response Assessment Result"), extensible, 96 terms, which publishes `CR`, `PR`, `SD`, `PD` and `NE`
among many others. `RSEVAL` uses **EVAL (C78735)**, extensible, which publishes `INVESTIGATOR` and
`INDEPENDENT ASSESSOR`. The same codelist also carries the performance-status records' evaluator; that
`RSCAT = "ECOG"` is a sponsor value is covered in the vital-signs lesson.
:::

## Formal concept

### --LNKGRP: what ties one assessment together

`TR` and `RS` are separate datasets recording the same event. Something has to say *which* `TR` record
belongs with *which* `RS` record, and it is not the date.

```text
TR.TRLNKGRP = "A6"      TR.TRSTRESN = 25       TR.TRDTC = "2023-02-02"
RS.RSLNKGRP = "A6"      RS.RSSTRESC = "PD"     RS.RSDTC = "2023-02-02"
```

`--LNKGRP` is a **link identifier**: a sponsor-assigned label that is the same on every record belonging
to one assessment. In CBX417-301 it runs `A1` through `A20` within each subject, where `A1` is the
baseline scan.

:::why[Why not just join on the date?]
Because the date is not reliably unique, and it is not reliably the same.

A CT of the chest and an MRI of the brain performed on consecutive days are **one** assessment with two
scan dates. A scan repeated the next morning because the first was unreadable is one assessment. An
unscheduled scan on the same day as a scheduled visit is two. CBX417-301 has 21 unscheduled tumour
assessments, each carrying `VISITNUM` values like `1024.01` — a date join across those is exactly where
a many-to-many match appears and nobody notices.

`--LNKGRP` removes the guessing. The sponsor decides what constitutes one assessment, stamps every
record of it with the same value, and the join is then unambiguous by construction. That is also its
limitation: **it is a sponsor-assigned label with no meaning outside the study**, so its composition
belongs in define.xml.
:::

:::standard{kind="official"}
SDTMIG v3.4 provides `--LNKID` and `--LNKGRP` as identifier variables for relating records. `--LNKID`
identifies a **single** record for linking; `--LNKGRP` identifies a **group** of related records. They
are the lightweight alternative to a `RELREC` dataset for relationships the sponsor can express inside
the domains themselves, and using them does not remove the obligation to document what the value means.
:::

### The arithmetic, and where it stops

The join is one line and the counts are exact:

```text
TR records                     2,346
  of which LNKGRP = "A1"         420   (baseline — no response is assessed at baseline)
  of which post-baseline       1,926

RS OVRLRESP records            1,928
  matched to a TR record       1,928   (every response has a measurement)
  TR records with no response    418
```

`1,928` is two more than `1,926`, and those two are not a rounding artefact — they are the two subjects
whose `A1` scan is **not** a baseline. More on them shortly.

::dataset{id="oncology/sdtm/rs" cols="USUBJID,RSSEQ,RSLNKGRP,RSTESTCD,RSTEST,RSCAT,RSORRES,RSSTRESC,RSSTRESN,RSEVAL,RSLOBXFL,VISIT,RSDTC,RSDY" filter="RSTESTCD=OVRLRESP" rows="8" caption="RS — the investigator's overall response, one record per assessment"}

The response distribution across 409 subjects with at least one post-baseline assessment:

| `RSSTRESC` | Records | Meaning |
|---|---:|---|
| `SD` | 986 | Stable disease |
| `PR` | 578 | Partial response |
| `PD` | 324 | Progressive disease |
| `NE` | 26 | Not evaluable |
| `CR` | 14 | Complete response |

All 14 `CR` records belong to **one subject**, `CBX417-301-1009-0001`, whose sum of diameters is `0` at
every assessment from Week 12 onwards.

:::number[The data obeys the target-lesion rules exactly — and that is what makes the exceptions visible]
Joining `TR` to `RS` on `USUBJID` and `--LNKGRP` and recomputing the target-lesion criteria from
`TRSTRESN`:

| Recorded `RSSTRESC` | Target-lesion arithmetic says PD |
|---|---|
| `CR` (14) | never |
| `PR` (578) | never |
| `SD` (986) | never |
| `PD` (324) | **182 yes, 142 no** |

Every `PR` record has a sum of diameters at least 30% below baseline; every `SD` record is above that
threshold; every `CR` record has a sum of exactly 0. **No `CR`, `PR` or `SD` record meets the
progression criterion** — which is the consistency check worth running, because a subject recorded as
stable whose measurements say progression is a real finding.

The 142 that do not are fully accounted for:

```text
142  PD records with no target-lesion progression
106  a new lesion appeared
 36  unequivocal non-target progression
  0  unexplained
```

Neither of those two facts is in `TR` in this study, which is the whole point.
:::

:::standard{kind="simplification"}
CBX417-301 submits no `TU` domain, and its `TR` contains only `SUMDIAM` — one aggregate measurement per
assessment rather than one record per lesion. A production implementation identifies each lesion in
`TU` and measures it in `TR`, with the sum derived rather than collected. The two collected fields that
drive 142 of the 324 progressions — non-target response and new-lesion status — are annotated
`[NOT SUBMITTED]` on this study's aCRF; published `ONCRTSCD` terms exist for both (`NTRGRESP`,
`NEWLPROG`). This is a documented simplification of the teaching dataset, stated in its SDTM
specification and cSDRG, and not a model to copy.
:::

### TRSTAT, and the NE records that follow from it

```text
TRSTAT   = "NOT DONE"
TRREASND = "NOT EVALUABLE (IMAGE QUALITY)"    14 records
TRORRES  = (null)   TRSTRESC = (null)   TRSTRESN = (null)
```

Fourteen `TR` records document a scan that happened and could not be measured. Each has a matching `RS`
record with `RSSTRESC = "NE"`.

**The record exists although the result does not**, for the same reason `LB` keeps its `NOT DONE` rows:
without it, an unreadable scan is indistinguishable from a scan that was never scheduled, and the gap in
the subject's assessment series has no explanation.

That accounts for 14 of the 26 `NE` records. The other 12 have a different and more consequential cause.

## Worked example

### Subject 1001-0008 — a partial response, and the nadir rule

| `TRLNKGRP` | Visit | `TRSTRESN` | % from baseline | Nadir | % from nadir | `RSSTRESC` |
|---|---|---:|---:|---:|---:|---|
| `A1` | Screening | 70 | — | 70 | — | *(none)* |
| `A2` | Week 6 | 44 | **−37.1** | 44 | — | `PR` |
| `A3` | Week 12 | 29 | −58.6 | 29 | — | `PR` |
| `A4` | Week 18 | 27 | −61.4 | 27 | — | `PR` |
| `A5` | Week 24 | 30 | −57.1 | 27 | **+11.1** | `PR` |
| `A6` | Week 30 | 29 | −58.6 | 27 | +7.4 | `PR` |

Two things to read out of that table.

**Partial response is measured from baseline.** 44 against 70 is a 37.1% decrease, past the 30%
threshold, so Week 6 is a `PR`.

**Progression is measured from the nadir, not from baseline.** At Week 24 the sum rises from 27 to 30.
Compared with baseline that is still a 57.1% decrease; compared with the nadir it is an 11.1% increase
and a 3 mm absolute one. Neither reaches 20% or 5 mm, so the assessment stays `PR`.

:::why[Why two different reference points?]
Because they answer two different clinical questions.

**"Is the drug working?"** compares against where the subject started. Baseline is the right reference.

**"Has the subject's disease started growing again?"** compares against the best the subject ever
achieved. A tumour that shrank from 70 mm to 27 mm and has climbed back to 60 mm is progressing, even
though 60 is still comfortably below 70. Using baseline as the reference would call that a partial
response and let a subject continue a drug that has stopped working.

**The 5 mm absolute requirement exists because of small lesions.** A lesion at the nadir of 10 mm
crossing 12 mm is a 20% increase and is within measurement error on a CT. Requiring 5 mm as well means
that lesion has to reach 15 mm. The rule removes a category of false progressions that would otherwise
scale with how small the disease is.

Both reference points come from the criteria document, not from CDISC. The arithmetic belongs in ADaM;
SDTM stores the measurement the arithmetic runs on.
:::

### Subject 1001-0002 — the progression that is not in the measurements

This is the subject from the opening. All six sums are below baseline, the largest rise from nadir is
19.0% and 4 mm, and the Week 30 response is `PD`.

**The raw assessment page shows why:**

```text
VISIT_NAME  TARGET_SLD_MM  NONTARGET_RESP  NEW_LESION  OVERALL_RESP
Baseline           28
Week 6             21      Non-CR/Non-PD       N            SD
Week 12            22      Non-CR/Non-PD       N            SD
Week 18            22      Non-CR/Non-PD       N            SD
Week 24            24      Non-CR/Non-PD       N            SD
Week 30            25      Non-CR/Non-PD       Y            PD
```

One field changed from `N` to `Y`, and it is not in the submitted domains.

:::mistake[Deriving progression from SUMDIAM]
It is the single most expensive mistake in oncology programming, because it is *nearly* right. A
derivation over `TR` alone reproduces 182 of this study's 324 progressions — 56% — and every one it
produces is correct. The 142 it misses are subjects whose measured disease looked fine.

The consequence lands in `ADTTE`. Progression-free survival is the primary endpoint; a missed
progression becomes a later event date or a censoring, and 142 of 420 subjects moving in the same
direction is not a rounding error in a hazard ratio.

**In this study the derivation is impossible, not merely wrong**, because the two driving fields are not
submitted. The correct source for progression is `RS.RSSTRESC`, which is what `ADRS` reads.
:::

## Data example

### The two subjects with no baseline

`TR` has 420 records with `TRLNKGRP = "A1"` and `TRLOBXFL = "Y"` on only **414** of them. Six subjects
have a baseline scan that is not a pre-treatment observation, for two different reasons:

| Subjects | Why | `ARMNRS` |
|---:|---|---|
| 4 | Randomized and never treated — no exposure for the flag to be "before" | `ASSIGNED, NOT TREATED` |
| 2 | **Their `A1` scan is after first dose** — study days 43 and 40 | *(null)* |

The second pair is the interesting one. `CBX417-301-1036-0003` and `CBX417-301-1038-0009` never had a
baseline scan. The study's answer key records both as **"MISSING BASELINE ASSESSMENT — confirmed not
performed (major protocol deviation)"**.

What that does to their response records:

```text
1036-0003:  A1 NE  A2 NE  A3 NE  A4 NE  A5 NE  A6 NE  A7 PD
1038-0009:  A1 NE  A2 NE  A3 NE  A4 NE  A5 NE  A6 NE  A7 NE  A8 PD
```

**Every response until the last is `NE`.** Without a baseline sum of diameters there is nothing to
compute a percentage change from, so no target-lesion category can be assigned — and `NE` is the correct
answer rather than a missing value.

That is 13 `NE` records between them, of which 12 are the ones the `NOT DONE` scans did not explain;
`1038-0009`'s `A4` is both — the scan was unreadable *and* there was no baseline, and it is counted once,
in the 14.

:::number[Except for the last assessment each, and it is the rule in action]
Both subjects' final assessments are **`PD`**, not `NE`, and both raw rows carry `NEW_LESION = "Y"`.

A new lesion is unequivocal progression and needs no baseline to compare against. So a subject whose
every other response is not evaluable can still have a perfectly determinate progression — which is the
same point as subject 1001-0002's, arriving from the opposite direction.

In `ADTTE`, the SAP's censoring rule for a subject with no baseline or no post-baseline assessment
censors them at randomization. Nine subjects across the study carry `CNSR = 2` with
`CNSDTDSC = "RANDOMIZATION DATE"`. Separately, 11 subjects have a baseline scan and no post-baseline one
at all.
:::

### Unscheduled assessments and the sort that ruins them

21 of the 2,346 `TR` records are unscheduled, carrying `VISITNUM` values like `1006.01` and `1024.01`
beside the scheduled `1006.00` and `1024.00`. Each has a matching `RS` record.

But the trap in this domain is not the unscheduled visits. It is this:

```text
Sorted as text:   A1  A10  A11  A12  A13 … A19  A2  A20  A3  A4 …
Sorted correctly: A1  A2   A3   A4   A5  … A10  A11 A12  A13 A14 …
```

`--LNKGRP` values are **character**, and `A10` sorts before `A2`. Any derivation that walks a subject's
assessments in order — a running nadir, a first-progression date, a confirmation check — reads them in
the wrong order and produces confident, plausible nonsense: a "nadir" established before it was
measured, and progressions that appear to precede the response they follow.

```r
mutate(ORD = as.integer(sub("^A", "", LNKGRP))) |> arrange(USUBJID, ORD)
```

Subjects in this study have up to **20** assessments, so the bug affects any subject who reached `A10` —
73 of them reached at least that far.

## Common mistakes

:::mistake[Treating RECIST 1.1 as a CDISC standard]
It is a published criteria document, maintained outside CDISC and revised on its own schedule. CDISC
provides the codelist value `RSCAT = "RECIST 1.1"` so that a dataset can *name* the criteria it was
assessed under, alongside 95 other criteria sets in **ONCRSCAT (C124298)**. Saying "RECIST is part of
SDTM" in an interview is a specific and noticeable error.
:::

:::mistake[Deriving overall response from the sum of diameters]
182 of 324 progressions in this study meet the target-lesion criterion. The other 142 are driven by new
lesions (106) and unequivocal non-target progression (36), neither of which is a measurement. `RS` is the
source for response; `TR` is the source for the measurement the criteria ran on.
:::

:::mistake[Joining TR to RS on the assessment date]
Use `--LNKGRP`. One assessment can span two scan dates — a chest CT and a brain MRI on consecutive days —
and two assessments can share one, which is where a date join silently becomes many-to-many.
:::

:::mistake[Sorting --LNKGRP as text]
`A10` sorts before `A2`. Any running calculation over a subject's assessments — nadir, first
progression, response confirmation — is wrong for every subject who reached ten assessments. Extract the
number and sort on it.
:::

:::mistake[Measuring progression from baseline]
Partial response is measured from **baseline**; progression is measured from the **nadir**, and needs a
5 mm absolute increase as well as a 20% relative one. Subject 1001-0008 is 57.1% below baseline and
11.1% above nadir at the same assessment, and the answer is `PR`.
:::

:::mistake[Treating NE as missing]
26 records are `NE`. Fourteen have a `TR` record with `TRSTAT = "NOT DONE"` — the scan was unreadable.
Twelve belong to two subjects who never had a baseline scan, so no percentage change exists to compute.
Both are determinate answers to the question "what was the response", and both have a documented cause.
:::

## Knowledge check

::quiz{ids="sdtm.onc.recist-not-cdisc,sdtm.onc.lnkgrp-why,sdtm.onc.new-lesion-pd,sdtm.onc.rs-two-categories"}

## Hands-on exercise

::practice{ids="sdtm.onc.count-lnkgrp,sdtm.onc.nadir-calc,sdtm.onc.ne-records,sdtm.onc.join-code" title="Practice: linking measurements to responses"}

## Challenge exercise

::practice{ids="sdtm.onc.lnkgrp-sort,sdtm.onc.no-baseline,sdtm.onc.open-response" title="Challenge: the responses the measurements do not explain"}

## Industry note

**Independent review is the reason `--EVAL` exists.** Investigator assessment is what drives treatment
decisions at the site, and it is unblinded to how the subject is doing clinically. Many registration
studies therefore also commission a **blinded independent central review**: radiologists at a vendor
read the same images without knowing the arm or the investigator's answer. Both assessments are
submitted, distinguished by `RSEVAL` — `INVESTIGATOR` and `INDEPENDENT ASSESSOR` are both published
**EVAL (C78735)** terms — and the SAP names which one is primary. CBX417-301 has investigator assessment
only, so `RSEVAL` is `INVESTIGATOR` on all 5,003 records; a study with both has roughly twice the `RS`
records and a concordance analysis between them.

**Confirmation is an ADaM derivation, not an SDTM one.** A response recorded at one visit is
*unconfirmed*. Most protocols require a repeat assessment at least four weeks later showing the same or
better, without intervening progression, before a response counts towards the objective response rate.
That rule is in the SAP; in this study it turns visit-level `OVRLRESP` into `ADRS` parameters `BOR` and
`CBOR`, one record per subject each, which is why `ADRS` has 2,768 records against `RS`'s 1,928 response
records.

::widget{name="waterfall-plot"}

:::standard{kind="convention"}
Putting the derived sum of diameters in `TR` as `SUMDIAM` rather than deriving it from per-lesion records
is a sponsor decision about what was *collected*. When the CRF asks the radiologist for individual lesion
measurements, the per-lesion values are the collected data and the sum is derived; when the CRF asks only
for a total, the total is what was collected. **SDTM records what was collected**, so the two studies
look different in `TR` and neither is wrong. What has to be true is that the aCRF and define.xml say
which situation applies — a `SUMDIAM` with origin `Collected` and one with origin `Derived` are
different claims about the study.
:::

:::interview[Your TR domain says the tumour shrank. Your RS domain says progressive disease. Explain.]
"Both are right, and the reason is that RECIST evaluates three things and only one of them is a number.

The one everybody knows is target lesions: up to five measurable lesions summed, with a 30% decrease
from baseline being a partial response and a 20% increase from the **nadir** plus a 5 mm absolute
increase being progression. That is what `TR` carries — in the study I've been working with, as a single
`SUMDIAM` record per assessment.

The two that aren't numbers are non-target lesions, which are judged as unequivocally progressed or not,
and new lesions, where a single new lesion is progression regardless of everything else. Neither is a
measurement, so neither is in `TR`.

On that study there are 324 progression records and only 182 of them meet the target-lesion criterion.
106 are driven by a new lesion and 36 by unequivocal non-target progression. So 44% of the progressions
are invisible in the measurements, and I'd be specific that they aren't a random 44% — they're the
subjects whose measured disease was stable or shrinking.

I can give you the case directly. One subject's sums go 28, 21, 22, 22, 24, 25 millimetres. Every value
is below baseline, and the biggest rise from the nadir is 19% and 4 millimetres, which is under both
progression thresholds. The response at that assessment is `PD`, and the raw page shows the new-lesion
field flipping from N to Y.

**The practical rule is that `RS` is the source for response and `TR` is the source for the
measurement.** I'd never derive progression from `SUMDIAM` — on that study it can't be done at all,
because the non-target and new-lesion fields aren't submitted, which the cSDRG has to state.

Two mechanical things I'd mention. The join is on `--LNKGRP`, not on the date, because one assessment
can be a chest CT and a brain MRI on consecutive days and two assessments can share a date. And
`--LNKGRP` is character, so `A10` sorts before `A2` — any running nadir or first-progression derivation
has to extract the number and sort on that, or it's wrong for every subject who got past ten
assessments.

And RECIST itself isn't a CDISC standard. It's a published criteria document; what CDISC gives you is
`RSCAT = 'RECIST 1.1'` so the dataset can name which criteria the assessment was made under."
:::
