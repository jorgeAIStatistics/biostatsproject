## What problem are we trying to solve?

You are mapping CBX417-301 and you reach page 6 of the CRF — the vital-signs page. It collects:

```text
SYSBP   DIABP   PULSE   TEMP   TEMP_UNIT   WEIGHT   WEIGHT_UNIT   HEIGHT   HEIGHT_UNIT   ECOG
```

Nine of those ten are obviously vital signs. They go to `VS`.

**The tenth does not.** ECOG performance status is collected on the vital-signs page because that is
where the coordinator has the subject in front of them — but it is not a vital sign. In this study it is
submitted in `RS`, the Disease Response and Clinical Classification domain, with `RSCAT = "ECOG"` and
`RSTESTCD = "ECOG101"`, alongside the RECIST overall response.

::dataset{id="oncology/sdtm/rs" cols="USUBJID,RSSEQ,RSCAT,RSTESTCD,RSTEST,RSORRES,RSSTRESC,RSEVAL,VISIT,RSDTC" rows="8" caption="RS — two completely different assessments in one domain, separated by RSCAT"}

Three thousand and seventy-five ECOG records and 1,928 RECIST overall-response records live in the same
domain, and neither of them lives where it was collected.

**The page a field sits on tells you nothing about the domain it belongs to.** What tells you is the
*class* of the observation — and the class is decided by a question you can answer about any field on
any CRF in under ten seconds, once you know the question.

## Intuition

SDTM's central idea is that there are only three kinds of clinical observation.

| Class | The question it answers | Topic variable |
|---|---|---|
| **Interventions** | What was *given to* or *taken by* the subject? | `--TRT` |
| **Events** | What *happened to* the subject? | `--TERM` |
| **Findings** | What was *measured, assessed or evaluated*? | `--TESTCD` |

That is the whole taxonomy. A study drug administration is something given — Interventions. An adverse
event is something that happened — Events. A platelet count is something measured — Findings.

The **topic variable** is the pivot. Every general observation class has exactly one variable that says
*what the record is about*, and its suffix tells you the class instantly:

- `EX.EXTRT = "CBX-417"` — an intervention: the thing administered.
- `AE.AETERM = "Diarrhea"` — an event: the thing that happened.
- `LB.LBTESTCD = "NEUT"` — a finding: the question that was asked. The *answer* is somewhere else, in
  `LBORRES` / `LBSTRESC`.

:::why[Why do Findings split the question from the answer, when Events and Interventions do not?]
Because a finding has a **result**, and Events and Interventions do not.

"Diarrhea" is the whole content of the AE record. There is no separate value to report. But "neutrophil
count" is a *question*, and `2.06` is its *answer*. Putting the question in the topic variable and the
answer in a result qualifier is what makes one Findings structure work for laboratory results, vital
signs, ECGs, tumour measurements and performance status without inventing a new domain shape for each.

It is also why Findings domains are **tall**. CBX417-301's vital-signs CRF has 3,441 rows — one per
subject visit, with five measurements across the row. `VS` has **17,385** rows, because each measurement
becomes its own record. The Findings class trades width for uniformity, and the trade is what lets one
program summarise any Findings domain.
:::

## Clinical context

Every domain in CBX417-301, with its class and topic variable. This table is the lesson:

| Domain | Rows | Class | Topic variable | Example topic value |
|---|---:|---|---|---|
| `EX` | 7,070 | Interventions | `EXTRT` | `CBX-417`, `DOCETAXEL`, `PLACEBO` |
| `CM` | 3,540 | Interventions | `CMTRT` | `CARBOPLATIN AUC5` |
| `AE` | 2,466 | Events | `AETERM` | `Diarrhea` |
| `MH` | 1,292 | Events | `MHTERM` | `Hyperlipidaemia` |
| `DS` | 1,696 | Events | `DSTERM` | disposition and milestone text |
| `DV` | 131 | Events | `DVTERM` | deviation description |
| `LB` | 25,450 | Findings | `LBTESTCD` | `ALT`, `NEUT` |
| `VS` | 17,385 | Findings | `VSTESTCD` | `SYSBP`, `WEIGHT` |
| `EG` | 5,601 | Findings | `EGTESTCD` | `QTCFAG`, `INTP` |
| `RS` | 5,003 | Findings | `RSTESTCD` | `OVRLRESP`, `ECOG101` |
| `TR` | 2,346 | Findings | `TRTESTCD` | `SUMDIAM` |
| `DD` | 356 | Findings | `DDTESTCD` | `PRCDTH` |
| `SS` | 960 | Findings | `SSTESTCD` | `SURVSTAT` |

Then there are domains that are **not** general observation classes at all, and this is the part people
miss:

| Domain | Rows | Class | Why it is not a general observation |
|---|---:|---|---|
| `DM` | 468 | **Special Purpose** | One record per subject, not one per observation. It has no topic variable |
| `SE` | 1,277 | Special Purpose | Subject elements — the actual timeline, not an observation |
| `SV` | 8,071 | Special Purpose | Subject visits |
| `TA`, `TE`, `TS` | 6, 4, 41 | **Trial Design** | Describe the *trial*, not any subject |
| `SUPPDM`, `SUPPAE` | 4,553, 4,932 | **Relationship** | Point at other records rather than standing alone |

:::standard{kind="official"}
SDTM (the model) defines **three general observation classes** — Interventions, Events and Findings —
plus the **Findings About** class, and separately the Special Purpose, Trial Design and Relationship
dataset types. SDTMIG v3.4 assigns each published domain to one of these. `DM` is Special Purpose, not
a Findings domain, despite containing age and sex: it has one record per subject and no topic variable,
which is exactly what disqualifies it.
:::

## Formal concept

### Variable roles

Within a general observation class, every variable has a **role**, and the roles are the same in every
domain. This is what lets you read a domain you have never seen.

| Role | What it does | In `LB` |
|---|---|---|
| **Identifier** | Identifies the study, subject, domain and record | `STUDYID`, `DOMAIN`, `USUBJID`, `LBSEQ`, `LBREFID` |
| **Topic** | Says what the record is about | `LBTESTCD` |
| **Qualifier** | Everything that describes the topic | `LBTEST`, `LBCAT`, `LBORRES`, `LBSTRESN`, `LBNRIND`, `LBSTAT` |
| **Timing** | Places the record in time | `VISITNUM`, `VISIT`, `EPOCH`, `LBDTC`, `LBDY` |

Qualifiers subdivide, and the subdivision is worth learning because it explains variable names:

| Qualifier type | Job | Example |
|---|---|---|
| **Grouping** | Groups records together | `LBCAT = "CHEMISTRY"`, `RSCAT = "ECOG"` |
| **Result** | Carries the finding's value | `LBORRES`, `LBSTRESC`, `LBSTRESN` |
| **Synonym** | An alternative name for the topic | `AEDECOD` (the coded term for `AETERM`), `LBTEST` |
| **Variable** | Describes a specific other variable | `LBORRESU` describes `LBORRES`; `LBSTRESU` describes `LBSTRESC` |
| **Record** | Describes the whole record | `AESER`, `AETOXGR`, `LBNRIND`, `LBSTAT` |

:::number[Roles, counted across CBX417-301's SDTM layer]
From `data/oncology/manifest.json`, every SDTM column carries its role. Across all 21 domains:

| Role | Columns |
|---|---:|
| Identifier | 89 |
| Timing | 90 |
| Record Qualifier | 72 |
| Result Qualifier | 22 |
| Variable Qualifier | 22 |
| Synonym Qualifier | 15 |
| Topic | 14 |

**Fourteen topic variables across twenty-one datasets.** The seven without one are `DM`, `SE`, `SV`,
`TA`, `TE`, `SUPPDM` and `SUPPAE` — precisely the ones that are not general observation classes.
Counting topic variables is a fast structural check on whether you have understood a domain list.
:::

### Findings About

There is a fourth class, and it exists for one specific awkwardness: **a finding whose subject is not the
person but an event or an intervention.**

"Did the rash itch?" is not a finding about the subject. It is a finding *about* a particular adverse
event. `FA` handles this with `FAOBJ` naming the event the finding is about.

:::standard{kind="official"}
The **Findings About** class is defined in SDTM and implemented in SDTMIG v3.4 as the `FA` domain (and
domain-specific variants such as `FACM`). Its distinguishing variable is `FAOBJ`, "Object of the
Observation", which names the event, intervention or other object the finding concerns.
:::

CBX417-301 has no `FA` domain — none of its CRF pages collect findings about events. It is still worth
recognising, because the moment a study collects "severity of the infusion reaction at 30 minutes" or
"location of the rash", the question "does this need FA?" is the one to ask.

### The decision procedure

Work through it in order. Stop at the first yes.

```text
1. Is this about the trial rather than any subject?        -> Trial Design (TA/TE/TS/TI/TV)
2. Is it one row per subject, or the subject's timeline?   -> Special Purpose (DM/SE/SV/CO)
3. Was something given to or taken by the subject?         -> Interventions   (topic --TRT)
4. Did something happen to the subject?                    -> Events          (topic --TERM)
5. Was something measured, assessed or evaluated?          -> Findings        (topic --TESTCD)
6. Is it a finding about an event or intervention?         -> Findings About  (FAOBJ)
7. No standard variable for it anywhere?                   -> SUPPQUAL
```

:::mistake[Answering "which domain?" before answering "which class?"]
Asking "does ECOG go in VS or RS?" first leads to an argument about where it was collected. Asking
"is this measured or assessed?" first gives you Findings immediately, and *then* the domain question
becomes narrow: which Findings domain covers performance status? That order is faster and it is also
what a reviewer reconstructs when they audit your mapping.
:::

## Worked example

Map one CRF page of CBX417-301 field by field. This is the concomitant-medications page:

```text
CM_TERM   CM_INDICATION   CM_DOSE   CM_UNIT   CM_ROUTE   CM_FREQ
CM_START  CM_END          CM_ONGOING          CM_CATEGORY
CODED_NAME   CODED_ATC_CLASS
```

**Step 1 — class.** Medications are *taken by* the subject. Interventions. Topic variable `CMTRT`.

**Step 2 — the topic.** `CM_TERM` is what the record is about, so `CMTRT = CM_TERM`. The verbatim text
is the topic; the dictionary term is a *synonym qualifier*, `CMDECOD`.

**Step 3 — roles for everything else.** Once the class is fixed, each remaining field has exactly one
sensible role, and the role determines the variable name:

| Raw field | SDTM variable | Role |
|---|---|---|
| `CM_TERM` | `CMTRT` | Topic |
| `CODED_NAME` | `CMDECOD` | Synonym qualifier |
| `CODED_ATC_CLASS` | `CMCLAS` | Variable qualifier (describes `CMDECOD`) |
| `CM_INDICATION` | `CMINDC` | Record qualifier |
| `CM_DOSE` | `CMDOSE` | Record qualifier |
| `CM_UNIT` | `CMDOSU` | Variable qualifier (describes `CMDOSE`) |
| `CM_ROUTE`, `CM_FREQ` | `CMROUTE`, `CMDOSFRQ` | Record qualifiers |
| `CM_CATEGORY` | `CMCAT` | Grouping qualifier |
| `CM_START`, `CM_END` | `CMSTDTC`, `CMENDTC` | Timing |
| `CM_ONGOING` | `CMENRTPT` / `CMENTPT` | Timing |

::dataset{id="oncology/sdtm/cm" cols="USUBJID,CMSEQ,CMTRT,CMDECOD,CMCLAS,CMCAT,CMINDC,CMDOSE,CMDOSU,CMROUTE,CMSTDTC,CMENDTC" rows="6" caption="CM — every column on this page has a role, and the role chose the name"}

:::number[Why CMCAT matters here]
`CMCAT` splits CBX417-301's 3,540 medication records into three groups that are used for completely
different tables:

| `CMCAT` | Records |
|---|---:|
| `CONCOMITANT` | 2,111 |
| `PRIOR CANCER THERAPY` | 1,241 |
| `SUBSEQUENT ANTICANCER THERAPY` | 188 |

All three are Interventions and all three belong in `CM`. Splitting them into three domains would be
wrong; leaving them unsplit would make every downstream table wrong, because "prior lines of therapy"
and "concomitant medications" are different analyses. **A grouping qualifier is how one domain serves
several questions**, and getting it populated correctly is usually more consequential than any variable
name in the mapping.
:::

## Data example

Now the hard case in this study: **ECOG performance status.**

Run the decision procedure. Is it about the trial? No. One row per subject? No — it is collected at
every visit. Was something given to the subject? No. Did something happen to them? No. **Was something
assessed? Yes.** Findings.

So it needs a Findings domain with a `--TESTCD`. Not `VS`, because `VSTESTCD` covers physiological
measurements and performance status is not one. In CBX417-301 it goes to `RS`:

::dataset{id="oncology/sdtm/rs" cols="RSCAT,RSTESTCD,RSTEST,RSORRES,RSSTRESC,RSEVAL" filter="RSCAT=ECOG" rows="5" caption="ECOG in RS — the verbatim scale text in RSORRES, the score in RSSTRESC"}

Two details in those rows are characteristic of the Findings class:

1. **`RSORRES` holds the full scale text**, for example *"Restricted in physically strenuous activity but
   ambulatory and able to carry out work of a light or sedentary nature…"*, and `RSSTRESC` holds `1`. The
   original result is what was recorded; the standardized result is what you analyse. That pair appears
   in every Findings domain.
2. **`RSEVAL = "INVESTIGATOR"`** — who made the assessment. For RECIST response in a study with
   independent review, the same domain would carry `INVESTIGATOR` and `INDEPENDENT ASSESSOR` rows for the
   same timepoint, and `RSEVAL` is what keeps them apart.

:::number[The ECOG score distribution]
`RSSTRESC` for `RSCAT = "ECOG"`, across all 3,075 records:

| Score | Records |
|---:|---:|
| 0 | 1,154 |
| 1 | 1,564 |
| 2 | 340 |
| 3 | 17 |

The protocol requires ECOG 0 or 1 at entry, and the 357 records at 2 and 3 are on-treatment assessments
as subjects deteriorate — which is exactly why the assessment is repeated at every visit rather than
collected once. A domain choice that buried it inside `VS` would have made it far harder to find.
:::

::widget{name="sdtm-explorer"}

## Common mistakes

:::mistake[Mapping by CRF page instead of by class]
ECOG is collected on the vital-signs page and belongs in `RS`. Baseline histology is collected on the
disease-characteristics page and, in this study, ends up in `SUPPDM`. The page is an operational
convenience for the site; the class is a property of the observation.
:::

:::mistake[Treating DM as a Findings domain]
`DM` has one record per subject and no topic variable. Age, sex and race are record qualifiers of the
*subject*, not findings with results. This matters practically: there is no `DMTESTCD`, so you cannot
add a new demographic "test" the way you would add a new lab test — anything extra goes to `SUPPDM`,
which is precisely where CBX417-301 puts histology, stage, PD-L1 and prior lines.
:::

:::mistake[Putting the coded term in the topic variable]
`AETERM` and `CMTRT` hold what was **reported**. `AEDECOD` and `CMDECOD` hold the dictionary term. In
CBX417-301, 1,877 of 2,466 AE records have `AETERM` different from `AEDECOD` — "Tiredness" becomes
"Fatigue", "URTI" becomes "Upper respiratory tract infection". Overwriting the verbatim term destroys
the ability to check the coding, which is a step a medical monitor performs on every study.
:::

:::mistake[Creating a new domain because the data looks different]
Prior cancer therapy, concomitant medications and subsequent anticancer therapy all live in `CM`,
separated by `CMCAT`. Splitting them into three domains would be non-conformant and would break every
tool that expects medications in `CM`. Grouping qualifiers exist for exactly this.
:::

:::mistake[Forgetting that Findings domains are tall]
3,441 vital-sign CRF rows become 17,385 `VS` records. If your mapping program produces one output row
per input row for a Findings domain, you have not transposed and the domain is wrong in a way that no
column-level check will catch.
:::

## Knowledge check

::quiz{ids="sdtm.class.topic-suffix,sdtm.class.ecog-placement,sdtm.class.dm-not-findings,sdtm.class.role-of-unit"}

## Hands-on exercise

::practice{ids="sdtm.class.classify-fields,sdtm.class.order-procedure,sdtm.class.vs-row-count,sdtm.class.cmcat-map" title="Practice: place any collected field"}

## Challenge exercise

::practice{ids="sdtm.class.fa-or-supp,sdtm.class.topic-count,sdtm.class.open-new-field" title="Challenge: the fields with no obvious home"}

## Industry note

**The class decision is made once, early, by whoever writes the SDTM specification — and then it is
frozen.** Changing a domain assignment after programming has started means rewriting the domain, the
aCRF annotation, the define.xml entry, every downstream ADaM dataset that reads it and every validation
program. Sponsors resist late changes for that reason, not out of stubbornness.

**Where the real arguments happen:** disease-specific assessments that no published domain covers
cleanly. Performance status, patient-reported outcomes, imaging, device readings. There are therapeutic
area user guides for several of these (oncology, diabetes, Alzheimer's and others), and checking whether
one covers your study is a step worth taking before inventing anything.

:::standard{kind="convention"}
CBX417-301 carries baseline disease characteristics — histology, stage, PD-L1 score, prior lines, prior
immunotherapy, brain metastases, smoking status — in `SUPPDM`. A production study would more commonly put
the diagnosis and its history in `MH`, prior therapies in `CM`, and biomarker results in a findings
domain. The study's own README labels this as an educational simplification, and the cSDRG would have to
justify it. **Recognising that it is a simplification is the point:** when you read someone else's SDTM
and something sits in an unexpected place, the question to ask is which document explains it.
:::

:::interview[How do you decide which domain a collected field belongs to?]
"I decide the class before the domain, because the domain argument is unwinnable otherwise.

Three questions in order. Was something given to or taken by the subject — that's Interventions, topic
variable `--TRT`. Did something happen to them — Events, `--TERM`. Was something measured or assessed —
Findings, `--TESTCD`, and the result goes in a separate result qualifier. Before those three I check
whether it's actually trial-level, which is Trial Design, or one-row-per-subject, which is Special
Purpose like DM.

The example I'd give is ECOG performance status on the study I've been working with. It's collected on
the vital-signs CRF page, which pulls people toward `VS`. But it's an assessment with a result, so it's
Findings, and `VSTESTCD` is for physiological measurements — so it goes to `RS` with `RSCAT = "ECOG"`,
sharing the domain with the RECIST overall response. Three thousand of those records, none of them where
they were collected.

Once the class is settled, roles do the rest of the work: the topic gets `--TRT`/`--TERM`/`--TESTCD`,
a unit is a variable qualifier of the value it describes, a category is a grouping qualifier, and
anything with nowhere to go is a SUPPQUAL candidate. If a finding is about an event rather than about
the subject, that's the Findings About class with `FAOBJ`."
:::
