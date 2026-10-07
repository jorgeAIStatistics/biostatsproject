# Data Management Plan — CBX417-301 (excerpt)

> **Educational, fictional document.** An excerpt of the data management plan for the synthetic study
> CBX417-301, written to show how edit checks, queries, coding, reconciliation and database lock are
> documented. Systems, vendors and thresholds are invented.

| | |
|---|---|
| Document | Data Management Plan, CBX417-301 |
| Version | 4.0 |
| Effective date | 09 January 2024 |
| Prepared by | Clinical Data Management, Halden Therapeutics (fictional) |
| Applies to | Protocol CBX417-301 v3.0 and later |

## 1. Scope and systems

| System | Purpose | Data provided |
|---|---|---|
| EDC | Site data entry | Demographics, disease characteristics, dosing, AEs, concomitant medications, vital signs, ECG, tumor assessments, disposition, death |
| IxRS | Randomization and drug supply | Randomization number and date, stratification values entered at randomization, kits assigned and dispensed, kit list |
| Central laboratory | Hematology and chemistry | Results with units, reference ranges, collection date/time, accession number |
| Safety database | Pharmacovigilance case processing | Serious adverse event cases |
| CTMS | Trial management | Protocol deviations, monitoring visit findings |

Data from the central laboratory and IxRS arrive as scheduled electronic transfers governed by a **data transfer agreement (DTA)** that fixes file layout, variable names, formats, units, transfer frequency and the contact for discrepancies. Each transfer is checked against the DTA before loading; layout changes require an updated DTA.

## 2. Roles

| Role | Responsibility |
|---|---|
| Lead data manager | Owns this plan, the edit check specification and the lock checklist |
| Clinical data coordinator | Reviews data, raises and closes queries |
| EDC programmer | Builds the eCRF and programs edit checks |
| Medical coder | Codes AE, medical history and medication terms; prepares the coding review |
| Statistical programmer | Provides cross-source listings and reports anomalies found during SDTM/ADaM work |
| Medical monitor | Reviews clinical data and coding decisions |
| Pharmacovigilance | Owns the safety database and supports SAE reconciliation |

## 3. Data cleaning approach

Cleaning combines: (1) **online edit checks** that fire in the EDC at entry; (2) **offline programmed checks** run on each data extract, including cross-form and cross-source checks; and (3) **manual data review** by data management, the medical monitor and, for selected listings, the study statistician (blinded, pooled).

### 3.1 Edit check specification (extract)

| Check ID | Type | Condition | Severity | Query text (site-facing) |
|---|---|---|---|---|
| DM-001 | Required | `SEX` is blank | Hard | "Sex is required. Please complete." |
| DM-004 | Consistency | `AGE` < 18 | Query | "Age is below the protocol minimum of 18 years. Please verify." |
| VS-002 | Range | `WEIGHT` > 250 kg or < 30 kg (after unit conversion) | Query | "Weight of {value} {unit} is outside the expected range. Please verify against source." |
| VS-003 | Range | `SYSBP` < 60 or > 250 mmHg | Query | "Systolic blood pressure of {value} mmHg is outside the expected range. Please verify." |
| VS-006 | Consistency | `HEIGHT` recorded at a visit other than SCREENING | Query | "Height is collected at screening only. Please confirm or remove." |
| AE-002 | Date validity | `AE_START` is not a valid date (for example `31 FEB 2023`) | Hard | "The start date is not a valid calendar date. Please correct." |
| AE-003 | Date logic | `AE_END` < `AE_START` (both complete) | Hard | "The end date precedes the start date. Please correct." |
| AE-004 | Cross-form | `AE_START` < `CONSENT_DATE` | Query | "The adverse event starts before informed consent. Please confirm the date or record the condition as medical history." |
| AE-007 | Consistency | `AE_SERIOUS` = Yes and no seriousness criterion checked | Hard | "At least one seriousness criterion must be selected for a serious adverse event." |
| AE-009 | Consistency | `AE_GRADE` = 5 and `AE_OUTCOME` ≠ Fatal | Query | "A grade 5 event must have outcome 'Fatal'. Please verify grade and outcome." |
| AE-011 | Cross-form | `AE_OUTCOME` = Fatal and no Death page completed | Query | "A fatal adverse event is recorded but the Death page is not completed. Please complete." |
| CM-003 | Date logic | `CM_END` < `CM_START` | Hard | "The end date precedes the start date. Please correct." |
| TU-002 | Consistency | `OVERALL_RESP` = PD and `NEW_LESION` = N and `TARGET_SLD_MM` not increased versus nadir | Query | "Overall response of PD is not supported by the recorded measurements. Please verify." |
| TU-004 | Window | Tumor assessment more than 7 days outside its scheduled window | Query | "The assessment is outside the protocol window. Please confirm the scan date." |
| LB-001 | Cross-source | Laboratory result received with no matching visit record in EDC | Query (vendor or site) | "A laboratory sample exists with no corresponding visit. Please verify." |
| EX-004 | Cross-source | Study drug dispensed with a kit number that is not on the IxRS kit list | Query | "The kit number is not recognized. Please verify against the kit label." |
| DS-002 | Cross-form | `EOT_REASON` = Progressive disease with no tumor assessment showing PD | Query | "End of treatment for progressive disease, but no assessment documents PD. Please verify." |

**Hard** checks block saving the record in the EDC; **query** checks raise a discrepancy for the site to answer. Ranges are plausibility limits, not eligibility limits: values confirmed against source are retained, including extreme results.

### 3.2 Query management

1. A query is raised automatically (edit check) or manually (data review).
2. The site answers in the EDC, either correcting the data or confirming the value with an explanation.
3. Data management closes the query, or re-queries with additional information.
4. All steps are recorded in the audit trail, with user, timestamp and reason for change.

Expected turnaround: sites answer within **10 business days**; data management reviews answers within **5 business days**. Queries open for more than 30 days are escalated to the monitoring team and reported in the weekly metrics.

Confirmed clinically significant values (for example ALT > 10 × ULN) are flagged for the medical monitor rather than re-queried.

## 4. Medical coding

| Item | Dictionary | Process |
|---|---|---|
| Adverse events, medical history | MedDRA (licensed; version recorded in the coding log, define.xml and output footnotes) | Auto-coding of exact matches, manual coding of the remainder, medical review of all new codes |
| Concomitant and prior medications | WHODrug Global (licensed) | Auto-coding, manual coding, review of drug classes used in summaries |

Coding conventions:

- Verbatim terms are never modified; coding questions are resolved by query when the term is ambiguous (for example "reaction" without a body site).
- Terms that cannot be coded are escalated to the medical monitor for clarification with the site.
- **Version upgrade**: if the dictionary version changes during the study, all previously coded terms are re-coded with the new version and differences are reviewed. The version used for the final analysis is fixed before database lock and stated in outputs.

## 5. External data reconciliation

| Reconciliation | Frequency | Compared |
|---|---|---|
| **SAE** (EDC vs safety database) | Monthly and before lock | Existence of each case, subject, verbatim and coded term, onset and end dates, seriousness criteria, outcome, causality, action taken |
| **IxRS** (IxRS vs EDC) | Monthly and before lock | Randomization number and date, stratification values, kits assigned vs kits recorded as dispensed, subjects randomized vs subjects with dosing records |
| **Central laboratory** (vendor vs EDC) | With each transfer | Subject and visit existence, collection dates, accession numbers, expected tests per visit, unit consistency |

Discrepancies are documented in a reconciliation log with the resolution and the responsible party. The SAE and IxRS reconciliations are signed off by data management and pharmacovigilance (SAE) before database lock.

## 6. Protocol deviations

Deviations are recorded in the CTMS by the monitoring team, categorized (for example eligibility, treatment, assessment schedule, informed consent, prohibited medication) and classified as **major** or **minor** using the study's deviation classification document. Major deviations affecting efficacy determine the per-protocol population and are reviewed and agreed at the blinded data review meeting before database lock.

## 7. Database lock

### 7.1 Pre-lock checklist

| # | Item | Owner |
|---|---|---|
| 1 | All expected CRF pages entered for visits on or before the data cutoff (31 March 2025) | Data management / sites |
| 2 | All queries closed, or closed with a documented reason | Data management |
| 3 | Source data verification complete per the monitoring plan | Clinical operations |
| 4 | Medical coding complete, reviewed and approved; dictionary versions fixed | Coding / medical monitor |
| 5 | SAE reconciliation complete and signed | Data management / pharmacovigilance |
| 6 | IxRS and laboratory reconciliations complete | Data management |
| 7 | Protocol deviations finalized and classified | Clinical operations / medical monitor |
| 8 | Blinded data review meeting held; analysis population decisions documented | Study team |
| 9 | SAP final and approved | Biostatistics |
| 10 | Investigator sign-off of casebooks | Sites |
| 11 | Final data extract produced and verified against the EDC | Data management |

### 7.2 Lock and unblinding

After the checklist is signed, the database is locked (write access removed) and the treatment codes are released by the unblinded team to the study team. Programming then runs the final SDTM, ADaM and TLF production on the locked extract.

### 7.3 Unlock

An unlock requires a documented request describing the issue, its impact on the analysis, the records to be changed and the approval of data management, the medical monitor and biostatistics. After the correction the database is re-locked and all affected outputs are regenerated and re-QC'd. Unlocks are listed in the CSR.

## 8. Metrics reported weekly

Pages entered vs expected; open queries by age and site; SAE reconciliation discrepancies; uncoded terms; overdue visits; and pending vendor transfers.
