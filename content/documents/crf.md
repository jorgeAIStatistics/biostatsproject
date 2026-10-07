# Case Report Form (eCRF) — CBX417-301

> **Educational, fictional document.** These pages imitate the layout of an electronic case report
> form for the synthetic study CBX417-301. Field names match the raw EDC extracts used in this app
> (`data/oncology/raw/*.csv`). No real study data are shown.

**General completion conventions**

| Convention | Detail |
|---|---|
| Date format | `DD MMM YYYY` (for example `07 MAR 2023`) |
| Unknown date parts | `UN` for an unknown day, `UNK` for an unknown month (for example `UN MAR 2023`, `UN UNK 2022`) |
| Blank fields | Not permitted for required items; use the provided "Unknown"/"Not done" options |
| Units | Pre-printed where fixed; selected on the page where sites may record different units |
| Record identifier | Every saved record receives a system identifier (`RECORD_ID`, for example `AE-000123`) used in queries and data listings |
| Header on every page | `SITE_ID`, `SUBJECT_ID` and, for visit-based pages, `VISIT_NAME` |

Log pages (adverse events, concomitant medications) are cumulative: each new entry is a new line, identified by a line number within the subject (`AE_LINE`, `CM_LINE`).

---

## Page 1 — Demographics

*Visit: SCREENING. Complete after informed consent.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Site number | `SITE_ID` | 4 digits, pre-populated |
| 2 | Subject number | `SUBJECT_ID` | `SITE_ID`-NNNN, assigned by EDC |
| 3 | Date of informed consent | `CONSENT_DATE` | `DD MMM YYYY` (also recorded on the enrollment page) |
| 4 | Year of birth | `BIRTH_YEAR` | YYYY |
| 5 | Age at consent (years) | `AGE` | Integer, 18–99 |
| 6 | Sex | `SEX` | Male / Female |
| 7 | Race (check all that apply) | `RACE_WHITE`, `RACE_ASIAN`, `RACE_BLACK`, `RACE_AMIND`, `RACE_NHPI`, `RACE_OTHER`, `RACE_NOT_REPORTED` | Checkbox: `Y` if checked, blank otherwise |
| 8 | If Other race, specify | `RACE_OTHER_SP` | Free text, ≤ 60 characters |
| 9 | Ethnicity | `ETHNICITY` | Hispanic or Latino / Not Hispanic or Latino / Not reported / Unknown |
| 10 | Country of the site | `COUNTRY` | Selected list (ISO 3166-1 alpha-3) |

*Completion note:* record race as reported by the subject; check every category that applies. Age is calculated by the site from the subject's date of birth; only the year of birth is entered in the EDC.

---

## Page 2 — Baseline Disease Characteristics

*Visit: SCREENING.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Histology | `HISTOLOGY` | Non-squamous / Squamous |
| 2 | Disease stage at study entry | `STAGE` | IIIB / IIIC / IVA / IVB |
| 3 | Date of initial NSCLC diagnosis | `DIAG_DATE` | `DD MMM YYYY`; `UN`/`UNK` permitted |
| 4 | PD-L1 tumor proportion score (%) | `PDL1_TPS` | Integer 0–100, or `ND` if not done |
| 5 | Number of prior lines of systemic therapy for advanced disease | `PRIOR_LINES` | 1 / 2 |
| 6 | Prior anti-PD-(L)1 therapy | `PRIOR_IO` | Yes / No |
| 7 | Brain metastases (treated, stable) | `BRAIN_METS` | Yes / No |
| 8 | Smoking status | `SMOKING` | Current / Former / Never |
| 9 | ECOG performance status at screening | `ECOG_SCREEN` | 0 / 1 (eligibility check) |

*Completion note:* `ECOG_SCREEN` supports the eligibility check on this page. The ECOG value used in analyses is the one recorded on the vital signs page at each visit; the stratification value is entered separately in the IxRS at randomization.

---

## Page 3 — Vital Signs and Performance Status

*Visits: SCREENING, CYCLE n DAY 1, END OF TREATMENT, SAFETY FOLLOW-UP, UNSCHEDULED. One record per visit (wide form).*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Visit | `VISIT_NAME` | Selected from the visit list |
| 2 | Assessment date | `VS_DATE` | `DD MMM YYYY` |
| 2b | Assessment time | `VS_TIME` | `HH:MM` (24-hour) |
| 3 | Systolic blood pressure (mmHg) | `SYSBP` | Integer 50–250 |
| 4 | Diastolic blood pressure (mmHg) | `DIABP` | Integer 30–150 |
| 5 | Pulse rate (beats/min) | `PULSE` | Integer 30–200 |
| 6 | Temperature | `TEMP` | Numeric, 1 decimal |
| 7 | Temperature unit | `TEMP_UNIT` | C / F |
| 8 | Weight | `WEIGHT` | Numeric, 1 decimal |
| 9 | Weight unit | `WEIGHT_UNIT` | kg / lb |
| 10 | Height (screening only) | `HEIGHT` | Numeric, 1 decimal |
| 11 | Height unit | `HEIGHT_UNIT` | cm / in |
| 12 | ECOG performance status | `ECOG` | 0 / 1 / 2 / 3 / 4 / 5 |

*Completion note:* blood pressure and pulse are measured after the subject has been seated for at least 5 minutes. Height is collected at screening only. Record the unit actually used; do not convert.

---

## Page 4 — Adverse Event Log

*Log page. One line per adverse event, from informed consent through 30 days after the last dose of study drug.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | AE line number | `AE_LINE` | Integer, assigned sequentially per subject |
| 2 | Adverse event (verbatim term) | `AE_TERM` | Free text, ≤ 200 characters |
| 3 | Start date | `AE_START` | `DD MMM YYYY`; `UN`/`UNK` permitted |
| 4 | End date | `AE_END` | `DD MMM YYYY`; blank if ongoing |
| 5 | Ongoing at last assessment | `AE_ONGOING` | Yes / No |
| 6 | CTCAE v5.0 grade (worst) | `AE_GRADE` | 1 / 2 / 3 / 4 / 5 |
| 7 | Serious? | `AE_SERIOUS` | Yes / No |
| 8 | If serious, check all criteria that apply: results in death | `AE_SER_DEATH` | Checkbox `Y` / blank |
| 9 |  life-threatening | `AE_SER_LIFE_THREAT` | Checkbox `Y` / blank |
| 10 |  requires or prolongs hospitalization | `AE_SER_HOSP` | Checkbox `Y` / blank |
| 11 |  persistent or significant disability/incapacity | `AE_SER_DISAB` | Checkbox `Y` / blank |
| 12 |  congenital anomaly/birth defect | `AE_SER_CONG_ANOM` | Checkbox `Y` / blank |
| 13 |  other medically important event | `AE_SER_MED_IMPORTANT` | Checkbox `Y` / blank |
| 14 | Relationship to CBX-417/placebo | `AE_REL_CBX` | Related / Not related |
| 15 | Relationship to docetaxel | `AE_REL_DOC` | Related / Not related |
| 16 | Action taken with CBX-417/placebo | `AE_ACTION_CBX` | Dose not changed / Dose reduced / Drug interrupted / Drug withdrawn / Not applicable / Unknown |
| 17 | Action taken with docetaxel | `AE_ACTION_DOC` | Dose not changed / Dose reduced / Drug interrupted / Drug withdrawn / Not applicable / Unknown |
| 18 | Outcome | `AE_OUTCOME` | Recovered/resolved / Recovering/resolving / Not recovered/not resolved / Recovered/resolved with sequelae / Fatal / Unknown |
| 19 | Coded preferred term (coding system) | `CODED_PT` | Assigned by medical coding; not site-entered |
| 20 | Coded system organ class (coding system) | `CODED_SOC` | Assigned by medical coding; not site-entered |

*Completion notes:* record one event per line, using a single diagnosis where possible rather than individual signs and symptoms. If severity changes, record the worst grade for the event. Disease progression is captured on the tumor assessment and end-of-treatment pages and is not entered as an adverse event unless the clinical manifestation itself is reported as an event. Serious adverse events must also be reported to the sponsor's pharmacovigilance function within 24 hours of awareness.

---

## Page 5 — Concomitant Medications Log

*Log page. Includes prior anticancer therapy, concomitant medications and subsequent anticancer therapy.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Medication line number | `CM_LINE` | Integer, assigned sequentially per subject |
| 2 | Medication (verbatim term) | `CM_TERM` | Free text, ≤ 200 characters |
| 3 | Category | `CM_CATEGORY` | Prior cancer therapy / Concomitant / Subsequent anticancer therapy |
| 4 | Indication | `CM_INDICATION` | Free text, ≤ 100 characters |
| 5 | Dose | `CM_DOSE` | Numeric |
| 6 | Dose unit | `CM_UNIT` | mg / g / mL / IU / mcg / Other |
| 7 | Route | `CM_ROUTE` | Oral / Intravenous / Subcutaneous / Topical / Other |
| 8 | Frequency | `CM_FREQ` | QD / BID / TID / QID / PRN / Other |
| 9 | Start date | `CM_START` | `DD MMM YYYY`; `UN`/`UNK` permitted |
| 10 | End date | `CM_END` | `DD MMM YYYY`; blank if ongoing |
| 11 | Ongoing | `CM_ONGOING` | Yes / No |
| 12 | Coded medication name (coding system) | `CODED_NAME` | Assigned by medical coding |
| 13 | Coded drug class | `CODED_ATC_CLASS` | Assigned by medical coding |

*Completion note:* record any anticancer therapy started after study treatment discontinuation with category "Subsequent anticancer therapy" and its start date; this date is used in the efficacy analyses.

---

## Page 6 — Tumor Assessment (RECIST 1.1)

*Visits: SCREENING (baseline), WEEK 6, WEEK 12 … and UNSCHEDULED. One record per assessment.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Visit | `VISIT_NAME` | Selected from the tumor-assessment visit list |
| 2 | Scan date | `SCAN_DATE` | `DD MMM YYYY` |
| 2b | Imaging method | `SCAN_METHOD` | CT / MRI |
| 3 | Sum of diameters of target lesions (mm) | `TARGET_SLD_MM` | Numeric, 1 decimal; blank if not evaluable |
| 4 | Non-target lesion response | `NONTARGET_RESP` | CR / Non-CR/Non-PD / PD / NE / Not applicable |
| 5 | New lesion(s) present | `NEW_LESION` | Y / N |
| 6 | Overall response at this assessment | `OVERALL_RESP` | CR / PR / SD / PD / NE |

*Completion notes:* the baseline assessment must be within 28 days before randomization. Follow-up assessments follow the calendar from randomization (every 6 weeks ± 7 days through week 48, then every 9 weeks ± 7 days), regardless of dose delays, and continue after treatment discontinuation for reasons other than progression. Target lesions selected at baseline must be measured at every assessment; enter `NE` when an assessment cannot be evaluated.

---

## Page 7 — End of Treatment

*Completed when all study treatment is permanently stopped.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Date of end of treatment decision | `EOT_DATE` | `DD MMM YYYY` |
| 2 | Date of last dose of any study drug | `LAST_DOSE_DATE` | `DD MMM YYYY` |
| 3 | Primary reason for end of treatment | `EOT_REASON` | Progressive disease / Adverse event / Death / Withdrawal by subject / Physician decision / Lost to follow-up / Study terminated by sponsor / Other |

*Completion note:* `LAST_DOSE_DATE` must be consistent with the dosing pages; discrepancies are queried. End of treatment does not end study participation: tumor and survival follow-up continue as scheduled unless the subject withdraws consent.

---

## Page 8 — Death

*Completed when the site becomes aware of a subject's death.*

| # | Prompt | Field | Type / allowed values |
|---|---|---|---|
| 1 | Date of death | `DEATH_DATE` | `DD MMM YYYY` |
| 2 | Primary cause of death | `DEATH_CAUSE` | Progressive disease / Adverse event / Other / Unknown |
| 3 | If Other, specify | `DEATH_CAUSE_SPEC` | Free text, ≤ 100 characters |

*Completion note:* if the cause of death is an adverse event, the corresponding adverse event line must have outcome "Fatal" and grade 5; data management reconciles the two pages before database lock.
