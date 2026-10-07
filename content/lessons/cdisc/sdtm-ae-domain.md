## What problem are we trying to solve?

The medical monitor sends one line: *"How many serious adverse events do we have?"*

You open `sdtm/ae.csv`, filter `AESER = "Y"` and count: **150**. You send it back.

An hour later they reply with three follow-ups, and each one is a different number.

> *"Serious in how many subjects?"* — not 150, because subjects have more than one.
> *"Treatment-emergent ones?"* — a variable that does not exist in AE.
> *"Related to study drug?"* — `AEREL` in AE covers CBX-417 only; docetaxel's assessment is in `SUPPAE`.

And one question you cannot answer from AE at all:

> *"How many in each arm?"*

**The AE domain has no treatment arm.** No `ARM`, no `ACTARM`, no `TRTA`. To split 2,466 adverse events
by treatment you have to join to `DM` on `USUBJID`, and to split them by *actual* treatment you have to
know which of `ARM` and `ACTARM` your table means.

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AESPID,AETERM,AEDECOD,AESOC,AETOXGR,AESER,AEREL,AEACN,AEOUT,AESTDTC,AESTDY,EPOCH" rows="8" caption="AE — 2,466 records across 414 subjects, and not a treatment arm in sight"}

This lesson builds that domain from the EDC page and then walks the boundary: what belongs in AE, what
belongs in `SUPPAE`, what belongs in another domain, and what belongs nowhere.

## Intuition

An adverse event record answers six questions, and the variables group into exactly those six:

| Question | Variables |
|---|---|
| **What happened?** | `AETERM` (verbatim), `AEDECOD` / `AEBODSYS` / `AESOC` (coded) |
| **When?** | `AESTDTC`, `AEENDTC`, `AESTDY`, `AEENDY`, `AEENRTPT`, `AEENTPT`, `EPOCH` |
| **How bad?** | `AETOXGR` (or `AESEV`) |
| **Was it serious?** | `AESER` plus the six criteria |
| **What did you do about it?** | `AEACN` |
| **Whose fault?** | `AEREL` |

Two of those six are where the difficulty is, and both for the same reason: **they look like one
question and are two.**

"How bad" splits into *severity* (how intense) and *seriousness* (a regulatory category). "Whose fault"
splits per drug, and this study gives every subject two drugs.

:::why[Severity and seriousness are not the same thing, and the difference has legal weight.]
**Severity** is a clinical intensity judgement: how bad was it. In oncology that is a CTCAE grade 1 to 5;
elsewhere it is usually mild, moderate or severe.

**Seriousness** is a regulatory classification with six defined criteria: the event resulted in death,
was life-threatening, required or prolonged hospitalization, caused persistent or significant
disability, was a congenital anomaly, or was an important medical event. **A serious adverse event
triggers expedited reporting timelines**, which is why the criteria are enumerated rather than left to
judgement.

They dissociate in both directions, and both directions occur here:

- A **grade 1** event requiring an overnight admission for observation is **serious** and not severe.
- A **grade 3** event managed as an outpatient — this study has 378 grade 3 events — is **severe** and
  not serious.

In CBX417-301, 150 records have `AESER = "Y"` while 502 have `AETOXGR` of 3 or higher. The two sets
overlap and neither contains the other.

"A severe adverse event" and "a serious adverse event" are different sentences. Saying one when you mean
the other in a safety meeting is a specific and noticeable error.
:::

## Clinical context

### CTCAE grade or severity — the study decides, and only one goes in

::::tabs
:::tab[Oncology: AETOXGR]
CBX417-301 carries `AETOXGR` and **no `AESEV` column at all**:

| `AETOXGR` | Records |
|---:|---:|
| 1 | 1,175 |
| 2 | 789 |
| 3 | 378 |
| 4 | 96 |
| 5 | 28 |

CTCAE grades are **term-specific**: the criteria for grade 3 diarrhoea and grade 3 neutropenia are
different definitions, written per term in the CTCAE document. A grade is not a generic intensity scale.
:::

:::tab[Non-oncology: AESEV]
The hypertension study in this repository carries `AESEV` and no `AETOXGR`:

| `AESEV` | Records |
|---:|---:|
| `MILD` | 80 |
| `MODERATE` | 54 |
| `SEVERE` | 8 |

An investigator's global judgement, with no per-term criteria behind it.
:::
::::

Both are legitimate SDTMIG v3.4 AE variables. **Carrying both is unusual and carrying neither is a
finding.**

:::standard{kind="official"}
`AESEV` ("Severity/Intensity") and `AETOXGR` ("Standard Toxicity Grade") are both Permissible variables
in the SDTMIG v3.4 AE domain. `AETOXGR` has no CDISC codelist; it holds the grade from the toxicity
scale the protocol names, which is recorded separately. A study collecting CTCAE grades submits
`AETOXGR`; a study collecting a three-level intensity submits `AESEV`.
:::

### Grade 5, fatal outcome and the death flag are three variables saying one thing

In CBX417-301 they agree exactly:

```text
AETOXGR = "5"   <=>   AEOUT = "FATAL"   <=>   AESDTH = "Y"      28 records, all three aligned
```

:::number[Why three variables for one fact, and why checking their agreement is worth doing]
They come from different parts of the CRF and answer subtly different questions:

- `AETOXGR = 5` is the CTCAE grade, which defines grade 5 as *death related to the adverse event*.
- `AEOUT = "FATAL"` is the event's outcome, from the outcome field.
- `AESDTH = "Y"` is one of the six seriousness criteria.

A site can tick them inconsistently, and studies routinely find records with `AEOUT = "FATAL"` and a
grade below 5, or `AESDTH = "Y"` with an outcome of `RECOVERED/RESOLVED`. **The cross-check is a
standard edit check**, and in this study all 28 agree.

Note what is *not* implied: 28 fatal adverse events against 356 deaths in the study. Most subjects died
of progressive disease, which in an oncology trial is the endpoint rather than an adverse event. Those
deaths live in `DS` (`DSDECOD = "DEATH"`, 356 records) and `DD` (`DDTESTCD = "PRCDTH"`, with
`PROGRESSIVE DISEASE` for 285 of them). **Reconciling AE, DS and DD is a real task** and the counts are
not supposed to match.
:::

### The six seriousness criteria

| Variable | Criterion | `Y` in this study |
|---|---|---:|
| `AESDTH` | Resulted in death | 28 |
| `AESHOSP` | Required or prolonged hospitalization | 126 |
| `AESLIFE` | Life-threatening | 22 |
| `AESMIE` | Other medically important event | 10 |
| `AESDISAB` | Persistent or significant disability | 5 |
| `AESCONG` | Congenital anomaly or birth defect | 0 |

All six are `NY (C66742)`, non-extensible, and all six are **null on the 2,316 non-serious records** —
the question is only asked when `AESER = "Y"`.

:::number[Every serious event has at least one criterion — check that it does]
All 150 records with `AESER = "Y"` have at least one criterion set to `Y`. That is the defining
consistency check for this block, and it fails more often than you would expect: a site ticks "serious"
on the front of the form and does not complete the criteria page.

`AESCONG = 0` is not a data problem. The study population is previously treated advanced NSCLC; a
congenital anomaly criterion has no plausible route to being met. **A criterion with no `Y` values is
normal.** What is not normal is a criterion with no values at all when `AESER = "Y"` records exist.
:::

## Formal concept

### Verbatim and coded: two terms, and you keep both

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AETERM,AEDECOD,AEBODSYS,AESOC" rows="10" caption="AE — AETERM is what the investigator wrote; AEDECOD is what the coder returned"}

**1,877 of 2,466 records** have `AETERM` different from `AEDECOD`:

| `AETERM` (verbatim) | `AEDECOD` (preferred term) |
|---|---|
| `Tiredness` | `Fatigue` |
| `hair loss` | `Alopecia` |
| `URTI` | `Upper respiratory tract infection` |
| `Septicaemia` | `Sepsis` |
| `Tingling hands and feet` | `Neuropathy peripheral` |
| `Elevated alanine aminotransferase` | `Alanine aminotransferase increased` |

The 2,466 records collapse to **56 distinct preferred terms** across **15 system organ classes**. That
collapse is the point: a safety table by preferred term is readable; a table of 1,900 verbatim strings
is not.

:::mistake[Overwriting AETERM with the coded term]
`AETERM` is the topic variable and it holds what the investigator wrote. It is the only record of the
original report, and a medical monitor reviewing the coding reads exactly this column against `AEDECOD`.
Replacing it destroys the ability to audit the coding, which is a step performed on every study before
lock.
:::

`AEBODSYS` and `AESOC` are identical on all 2,466 records here, which is common and not guaranteed.
`AESOC` is the dictionary's *primary* system organ class for that preferred term; `AEBODSYS` is the body
system used for reporting, which a sponsor may choose to define differently.

### Action taken, and the second drug

`AEACN` uses **ACN (C66767)**, non-extensible:

| `AEACN` | Records |
|---|---:|
| `DOSE NOT CHANGED` | 1,833 |
| `DRUG INTERRUPTED` | 300 |
| `NOT APPLICABLE` | 176 |
| `DRUG WITHDRAWN` | 83 |
| `DOSE REDUCED` | 74 |

`NOT APPLICABLE` is not a missing value: it means there was no study drug to act on — the event occurred
before first dose or after treatment ended.

**But `AEACN` and `AEREL` describe one drug**, and every subject in this study received two. The CRF
collects four fields:

| CRF field | Destination |
|---|---|
| `AE_REL_CBX` | `AE.AEREL` |
| `AE_ACTION_CBX` | `AE.AEACN` |
| `AE_REL_DOC` | `SUPPAE.QVAL` where `QNAM = "AERELDOC"` |
| `AE_ACTION_DOC` | `SUPPAE.QVAL` where `QNAM = "AEACNDOC"` |

::dataset{id="oncology/sdtm/suppae" cols="USUBJID,RDOMAIN,IDVAR,IDVARVAL,QNAM,QLABEL,QVAL,QORIG,QEVAL" rows="6" caption="SUPPAE — 4,932 rows, exactly two per AE record"}

:::number[2,466 x 2 = 4,932]
`SUPPAE` has 4,932 rows: one `AERELDOC` and one `AEACNDOC` for every AE record. The arithmetic is the
fastest check that no qualifier was lost.

The docetaxel assessments differ substantially from the CBX-417 ones:

| | `AEREL` (CBX-417) | `AERELDOC` (docetaxel) |
|---|---:|---:|
| `RELATED` | 1,051 | 1,350 |
| `NOT RELATED` | 1,412 | 1,116 |

More events are attributed to docetaxel than to the investigational product — which is what you would
expect when one arm's investigational product is placebo. **A "related adverse events" table that used
only `AEREL` would be answering a different question from one that used either assessment.** Which one
the SAP means has to be stated.

`SUPPAE` also carries `QEVAL = "INVESTIGATOR"` on every row, recording who made the assessment. `QORIG`
is `Collected`.
:::

### What AE does not have

| Not in AE | Where it is | Why |
|---|---|---|
| Treatment arm | `DM.ARM` / `DM.ACTARM`, joined on `USUBJID` | SDTM does not denormalise |
| Treatment-emergent flag | `ADAE.TRTEMFL` | A SAP definition |
| Analysis toxicity grade | `ADAE.ATOXGRN` | An analysis variable |
| Imputed start date | `ADAE.ASTDT` with `ASTDTF` | SDTM does not impute |
| Docetaxel relationship | `SUPPAE`, `QNAM = "AERELDOC"` | No standard AE variable for a second drug |

## Worked example

Build one AE record from the EDC page, field by field.

**The raw row** (`raw/ae.csv`, `AE-000001`):

```csv
RECORD_ID,SITE_ID,SUBJECT_ID,AE_LINE,AE_TERM,AE_START,AE_END,AE_ONGOING,AE_GRADE,AE_SERIOUS,AE_REL_CBX,AE_REL_DOC,AE_ACTION_CBX,AE_ACTION_DOC,AE_OUTCOME,CODED_PT,CODED_SOC
AE-000001,1001,1001-0002,1,Diarrhea,13 JUL 2022,25 JUL 2022,N,2,N,Related,Not related,Drug interrupted,Dose not changed,Recovered/Resolved,Diarrhea,Gastrointestinal disorders
```

**The mapping, with the reason for each:**

| SDTM | Value | How |
|---|---|---|
| `USUBJID` | `CBX417-301-1001-0002` | Derived from `STUDYID`, `SITE_ID`, `SUBJECT_ID` |
| `AESEQ` | `1` | Assigned after sorting; happens to equal `AESPID` here |
| `AESPID` | `1` | `AE_LINE`, the site's own line number |
| `AETERM` | `Diarrhea` | Verbatim, unchanged |
| `AEDECOD` | `Diarrhea` | `CODED_PT`, trimmed and case-standardised |
| `AESOC`, `AEBODSYS` | `Gastrointestinal disorders` | `CODED_SOC` |
| `AETOXGR` | `2` | `AE_GRADE` |
| `AESER` | `N` | `AE_SERIOUS`; the six criteria stay null |
| `AEREL` | `RELATED` | `AE_REL_CBX`, case-folded |
| `AEACN` | `DRUG INTERRUPTED` | `AE_ACTION_CBX`, mapped to codelist ACN |
| `AEOUT` | `RECOVERED/RESOLVED` | `AE_OUTCOME`, mapped to codelist OUT |
| `AESTDTC` | `2022-07-13` | `DATE9.` in, ISO 8601 out |
| `AEENDTC` | `2022-07-25` | same |
| `AESTDY` | `6` | Derived against `RFSTDTC = "2022-07-08T10:41"` |
| `AEENDY` | `18` | same |
| `EPOCH` | `TREATMENT` | Derived from the date against `RFXSTDTC`/`RFXENDTC` |

Plus two `SUPPAE` rows:

```text
IDVAR = "AESEQ"  IDVARVAL = "1"  QNAM = "AERELDOC"  QVAL = "NOT RELATED"
IDVAR = "AESEQ"  IDVARVAL = "1"  QNAM = "AEACNDOC"  QVAL = "DOSE NOT CHANGED"
```

:::number[The EX domain corroborates AEACN]
`AEACN = "DRUG INTERRUPTED"` is an investigator's assertion. `EX` shows it happening: subject
`1001-0002`'s CBX-417 intervals are `EXSEQ = 1` ending 2022-07-12 and `EXSEQ = 3` starting 2022-07-17,
with `EXADJ = "Resumed after interruption for diarrhea"`.

**Four days of no dosing, in the middle of the adverse event that runs from study day 6 to 18.**

Cross-domain corroboration like this is what a reviewer does and what a good QC programmer does. When
`AEACN = "DRUG INTERRUPTED"` and `EX` shows continuous dosing, one of the two is wrong and the discrepancy
is invisible within either domain alone.
:::

## Data example

### Three records with no causality, and they are not a programming error

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AETERM,AEDECOD,AETOXGR,AESER,AEREL,AEACN,AEOUT" filter="AEREL=" rows="4" caption="AE — three records where the investigator did not answer the causality question"}

Three of 2,466 records have a null `AEREL`, and the raw file has the same three nulls. The answer key
classifies them as **"TRUE FINDING: MISSING CAUSALITY"** — a genuine gap that a query did not close.

:::why[What do you do with three missing causality assessments?]
Not fabricate them, which is the only truly wrong answer.

The options, in the order a study would consider them:

1. **Query the site.** Tried; these are what remains after querying. Investigators leave study, sites
   close, and some records stay incomplete.
2. **Leave the null and document it.** This is what the study does. `AEREL` is Expected rather than
   Required, so a null is conformant, and the cSDRG explains the residual gap.
3. **Decide what the analysis does.** This is the real question, and it belongs to the SAP. A "related
   adverse events" table needs a rule for unknown causality, and the conservative convention is to
   **count unknown as related** — because understating the drug's attributed toxicity is the error that
   matters.

Three records will not move any number in this study. The reason to handle them properly is that the
rule has to exist *before* someone finds thirty of them.
:::

### Five records with no EPOCH, and one reason

Five AE records have a null `EPOCH`, and all five have a **partial start date**:

| `USUBJID` | `AETERM` | `AESTDTC` | `AESTDY` | `EPOCH` |
|---|---|---|---|---|
| `…-1026-0001` | tiredness | `2022-04` | *(null)* | *(null)* |
| `…-1029-0005` | Nauseous | `2023-03` | *(null)* | *(null)* |
| `…-1034-0012` | fatigue | `2023-06` | *(null)* | *(null)* |

`EPOCH` is derived by comparing the event date with `RFXSTDTC` and `RFXENDTC`. A date known only to the
month cannot be placed on either side of a boundary that falls inside that month, so the derivation
correctly declines.

The other 2,461 records: `TREATMENT` 2,323, `FOLLOW-UP` 99, `SCREENING` 39.

### Six raw records that are not in AE

| Reason | Records |
|---|---:|
| Exact duplicate rows from a double EDC export | 5 |
| Adverse event starting before informed consent | 1 |

The second is the interesting one. Subject `CBX417-301-1027-0019`'s CRF line 1, *"Chronic lower back
pain"*, started 14 February 2023 — before the subject consented.

:::why[Is a pre-consent condition an adverse event?]
No, and the reason is definitional. An adverse event is an untoward medical occurrence **in a subject
administered a pharmaceutical product**. A condition that existed before the subject entered the study
is **medical history**, and it belongs in `MH`.

This is the most common "records that belong somewhere else" case in AE mapping, and it produces the
visible signature discussed in the identifiers lesson: that subject's `AESPID` values run 2 to 8 while
their `AESEQ` values run 1 to 7.

Two related cases worth knowing:

- **A pre-existing condition that worsens** during the study *is* an adverse event — the worsening is
  the event. Investigators are trained to report it that way, and the verbatim term usually says so
  ("worsening of…").
- **Disease progression** in an oncology study is usually *not* reported as an adverse event, because it
  is the efficacy endpoint. CBX417-301 has 28 fatal adverse events against 285 deaths attributed to
  progressive disease in `DD`.
:::

## Common mistakes

:::mistake[Confusing severity with seriousness]
150 serious records and 502 at grade 3 or above, and neither set contains the other. Seriousness is a
regulatory classification with six enumerated criteria that triggers reporting timelines; severity is a
clinical intensity judgement.
:::

:::mistake[Reporting "related" events from AEREL alone in a two-drug regimen]
`AEREL` is the relationship to CBX-417 or placebo. Docetaxel's assessment is `SUPPAE.QNAM = "AERELDOC"`,
and it attributes more events (1,350) than `AEREL` does (1,051). The SAP has to say which assessment,
or both, the table means.
:::

:::mistake[Looking for treatment-emergence in AE]
There is no `TRTEMFL` in SDTM. Treatment-emergent is a SAP definition — in this study, first dose to
last dose plus 30 days — and it lives in `ADAE`. SDTM gives you the dates and `EPOCH`; the flag is an
analysis decision.
:::

:::mistake[Summarising AE by arm without joining to DM]
AE has no treatment variable. You join to `DM` on `USUBJID` — and then you choose between `ARM` and
`ACTARM`, which differ for one subject and leave two subjects with no `ACTARM` at all.
:::

:::mistake[Expecting fatal AEs to equal deaths]
28 fatal adverse events, 356 deaths. In oncology most deaths are from progressive disease, which is the
endpoint rather than an adverse event. `DS`, `DD` and `AE` are three different views and reconciling them
is a task, not a check that should balance.
:::

:::mistake[Filling in a missing causality]
Three records have a null `AEREL` after querying. The null is conformant and honest. What needs to exist
is a SAP rule for how unknown causality is counted — conventionally as related.
:::

## Knowledge check

::quiz{ids="sdtm.ae.severity-vs-serious,sdtm.ae.no-trtemfl,sdtm.ae.second-drug,sdtm.ae.grade5-triple"}

## Hands-on exercise

::practice{ids="sdtm.ae.count-serious-subjects,sdtm.ae.map-one-record,sdtm.ae.supp-arithmetic,sdtm.ae.join-code" title="Practice: counting adverse events correctly"}

## Challenge exercise

::practice{ids="sdtm.ae.belongs-elsewhere,sdtm.ae.reconcile-deaths,sdtm.ae.open-sae" title="Challenge: the records that are not adverse events"}

## Industry note

**SAE reconciliation is a named deliverable on every study.** Serious adverse events are reported to the
sponsor's pharmacovigilance system on an expedited timeline, separately from the clinical database, and
the two must agree before lock. The reconciliation compares subject, verbatim term, onset date,
seriousness criteria and outcome between the safety database and `AE`, and every discrepancy is
investigated. It is a recurring task, not a one-off, and it is frequently a clinical programmer's first
exposure to the safety function.

**Medical coding is a separate function on a separate schedule.** A coder maps verbatim terms to MedDRA;
a medical monitor reviews the mapping; the version of MedDRA is chosen and often upgraded before lock,
which re-codes existing terms. `AEDECOD` is therefore not stable through the life of a study, which
matters for any reconciliation keyed on it.

::widget{name="trace-value" tlf="ae-soc-pt"}

:::standard{kind="convention"}
Counting **subjects** rather than **events** is the standard for safety tables. CBX417-301 has 150
serious adverse-event records across **137 subjects**, and a safety table reports the 137 — because the
denominator is subjects and a subject with five events is still one subject. Frequency tables are ordered by descending incidence in the
experimental arm, and a subject with several events of the same preferred term is counted once. None of
this is in SDTM; it is table convention, it belongs in the shells, and getting it wrong produces
percentages above 100%.
:::

:::interview[Walk me through mapping an adverse-event page to SDTM.]
"Six questions, and the variables follow from them: what happened, when, how bad, was it serious, what
did you do, and whose fault.

What happened is two variables, not one. `AETERM` is the verbatim report and `AEDECOD` is the coded
preferred term, and you keep both — on the study I've been working with, 1,877 of 2,466 records have
them different, things like 'Tiredness' becoming 'Fatigue' and 'URTI' becoming 'Upper respiratory tract
infection'. Overwriting the verbatim term destroys the coder's audit trail.

How bad and was it serious are genuinely separate. That study is oncology so severity is `AETOXGR`, a
CTCAE grade, with 502 records at grade 3 or above. Seriousness is `AESER` plus six enumerated criteria —
death, life-threatening, hospitalization, disability, congenital anomaly, other medically important —
and there are 150 of those. Neither set contains the other, and seriousness is what triggers expedited
reporting, so the distinction has regulatory weight rather than just being pedantry.

Whose fault is where the study-specific work is. Every subject gets two drugs, and SDTM has one `AEREL`
and one `AEACN`. So the CBX-417 assessments go in the AE domain and the docetaxel ones go to `SUPPAE` as
`AERELDOC` and `AEACNDOC` — 4,932 supplemental rows, exactly two per AE record, which is also the check
that none went missing. Worth knowing that the two disagree: docetaxel is attributed 1,350 events
against CBX-417's 1,051, which is what you'd expect when half the subjects are on placebo.

And three things I'd say are *not* in AE: there's no treatment arm, so any by-arm table joins to DM;
there's no treatment-emergent flag, because that's a SAP definition and it's `ADAE.TRTEMFL`; and there's
no imputed date, because the five records with a partial start date correctly have a null `AESTDY` and a
null `EPOCH`."
:::
