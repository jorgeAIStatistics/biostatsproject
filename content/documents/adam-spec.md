# ADaM Specification — CBX417-301 (excerpt: ADSL, ADAE, ADLB, ADTTE)

> **Educational, fictional document.** Variable-level specifications for the synthetic study
> CBX417-301, following ADaMIG v1.3 conventions. Every derivation here is the one implemented in
> this app's synthetic data and referenced by the SAP; simplifications are labeled.

## 1. General conventions

| Topic | Convention |
|---|---|
| Predecessor | Variables copied unchanged from SDTM record the source in the metadata (`SRCDOM`, `SRCVAR`, `SRCSEQ` where applicable) |
| Dates | Numeric SAS dates with a `DATE9.` format in a SAS implementation; ISO 8601 text (`YYYY-MM-DD`) in the CSV files shipped with this app |
| Imputation flags | `--DTF` records the imputed component: `D` (day), `M` (month and day), `Y` (year, month and day) |
| Population flags | Subject-level flags in `ADSL` take values `Y` and `N` (never null) |
| Record-level flags | Analysis and derivation flags (`ABLFL`, `ANL01FL`, `TRTEMFL`, `ONTRTFL`, occurrence flags) take the value `Y` or are null |
| Data cutoff | `DCUTDT = 2025-03-31`; records and events after the cutoff are excluded from analysis datasets or flagged, as specified per dataset |
| Traceability | BDS datasets carry `SRCDOM`, `SRCVAR`, `SRCSEQ` pointing at the SDTM record that produced `AVAL` |

| Dataset | Structure | Key variables | Class |
|---|---|---|---|
| `ADSL` | One record per randomized subject (420) | `STUDYID`, `USUBJID` | Subject-level |
| `ADAE` | One record per adverse event per subject | `STUDYID`, `USUBJID`, `AESEQ` | OCCDS |
| `ADLB` | One record per subject, parameter and analysis time point | `STUDYID`, `USUBJID`, `PARAMCD`, `ADT`, `ASEQ` | BDS |
| `ADTTE` | One record per subject and time-to-event parameter | `STUDYID`, `USUBJID`, `PARAMCD` | BDS (time-to-event) |

`ADSL` contains all **randomized** subjects; screen failures are not included (disposition counts for screening come from SDTM `DM`/`DS`).

---

## 2. ADSL — Subject-Level Analysis Dataset

| Variable | Label | Type | Derivation |
|---|---|---|---|
| `STUDYID`, `USUBJID`, `SUBJID`, `SITEID` | Identifiers | Char | Predecessor: `DM` |
| `COUNTRY` | Country | Char | Predecessor: `DM.COUNTRY` |
| `REGION1` | Geographic Region 1 | Char | Derived from `COUNTRY`: `"North America"`, `"Europe"`, `"Asia-Pacific"` |
| `AGE`, `AGEU` | Age, Age Units | Num, Char | Predecessor: `DM` |
| `AGEGR1` | Pooled Age Group 1 | Char | `"<65"` if `AGE < 65`, else `">=65"` |
| `AGEGR1N` | Pooled Age Group 1 (N) | Num | 1 = `"<65"`, 2 = `">=65"` |
| `SEX`, `RACE`, `ETHNIC` | Demographics | Char | Predecessor: `DM` |
| `HEIGHTBL` | Baseline Height (cm) | Num | `VS.VSSTRESN` where `VSTESTCD = "HEIGHT"` at screening |
| `WEIGHTBL` | Baseline Weight (kg) | Num | Last non-missing `VS.VSSTRESN` where `VSTESTCD = "WEIGHT"` on or before `TRTSDT` (on or before `RANDDT` for never-treated subjects) |
| `BMIBL` | Baseline BMI (kg/m²) | Num | `WEIGHTBL / (HEIGHTBL / 100)²`, rounded to 1 decimal |
| `BSABL` | Baseline BSA (m²) | Num | Mosteller: `sqrt(HEIGHTBL × WEIGHTBL / 3600)`, rounded to 2 decimals |
| `ECOGBL` | Baseline ECOG Performance Status | Char | Last non-missing `RS.RSSTRESC` where `RSTESTCD = "ECOG101"` on or before `TRTSDT` (or `RANDDT` if never treated) |
| `HISTOL` | Histology | Char | `SUPPDM.QVAL` where `QNAM = "DISHIST"` |
| `PDL1CAT` | PD-L1 TPS Category | Char | From `SUPPDM.QVAL` where `QNAM = "PDL1TPS"`: `"<1%"`, `"1-49%"`, `">=50%"`, `"Not done"` |
| `PRIORIO` | Prior Anti-PD-(L)1 Therapy | Char | `SUPPDM.QVAL` where `QNAM = "PRIORIO"` (`"Y"`/`"N"`) |
| `PRLINES` | Number of Prior Lines | Num | `SUPPDM.QVAL` where `QNAM = "PRLINES"` |
| `BRAINMET` | Brain Metastases | Char | `SUPPDM.QVAL` where `QNAM = "BRAINMET"` |
| `SMOKSTAT` | Smoking Status | Char | `SUPPDM.QVAL` where `QNAM = "SMOKSTAT"` |
| `STRAT1R` | ECOG Stratum as Randomized | Char | `SUPPDM.QVAL` where `QNAM = "STRATECG"` (the IxRS value recorded at randomization; **not** derived from `ECOGBL`) |
| `STRAT2R` | Prior Anti-PD-(L)1 Stratum as Randomized | Char | `SUPPDM.QVAL` where `QNAM = "STRATIO"` (the IxRS value recorded at randomization) |
| `ARM`, `ARMCD`, `ACTARM`, `ACTARMCD` | Planned / actual arm | Char | Predecessor: `DM` |
| `TRT01P` | Planned Treatment for Period 01 | Char | `"CBX-417 + Docetaxel"` when `ARMCD = "CBX+DOC"`, else `"Placebo + Docetaxel"` |
| `TRT01PN` | Planned Treatment for Period 01 (N) | Num | 1 = CBX-417 + Docetaxel, 2 = Placebo + Docetaxel |
| `TRT01A` | Actual Treatment for Period 01 | Char | For treated subjects: `"CBX-417 + Docetaxel"` if at least one CBX-417 kit was dispensed and taken, else `"Placebo + Docetaxel"`; null when `SAFFL = "N"` |
| `TRT01AN` | Actual Treatment for Period 01 (N) | Num | 1 / 2, as `TRT01PN`; null when `TRT01A` is null |
| `RANDDT` | Date of Randomization | Num | IxRS `RAND_DATE` |
| `TRTSDT` | Date of First Exposure to Treatment | Num | Date part of `DM.RFXSTDTC` |
| `TRTSDTM` | Datetime of First Exposure to Treatment | Num | `DM.RFXSTDTC` with time when collected |
| `TRTEDT` | Date of Last Exposure to Treatment | Num | Date part of `DM.RFXENDTC`; for subjects still on treatment at the cutoff, the last dose date on or before `DCUTDT` |
| `TRTDURD` | Total Treatment Duration (days) | Num | `TRTEDT − TRTSDT + 1`; null when `SAFFL = "N"` |
| `EOTSTT` | End of Treatment Status | Char | `"COMPLETED"`, `"DISCONTINUED"` or `"ONGOING"`, from `DS` records with `DSSCAT = "STUDY TREATMENT"` and the data cutoff |
| `DCTREAS` | Reason for Discontinuation of Treatment | Char | `DS.DSDECOD` where `DSSCAT = "STUDY TREATMENT"` and the subject discontinued |
| `DCTDT` | Date of Treatment Discontinuation | Num | Date of the `DS` record with `DSSCAT = "STUDY TREATMENT"` |
| `EOSSTT` | End of Study Status | Char | `"COMPLETED"`, `"DISCONTINUED"` or `"ONGOING"`, from `DS` records with `DSSCAT = "STUDY PARTICIPATION"` |
| `DCSREAS` | Reason for Discontinuation of Study | Char | `DS.DSDECOD` where `DSSCAT = "STUDY PARTICIPATION"` |
| `EOSDT` | Date of End of Study | Num | Date of the `DS` record with `DSSCAT = "STUDY PARTICIPATION"` |
| `DTHFL` | Subject Death Flag | Char | `"Y"` if `DM.DTHDTC` is not null and the death occurred on or before `DCUTDT`, else `"N"` |
| `DTHDT` | Date of Death | Num | Date part of `DM.DTHDTC` (null if after `DCUTDT`) |
| `DTHCAUS` | Cause of Death | Char | `SUPPDM.QVAL` where `QNAM = "DTHCAUS"` |
| `LSTALVDT` | Last Known Alive Date | Num | Maximum of all visit, assessment, dosing and survival-contact dates on or before `DCUTDT`; for subjects who died, `DTHDT` |
| `DCUTDT` | Data Cutoff Date | Num | Constant `2025-03-31` |
| `RANDFL` | Randomized Population Flag | Char | `"Y"` if `RANDDT` is not null, else `"N"` |
| `ITTFL` | Intent-to-Treat Population Flag | Char | Equal to `RANDFL` (all randomized subjects) |
| `SAFFL` | Safety Population Flag | Char | `"Y"` if the subject received at least one dose of any study drug (`TRTSDT` not null), else `"N"` |
| `EFFFL` | Efficacy-Evaluable Population Flag | Char | `"Y"` if `ITTFL = "Y"`, measurable disease at baseline (a baseline `TR` record with `TRTESTCD = "SUMDIAM"`), and at least one post-baseline tumor assessment **or** death before the first scheduled post-baseline assessment; else `"N"` |
| `PPROTFL` | Per-Protocol Population Flag | Char | `"Y"` if `ITTFL = "Y"` and no major protocol deviation affecting efficacy (classified blind before database lock; SAP Section 6.2), else `"N"` |

**QC checks.** `count(ITTFL = "Y") = 420`; `count(SAFFL = "Y") = 420 − (subjects never treated)`; every subject with `SAFFL = "Y"` has a non-missing `TRT01A`; `TRT01A ≠ TRT01P` only for documented dispensing errors; `TRTEDT ≥ TRTSDT`; `LSTALVDT ≥ RANDDT`.

---

## 3. ADAE — Adverse Events Analysis Dataset (OCCDS)

Population: all `AE` records for subjects in `ADSL`. Subject-level variables copied from `ADSL`: `TRT01A`/`TRT01AN` (as `TRTA`/`TRTAN`), `SAFFL`, `TRTSDT`, `TRTEDT`, `AGEGR1`, `SEX`, `RACE`, `REGION1`.

| Variable | Label | Type | Derivation |
|---|---|---|---|
| `AESEQ`, `AESPID`, `AETERM`, `AEDECOD`, `AEBODSYS`, `AESER`, `AEACN`, `AEOUT` | — | — | Predecessor: `AE` |
| `ASTDT` | Analysis Start Date | Num | From `AE.AESTDTC`. Complete date: used as is. Day missing: 1st of the month, unless the month and year equal those of `TRTSDT`, in which case `TRTSDT`. Month and day missing: 1 January, unless the year equals that of `TRTSDT`, in which case `TRTSDT`. An imputed start date later than a complete `AENDT` is set to `AENDT`. A completely missing start date is not imputed |
| `ASTDTF` | Analysis Start Date Imputation Flag | Char | `"D"` when the day was imputed, `"M"` when month and day were imputed, null otherwise |
| `AENDT` | Analysis End Date | Num | From `AE.AEENDTC`. Day missing: last day of the month; month and day missing: 31 December; an imputed end date later than `DTHDT` or `DCUTDT` is set to that date; null when the event is ongoing |
| `AENDTF` | Analysis End Date Imputation Flag | Char | As `ASTDTF` |
| `ASTDY` | Analysis Start Relative Day | Num | `ASTDT − TRTSDT + 1` if `ASTDT ≥ TRTSDT`, else `ASTDT − TRTSDT` |
| `AENDY` | Analysis End Relative Day | Num | Same rule using `AENDT` |
| `ATOXGR` | Analysis Toxicity Grade | Char | Predecessor: `AE.AETOXGR` |
| `ATOXGRN` | Analysis Toxicity Grade (N) | Num | Numeric value of `ATOXGR` (1–5) |
| `AREL` | Analysis Causality | Char | `AE.AEREL` (relationship to CBX-417/placebo) |
| `AERELDOC` | Causality, Docetaxel | Char | `SUPPAE.QVAL` where `QNAM = "AERELDOC"` |
| `AEACNDOC` | Action Taken with Docetaxel | Char | `SUPPAE.QVAL` where `QNAM = "AEACNDOC"` |
| `ADURN`, `ADURU` | Analysis Duration and Unit | Num, Char | `AENDT − ASTDT + 1` in days, when both dates are known |
| `TRTEMFL` | Treatment-Emergent Analysis Flag | Char | `"Y"` when `SAFFL = "Y"` and `TRTSDT ≤ ASTDT ≤ TRTEDT + 30`; when `ASTDT` is missing, `"Y"` unless `AENDT < TRTSDT`; null otherwise |
| `AOCCFL` | 1st Occurrence of Any TEAE Flag | Char | `"Y"` on the chronologically first record with `TRTEMFL = "Y"` per subject (ties broken by `AESEQ`) |
| `AOCCSFL` | 1st Occurrence of SOC Flag | Char | `"Y"` on the first `TRTEMFL = "Y"` record per subject and `AEBODSYS` |
| `AOCCPFL` | 1st Occurrence of Preferred Term Flag | Char | `"Y"` on the first `TRTEMFL = "Y"` record per subject and `AEDECOD` |
| `TRTA`, `TRTAN` | Actual Treatment | Char, Num | Copied from `ADSL.TRT01A`, `TRT01AN` |

**Notes.** Occurrence flags are derived **after** restricting to `TRTEMFL = "Y"` and sorting by `USUBJID`, `ASTDT`, `AESEQ`; they identify the record that represents the subject in incidence tables. Counting distinct `USUBJID` gives the same result and is the recommended QC method. Grade-based tables select each subject's maximum `ATOXGRN` within the summarized grouping, not the occurrence-flagged record.

---

## 4. ADLB — Laboratory Analysis Dataset (BDS)

Population: all `LB` records for subjects in `ADSL` with `SAFFL = "Y"`, for the parameters below. One record per subject, parameter and collection date; `ANL01FL` identifies the record used for by-visit summaries.

| Variable | Label | Type | Derivation |
|---|---|---|---|
| `PARAMCD` | Parameter Code | Char | `LB.LBTESTCD` (`ALT`, `AST`, `ALP`, `BILI`, `CREAT`, `ALB`, `HGB`, `WBC`, `NEUT`, `PLAT`) |
| `PARAM` | Parameter | Char | Test name with standard unit, for example `"Alanine Aminotransferase (U/L)"` |
| `PARCAT1` | Parameter Category 1 | Char | `"CHEMISTRY"` or `"HEMATOLOGY"` (from `LB.LBCAT`) |
| `AVAL` | Analysis Value | Num | `LB.LBSTRESN` (standard/SI units) |
| `ADT` | Analysis Date | Num | Date part of `LB.LBDTC` |
| `ADY` | Analysis Relative Day | Num | `ADT − TRTSDT + 1` if `ADT ≥ TRTSDT`, else `ADT − TRTSDT` |
| `AVISIT` | Analysis Visit | Char | Scheduled records: the nominal visit. Unscheduled records: the analysis visit whose window contains `ADY` (SAP Section 5.4); null when outside all windows |
| `AVISITN` | Analysis Visit (N) | Num | Numeric order of `AVISIT` (baseline = 0) |
| `ABLFL` | Baseline Record Flag | Char | `"Y"` on the last non-missing record with `ADT ≤ TRTSDT` per subject and parameter (for never-treated subjects, `ADT ≤ RANDDT`); ties broken by the later collection time, then the higher `LBSEQ` |
| `BASE` | Baseline Value | Num | `AVAL` of the record where `ABLFL = "Y"`, copied to all records of the subject and parameter |
| `CHG` | Change from Baseline | Num | `AVAL − BASE` on post-baseline records; null on the baseline record and when `BASE` is missing |
| `PCHG` | Percent Change from Baseline | Num | `100 × (AVAL − BASE) / BASE` on post-baseline records when `BASE` is not 0 |
| `ANRLO`, `ANRHI` | Analysis Normal Range Lower/Upper Limit | Num | `LB.LBSTNRLO`, `LB.LBSTNRHI` |
| `ANRIND` | Analysis Reference Range Indicator | Char | `"LOW"`, `"NORMAL"`, `"HIGH"` from `AVAL` versus `ANRLO`/`ANRHI` |
| `BNRIND` | Baseline Reference Range Indicator | Char | `ANRIND` of the baseline record, copied to all records |
| `ATOXGR` | Analysis Toxicity Grade | Char | CTCAE v5.0-style grade (`0`–`4`) for `ALT`, `AST`, `BILI`, `NEUT`, `PLAT`, `HGB`, using the criteria for a normal baseline (SAP Section 10.3.1); `"0"` when no grade criterion is met |
| `ATOXGRN` | Analysis Toxicity Grade (N) | Num | Numeric value of `ATOXGR` |
| `BTOXGR` | Baseline Toxicity Grade | Char | `ATOXGR` of the baseline record, copied to all records |
| `BTOXGRN` | Baseline Toxicity Grade (N) | Num | Numeric value of `BTOXGR` |
| `ONTRTFL` | On-Treatment Record Flag | Char | `"Y"` when `TRTSDT < ADT ≤ TRTEDT + 30`; null otherwise |
| `ANL01FL` | Analysis Flag 01 | Char | `"Y"` on one record per subject, parameter and `AVISIT`: the scheduled record if present, otherwise the latest unscheduled record within the window; ties broken by the later collection time |
| `SRCDOM` | Source Domain | Char | `"LB"` |
| `SRCVAR` | Source Variable | Char | `"LBSTRESN"` |
| `SRCSEQ` | Source Sequence Number | Num | `LB.LBSEQ` |
| `TRTA`, `TRTAN`, `SAFFL` | Treatment and population | Char, Num, Char | Copied from `ADSL` |

**Worst post-baseline derivations** used by shift tables are computed at reporting time from records with `ONTRTFL = "Y"` (maximum `ATOXGRN`, or the most extreme `ANRIND` in the clinically relevant direction), not stored as separate records.

---

## 5. ADTTE — Time-to-Event Analysis Dataset (BDS)

One record per subject and parameter, for subjects with `ITTFL = "Y"` (`DOR`: confirmed responders only).

| Variable | Label | Type | Derivation |
|---|---|---|---|
| `PARAMCD` | Parameter Code | Char | `"PFS"`, `"OS"`, `"DOR"` |
| `PARAM` | Parameter | Char | `"Progression-Free Survival (days)"`, `"Overall Survival (days)"`, `"Duration of Response (days)"` |
| `STARTDT` | Time-to-Event Origin Date | Num | `RANDDT` for `PFS` and `OS`; the date of the first documented (subsequently confirmed) response for `DOR` |
| `ADT` | Analysis Date | Num | Event or censoring date per the rules below |
| `AVAL` | Analysis Value (days) | Num | `ADT − STARTDT + 1` |
| `AVALU` | Analysis Value Unit | Char | `"DAYS"` |
| `PARAMN` | Parameter (N) | Num | 1 = `PFS`, 2 = `OS`, 3 = `DOR` |
| `CNSR` | Censor | Num | `0` = event; `1`–`4` = censored, per the rules below |
| `EVNTDESC` | Event or Censoring Description | Char | For example `"Progressive disease"`, `"Death"`, `"No progression or death"`, `"New anticancer therapy"`, `"Event after 2 or more missed assessments"`, `"No baseline or post-baseline assessment"` |
| `CNSDTDSC` | Censoring Date Description | Char | Origin of the censoring date, for example `"Last adequate tumor assessment"`, `"Randomization"`, `"Last adequate assessment on or before new anticancer therapy"`, `"Last known alive date"`; null for events |
| `SRCDOM`, `SRCVAR`, `SRCSEQ` | Source | Char, Char, Num | Source of `ADT`: `RS`/`RSDTC`/`RSSEQ` for progression, `DM`/`DTHDTC` for death, `ADSL`/`LSTALVDT` for administrative censoring |
| `TRTP`, `TRTPN` | Planned Treatment | Char, Num | Copied from `ADSL.TRT01P`, `TRT01PN` |
| `ITTFL`, `EFFFL` | Population flags | Char | Copied from `ADSL` |
| `STRAT1R`, `STRAT2R` | Stratification factors as randomized | Char | Copied from `ADSL` |
| `AGEGR1`, `SEX`, `REGION1`, `ECOGBL`, `HISTOL`, `PDL1CAT`, `BRAINMET`, `PRIORIO` | Subgroup covariates | Char | Copied from `ADSL` |

### 5.1 PFS (`PARAMCD = "PFS"`)

Definitions: an **adequate assessment** has `ADRS.AVALC` in {`CR`, `PR`, `SD`, `PD`} on or before `DCUTDT`; a scheduled assessment is **missed** when its entire ±7-day window passes with no adequate assessment. Rules are applied **in this order**:

| Order | Condition | `ADT` | `CNSR` |
|---:|---|---|---|
| 1 | No baseline tumor assessment, or no post-baseline adequate assessment, and no death within 91 days of randomization | `RANDDT` | 2 |
| 2 | New anticancer therapy started before the first progression or death | Last adequate assessment on or before the new therapy start (`RANDDT` if none) | 3 |
| 3 | Progression or death preceded by ≥ 2 consecutive missed scheduled assessments | Last adequate assessment before the missed assessments (`RANDDT` if none) | 4 |
| 4 | Progression or death (whichever first) on or before `DCUTDT` | Date of progression or death | 0 |
| 5 | Otherwise | Last adequate assessment | 1 |

The progression date is the date of the tumor assessment documenting progression (`RS.RSDTC` where `RSTESTCD = "OVRLRESP"` and the result is `PD`). Death dates after `DCUTDT` are ignored.

### 5.2 OS (`PARAMCD = "OS"`)

| Condition | `ADT` | `CNSR` |
|---|---|---|
| Death on or before `DCUTDT` | `DTHDT` | 0 |
| Otherwise | `LSTALVDT` | 1 |

### 5.3 DoR (`PARAMCD = "DOR"`)

Derived only for subjects whose confirmed best overall response is `CR` or `PR`. `STARTDT` is the date of the first documented response that was subsequently confirmed. Event and censoring rules are those of Section 5.1 applied from `STARTDT` onward.

---

## 6. QC expectations

| Check | Expectation |
|---|---|
| `ADSL` subject count | 420 records; `ITTFL = "Y"` for all |
| `ADAE` | Every record has `TRTA` when `SAFFL = "Y"`; `ASTDTF` populated for every imputed date; no `ASTDT` after `AENDT` |
| `ADLB` | At most one `ABLFL = "Y"` per subject and parameter; at most one `ANL01FL = "Y"` per subject, parameter and `AVISIT`; `CHG` null when `BASE` is missing |
| `ADTTE` | One record per subject per parameter; `AVAL ≥ 1`; `CNSR` in 0–4 for `PFS`/`DOR` and 0–1 for `OS`; `EVNTDESC` populated on every record; `CNSDTDSC` populated exactly when `CNSR > 0` |
| Cross-dataset | `ADTTE` subjects with `CNSR = 3` appear in the listing of subsequent anticancer therapy; PFS events equal the number of subjects with documented progression or death that satisfy rule 4 |
