## What problem are we trying to solve?

It is your second week as a statistical programmer at a CRO. The biostatistician forwards an email from the sponsor's medical lead:

> "Table 14.3.1.2 shows 101 subjects with diarrhea on CBX-417, but the safety narrative says 'about half of patients'. Which is right, and where does the number come from?"

To answer, you need to know where that number was born. It started as a nurse typing "loose stools" into an electronic case report form. It was coded to a dictionary term, cleaned by data management, mapped into an SDTM dataset, derived into an ADaM dataset with a treatment-emergent flag, counted by a TLF program, checked by a QC programmer, pasted into a clinical study report — and now it is the subject of an ad hoc question.

Every job in clinical biometrics sits somewhere on that path. If you know the whole path, you can answer "where does this number come from?" quickly and with evidence. If you only know your own step, you will guess — and guessing is how wrong numbers reach regulators.

(The 101 in the email is invented for the scenario. You will compute real numbers from the CBX417-301 data in later labs.)

## Intuition

Think of a trial as a **promise made in advance, kept with evidence**.

- The **protocol** is the promise: *we will treat these patients this way and measure these outcomes on this schedule*.
- The **case report form (CRF)** is the instrument that records whether the promise was kept, patient by patient, visit by visit.
- **Data management** makes the record trustworthy: complete, consistent, coded, reconciled.
- **SDTM** reorganizes the record into a standard shape that any reviewer can navigate.
- **ADaM** reshapes it again into exactly what each analysis needs — with every derivation documented.
- **Analysis and TLFs** turn the data into the answers the protocol promised.
- **QC** proves the answers were computed correctly.
- The **CSR** tells the story, and **ad hoc** requests keep asking new questions of the same data.

Each stage adds structure and removes ambiguity, and each stage must be **traceable** to the previous one. Click through the map below; for each stage, note what goes in, what comes out, and who owns it.

::widget{name="lifecycle-map"}

## Clinical context

### The phases of clinical development

| Phase | Typical question | Typical design | What biometrics produces |
|---|---|---|---|
| Phase 1 | Is it safe? What dose? How is it absorbed and cleared? | Small, often dose-escalation; in oncology usually in patients rather than healthy volunteers | Safety listings, PK summaries, dose-escalation tables |
| Phase 2 | Is there a signal of efficacy? Which dose to take forward? | Randomized or single-arm, moderate size | Response rates, early time-to-event data, dose–response |
| Phase 3 | Does it work better than the standard, with acceptable safety? | Large, randomized, usually blinded, confirmatory | Full SDTM/ADaM, SAP-driven TLFs, CSR, submission datasets |
| Phase 4 | What happens in routine use? | Post-approval studies, registries | Safety surveillance, real-world analyses |

CBX417-301 is a **Phase 2/3** trial: one protocol designed so that an early portion can inform decisions while the full study provides confirmatory evidence. For your work, it behaves like a Phase 3 study: 420 randomized subjects, a prespecified primary endpoint (PFS), a formal SAP, and submission-style datasets.

:::standard{kind="official" source="ICH E8(R1) General Considerations for Clinical Studies"}
ICH E8(R1) describes development as a sequence of studies whose objectives build on each other, and it encourages sponsors to design quality into studies by identifying the factors critical to reliable results. The phase labels are a descriptive convention; ICH E8(R1) itself emphasizes study objectives over phase names.
:::

### Sponsor, CRO and who does what

The **sponsor** owns the product and takes legal responsibility for the trial (in CBX417-301, the fictional Halden Therapeutics). A **contract research organization (CRO)** is hired to perform some or all of the work: site monitoring, data management, programming, statistics, medical writing. Many programmers spend their early careers at CROs working on several sponsors' studies at once.

| Role | Owns | Hands to |
|---|---|---|
| Clinical scientist / medical lead | Scientific rationale, eligibility, medical review of data | Protocol content, data review findings |
| Biostatistician | Design, sample size, randomization scheme, SAP, shells, interpretation | SAP and shells to programmers; results to the team |
| Data manager | CRF design, database build, edit checks, queries, coding, reconciliation, database lock | Clean, locked raw data |
| Statistical programmer | SDTM and ADaM datasets, TLF programs, QC, define.xml, reviewer guides | Datasets and outputs |
| Medical writer | Protocol text, CSR, narratives | Documents to regulators |
| Clinical operations (CRA, study manager) | Sites, monitoring, source data verification | Site issues, protocol deviations |
| Pharmacovigilance / drug safety | Expedited safety reporting of SAEs | The safety database used for SAE reconciliation |

:::industry
Titles vary. "Clinical data scientist" can mean a data manager with programming skills, a programmer who builds data-review tools, or an analyst who explores trial data. "Statistical programmer" and "SAS programmer" are often the same job. Read the job description's verbs — *derive, validate, map, query, report* — rather than the title.
:::

## Formal concept

### The data lifecycle, stage by stage

| Stage | Input | Output | Primary owner | What can go wrong |
|---|---|---|---|---|
| **Protocol** | Scientific question | Objectives, endpoints, design, schedule of assessments | Clinical + statistics | An endpoint that cannot be derived from what is collected |
| **CRF** | Protocol schedule | eCRF pages, completion guidelines | Data management | Fields missing for a derivation the SAP needs |
| **Raw** | Site entry, vendor transfers (labs, IxRS) | EDC extracts, vendor files | Data management | Wrong units, partial dates, duplicates |
| **Data management** | Raw data | Queried, coded, reconciled, locked data | Data management | Unresolved queries at lock |
| **SDTM** | Locked raw data | Standard tabulation domains (DM, AE, LB, …) | Programming | Mapping errors, wrong controlled terminology |
| **ADaM** | SDTM | Analysis-ready datasets (ADSL, ADAE, ADTTE, …) | Programming, per statistician's spec | Wrong derivation, flag or population |
| **Analysis** | ADaM | Model results (estimates, CIs, p-values) | Statistics + programming | Wrong model options, wrong population |
| **TLF** | ADaM + analysis results | Tables, listings, figures | Programming | Wrong denominator, format, sort order |
| **QC** | Production outputs | Independent reproduction, findings log | Second programmer | QC copies production logic instead of reproducing it |
| **CSR** | TLFs | Clinical study report | Medical writing + statistics | Text that disagrees with tables |
| **Ad hoc** | Locked data, questions from the team or regulators | Additional outputs | Programming + statistics | Unvalidated quick answers that get reused |

:::why[Why two standards (SDTM and ADaM) instead of one?]
They answer different questions. SDTM is a **tabulation**: it shows what was collected, in a predictable structure, with minimal derivation — so a reviewer can find any observation. ADaM is for **analysis**: it adds derived values (baseline, change from baseline, treatment-emergent flags, time-to-event with censoring) in a structure that analysis programs can use directly, with metadata linking each derived value back to its source. Keeping them separate protects traceability: you can always tell what was *observed* from what was *derived*.
:::

### Traceability is the thread

**Traceability** means that any number in a table can be followed back to the records that produced it, and each derivation step is documented. In practice it relies on:

- stable identifiers (`STUDYID`, `USUBJID`, `--SEQ`, `--SPID`);
- specifications that state each derivation in words;
- ADaM variables that record provenance (for example `SRCDOM`, `SRCVAR`, `SRCSEQ` in the CBX417-301 `ADLB`);
- a define.xml and reviewer guides that describe the datasets to the reviewer.

:::standard{kind="official" source="ICH E6 Good Clinical Practice; 21 CFR Part 11"}
Good Clinical Practice requires that trial data be attributable, accurate and verifiable against source, and that computerized systems used for trial data be validated and keep audit trails. In the US, 21 CFR Part 11 sets requirements for electronic records and electronic signatures. These are why EDC systems log every change and why production programs run in controlled environments.
:::

## Worked example

Follow one adverse event through the whole lifecycle. The values below are **illustrative**, constructed for this lesson — not taken from the generated CBX417-301 files.

**1. Protocol.** Section "Adverse events" says: record all AEs from informed consent until 30 days after the last dose; grade them with NCI CTCAE v5.0.

**2. CRF.** On the Adverse Event log page the site enters:

| Field | Entered value |
|---|---|
| `AE_TERM` | Loose stools |
| `AE_START` | UN MAR 2023 |
| `AE_GRADE` | 2 |
| `AE_SERIOUS` | No |

The start day is unknown, so the site enters `UN` for the day — the EDC allows partial dates.

**3. Raw.** The EDC extract `ae.csv` holds the row with `RECORD_ID = AE-000123`, exactly as entered, plus `CODED_PT` and `CODED_SOC` added by coding.

**4. Data management.** The coder assigns the preferred term *Diarrhea* in the system organ class *Gastrointestinal disorders*. An edit check confirms the start date is on or after informed consent. No query is needed.

**5. SDTM.** The AE domain row gets `AETERM = "Loose stools"` (verbatim, never overwritten), `AEDECOD = "Diarrhea"`, `AESTDTC = "2023-03"` (ISO 8601 keeps only the known part), `AETOXGR = "2"`, and `AESPID` carries the raw AE line number for traceability.

**6. ADaM.** `ADAE` needs a full date to decide whether the AE is treatment-emergent. Suppose this subject's first dose `TRTSDT` is 2023-03-14. The SAP rule for a missing day: impute the 1st of the month, *unless* the AE month equals the first-dose month, in which case use `TRTSDT`. March 2023 is the first-dose month, so `ASTDT = 2023-03-14` and `ASTDTF = "D"` (day imputed). With `ASTDT ≥ TRTSDT` and within 30 days after the last dose, `TRTEMFL = "Y"`.

:::number[Why impute to TRTSDT rather than March 1?]
If March 1 were used, the AE would appear to start *before* the first dose (March 14) and would not count as treatment-emergent. Since the true day is unknown, the SAP chooses the conservative option: when the partial date is compatible with onset on or after first dose, assume it was — so a possible drug effect is not hidden. The rule, not the programmer, makes this choice, and `ASTDTF` records that it was imputed.
:::

**7. Analysis and TLF.** The AE-by-SOC-and-PT table counts subjects with `TRTEMFL = "Y"` in the safety population, by actual treatment `TRTA`. This subject contributes 1 to the *Diarrhea* row of their arm — once, however many diarrhea records they have.

**8. QC.** A second programmer independently derives `TRTEMFL` and reproduces the table; the counts must match cell for cell.

**9. CSR.** The medical writer writes: "Diarrhea was reported in xx.x% of patients in the CBX-417 arm…", citing Table 14.3.1.2.

**10. Ad hoc.** Months later, a regulator asks how many diarrhea events started in cycle 1. You answer from the same `ADAE`, with a validated program — and the partial-date imputation you documented in step 6 is now part of the answer.

## Data example

In the generated CBX417-301 data, the same journey is visible across layers. The raw AE extract keeps EDC field names and text dates:

::dataset{id="oncology/raw/ae" cols="RECORD_ID,AE_LINE,AE_TERM,AE_START,AE_GRADE,CODED_PT" rows="8" caption="Raw EDC adverse-event extract (EDC field names, text dates)"}

The SDTM AE domain carries the same events in standard form; `AESPID` points back to `AE_LINE`:

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AESPID,AETERM,AEDECOD,AESTDTC,AETOXGR" rows="8" caption="SDTM AE — ISO 8601 dates, coded terms, sequence numbers"}

Compare a few rows: the verbatim term survives untouched in `AETERM`, the dictionary term appears in `AEDECOD`, and a partial raw date such as `UN MAR 2023` becomes a shorter ISO string rather than an invented full date. Imputation happens only in ADaM, where it is flagged.

## Interpretation

What the lifecycle tells you when a number is questioned:

- **A TLF number is only as good as its weakest upstream step.** A correct table program can faithfully count wrongly coded terms.
- **Each stage has an owner.** If the coding is wrong, the fix is a coding change in data management, not a patch in your TLF program. Patching downstream breaks traceability and gets overwritten at the next data transfer.
- **Imputed and derived values live in ADaM, never in SDTM.** If you find an invented day in `AESTDTC`, something is wrong.
- **The protocol and SAP decide; programs implement.** "Should partial dates be imputed to the first dose date?" is not a programming question. Find the rule; if there is none, ask the statistician to add one.

## Common mistakes

:::mistake[Fixing data in the wrong place]
A programmer notices a misspelled verbatim term and "fixes" it in the SDTM program. The next EDC transfer still contains the misspelling, the fix silently diverges from source, and the SDTM value can no longer be traced to the CRF. Raise it with data management so it is queried and corrected at source (or documented as-is).
:::

:::mistake[Treating SDTM as analysis-ready]
Counting AEs straight from SDTM AE ignores treatment-emergence, imputed dates and the analysis population. Tables should come from ADaM (`ADAE` with `TRTEMFL` and `SAFFL`), where those rules are implemented once and documented.
:::

:::mistake[Answering ad hoc requests with throwaway code]
An "urgent quick count" computed in a scratch program ends up in a slide deck, then a regulatory response. Ad hoc outputs deserve the same discipline — version-controlled code, a stated population, QC proportional to the risk — because they are reused.
:::

:::mistake[Not knowing which data version you used]
Rerunning a table on a newer transfer and comparing it with last month's output produces "discrepancies" that are real data changes. Record the data cut (for CBX417-301, DCO 2025-03-31) and the transfer date in every output's footer and program header.
:::

## Knowledge check

::quiz{ids="trials.lifecycle.stage-order,trials.lifecycle.edit-check-owner,trials.lifecycle.why-adam,trials.lifecycle.artifact-stage"}

## Hands-on exercise

::practice{ids="trials.lifecycle.role-classify,trials.lifecycle.before-lock,trials.lifecycle.trace-discrepancy" title="Practice: roles, milestones and tracing a number"}

## Challenge exercise

::practice{ids="trials.lifecycle.fix-location" title="Debug: where should this problem be fixed?"}

## Industry note

- **Interviewers test the whole path.** A common opening question is "walk me through the flow of clinical data from collection to submission." A strong answer names the stages, the artifacts at each stage (aCRF, SDTM spec, ADaM spec, SAP, shells, define.xml, CSR), the owners, and why traceability matters. A weak answer lists acronyms.
- **Know where you sit and who is upstream.** Programmers who can talk to data managers about edit checks and to statisticians about SAP wording resolve issues in hours instead of weeks.
- **CRO vs sponsor work differs mainly in scope.** At a CRO you may work on several studies' deliverables at once with fixed timelines; at a sponsor you may own standards, oversee CROs and handle submission-level integration. Both reward the same core skill: knowing where a number comes from.

:::interview[Walk me through the lifecycle of clinical trial data.]
"It starts with the protocol, which defines objectives, endpoints and the schedule of assessments. Data management designs the eCRF from that schedule and builds edit checks. Sites enter data into EDC; vendors send labs and randomization data. Data management raises queries, codes AEs and medications with MedDRA and WHODrug, reconciles SAEs against the safety database and randomization against IxRS, and locks the database. Programmers map the locked data to SDTM following an SDTM spec and the annotated CRF, then derive ADaM datasets — ADSL, ADAE, ADTTE and so on — from the ADaM spec the statistician approves. TLF programs produce tables, listings and figures per the SAP and shells; a second programmer independently reproduces them for QC. The outputs go into the CSR, and the datasets, define.xml and reviewer guides go into the submission. Throughout, every number must be traceable back to the CRF."
:::
