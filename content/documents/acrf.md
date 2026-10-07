# Annotated CRF (aCRF) — CBX417-301

> **Educational, fictional document.** This is the CBX417-301 CRF annotated with its SDTM targets,
> in the conventional style used for `acrf.pdf` in a submission. The study, its data and some
> mapping choices are invented for training; simplifications are labeled.

## How to read the annotations

| Annotation style | Meaning |
|---|---|
| `DM.SEX` | The field is submitted in domain `DM`, variable `SEX` |
| `VS.VSORRES when VSTESTCD = "SYSBP"` | Value-level mapping: the field becomes a record in `VS` where the test code identifies it |
| `DM.AGEU = "YEARS"` | The variable is assigned a constant, not collected |
| `SUPPAE.QVAL when QNAM = "AERELDOC"` | The field is submitted as a supplemental qualifier of the parent domain |
| `[NOT SUBMITTED]` | The field is collected but not submitted in SDTM (for example, an operational or eligibility check); the reason is given in the cSDRG |
| *(derived)* | The SDTM variable is derived rather than mapped one-to-one from this field |

Identifier variables are annotated once here rather than on every page: `STUDYID = "CBX417-301"`, `DOMAIN`, `USUBJID = STUDYID || "-" || SITEID || "-" || SUBJID` *(derived)*, `--SEQ` *(derived)*, `VISIT`/`VISITNUM` from the visit selected on the page, and `EPOCH` *(derived)*.

> **Simplification (educational).**
> This aCRF reflects the reduced SDTM implementation used in this training app (see the SDTM specification and the cSDRG): `TR` carries only the sum of diameters, `RS` carries only the investigator's overall response and ECOG, and several baseline disease characteristics are submitted as supplemental qualifiers of `DM` rather than in `MH`, `SU`, `CM` or a findings domain. A production implementation would map them to those domains.

---

## Page 1 — Demographics *(Visit: SCREENING)*

| Field | SDTM annotation |
|---|---|
| `SITE_ID` | `DM.SITEID` |
| `SUBJECT_ID` | `DM.SUBJID` |
| `CONSENT_DATE` | `DM.RFICDTC`; also `DS.DSSTDTC when DSDECOD = "INFORMED CONSENT OBTAINED"` and `DSCAT = "PROTOCOL MILESTONE"` |
| `BIRTH_YEAR` | `DM.BRTHDTC` (year only, ISO 8601 `YYYY`) |
| `AGE` | `DM.AGE`; `DM.AGEU = "YEARS"` |
| `SEX` | `DM.SEX` |
| `RACE_WHITE`, `RACE_ASIAN`, `RACE_BLACK`, `RACE_AMIND`, `RACE_NHPI`, `RACE_OTHER`, `RACE_NOT_REPORTED` | `DM.RACE` *(derived: the single checked category; if more than one is checked, `RACE = "MULTIPLE"` and each selected category is submitted in `SUPPDM.QVAL when QNAM = "RACE1"`, `"RACE2"`, …)* |
| `RACE_OTHER_SP` | `SUPPDM.QVAL when QNAM = "RACEOTH"` |
| `ETHNICITY` | `DM.ETHNIC` |
| `COUNTRY` | `DM.COUNTRY` (ISO 3166-1 alpha-3) |

*Not on the page but derived into `DM`:* `ACTARMUD` *(description of unplanned actual treatment)*, `RFSTDTC`, `RFXSTDTC` (first dose, from `EX`), `RFXENDTC` (last dose, from `EX`), `RFENDTC`/`RFPENDTC` (end of participation, from `DS`), `DTHDTC`/`DTHFL` (from the Death page), `ARM`/`ARMCD` (IxRS), `ACTARM`/`ACTARMCD` *(derived from dispensing)*, `ARMNRS` *(derived: `"SCREEN FAILURE"` or `"ASSIGNED, NOT TREATED"`)*.

---

## Page 2 — Baseline Disease Characteristics *(Visit: SCREENING)*

| Field | SDTM annotation |
|---|---|
| `HISTOLOGY` | `SUPPDM.QVAL when QNAM = "DISHIST"` |
| `STAGE` | `SUPPDM.QVAL when QNAM = "DISSTAGE"` |
| `DIAG_DATE` | `MH.MHSTDTC when MHCAT = "PRIMARY DIAGNOSIS"` (ISO 8601, partial dates retained) |
| `PDL1_TPS` | `SUPPDM.QVAL when QNAM = "PDL1TPS"` |
| `PRIOR_LINES` | `SUPPDM.QVAL when QNAM = "PRLINES"` |
| `PRIOR_IO` | `SUPPDM.QVAL when QNAM = "PRIORIO"` |
| `BRAIN_METS` | `SUPPDM.QVAL when QNAM = "BRAINMET"` |
| `SMOKING` | `SUPPDM.QVAL when QNAM = "SMOKSTAT"` |
| `ECOG_SCREEN` | `[NOT SUBMITTED]` — eligibility check only; the analyzed screening ECOG comes from the Vital Signs page (`RS`, `RSTESTCD = "ECOG101"`, `VISIT = "SCREENING"`) |

---

## Page 3 — Vital Signs and Performance Status *(Visits: SCREENING, CYCLE n DAY 1, END OF TREATMENT, SAFETY FOLLOW-UP, UNSCHEDULED)*

| Field | SDTM annotation |
|---|---|
| `VISIT_NAME` | `VS.VISIT`; `VS.VISITNUM` *(derived from the visit list)* — same for the `RS` record below |
| `VS_DATE`, `VS_TIME` | `VS.VSDTC` (ISO 8601 date, with time when collected) |
| `SYSBP` | `VS.VSORRES when VSTESTCD = "SYSBP"`; `VS.VSORRESU = "mmHg"`; `VS.VSTEST = "Systolic Blood Pressure"` |
| `DIABP` | `VS.VSORRES when VSTESTCD = "DIABP"`; `VS.VSORRESU = "mmHg"` |
| `PULSE` | `VS.VSORRES when VSTESTCD = "PULSE"`; `VS.VSORRESU = "beats/min"` |
| `TEMP` | `VS.VSORRES when VSTESTCD = "TEMP"` |
| `TEMP_UNIT` | `VS.VSORRESU when VSTESTCD = "TEMP"` (`C` or `F`; `VSSTRESU = "C"` after conversion) |
| `WEIGHT` | `VS.VSORRES when VSTESTCD = "WEIGHT"` |
| `WEIGHT_UNIT` | `VS.VSORRESU when VSTESTCD = "WEIGHT"` (`kg` or `lb`; `VSSTRESU = "kg"` after conversion) |
| `HEIGHT` | `VS.VSORRES when VSTESTCD = "HEIGHT"` (screening only) |
| `HEIGHT_UNIT` | `VS.VSORRESU when VSTESTCD = "HEIGHT"` (`cm` or `in`; `VSSTRESU = "cm"` after conversion) |
| `ECOG` | `RS.RSORRES when RSTESTCD = "ECOG101"`; `RS.RSCAT = "ECOG"`; `RS.RSTEST = "ECOG1-Performance Status"`; `RS.RSEVAL = "INVESTIGATOR"`; `RS.RSDTC` from `VS_DATE` |

*Derived on every `VS`/`RS` record:* `--STRESC`, `--STRESN`, `--STRESU` *(standardized results and units)*, `--DY` *(study day relative to `RFSTDTC`, no day 0)*, `--LOBXFL` *(last observation before exposure flag)*, `EPOCH`.

---

## Page 4 — Adverse Event Log

| Field | SDTM annotation |
|---|---|
| `AE_LINE` | `AE.AESPID` |
| `AE_TERM` | `AE.AETERM` (verbatim, never modified) |
| `AE_START` | `AE.AESTDTC` (ISO 8601; partial dates retained, for example `2023-03`) |
| `AE_END` | `AE.AEENDTC` |
| `AE_ONGOING` | `AE.AEENRTPT = "ONGOING"` when Yes; `AE.AEENTPT` = the reference time point text *(sponsor-defined)* |
| `AE_GRADE` | `AE.AETOXGR` |
| `AE_SERIOUS` | `AE.AESER` |
| `AE_SER_DEATH` | `AE.AESDTH` |
| `AE_SER_LIFE_THREAT` | `AE.AESLIFE` |
| `AE_SER_HOSP` | `AE.AESHOSP` |
| `AE_SER_DISAB` | `AE.AESDISAB` |
| `AE_SER_CONG_ANOM` | `AE.AESCONG` |
| `AE_SER_MED_IMPORTANT` | `AE.AESMIE` |
| `AE_REL_CBX` | `AE.AEREL` |
| `AE_REL_DOC` | `SUPPAE.QVAL when QNAM = "AERELDOC"` (QLABEL = "Relationship to Docetaxel") |
| `AE_ACTION_CBX` | `AE.AEACN` |
| `AE_ACTION_DOC` | `SUPPAE.QVAL when QNAM = "AEACNDOC"` (QLABEL = "Action Taken with Docetaxel") |
| `AE_OUTCOME` | `AE.AEOUT` |
| `CODED_PT` | `AE.AEDECOD` |
| `CODED_SOC` | `AE.AEBODSYS`; `AE.AESOC` *(primary system organ class)* |

*Derived:* `AE.AESTDY`, `AE.AEENDY`, `EPOCH`. Severity (`AESEV`) is not collected; CTCAE grade is used instead.

---

## Page 5 — Concomitant Medications Log

| Field | SDTM annotation |
|---|---|
| `CM_LINE` | `CM.CMSPID` |
| `CM_TERM` | `CM.CMTRT` (verbatim) |
| `CM_CATEGORY` | `CM.CMCAT` |
| `CM_INDICATION` | `CM.CMINDC` |
| `CM_DOSE` | `CM.CMDOSE` |
| `CM_UNIT` | `CM.CMDOSU` |
| `CM_ROUTE` | `CM.CMROUTE` |
| `CM_FREQ` | `CM.CMDOSFRQ` |
| `CM_START` | `CM.CMSTDTC` |
| `CM_END` | `CM.CMENDTC` |
| `CM_ONGOING` | `CM.CMENRTPT = "ONGOING"` when Yes |
| `CODED_NAME` | `CM.CMDECOD` |
| `CODED_ATC_CLASS` | `CM.CMCLAS` |

---

## Page 6 — Tumor Assessment (RECIST 1.1)

| Field | SDTM annotation |
|---|---|
| `VISIT_NAME` | `TR.VISIT` / `RS.VISIT`; `VISITNUM` *(derived)* |
| `SCAN_DATE` | `TR.TRDTC` and `RS.RSDTC` |
| `SCAN_METHOD` | `TR.TRMETHOD` *(imaging method)* |
| `TARGET_SLD_MM` | `TR.TRORRES when TRTESTCD = "SUMDIAM"`; `TR.TRORRESU = "mm"`; `TR.TRTEST = "Sum of Diameter"`; `TR.TREVAL = "INVESTIGATOR"` |
| `NONTARGET_RESP` | `[NOT SUBMITTED]` in this implementation — a production implementation submits `RS.RSORRES when RSTESTCD = "NTRGRESP"` |
| `NEW_LESION` | `[NOT SUBMITTED]` in this implementation — a production implementation records new lesions in `TU`/`TR` |
| `OVERALL_RESP` | `RS.RSORRES when RSTESTCD = "OVRLRESP"`; `RS.RSCAT = "RECIST 1.1"`; `RS.RSTEST = "Overall Response"`; `RS.RSEVAL = "INVESTIGATOR"` |

---

## Page 7 — End of Treatment

| Field | SDTM annotation |
|---|---|
| `EOT_DATE` | `DS.DSSTDTC when DSCAT = "DISPOSITION EVENT"` and `DSSCAT = "STUDY TREATMENT"` |
| `EOT_REASON` | `DS.DSTERM` (verbatim) and `DS.DSDECOD` *(standardized, for example `"PROGRESSIVE DISEASE"`, `"ADVERSE EVENT"`, `"DEATH"`, `"WITHDRAWAL BY SUBJECT"`, `"PHYSICIAN DECISION"`, `"LOST TO FOLLOW-UP"`, `"STUDY TERMINATED BY SPONSOR"`, `"COMPLETED"`)* |
| `LAST_DOSE_DATE` | `[NOT SUBMITTED]` — used for reconciliation with the dosing pages; `DM.RFXENDTC` is derived from `EX` |

---

## Page 8 — Death

| Field | SDTM annotation |
|---|---|
| `DEATH_DATE` | `DM.DTHDTC`; `DM.DTHFL = "Y"`; also `DS.DSSTDTC when DSDECOD = "DEATH"` and `DSSCAT = "STUDY PARTICIPATION"` |
| `DEATH_CAUSE` | `DD.DDORRES when DDTESTCD = "PRCDTH"`; `DD.DDSTRESC` *(standardized)* |
| `DEATH_CAUSE_SPEC` | `DD.DDORRES when DDTESTCD = "PRCDTH"` *(appended to the verbatim cause when "Other" is selected)* |

---

## Pages not shown in this excerpt

The full CRF also includes the enrollment/eligibility page, study drug and docetaxel dosing pages, medical history, ECG, laboratory requisition (central laboratory results arrive as a vendor transfer, not through the CRF), protocol deviations (recorded in the CTMS), end of study and survival follow-up. Their annotations follow the same conventions: `EX` for dosing, `MH` for medical history, `EG` for ECG, `LB` for laboratory data, `DV` for deviations, and `DS` for disposition milestones.
