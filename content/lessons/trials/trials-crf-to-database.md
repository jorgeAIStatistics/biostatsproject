## What problem are we trying to solve?

Three weeks before the CBX417-301 primary-analysis database lock, the data manager circulates a status report:

- 212 open queries, 37 of them older than 30 days;
- 9 serious adverse events in the safety database with no matching AE in EDC;
- 2 subjects with study-drug dispensing records but no randomization row in the IxRS transfer;
- a lab result of ALT = 12000 U/L flagged by an edit check.

Your lead asks you to help: write programmatic checks across forms that the EDC cannot do, produce listings for the medical review, and make sure the SDTM programs will not break when the corrected data arrive.

To be useful here you need to understand how data are collected (eCRF/EDC), how they are cleaned (edit checks and queries), how free text becomes analyzable (medical coding), how different sources are made consistent (reconciliation), and what "locked" means.

## Intuition

Clinical data are **clean** when they are:

1. **Complete** — everything the protocol requires was collected or explained;
2. **Valid** — values are possible (no 31 February, no 700 kg patient);
3. **Consistent** — within a form, across forms, across visits and across sources (EDC vs lab vendor vs IxRS vs safety database);
4. **Coded** — free text mapped to standard dictionaries so it can be counted;
5. **Traceable** — every change is recorded with who, when and why.

The EDC system enforces what it can at the moment of entry. Everything else is found by review and programs, and resolved through **queries**: formal questions to the site, answered in the system, leaving an audit trail. Crucially, the site — not the sponsor — corrects source data. Data management asks; sites answer.

## Clinical context

### Who does what

| Activity | Owner | Programmer's involvement |
|---|---|---|
| eCRF design and CRF completion guidelines | Data management, with clinical and statistics input | Review that analysis variables can be derived |
| Edit check specification and programming (online, in EDC) | Data management / EDC builder | — |
| Offline checks (cross-form, cross-source listings) | Data management, often with programmers | Write SAS/R/SQL checks and listings |
| Query management | Data management and CRAs | Report anomalies found during SDTM/ADaM work |
| Medical coding (MedDRA, WHODrug) | Coders / data management | Use coded terms; flag uncoded records |
| Reconciliation (SAE, IxRS, lab) | Data management, pharmacovigilance | Programmatic comparison listings |
| Database lock | Data management, sign-off by study team | Final SDTM/ADaM runs after lock |

:::standard{kind="official" source="CDISC CDASH (Clinical Data Acquisition Standards Harmonization)"}
CDASH is the CDISC standard for how data are collected on CRFs: recommended fields, names, prompts and controlled terminology, designed to map cleanly to SDTM. Using CDASH-aligned CRFs is a strong convention that makes SDTM mapping simpler; it is not a regulatory requirement.
:::

### The data management plan

The **DMP** is the rulebook: CRF completion guidelines, edit check specifications, query conventions, coding dictionaries and versions, reconciliation procedures, external data transfer specifications, and the database lock checklist. When a programmer asks "why is this value like that?", the DMP (and its query log) usually has the answer.

::doc{id="dmp-excerpt" label="Open the CBX417-301 data management plan excerpt"}

## Formal concept

### eCRF and EDC

An **electronic case report form (eCRF)** is a set of pages in an **electronic data capture (EDC)** system, organized by visit (vital signs at C2D1) or as logs (the AE log, the concomitant medication log). Each field has a type, allowed values, and often a unit pre-printed on the page. The CBX417-301 CRF pages and their SDTM annotations are in the document library:

::doc{id="crf" label="CBX417-301 CRF pages"}

::doc{id="acrf" label="CBX417-301 annotated CRF (SDTM targets)"}

### Edit checks

| Type | Example (CBX417-301) | Fires |
|---|---|---|
| Required field | `AE_GRADE` missing on an AE line | On save in EDC |
| Range / plausibility | `WEIGHT` > 250 kg; `SYSBP` < 60 mmHg | On save in EDC |
| Date validity | `31 FEB 2023` | On save in EDC |
| Date logic | `AE_END` before `AE_START` | On save in EDC |
| Cross-form | AE start before informed consent; death date without a death page | Online or offline |
| Cross-visit | `CYCLE 3 DAY 1` dated before `CYCLE 2 DAY 1` | Offline listing |
| Cross-source | Dispensing record with no IxRS randomization; lab sample with no EDC visit | Offline reconciliation |

A check either **blocks** entry (hard check, rare — it can stop sites entering true but unusual data) or **raises a query** (soft check, usual).

### The query lifecycle

**Open** (system- or reviewer-raised) → **answered** by the site (data corrected, or confirmed as correct with an explanation) → **closed** by data management, or **re-queried** if the answer is insufficient. Every step is in the audit trail.

:::warning[Confirmed is not the same as wrong]
Some extreme values are real. A subject with drug-induced liver injury can have ALT above 1000 U/L. If the site confirms the value against source documents, it stays — and it may be one of the most important data points in the study. The CBX417-301 raw data deliberately include genuine extreme values that must **not** be "cleaned".
:::

### Medical coding

Free-text terms are coded to licensed dictionaries so that they can be counted consistently:

- **MedDRA** for adverse events and medical history. Verbatim terms are coded to a Lowest Level Term, which links to a Preferred Term (PT) and up the hierarchy to a System Organ Class (SOC). MedDRA is owned by ICH, maintained by its MSSO, updated twice a year, and requires a subscription.
- **WHODrug Global** (Uppsala Monitoring Centre) for medications: trade and generic names coded to a standardized drug name, with ATC classes used for summaries. It is also licensed.

Coding is done by trained coders (with auto-coding for exact matches), reviewed medically, and **versioned**: the dictionary version is recorded, and moving to a new version can change codes.

:::standard{kind="simplification"}
The CBX417-301 synthetic data use realistic-looking PT and SOC names but **no MedDRA or WHODrug codes**, because the dictionaries are licensed. Real SDTM AE data also carry the other hierarchy levels (for example `AELLT`, `AEHLT`, `AEHLGT`) and their codes.
:::

### Reconciliation

| Reconciliation | Compares | Typical findings |
|---|---|---|
| **SAE** | SAEs in EDC vs cases in the safety (pharmacovigilance) database | Missing SAE in EDC; different onset date, term, outcome or causality |
| **IxRS** | Randomization and dispensing in IxRS vs EDC | Subjects dosed with no randomization record; kit numbers not on the kit list; strata mismatches |
| **Lab** | Central lab transfer vs EDC sample collection records | Samples with no visit; visits with no results; mismatched dates or accession numbers |

### Database lock

Before lock: all expected data entered; queries resolved or closed with documented reasons; coding complete and approved; reconciliations complete; source data verification complete per the monitoring plan; investigator sign-off of casebooks; final data review. At lock, write access is removed. Changes after lock require a formal, documented **unlock** — expensive and visible, so teams work hard to avoid it.

In event-driven oncology trials, the primary analysis uses a **data cutoff** (DCO): CBX417-301 uses 2025-03-31. Data up to the cutoff are cleaned and locked for the analysis while the study continues; assessments after the cutoff are excluded.

## Worked example

Follow four problems from the opening scenario through the process.

**1. ALT = 12000 U/L.** The range check raises a query: "ALT value 12000 U/L exceeds the plausible range. Please verify against the laboratory report." The site checks the report: the true value is 120.00 — a decimal shift during manual entry. The site corrects it; the audit trail records old value, new value, user and reason. SDTM will carry 120.

**2. ALT = 1850 U/L for another subject.** The same check fires. The site confirms the value from the source lab report; the subject had a grade 4 ALT increase recorded as an AE. The query is closed as "confirmed". This value is real and must flow unchanged into SDTM, ADaM and the lab safety tables.

**3. Nine SAEs in the safety database, missing in EDC.** SAE reconciliation lists them by subject, term and onset date. Data management queries the sites to enter the AEs in EDC (sites report SAEs to pharmacovigilance within 24 hours, and sometimes the EDC entry lags). Differences in terms or dates between the databases are queried and aligned.

**4. Two dosed subjects with no randomization row.** The IxRS reconciliation shows these subjects *were* randomized in IxRS but the transfer file omitted them. The vendor re-sends the transfer. Had they not been randomized at all, that would be a serious protocol deviation — dosing without randomization.

:::number[Why does it matter that the fix happens at source?]
If a programmer "fixed" ALT = 12000 by dividing by 100 in the SDTM program, the EDC, the audit trail and the lab report would still disagree with SDTM, and the next data transfer might already contain the site's correction — which the program would then divide again, producing 1.2. Corrections at source keep every layer consistent and traceable.
:::

## Code

Offline checks that the EDC cannot do on its own are often written by programmers. This R example runs the date checks on a small illustrative extract (EDC text dates, partial dates with `UN`):

```r title="offline_ae_date_checks.R"
options(width = 120)
ae <- data.frame(
  RECORD_ID    = sprintf("AE-%06d", 101:105),
  SUBJECT_ID   = c("1012-0007", "1012-0007", "1033-0002", "1033-0002", "1044-0011"),
  AE_TERM      = c("Nausea", "Fatigue", "Rash", "Diarrhoea", "Headache"),
  AE_START     = c("12 MAR 2023", "20 FEB 2023", "UN APR 2023", "05 APR 2023", "31 FEB 2023"),
  AE_END       = c("10 MAR 2023", "25 FEB 2023", "30 APR 2023", "", "02 MAR 2023"),
  CONSENT_DATE = c("01 MAR 2023", "01 MAR 2023", "15 MAR 2023", "15 MAR 2023", "10 JAN 2023")
)
parse_edc <- function(x) as.Date(x, format = "%d %b %Y")
is_partial <- function(x) grepl("^UN |UNK", x)

chk <- within(ae, {
  st <- parse_edc(AE_START); en <- parse_edc(AE_END); ic <- parse_edc(CONSENT_DATE)
  finding <- ifelse(is_partial(AE_START), "Partial start date: confirm or complete",
             ifelse(is.na(st), "Invalid start date: please correct",
             ifelse(!is.na(en) & en < st, "End date before start date: please correct",
             ifelse(st < ic, "Start date before informed consent: please confirm",
                    NA))))
})
print(chk[!is.na(chk$finding), c("RECORD_ID", "AE_START", "AE_END", "finding")], row.names = FALSE)
```

:::lines
1: Widens the console so the findings print on one line per record.
2-9: An illustrative extract in EDC style: `RECORD_ID` identifies the raw row, dates are text such as `12 MAR 2023`, and unknown parts are `UN`/`UNK`.
10: Converts complete EDC dates to `Date`; `%b` matches month abbreviations. Anything unparseable — partial or impossible dates such as `31 FEB 2023` — becomes `NA`.
11: Detects partial dates before conversion, so they are reported as partial rather than invalid.
13-20: Evaluates the checks in priority order: partial, invalid, end before start, start before consent. `!is.na(en)` stops an ongoing AE (blank end date) from being flagged.
21: Lists only records with a finding — the listing a data manager turns into queries, citing `RECORD_ID` so each query points at one raw row.
:::

## Output

Output of the program above (R 4.6):

```output
 RECORD_ID    AE_START      AE_END                                            finding
 AE-000101 12 MAR 2023 10 MAR 2023         End date before start date: please correct
 AE-000102 20 FEB 2023 25 FEB 2023 Start date before informed consent: please confirm
 AE-000103 UN APR 2023 30 APR 2023            Partial start date: confirm or complete
 AE-000105 31 FEB 2023 02 MAR 2023                 Invalid start date: please correct
```

`AE-000104` has no finding: its start date is valid, after consent, and the end date is blank because the AE is ongoing. Note that `AE-000102` asks the site to *confirm*: an AE starting before consent might be a pre-existing condition that belongs in medical history, or a date error.

The same checks in SAS (not executed here) would use `input(AE_START, ?? date11.)` — the `??` modifier suppresses invalid-data notes for partial dates, which you then detect explicitly with a pattern such as `prxmatch('/^UN |UNK/', AE_START)`.

## Interpretation

- **Queries create the audit trail that makes data credible.** An unexplained change is worse than an unchanged error.
- **Data cleaning never makes data "look nicer".** It makes them *true to source*. Real outliers stay.
- **Reconciliation protects the most important data.** SAEs, randomization and exposure are the data regulators scrutinize first; mismatches between sources erode trust in everything else.
- **Lock is a quality milestone, not a date.** Moving lock forward with open issues simply moves the problems into the analysis.

## Common mistakes

:::mistake[Cleaning data in the programs]
Recoding values in SDTM programs ("everyone knows 700 kg means 70 kg") bypasses queries and the audit trail. Report it; let the site correct source. Document any unavoidable programmatic handling in the specs and the cSDRG.
:::

:::mistake[Querying genuine extreme values into oblivion]
Aggressive range checks and pressure to "resolve" queries can push sites to change correct values. Queries ask sites to *verify*; a confirmed value is closed as-is.
:::

:::mistake[Ignoring dictionary versions]
Comparing AE tables produced with different MedDRA versions creates "discrepancies" that are coding changes. Record the version in outputs and define.xml, and re-code consistently when the version is upgraded.
:::

:::mistake[Treating vendor data as clean]
Lab and IxRS transfers have their own errors — missing units, conventional vs SI units by site, missing subjects in a transfer. Validate every transfer against its data transfer specification before using it.
:::

## Knowledge check

::quiz{ids="trials.crf.check-types,trials.crf.programmer-finds-issue,trials.crf.dictionary,trials.crf.genuine-extreme"}

## Hands-on exercise

::practice{ids="trials.crf.sae-recon-fields,trials.crf.lock-order,trials.crf.date-check-code" title="Practice: checks, reconciliation and lock"}

## Challenge exercise

::practice{ids="trials.crf.invalid-date-log" title="Debug: read the log of a date conversion"}

## Industry note

- **Clinical data scientists** increasingly build the cross-source checks, review listings and dashboards that data managers use. SQL, R and SAS skills are all valued; so is knowing *why* a check exists.
- **Programmers see data long before lock.** SDTM and ADaM programs run on every transfer. Treat each run as a data review: new values in controlled-terminology fields, unexpected missing data and log notes are early signals worth reporting.
- **Expect interview questions on lock and reconciliation**, especially "What happens before database lock?" and "What is SAE reconciliation?"

:::interview[What has to happen before database lock?]
"All expected data entered and source-verified per the monitoring plan; all queries answered and closed, or closed with a documented reason; medical coding of AEs, medical history and medications complete and reviewed, with dictionary versions recorded; SAE reconciliation between EDC and the safety database complete; IxRS and external vendor data such as central labs reconciled; protocol deviations reviewed and classified; investigator sign-off; and a final data review including blinded population decisions. Then lock is approved and write access removed. Programmers rerun SDTM and ADaM on the locked data; any change after that needs a formal unlock, which is documented and visible to auditors."
:::
