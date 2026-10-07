# SDTM Specification — CBX417-301 (excerpt: DM, AE, LB)

> **Educational, fictional document.** Mapping specification for the synthetic study CBX417-301.
> It targets SDTM v2.0 / SDTMIG v3.4 conventions; simplifications made for teaching are labeled.
> Controlled terminology values were checked against the CDISC SDTM CT package dated 2026-03-27
> that ships with this app (`python3 scripts/tools/ct_lookup.py <CODELIST>`).

## 1. General conventions

| Topic | Convention |
|---|---|
| Study identifier | `STUDYID = "CBX417-301"` on every record |
| Unique subject identifier | `USUBJID = STUDYID || "-" || SITEID || "-" || SUBJID`, for example `CBX417-301-1012-0007` |
| Dates | ISO 8601 character strings; partial dates keep only the known part (`2023-03`, `2023`); no imputation in SDTM |
| Study day (`--DY`) | `--DY = date − RFSTDTC + 1` when the date is on or after `RFSTDTC`, otherwise `date − RFSTDTC`; there is no day 0 |
| Sequence (`--SEQ`) | Unique within `USUBJID` and domain, assigned after sorting by the domain's key variables |
| Epoch | `SCREENING`, `TREATMENT`, `FOLLOW-UP`, derived from the date relative to `RFXSTDTC` and `RFXENDTC` |
| Baseline flags | `--LOBXFL` (last observation before first exposure) is populated in findings domains; `--BLFL` is not submitted (Permissible in SDTMIG v3.4) |
| Origin values | `Collected` (with CRF page and field), `Derived`, `Assigned`, `Protocol`, `Predecessor` |
| Source of corrections | Raw values corrected through data-management queries are used; the lineage file `data/oncology/lineage/sdtm_raw_map.csv` links every SDTM record to its raw row(s) |

**Simplifications (documented in the cSDRG):** `TR` contains only the sum of diameters (`SUMDIAM`); individual lesions (`TU`, per-lesion `TR`) are omitted; `RS` contains the investigator's overall response and ECOG only; adverse events and medications carry realistic preferred terms and classes but **no dictionary codes**, because MedDRA and WHODrug are licensed; several baseline disease characteristics are carried in `SUPPDM` rather than in `MH`, `SU`, `CM` or a findings domain.

## 2. Dataset-level metadata

| Dataset | Description | Class | Structure | Key variables |
|---|---|---|---|---|
| `DM` | Demographics | Special Purpose | One record per subject | `STUDYID`, `USUBJID` |
| `SUPPDM` | Supplemental qualifiers for DM | Relationship | One record per subject per qualifier | `STUDYID`, `USUBJID`, `QNAM` |
| `AE` | Adverse Events | Events | One record per adverse event per subject | `STUDYID`, `USUBJID`, `AEDECOD`, `AESTDTC`, `AESEQ` |
| `SUPPAE` | Supplemental qualifiers for AE | Relationship | One record per AE record per qualifier | `STUDYID`, `USUBJID`, `IDVARVAL`, `QNAM` |
| `LB` | Laboratory Test Results | Findings | One record per test per visit per subject | `STUDYID`, `USUBJID`, `LBTESTCD`, `VISITNUM`, `LBDTC`, `LBSEQ` |

Other domains in the study: `CM`, `MH` (including the primary diagnosis, `MHCAT = "PRIMARY DIAGNOSIS"`, which carries the diagnosis date), `EX`, `VS`, `EG`, `DS`, `DV`, `RS`, `TR`, `DD` (death details, `DDTESTCD = "PRCDTH"`), `SS`, `SV`, `SE`, `TS`, `TA`, `TE`.

## 3. DM — Demographics

| Variable | Label | Type | Codelist | Origin | Source / mapping rule |
|---|---|---|---|---|---|
| `STUDYID` | Study Identifier | Char | — | Assigned | Constant `"CBX417-301"` |
| `DOMAIN` | Domain Abbreviation | Char | — | Assigned | Constant `"DM"` |
| `USUBJID` | Unique Subject Identifier | Char | — | Derived | `STUDYID`-`SITEID`-`SUBJID` |
| `SUBJID` | Subject Identifier for the Study | Char | — | Collected | Demographics page, `SUBJECT_ID` |
| `SITEID` | Study Site Identifier | Char | — | Collected | Demographics page, `SITE_ID` |
| `RFSTDTC` | Subject Reference Start Date/Time | Char | — | Derived | Date of first exposure to any study drug (earliest `EX.EXSTDTC`); null for subjects never treated |
| `RFENDTC` | Subject Reference End Date/Time | Char | — | Derived | End of participation: death date, or last contact date on or before the data cutoff |
| `RFXSTDTC` | Date/Time of First Study Treatment | Char | — | Derived | Earliest `EX.EXSTDTC` |
| `RFXENDTC` | Date/Time of Last Study Treatment | Char | — | Derived | Latest `EX.EXENDTC` |
| `RFICDTC` | Date/Time of Informed Consent | Char | — | Collected | Demographics/enrollment page, `CONSENT_DATE` |
| `RFPENDTC` | Date/Time of End of Participation | Char | — | Derived | Same as `RFENDTC` |
| `DTHDTC` | Date/Time of Death | Char | — | Collected | Death page, `DEATH_DATE` |
| `DTHFL` | Subject Death Flag | Char | NY (`Y`) | Derived | `"Y"` when `DTHDTC` is not null; otherwise null |
| `AGE` | Age | Num | — | Collected | Demographics page, `AGE` |
| `AGEU` | Age Units | Char | AGEU (`YEARS`) | Assigned | Constant `"YEARS"` |
| `SEX` | Sex | Char | SEX (`M`, `F`) | Collected | Demographics page, `SEX`; raw variants (`Male`, `male`, `1`, `f `, …) are standardized after trimming and case folding: `M` for male, `F` for female |
| `RACE` | Race | Char | Race terminology (see note) | Collected | Race checkboxes; exactly one checked → that category; more than one → `"MULTIPLE"` (individual selections in `SUPPDM`); none checked → `"NOT REPORTED"` |
| `ETHNIC` | Ethnicity | Char | Ethnicity terminology | Collected | Demographics page, `ETHNICITY` |
| `COUNTRY` | Country | Char | ISO 3166-1 alpha-3 | Collected | Demographics page, `COUNTRY` |
| `ARMCD` | Planned Arm Code | Char | Sponsor-defined (`CBX+DOC`, `PBO+DOC`) | Collected (IxRS) | `randomization.csv`, `ARM_ASSIGNED`; null for screen failures |
| `ARM` | Description of Planned Arm | Char | Sponsor-defined | Derived | `"CBX-417 200 mg + Docetaxel 75 mg/m2"` or `"Placebo + Docetaxel 75 mg/m2"`; null for screen failures |
| `ACTARMCD` | Actual Arm Code | Char | Sponsor-defined | Derived | Arm corresponding to the kits actually dispensed; null when no treatment was received |
| `ACTARM` | Description of Actual Arm | Char | Sponsor-defined | Derived | As `ARM`, based on actual treatment |
| `ARMNRS` | Reason Arm and/or Actual Arm is Null | Char | ARMNULRS (`SCREEN FAILURE`, `ASSIGNED, NOT TREATED`, `UNPLANNED TREATMENT`) | Derived | `"SCREEN FAILURE"` when the subject was not randomized; `"ASSIGNED, NOT TREATED"` when randomized but never treated; `"UNPLANNED TREATMENT"` when the treatment received does not correspond to a planned arm |
| `ACTARMUD` | Description of Unplanned Actual Arm | Char | — | Derived | Free text describing the treatment actually received when `ACTARM` is null because of a dispensing error |

**Note on race and ethnicity terminology.** The values used (`WHITE`, `ASIAN`, `BLACK OR AFRICAN AMERICAN`, `AMERICAN INDIAN OR ALASKA NATIVE`, `NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER`, `OTHER`, `MULTIPLE`, `NOT REPORTED`, `HISPANIC OR LATINO`, `NOT HISPANIC OR LATINO`) follow SDTMIG examples for `RACE` and `ETHNIC`. In the CT package dated 2026-03-27 used by this project, the corresponding published codelists are `RACEC` ("Race As Collected", C128689) and `ETHNICC` ("Ethnicity As Collected", C128690), and `MULTIPLE` is not among their submission values. Race and ethnicity terminology has been changing across CT releases: confirm the codelist and CT version referenced in your study's define.xml rather than assuming.

### SUPPDM qualifiers

| `QNAM` | `QLABEL` | Source |
|---|---|---|
| `RACE1`…`RACE6` | Race category as collected | Individual race checkboxes when more than one is checked |
| `RACEOTH` | Race, other, specify | `RACE_OTHER_SP` |
| `DISHIST` | Histology | Baseline disease page, `HISTOLOGY` |
| `DISSTAGE` | Disease stage at entry | `STAGE` |
| `RANDNO` | Randomization number | IxRS `RAND_NO` |
| `STRATECG` | ECOG stratum as randomized | IxRS `STRAT_ECOG` |
| `STRATIO` | Prior anti-PD-(L)1 stratum as randomized | IxRS `STRAT_PRIOR_IO` |
| `PDL1TPS` | PD-L1 tumor proportion score | `PDL1_TPS` |
| `PRLINES` | Number of prior lines of therapy | `PRIOR_LINES` |
| `PRIORIO` | Prior anti-PD-(L)1 therapy | `PRIOR_IO` |
| `BRAINMET` | Brain metastases | `BRAIN_METS` |
| `SMOKSTAT` | Smoking status | `SMOKING` |


## 4. AE — Adverse Events

| Variable | Label | Type | Codelist | Origin | Source / mapping rule |
|---|---|---|---|---|---|
| `STUDYID`, `DOMAIN`, `USUBJID` | — | Char | — | Assigned/Derived | As Section 1 |
| `AESEQ` | Sequence Number | Num | — | Derived | Sequential within subject after sorting by `AESTDTC`, `AESPID` |
| `AESPID` | Sponsor-Defined Identifier | Char | — | Collected | AE log, `AE_LINE` |
| `AETERM` | Reported Term for the Adverse Event | Char | — | Collected | AE log, `AE_TERM`, verbatim; only leading/trailing whitespace is trimmed |
| `AEDECOD` | Dictionary-Derived Term | Char | MedDRA PT (licensed; no codes in this project) | Derived (coding) | `CODED_PT` |
| `AEBODSYS` | Body System or Organ Class | Char | MedDRA SOC | Derived (coding) | `CODED_SOC` |
| `AESOC` | Primary System Organ Class | Char | MedDRA SOC | Derived (coding) | Same as `AEBODSYS` in this study (one SOC per PT is carried) |
| `AESTDTC` | Start Date/Time of Adverse Event | Char | — | Collected | `AE_START` converted to ISO 8601; `UN`/`UNK` parts are dropped rather than imputed (`07 MAR 2023` → `2023-03-07`; `UN MAR 2023` → `2023-03`) |
| `AEENDTC` | End Date/Time of Adverse Event | Char | — | Collected | `AE_END`, same conversion; null when ongoing |
| `AESTDY` | Study Day of Start of Adverse Event | Num | — | Derived | From `AESTDTC` and `RFSTDTC` when the start date is complete |
| `AEENDY` | Study Day of End of Adverse Event | Num | — | Derived | From `AEENDTC` and `RFSTDTC` when the end date is complete |
| `AEENRTPT` | End Relative to Reference Time Point | Char | STENRF (`ONGOING`) | Collected | `"ONGOING"` when `AE_ONGOING` = Yes |
| `AEENTPT` | End Reference Time Point | Char | — | Assigned | Sponsor-defined text describing the reference point for `AEENRTPT` |
| `AETOXGR` | Standard Toxicity Grade | Char | `1`–`5` (NCI CTCAE v5.0) | Collected | `AE_GRADE` |
| `AESER` | Serious Event | Char | NY (`Y`, `N`) | Collected | `AE_SERIOUS` |
| `AESDTH` | Results in Death | Char | NY | Collected | `AE_SER_DEATH` (`Y` when checked, otherwise `N` when `AESER = "Y"`) |
| `AESLIFE` | Is Life Threatening | Char | NY | Collected | `AE_SER_LIFE` |
| `AESHOSP` | Requires or Prolongs Hospitalization | Char | NY | Collected | `AE_SER_HOSP` |
| `AESDISAB` | Persist or Signif Disability/Incapacity | Char | NY | Collected | `AE_SER_DISAB` |
| `AESCONG` | Congenital Anomaly or Birth Defect | Char | NY | Collected | `AE_SER_CONG` |
| `AESMIE` | Other Medically Important Serious Event | Char | NY | Collected | `AE_SER_MIE` |
| `AEREL` | Causality | Char | Sponsor-defined (`RELATED`, `NOT RELATED`) | Collected | `AE_REL_CBX` (relationship to CBX-417/placebo) |
| `AEACN` | Action Taken with Study Treatment | Char | ACN | Collected | `AE_ACTION_CBX` |
| `AEOUT` | Outcome of Adverse Event | Char | OUT | Collected | `AE_OUTCOME` |
| `EPOCH` | Epoch | Char | EPOCH | Derived | From `AESTDTC` relative to `RFXSTDTC`/`RFXENDTC` |

`AESEV` is not collected: the protocol uses CTCAE grades, carried in `AETOXGR`.

### SUPPAE qualifiers

| `QNAM` | `QLABEL` | `IDVAR` / `IDVARVAL` | Source |
|---|---|---|---|
| `AERELDOC` | Relationship to Docetaxel | `AESEQ` | AE log, `AE_REL_DOC` |
| `AEACNDOC` | Action Taken with Docetaxel | `AESEQ` | AE log, `AE_ACTION_DOC` |

## 5. LB — Laboratory Test Results

Source: central laboratory transfer (`labs.csv`), loaded per the data transfer agreement. Vendor test codes are mapped to CDISC `LBTESTCD` values by a controlled lookup; results reported in conventional units are converted to standard (SI) units.

| Variable | Label | Type | Codelist | Origin | Source / mapping rule |
|---|---|---|---|---|---|
| `STUDYID`, `DOMAIN`, `USUBJID` | — | Char | — | Assigned/Derived | As Section 1 |
| `LBSEQ` | Sequence Number | Num | — | Derived | Sequential within subject after sorting by `LBDTC`, `LBTESTCD` |
| `LBREFID` | Specimen ID | Char | — | Collected | `ACCESSION_NO` |
| `LBTESTCD` | Lab Test or Examination Short Name | Char | LBTESTCD (`ALT`, `AST`, `ALP`, `BILI`, `CREAT`, `ALB`, `HGB`, `WBC`, `NEUT`, `PLAT`) | Derived | Lookup from `VENDOR_TEST_CODE` |
| `LBTEST` | Lab Test or Examination Name | Char | LBTEST | Derived | Lookup from `LBTESTCD` |
| `LBCAT` | Category for Lab Test | Char | Sponsor-defined (`CHEMISTRY`, `HEMATOLOGY`) | Assigned | From the test lookup |
| `LBORRES` | Result or Finding in Original Units | Char | — | Collected | `RESULT` as reported by the laboratory |
| `LBORRESU` | Original Units | Char | UNIT | Collected | `UNIT`; when the vendor sends no unit, the unit is resolved by query and documented |
| `LBORNRLO`, `LBORNRHI` | Reference Range in Original Units | Char | — | Collected | `REF_LOW`, `REF_HIGH` |
| `LBSTRESC` | Character Result/Finding in Std Units | Char | — | Derived | Standardized (SI) result as text |
| `LBSTRESN` | Numeric Result/Finding in Std Units | Num | — | Derived | Numeric standardized result; conversions applied: bilirubin mg/dL × 17.1 → µmol/L; creatinine mg/dL × 88.4 → µmol/L; hemoglobin g/dL × 10 → g/L; albumin g/dL × 10 → g/L |
| `LBSTRESU` | Standard Units | Char | UNIT (`U/L`, `umol/L`, `g/L`, `10^9/L`) | Assigned | From the test lookup |
| `LBSTNRLO`, `LBSTNRHI` | Reference Range in Standard Units | Num | — | Derived | Reference limits converted with the same factors |
| `LBNRIND` | Reference Range Indicator | Char | NRIND (`LOW`, `NORMAL`, `HIGH`) | Derived | Comparison of `LBSTRESN` with `LBSTNRLO`/`LBSTNRHI`; null when either is missing |
| `LBSTAT` | Completion Status | Char | ND (`NOT DONE`) | Collected | `"NOT DONE"` when the sample was not collected or not analyzed |
| `LBREASND` | Reason Not Done | Char | — | Collected | Reason supplied by the laboratory or site |
| `LBNAM` | Vendor Name | Char | — | Assigned | Laboratory that performed the test |
| `LBSPEC` | Specimen Type | Char | SPECTYPE (`BLOOD`, `SERUM`, `PLASMA`) | Assigned | From the test lookup |
| `VISITNUM`, `VISIT` | Visit Number / Name | Num / Char | Sponsor-defined visit list | Derived | Mapped from `VISIT_NAME`; unscheduled visits take the preceding scheduled `VISITNUM` + 0.01 (a sponsor convention) |
| `LBDTC` | Date/Time of Specimen Collection | Char | — | Collected | `COLLECTION_DATE` (+ `COLLECTION_TIME` when present) |
| `LBDY` | Study Day of Specimen Collection | Num | — | Derived | From `LBDTC` and `RFSTDTC` |
| `LBLOBXFL` | Last Observation Before Exposure Flag | Char | NY (`Y`) | Derived | `"Y"` on the last non-missing result for each subject and test on or before `RFXSTDTC` |
| `EPOCH` | Epoch | Char | EPOCH | Derived | From `LBDTC` relative to `RFXSTDTC`/`RFXENDTC` |

**Local laboratory results.** Results from local laboratories (`LAB_SOURCE = "LOCAL"`) are submitted in `LB` with their own reference ranges; the cSDRG explains that they are excluded from by-visit summaries but included in "worst post-baseline" summaries, as specified in the SAP.

## 6. Conformance and validation

Datasets are checked with CDISC conformance rules and FDA validator rules before delivery. Findings that cannot be resolved (for example, absence of dictionary codes in `AEDECOD`-related variables in this educational implementation) are explained in the cSDRG with their rationale.
