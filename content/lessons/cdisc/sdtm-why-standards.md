## What problem are we trying to solve?

Your manager gives you a one-line task: **"Count the grade 3 or higher adverse events in both of our studies."**

Two studies sit on the server. Open the adverse-event export from the oncology study first:

```text
RECORD_ID,SITE_ID,SUBJECT_ID,AE_LINE,AE_TERM,AE_START,AE_END,AE_ONGOING,
AE_GRADE,AE_SERIOUS,AE_SER_DEATH,AE_SER_LIFE_THREAT,AE_SER_HOSP,
AE_SER_DISAB,AE_SER_CONG_ANOM,AE_SER_MED_IMPORTANT,AE_REL_CBX,AE_REL_DOC,
AE_ACTION_CBX,AE_ACTION_DOC,AE_OUTCOME,CODED_PT,CODED_SOC
```

Twenty-three columns, and every name was invented by whoever built that EDC database. `AE_GRADE` holds
the CTCAE grade. Severity is grade. Dates look like `13 JUL 2022`. Fine — you write the program.

Then you open the second study and none of it applies. Different column names, different date format,
and severity is not a grade at all but the words `MILD`, `MODERATE`, `SEVERE`.

Now multiply that by the reviewer's problem. A medical reviewer at a regulator looking at a marketing
application is not reading two studies. They are reading eight, from four different CROs, each with its
own EDC build, and they want one thing: the safety profile of this drug. If every study speaks its own
dialect, the reviewer's first month is spent writing translation programs instead of reviewing.

**SDTM is the translation, done once, by the sponsor, in a form everybody agrees on in advance.**

Here is the same adverse-event data after SDTM mapping, in both studies:

::dataset{id="oncology/sdtm/ae" cols="STUDYID,DOMAIN,USUBJID,AESEQ,AETERM,AEDECOD,AETOXGR,AESER,AESTDTC,AESTDY" rows="6" caption="CBX417-301 — SDTM AE"}

::dataset{id="cardio/sdtm/ae" cols="STUDYID,DOMAIN,USUBJID,AESEQ,AETERM,AEDECOD,AESEV,AESER,AESTDTC,AESTDY" rows="6" caption="VTX221-201 — SDTM AE, a completely different study"}

:::number[How much did standardization actually buy?]
Counted from the files in `data/`:

| Comparison | Shared column names |
|---|---:|
| `raw/ae.csv` vs `sdtm/ae.csv` (same study) | **0 of 23** |
| `oncology/sdtm/ae` vs `cardio/sdtm/ae` (different studies, different sponsors, different diseases) | **16 of 17** |

The raw oncology export and its own SDTM domain share **not a single column name**. Two unrelated SDTM
AE domains share all but one.

The one that differs is the severity variable: oncology uses `AETOXGR` (CTCAE grade 1–5), the
hypertension study uses `AESEV` (`MILD`/`MODERATE`/`SEVERE`). Both are valid SDTM. That difference is
the honest part of the story and we come back to it.
:::

## Intuition

The instinct people arrive with is that a data standard is a *format* — like agreeing everybody will use
CSV. It is not. A format tells you how bytes are arranged. SDTM tells you **what a row means**.

The useful mental model is a **filing cabinet with named drawers**. Before SDTM, every study invented its
own drawers. SDTM says: there is a drawer called AE and everything that is an adverse event goes in it;
inside, the reported term is always called `AETERM` and the start date is always called `AESTDTC` and it
is always ISO 8601 text.

Two consequences follow, and both matter more than the format:

1. **A program written once runs on any conformant study.** The reviewer's standard safety tools, the
   sponsor's standard macros, Pinnacle 21's conformance checks — all of them assume the drawer names.
2. **Deciding which drawer a piece of data goes in becomes the real work.** Mapping is not renaming
   columns. It is a series of judgements: is ECOG performance status a vital sign or a disease response?
   (In CBX417-301 it is collected on the vital-signs page and submitted in `RS`.) Is a baseline histology
   a medical-history record or a supplemental qualifier of demographics? Those decisions are where a study
   becomes conformant or does not.

:::why[Why doesn't the sponsor just send the raw data and let the reviewer sort it out?]
Because the reviewer cannot. The raw export is meaningless without the EDC build specification, the edit
checks, the query history and the person who built it. `AE_REL_CBX` means "relationship to CBX-417" only
if you know what CBX-417 is and that a second `AE_REL_DOC` column exists for the other drug in the
regimen.

Standardizing also forces the sponsor to *make the ambiguous decisions explicit and write them down*.
That is why Define-XML and the annotated CRF exist and why they are submitted alongside the data: the
reviewer gets the decisions, not just the rows.
:::

## Clinical context

Three artifacts are constantly confused. They are different documents with different jobs.

| Artifact | What it is | What it does not do |
|---|---|---|
| **SDTM** (the model) | The abstract framework: three general observation classes, the variable **roles** (Identifier, Topic, Qualifier, Timing), the naming pattern `--TESTCD`, `--DTC`, `--SEQ` | Does not define a single domain or variable list |
| **SDTMIG** (the implementation guide) | Concrete domains — DM, AE, LB, EX, VS — with their variable lists, core status (Required / Expected / Permissible) and assumptions | Does not define analysis variables |
| **Controlled terminology** (NCI EVS, published for CDISC) | The permitted values: `AEOUT` may be `FATAL`, `RECOVERED/RESOLVED`, … | Does not tell you which variable to use |

CBX417-301 states its own versions in the Trial Summary domain, which is exactly where a reviewer looks
first:

::dataset{id="oncology/sdtm/ts" cols="TSPARMCD,TSPARM,TSVAL" filter="TSPARMCD~VER" rows="4" caption="TS — the study declares its own standard versions"}

The rest of the 41 `TS` records describe the trial itself: `TPHASE = "PHASE II/III TRIAL"`,
`NARMS = "2"`, `PLANSUB = "420"`, `ACTSUB = "420"`, `DCUTDTC = "2025-03-31"`,
`TBLIND = "DOUBLE BLIND"`, and both stratification factors.

::dataset{id="oncology/sdtm/ts" cols="TSSEQ,TSPARMCD,TSPARM,TSVAL" rows="10" caption="TS — one record per trial summary parameter value"}

:::standard{kind="official"}
`TS` (Trial Summary) is an SDTMIG v3.4 trial-design domain, one record per trial summary parameter value,
keyed on `TSPARMCD`/`TSSEQ`. `TSPARMCD` and `TSPARM` are governed by the NCI/CDISC codelists
**TSPARMCD (C66738)** and **TSPARM (C67152)**. In this study `SDTMVER = "2.0"` and `SDTIGVER = "3.4"`:
the model version and the implementation-guide version are separate parameters because they version
independently.
:::

## Formal concept

### SDTM is a tabulation standard

This is the sentence people skip, and it is the one that determines what you will and will not find in
a domain.

**A tabulation dataset represents what was observed and collected.** It does not represent what you
decided to analyse. The boundary is enforced by what is simply absent from SDTM:

| Analysis question | Lives in | Not in SDTM because |
|---|---|---|
| Was this AE treatment-emergent? | ADaM `ADAE.TRTEMFL` | "Treatment-emergent" is an analysis definition from the SAP, not an observation |
| Which record is the analysis baseline? | ADaM `ADLB.ABLFL` | Baseline choice depends on the analysis; SDTM only flags the last record before exposure |
| What analysis visit does this unscheduled draw belong to? | ADaM `AVISIT` | Visit windowing is an analysis rule |
| What is the change from baseline? | ADaM `CHG` | A derived comparison, not an observation |

:::number[Prove it on the data]
`data/oncology/sdtm/ae.csv` has 27 columns. `TRTEMFL` is not one of them. `data/oncology/adam/adae.csv`
has 46 columns and it is there.

`data/oncology/sdtm/lb.csv` has `LBLOBXFL` — the *last observation before first exposure* flag — with
exactly one `Y` per subject and test: 2,910 flagged records, 415–416 per test across 7 tests.
`data/oncology/adam/adlb.csv` separately carries `ABLFL`. They are not the same variable and they are
not guaranteed to agree, because `ABLFL` answers a question the SAP asks and `LBLOBXFL` answers a
question the data asks.
:::

:::standard{kind="official"}
`--LOBXFL` ("Last Observation Before Exposure Flag") was added to the SDTM findings classes and is used
in SDTMIG v3.4 as the standardized pre-exposure flag. It is distinct from ADaM's `ABLFL`, which is the
analysis baseline record flag defined in ADaMIG v1.3. Using one where the other is meant is a real and
common error.
:::

### What "FDA requires SDTM" actually means

It is not a single sentence in a single regulation, and saying it loosely in an interview is a tell.

:::standard{kind="official"}
Two FDA documents carry the operative content:

- The **Data Standards Catalog** lists the data standards and the specific **versions** FDA supports for
  submission, with the dates each becomes supported or required.
- The **Study Data Technical Conformance Guide** describes the technical expectations for submitting
  standardized study data — file formats, folder structure, Define-XML, the Study Data Reviewer's Guide.

The requirement to submit standardized study data attaches to certain application types and study start
dates, and the Catalog is the authority on which version applies to your study. **Check the Catalog for
the study, do not assume the newest version.** Neither document is a statute; both are the practical
answer to "what do we have to send".
:::

:::mistake[Saying "the FDA requires SDTMIG v3.4"]
The FDA supports a *range* of versions at any time, and which one applies depends on when your study
started. CBX417-301 records `SDTIGVER = "3.4"` in TS precisely so nobody has to guess. A study that began
earlier may legitimately submit an earlier IG version, and re-mapping an old study to a new IG to look
modern is expensive and creates risk rather than removing it.
:::

## Worked example

Take one adverse event through the boundary, end to end.

**The raw row** (EDC export, `raw/ae.csv`, first record):

```csv
RECORD_ID,SITE_ID,SUBJECT_ID,AE_LINE,AE_TERM,AE_START,AE_END,AE_ONGOING,AE_GRADE,AE_SERIOUS,AE_REL_CBX,AE_REL_DOC,AE_ACTION_CBX,AE_ACTION_DOC,AE_OUTCOME,CODED_PT,CODED_SOC
AE-000001,1001,1001-0002,1,Diarrhea,13 JUL 2022,25 JUL 2022,N,2,N,Related,Not related,Drug interrupted,Dose not changed,Recovered/Resolved,Diarrhea,Gastrointestinal disorders
```

**The SDTM row.** Four things changed, and each is a different kind of change:

| Raw | SDTM | Kind of change |
|---|---|---|
| `SITE_ID` + `SUBJECT_ID` | `USUBJID = "CBX417-301-1001-0002"` | **Derivation** — a study-unique key is constructed |
| `13 JUL 2022` | `AESTDTC = "2022-07-13"` | **Format** — ISO 8601 text |
| `Recovered/Resolved` | `AEOUT = "RECOVERED/RESOLVED"` | **Controlled terminology** — the submission value from codelist OUT (C66768) |
| `AE_REL_DOC` | `SUPPAE.QVAL when QNAM = "AERELDOC"` | **Structure** — a second causality has no standard AE variable, so it becomes a supplemental qualifier |

And one thing was *added* that was not collected anywhere: `AESTDY = 6`, the study day, derived against
the subject's reference start date.

:::number[Where does AESTDY = 6 come from?]
The subject's `RFSTDTC` in DM is `2022-07-08T10:41` — the first dose. The AE started `2022-07-13`.

```text
2022-07-13 − 2022-07-08 = 5 days
AESTDY = 5 + 1 = 6      (there is no day 0)
```

Verified across the whole domain: all 2,454 AE records with a non-missing `AESTDY` satisfy this formula,
and none has `AESTDY = 0`. Twelve records have no `AESTDY` at all, because their `AESTDTC` is a partial
date such as `2023-06`.
:::

**What did not happen:** nobody decided whether this event was treatment-emergent, nobody assigned it to
an analysis period, and nobody compared it to anything. Those come later, in ADaM.

## Data example

The trap is believing standardized means *identical*. Look at the two studies again.

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AETERM,AEDECOD,AETOXGR,AESER,AEACN,AEOUT" rows="5" caption="Oncology: severity expressed as a CTCAE grade"}

::dataset{id="cardio/sdtm/ae" cols="USUBJID,AETERM,AEDECOD,AESEV,AESER,AEACN,AEOUT" rows="5" caption="Hypertension: severity expressed as MILD / MODERATE / SEVERE"}

`AESEV` and `AETOXGR` are both legitimate SDTMIG v3.4 AE variables. Oncology protocols grade by CTCAE and
therefore collect `AETOXGR`; most non-oncology protocols collect a three-level severity and therefore use
`AESEV`. CBX417-301 has **no `AESEV` column at all** — 2,466 records with `AETOXGR` in {1,2,3,4,5}
(1,175 / 789 / 378 / 96 / 28).

:::why[So the standard did not actually standardize severity?]
It standardized the *question*. Both studies answer "how bad was it" in a named variable with a published
codelist, in a domain the reviewer can find without asking. What the standard cannot do is make an
oncology CTCAE grade mean the same clinical thing as a cardiology severity rating — because they do not.

This is the realistic ceiling of any data standard: it removes the accidental differences (column names,
date formats, spelling) so that the real differences stay visible. A tool that pooled `AESEV = "SEVERE"`
with `AETOXGR = 3` across these two studies would produce a number, and the number would be meaningless.
Knowing where the standard stops is part of knowing the standard.
:::

## Common mistakes

:::mistake[Treating SDTM as a renaming exercise]
Zero of the 23 raw AE column names survive into SDTM. Mapping is a sequence of decisions about meaning —
which domain, which variable, which codelist value, what goes to SUPPQUAL — not a lookup table of old
name to new name. The specification document exists because the decisions need to be written down.
:::

:::mistake[Putting analysis variables into SDTM because they would be convenient there]
Treatment-emergent flags, analysis baselines, analysis visits and changes from baseline belong to ADaM.
Adding `TRTEMFL` to your AE domain will fail conformance and, worse, it hides an analysis decision inside
a dataset that is supposed to contain observations.
:::

:::mistake[Confusing --LOBXFL with ABLFL]
`LBLOBXFL` is SDTM's *last observation before first exposure* flag; `ABLFL` is ADaM's *analysis baseline*
flag. They often land on the same record and they are not the same variable. When the SAP defines
baseline as something other than the last pre-dose value, they diverge, and copying one into the other
silently changes the analysis.
:::

:::mistake[Quoting the FDA requirement from memory]
"FDA requires SDTM" is close enough for a corridor conversation and wrong in an interview. The Data
Standards Catalog names supported versions and their dates; the Study Data Technical Conformance Guide
describes how to submit. Which version applies to a given study depends on that study, which is why `TS`
carries `SDTIGVER`.
:::

:::mistake[Assuming two conformant studies are poolable]
CBX417-301 and VTX221-201 are both conformant and their AE domains differ in the severity variable.
Conformance guarantees that a reviewer can read both; it does not guarantee that a variable means the
same thing in both.
:::

## Knowledge check

::quiz{ids="sdtm.why.model-vs-ig,sdtm.why.tabulation-boundary,sdtm.why.lobxfl-vs-ablfl,sdtm.why.fda-requirement"}

## Hands-on exercise

::practice{ids="sdtm.why.shared-columns,sdtm.why.classify-layer,sdtm.why.ts-lookup,sdtm.why.compare-code" title="Practice: what the standard does and does not buy you"}

## Challenge exercise

::practice{ids="sdtm.why.pooling-trap,sdtm.why.raw-survives,sdtm.why.open" title="Challenge: the limits of conformance"}

## Industry note

**Conformance is checked by software, and everybody runs it.** Pinnacle 21 (Community or Enterprise) is
the de facto tool; sponsors run it before every delivery and regulators run it on receipt. A conformance
report full of errors does not stop a submission by itself — many findings are explained rather than
fixed — but every unexplained one becomes a question, and questions cost weeks. The explanations live in
the **cSDRG** (clinical Study Data Reviewer's Guide).

**Your first SDTM job will not be designing a mapping.** It will be reading an existing specification and
programming a domain to match it, then reconciling your output against an independent programmer's.
Reading a spec accurately — including the sentence in the middle of a cell that says "null for screen
failures" — is the skill being assessed.

::widget{name="sdtm-explorer"}

:::standard{kind="convention"}
The idea that SDTM is "for the regulator" and ADaM is "for the statistician" is a useful teaching
shorthand and not quite true. Sponsors read SDTM constantly — safety signal reviews, data-cleaning
listings, ad-hoc questions from the medical monitor — because it is the only complete, stable,
study-wide view of what was collected. Treating it as a write-only deliverable is how studies end up
with SDTM nobody trusts.
:::

:::interview[Why does SDTM exist, in one minute?]
"Because a reviewer reading eight studies from four CROs would otherwise have to write eight translation
programs before reading anything. SDTM moves that translation to the sponsor and fixes it in advance:
same domains, same variable names, same controlled terminology, same ISO 8601 dates.

The part people leave out is that it's a *tabulation* standard. It holds what was observed — the AE and
its reported term, grade and dates — and deliberately not what you decided to analyse. Treatment-emergent
flags, analysis baselines, analysis visits and change from baseline are ADaM. That boundary is why
there's a second standard at all.

And it has a ceiling. On the two studies I've been working with, the SDTM AE domains share sixteen of
seventeen column names even though the studies have nothing to do with each other — but one uses
`AETOXGR` because it's an oncology study graded by CTCAE and the other uses `AESEV`. Both are conformant.
The standard removes the accidental differences so the real ones stay visible; it doesn't make two
studies poolable."
:::
