# Flagship study specification — CBX417-301 (synthetic)

This document is the **design contract** for the flagship synthetic oncology trial used throughout
Clinical Biometrics Mastery OS: the trial simulator, dataset viewer, SDTM/ADaM labs, TLF lab,
"Trace This Value", SQL lab, QC lab, case studies and capstones.

Everything here is **fictional and synthetic**. No real patients, sponsors, sites or products.
Where the data follows CDISC conventions, it targets **SDTMIG v3.4 / SDTM v2.0** and **ADaMIG v1.3**
(the latest *final* versions at the time of writing; SDTMIG v4.0 / SDTM v3.0 were in public review
in 2026). Anything that is a simplification must be labeled as such in the data dictionary.

Controlled terminology values were checked against the NCI EVS CDISC SDTM CT file dated 2026-03-27
(`python3 scripts/tools/ct_lookup.py <CODELIST>` to verify locally).

---

## 1. Study design (protocol synopsis facts)

| Item | Value |
|---|---|
| STUDYID | `CBX417-301` |
| Title | A Phase 2/3, Randomized, Double-Blind, Placebo-Controlled, Multicenter Study of CBX-417 plus Docetaxel versus Placebo plus Docetaxel in Adults with Previously Treated Advanced or Metastatic Non-Small Cell Lung Cancer |
| Sponsor | Halden Therapeutics (fictional) |
| Investigational product | CBX-417, a fictional oral small-molecule targeted agent, 200 mg once daily (QD), 21-day cycles, continuous |
| Background therapy | Docetaxel 75 mg/m² IV on Day 1 of each 21-day cycle (open-label in both arms) |
| Control | Matching placebo QD + docetaxel |
| Blinding | Double-blind for CBX-417 vs placebo (docetaxel is open-label) |
| Randomization | 1:1, stratified by ECOG PS (0 vs 1) and prior anti-PD-(L)1 therapy (Yes vs No); permuted blocks of 4 within stratum via IxRS |
| Population | Adults ≥18 y, advanced/metastatic NSCLC, 1–2 prior lines incl. platinum doublet, ECOG 0–1, measurable disease per RECIST 1.1, no actionable EGFR/ALK alteration |
| Primary endpoint | Progression-free survival (PFS) per investigator, RECIST 1.1 |
| Key secondary | Overall survival (OS) |
| Other secondary | ORR (confirmed CR/PR), duration of response (DoR), safety (AEs, labs, vitals, ECG) |
| Sample size | 420 randomized (210/arm). 331 PFS events give 90% power to detect HR = 0.70 at two-sided α = 0.05 (Schoenfeld: d = 4(1.96+1.2816)²/(ln 0.70)² = 330.4 → 331) |
| Interim analysis | One interim analysis for PFS at ~66% information (≈219 events), Lan-DeMets O'Brien-Fleming-type spending; the data provided are the **final PFS analysis** cut |
| Data cutoff (DCO) | **2025-03-31** |
| Enrollment | First randomization 2022-04-11, last randomization 2023-11-28 |
| Sites | 42 sites in 12 countries across 3 regions (North America, Europe, Asia-Pacific) |

### Arms and codes

| ARMCD | ARM | TRT01P / TRT01PN |
|---|---|---|
| `CBX+DOC` | `CBX-417 200 mg + Docetaxel 75 mg/m2` | `CBX-417 + Docetaxel` / 1 |
| `PBO+DOC` | `Placebo + Docetaxel 75 mg/m2` | `Placebo + Docetaxel` / 2 |

Screen failures: `ARM`/`ARMCD`/`ACTARM`/`ACTARMCD` null with `ARMNRS = "SCREEN FAILURE"` (SDTMIG v3.3+
approach). Randomized-but-never-treated subjects: ARM populated, ACTARM/ACTARMCD null,
`ARMNRS = "ASSIGNED, NOT TREATED"`.

### Subject flow targets

| Stage | Count |
|---|---|
| Screened (informed consent) | 468 |
| Screen failures | 48 |
| Randomized (ITT) | 420 (210 CBX+DOC, 210 PBO+DOC) |
| Randomized, never treated | 4 (2 per arm) → SAFFL = N |
| Treated (safety population) | 416 |
| Dispensing errors | 3 subjects: 2 randomized to PBO+DOC received ≥1 CBX-417 kit → TRT01A = CBX-417 + Docetaxel; 1 randomized to CBX+DOC received only placebo kits → TRT01A = Placebo + Docetaxel |

### Visit schedule

- **Screening**: Day −28 to −1 relative to randomization (VISIT `SCREENING`, VISITNUM 1).
- **Treatment cycles** (21 days): `CYCLE 1 DAY 1` (VISITNUM 10, within 3 days after randomization),
  `CYCLE 1 DAY 8` (VISITNUM 11, labs only), then `CYCLE n DAY 1` (VISITNUM n×10) while on treatment.
- **End of treatment**: `END OF TREATMENT` (VISITNUM 800) within 7 days of the decision to stop.
- **Safety follow-up**: `SAFETY FOLLOW-UP` (VISITNUM 810) 30 (±7) days after last dose.
- **Survival follow-up**: every 12 weeks by phone (`SURVIVAL FOLLOW-UP n`, VISITNUM 900+n).
- **Tumor assessments** (CT/MRI, RECIST 1.1) on a calendar schedule from randomization regardless of
  dosing delays: screening (baseline, within 28 days before randomization), then every 6 weeks
  (±7 days) through week 48 (`WEEK 6`, `WEEK 12` … `WEEK 48`), then every 9 weeks (`WEEK 57`, `WEEK 66`, …)
  until PD, death, withdrawal, new anticancer therapy or DCO. Scans continue after treatment
  discontinuation for reasons other than PD.
- **Unscheduled** records: VISIT `UNSCHEDULED`, VISITNUM = preceding scheduled VISITNUM + 0.01 (a common
  convention, not a CDISC rule — label it as a convention).

Assessments by visit:

| Assessment | Schedule |
|---|---|
| Labs (hematology + chemistry) | Screening, C1D1 (pre-dose), C1D8, every CnD1, EOT, Safety FU |
| Vital signs + weight | Screening (incl. height), every CnD1, EOT, Safety FU |
| ECOG PS | Screening, every CnD1, EOT |
| ECG (QTcF, HR) | Screening, C1D1 (post-dose), C2D1, C4D1, EOT |
| Tumor assessment | Calendar schedule above |

### Treatment and dose modification

- CBX-417/placebo 200 mg QD continuous; reductions 200 → 150 → 100 mg; interruptions allowed up to 21 days.
- Docetaxel 75 mg/m² Day 1 q3w; dose (mg) = 75 × BSA (Mosteller: BSA = √(height_cm × weight_kg / 3600)),
  one reduction to 60 mg/m² permitted (typically after febrile neutropenia or grade ≥3 neutropenia).
- Treatment continues until PD, unacceptable toxicity, withdrawal or physician decision.
  Docetaxel may stop before CBX-417/placebo (e.g., cumulative toxicity) — end of treatment is the last dose of any study drug.

---

## 2. Truth model (how to simulate plausibly)

Simulate a **true** dataset first, then derive (a) raw EDC/vendor exports with injected data problems,
(b) SDTM from the corrected truth, (c) ADaM from SDTM. Use a seeded PRNG (e.g. mulberry32 / sfc32);
the generator must be fully deterministic (same seed → byte-identical CSVs).

### Baseline characteristics (approximate targets)

| Variable | Distribution |
|---|---|
| Age | median ~64 (range 33–85); ~42% ≥65 |
| Sex | ~61% M |
| Race | ~66% WHITE, ~24% ASIAN, ~6% BLACK OR AFRICAN AMERICAN, remainder other/not reported; a few MULTIPLE |
| Ethnicity | ~7% HISPANIC OR LATINO |
| Region | North America ~30%, Europe ~45%, Asia-Pacific ~25% |
| ECOG PS | 0 ~38%, 1 ~62% |
| Histology | non-squamous ~72%, squamous ~28% |
| Prior anti-PD-(L)1 | ~78% Yes |
| Prior lines | 1 (~65%) or 2 |
| Brain metastases (treated, stable) | ~12% |
| Smoking | current ~14%, former ~66%, never ~20% |
| PD-L1 TPS | <1% ~35%, 1–49% ~40%, ≥50% ~25% |
| Baseline SLD (target lesions) | lognormal, median ~68 mm (range 12–230) |
| Weight/height | realistic by sex/region; BSA 1.4–2.4 m² |

### Efficacy (targets, tune the generator until achieved within noise)

- **PFS**: control median ≈ 4.2 months; CBX-417 HR ≈ 0.70 (median ≈ 6.0 months). ECOG 1 raises hazard
  (~HR 1.35), brain mets (~1.3). ~8% of PFS events are deaths without documented PD.
- **Progression is detected at tumor assessments** (interval-censored truth): the PD date is the date of
  the assessment at which PD is first documented (or an unscheduled scan).
- **OS**: control median ≈ 10.5 months; HR ≈ 0.80. Generate OS consistent with PFS (death after PD
  with post-progression survival ~ median 6–7 months, plus deaths without PD).
- **Response**: confirmed ORR ≈ 27% (CBX) vs ≈ 14% (PBO); a few CR. SLD trajectories must be consistent
  with RECIST 1.1 logic: PR = ≥30% decrease from baseline SLD; PD = ≥20% increase from nadir **and**
  ≥5 mm absolute increase, **or** a new lesion. Confirmation of CR/PR requires a repeat assessment
  ≥4 weeks later (SAP rule for confirmed ORR).
- Build SLD paths from the truth: decline to a nadir that matches the subject's best response, then grow
  so that the PD criterion is met at the true progression time (or never before DCO).
- **Missed scans**: ~5% of subjects miss ≥2 consecutive scheduled assessments before PD/death.
- **New anticancer therapy** before PD in ~6% (mostly those discontinuing for AE/withdrawal).
- Everything after DCO (2025-03-31) is excluded from all files.

### Safety (targets)

TEAE incidence (any grade, %) CBX+DOC vs PBO+DOC, roughly: Neutropenia 40/38, Fatigue 45/38, Diarrhoea 48/22,
Alopecia 30/29, Nausea 32/26, Rash 30/10, Stomatitis 25/15, Decreased appetite 25/20, Anaemia 20/18,
ALT increased 18/6, AST increased 15/5, Oedema peripheral 15/12, Neuropathy peripheral 12/11,
Vomiting 15/12, Constipation 15/16, Dyspnoea 14/15, Cough 12/12, Pyrexia 10/9, Hypertension 12/4,
Febrile neutropenia 8/6, Pneumonia 7/6, Dysgeusia 10/7, Asthenia 12/11, Arthralgia 8/8, Headache 8/7,
Hypokalaemia 6/4, Thrombocytopenia 6/5, Pneumonitis 4/1, Pulmonary embolism 3/2.
(Use US or UK spelling consistently for coded terms — pick **US spelling**: Diarrhea, Anemia, Edema…)

- Grades 1–5 (NCI CTCAE v5.0 style); neutropenia often grade 3–4; febrile neutropenia grade ≥3 and serious.
- ~2–3% grade 5 (e.g., Pneumonia, Sepsis, Pulmonary embolism). Disease progression is **not** an AE.
- Some AEs start between consent and first dose (not treatment-emergent) and some start >30 days after last dose.
- ALT/AST lab values must be consistent with ALT/AST increased AEs (subjects with the AE should show elevated labs).
- Neutropenia AEs consistent with low NEUT values; hypokalemia with low K if K is included.
- AE coding is **MedDRA-like and illustrative** (real-looking PT/SOC names, **no MedDRA codes**). Include verbatim
  terms with realistic variation ("diarrhoea", "Loose stools", "ALT elevated", "tiredness").

### Labs

Tests (CDISC LBTESTCD): `ALT`, `AST`, `ALP`, `BILI`, `CREAT`, `ALB`, `HGB`, `WBC`, `NEUT`, `PLAT`
(optionally `K`). Standard (SI) units in SDTM LBSTRESU: U/L, U/L, U/L, umol/L, umol/L, g/L, g/L,
10^9/L, 10^9/L, 10^9/L. Some sites report conventional units in raw data (BILI mg/dL ×17.1 → umol/L,
CREAT mg/dL ×88.4 → umol/L, HGB g/dL ×10 → g/L, ALB g/dL ×10 → g/L). Reference ranges by sex where relevant.
Docetaxel nadir pattern for neutrophils around C1D8 is plausible.

### Vitals / ECG / ECOG

- VS: `SYSBP`, `DIABP` (mmHg), `PULSE` (beats/min), `TEMP` (C), `WEIGHT` (kg), `HEIGHT` (cm, screening only).
  CBX-417 raises SBP slightly (~+4 mmHg) to support the hypertension signal.
- EG: `QTCFAG` (QTcF Interval, Aggregate; msec), `EGHRMN` (ECG Mean Heart Rate; beats/min). A handful of
  subjects with QTcF > 480 and increases > 60 ms (more on CBX-417).
- ECOG in **RS** (clinical classification): `RSCAT = "ECOG"`, `RSTESTCD = "ECOG101"`,
  `RSTEST = "ECOG1-Performance Status"`, RSORRES = CT text, RSSTRESC = "0"–"5".

---

## 3. Raw data layer (`data/oncology/raw/`)

Raw files imitate EDC and vendor exports — **not** SDTM. Column names are EDC field names in
UPPER_SNAKE_CASE. Every raw file has a unique `RECORD_ID` (e.g. `AE-000123`) so lineage can point at rows.
EDC dates are text like `07 MAR 2023`; partial dates use `UN`/`UNK` (`UN MAR 2023`, `UN UNK 2022`).
Vendor files (labs, IxRS) use `YYYY-MM-DD`.

| File | Source | Grain | Key columns (minimum) |
|---|---|---|---|
| `enrollment.csv` | EDC | 1 row / screened subject | SITE_ID, SUBJECT_ID, CONSENT_DATE, ELIGIBLE (Y/N), SCREEN_FAIL_REASON |
| `demographics.csv` | EDC | 1 / subject | SITE_ID, SUBJECT_ID, BIRTH_YEAR, AGE, SEX (dirty coding), RACE_WHITE / RACE_ASIAN / RACE_BLACK / RACE_AMIND / RACE_NHPI / RACE_OTHER (checkbox Y/blank), RACE_OTHER_SP, ETHNICITY, COUNTRY |
| `baseline_disease.csv` | EDC | 1 / subject | HISTOLOGY, STAGE, DIAG_DATE (often partial), PDL1_TPS, PRIOR_LINES, PRIOR_IO, BRAIN_METS, SMOKING, ECOG_SCREEN |
| `randomization.csv` | IxRS | 1 / randomized subject | SUBJECT_ID, RAND_NO, RAND_DATE, STRAT_ECOG, STRAT_PRIOR_IO, ARM_ASSIGNED |
| `kit_list.csv` | IxRS | 1 / kit | KIT_NUMBER, KIT_CONTENT (`CBX-417 50 mg tablets` / `Placebo tablets`) |
| `ex_study_drug.csv` | EDC | 1 / dispensing period | SUBJECT_ID, CYCLE, KIT_NUMBER, START_DATE, END_DATE, DOSE_MG, DOSE_CHANGE_REASON |
| `ex_docetaxel.csv` | EDC | 1 / infusion | SUBJECT_ID, CYCLE, INFUSION_DATE, BSA, PLANNED_DOSE_MG_M2, ACTUAL_DOSE_MG, DOSE_CHANGE_REASON |
| `ae.csv` | EDC + coding | 1 / AE line | AE_LINE (per subject), AE_TERM, AE_START, AE_END, AE_ONGOING, AE_GRADE, AE_SERIOUS + criteria, AE_REL_CBX, AE_REL_DOC, AE_ACTION_CBX, AE_ACTION_DOC, AE_OUTCOME, CODED_PT, CODED_SOC |
| `cm.csv` | EDC + coding | 1 / med line | CM_LINE, CM_TERM (verbatim), CM_INDICATION, CM_DOSE, CM_UNIT, CM_ROUTE, CM_FREQ, CM_START, CM_END, CM_ONGOING, CM_CATEGORY (PRIOR CANCER THERAPY / CONCOMITANT / SUBSEQUENT ANTICANCER THERAPY), CODED_NAME, CODED_ATC_CLASS |
| `mh.csv` | EDC + coding | 1 / condition | MH_TERM, MH_START (partial common), MH_ONGOING, CODED_PT, CODED_SOC |
| `labs.csv` | Lab vendor | 1 / result | SUBJECT_ID, VISIT_NAME, COLLECTION_DATE, COLLECTION_TIME, VENDOR_TEST_CODE (vendor codes ≠ CDISC), TEST_NAME, RESULT, UNIT, REF_LOW, REF_HIGH, LAB_SOURCE (CENTRAL/LOCAL), ACCESSION_NO |
| `vitals.csv` | EDC | 1 / visit (**wide**) | VISIT_NAME, VS_DATE, SYSBP, DIABP, PULSE, TEMP, TEMP_UNIT (C/F), WEIGHT, WEIGHT_UNIT (kg/lb), HEIGHT, HEIGHT_UNIT, ECOG |
| `ecg.csv` | EDC | 1 / visit | VISIT_NAME, ECG_DATE, QTCF_MS, HR_BPM, INTERPRETATION |
| `tumor_assessment.csv` | EDC | 1 / assessment | VISIT_NAME, SCAN_DATE, TARGET_SLD_MM, NONTARGET_RESP, NEW_LESION (Y/N), OVERALL_RESP (CR/PR/SD/PD/NE) |
| `eot.csv` | EDC | 1 / subject who stopped | EOT_DATE, LAST_DOSE_DATE, EOT_REASON (free-ish text categories) |
| `eos.csv` | EDC | 1 / subject who left study | EOS_DATE, EOS_REASON |
| `death.csv` | EDC | 1 / death | DEATH_DATE, DEATH_CAUSE (Progressive disease / Adverse event / Other / Unknown) |
| `survival_followup.csv` | EDC | 1 / contact | CONTACT_DATE, STATUS (Alive/Dead/Lost to follow-up), NEW_THERAPY (Y/N), NEW_THERAPY_NAME, NEW_THERAPY_START |
| `deviations.csv` | CTMS | 1 / deviation | DV_ID, CATEGORY, DESCRIPTION, DV_DATE, SEVERITY (Major/Minor) |

### Injected data problems (documented in `data/oncology/answer-key/data_issues.csv`)

Inject each problem a realistic, **documented** number of times (typically 3–15). The answer key lists:
`ISSUE_ID, FILE, RECORD_ID, COLUMN, ISSUE_TYPE, RAW_VALUE, RESOLUTION, CORRECTED_VALUE`.
The SDTM layer uses the corrected values (as if data-management queries were resolved).

1. Exact duplicate rows (AE, labs)
2. Impossible dates (`31 FEB 2023`, year `2203`)
3. Missing units (labs)
4. Inconsistent sex coding (`Male`, `M`, `male`, `1`, `F`, `Female`, `f `, `2`)
5. Unknown/misspelled treatment (kit numbers not in kit list; `PLB` in a free-text field)
6. Lab values in different units by site/source
7. AE start dates before informed consent
8. End date before start date (AE, CM)
9. Randomized subjects without any treatment records (the 4 never-treated are *real*; add ≥1 more that is a data-entry omission resolved by query)
10. Subjects with treatment records but no randomization row (IxRS transfer gap)
11. Duplicate subject identifiers (same SUBJECT_ID at two sites; a transposed-digit ID)
12. Outliers (weight 700 kg = unit error; height 17 cm; ALT 12000 = decimal shift) plus a few *genuine* extreme values that must NOT be "cleaned"
13. Missing baseline assessments (no screening lab for a test; no baseline scan for 2 subjects)
14. Partial dates (AE, MH, CM, diagnosis date)
15. Visit inconsistencies (visit label vs date out of window; C3D1 dated before C2D1)
16. Temperature in °F and weight in lb in some rows (units recorded)
17. Leading/trailing whitespace and case variants in coded text fields

---

## 4. SDTM layer (`data/oncology/sdtm/`)

SDTM-like domains (SDTMIG v3.4 structure, **character dates as ISO 8601**, `--DY` with no day 0,
`--SEQ` unique within USUBJID, sorted by the domain's key variables).

- `USUBJID = STUDYID || "-" || SITEID || "-" || SUBJID` e.g. `CBX417-301-1012-0007` (SUBJID = `1012-0007`).
- `RFSTDTC` = first exposure to study treatment; `RFXSTDTC` = first dose; `RFXENDTC` = last dose;
  `RFENDTC` = end of participation or last contact; `RFICDTC` = informed consent; `RFPENDTC` = end of participation;
  `DTHDTC`/`DTHFL`; `ARM/ARMCD/ACTARM/ACTARMCD/ARMNRS/ACTARMUD` per §1.
- Include `EPOCH` on event/finding records (`SCREENING`, `TREATMENT`, `FOLLOW-UP`).
- Findings domains include `--LOBXFL` (last observation before exposure flag; Expected in v3.4).
  `--BLFL` is Permissible — omit it (and explain why in the dictionary).
- `AESPID` = raw AE_LINE; `CMSPID` = raw CM_LINE; `LBREFID` = accession number.

Domains to produce: **DM, SUPPDM (optional), AE, SUPPAE (QNAM `AERELDOC` relationship to docetaxel,
`AEACNDOC` action taken with docetaxel), CM, MH, EX, LB, VS, EG, DS, DV, RS (OVRLRESP by investigator +
ECOG101), TR (SUMDIAM only — educational simplification: TU and individual lesions omitted), SV
(optional), TS (key trial summary parameters), TA (trial arms)**.

Key controlled terminology (verified):
- DSCAT: `DISPOSITION EVENT`, `PROTOCOL MILESTONE`, `OTHER EVENT`; milestones `INFORMED CONSENT OBTAINED`, `RANDOMIZED`.
- DSDECOD (NCOMPLT): `COMPLETED`, `ADVERSE EVENT`, `DEATH`, `LOST TO FOLLOW-UP`, `PHYSICIAN DECISION`,
  `PROGRESSIVE DISEASE`, `WITHDRAWAL BY SUBJECT`, `SCREEN FAILURE`, `STUDY TERMINATED BY SPONSOR`.
  Use `DSSCAT` to distinguish `STUDY TREATMENT` vs `STUDY PARTICIPATION` (sponsor-defined — label as convention).
- AEACN (ACN): `DOSE NOT CHANGED`, `DOSE REDUCED`, `DRUG INTERRUPTED`, `DRUG WITHDRAWN`, `NOT APPLICABLE`, `UNKNOWN`.
- AEOUT (OUT): `RECOVERED/RESOLVED`, `RECOVERING/RESOLVING`, `NOT RECOVERED/NOT RESOLVED`,
  `RECOVERED/RESOLVED WITH SEQUELAE`, `FATAL`, `UNKNOWN`.
- AESER and seriousness criteria: `Y`/`N` (NY). AETOXGR `1`–`5`. AESEV omitted (CTCAE grade used).
- RS: RSCAT `RECIST 1.1`, RSTESTCD `OVRLRESP` / RSTEST `Overall Response`, RSEVAL `INVESTIGATOR`,
  results `CR`, `PR`, `SD`, `PD`, `NE` (ONCRSR). ECOG: RSCAT `ECOG`, RSTESTCD `ECOG101`.
- TR: TRTESTCD `SUMDIAM` / TRTEST `Sum of Diameter`, TRORRESU `mm`.
- EG: EGTESTCD `QTCFAG`, `EGHRMN`; EGSTRESU `msec`, `beats/min`.
- SEX: `M`, `F`. RACE uses the classic SDTM values (`WHITE`, `ASIAN`, `BLACK OR AFRICAN AMERICAN`,
  `AMERICAN INDIAN OR ALASKA NATIVE`, `NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER`, `MULTIPLE`, `NOT REPORTED`);
  note in the dictionary that race/ethnicity terminology has been evolving in recent CT releases.

---

## 5. ADaM layer (`data/oncology/adam/`)

ADaMIG v1.3 conventions. Dates stored as ISO 8601 text in the CSVs (in SAS they would be numeric
with a DATE9. format — say so in the dictionary). Every derived variable must have its derivation
written in the manifest `derivation` field.

**ADSL** (1 row/randomized **and** screen-failed? → ADSL contains **all randomized subjects** (420);
screen failures excluded — state this rule). Variables at least:
STUDYID, USUBJID, SUBJID, SITEID, REGION1, COUNTRY, AGE, AGEU, AGEGR1 (`<65`, `>=65`), AGEGR1N, SEX, RACE, ETHNIC,
HEIGHTBL, WEIGHTBL, BMIBL, BSABL, ECOGBL, HISTOL, PDL1CAT, PRIORIO, PRLINES, BRAINMET, SMOKSTAT,
STRAT1R (ECOG stratum as randomized), STRAT2R (prior IO stratum as randomized), ARM, ARMCD, ACTARM, ACTARMCD,
TRT01P, TRT01PN, TRT01A, TRT01AN, RANDDT, TRTSDT, TRTEDT, TRTDURD, EOTSTT, DCTREAS, EOSSTT, DCSREAS,
DTHFL, DTHDT, DTHCAUS, LSTALVDT, RANDFL, ITTFL, SAFFL, EFFFL (ITT with measurable disease at baseline and ≥1
post-baseline tumor assessment **or** death before first scheduled assessment), PPROTFL (ITT without major
deviations affecting efficacy), DCUTDT.

**ADAE** (OCCDS): all SDTM AE records for ADSL subjects + ADSL variables needed for analysis (TRTA/TRTAN from
TRT01A/TRT01AN, SAFFL). ASTDT/ASTDTF (imputation for partial start dates per SAP: missing day → 1st of
month unless same month as TRTSDT then TRTSDT; missing month and day → Jan 1 unless same year as TRTSDT then
TRTSDT; never impute after AENDT), AENDT/AENDTF, ASTDY, AENDY, ATOXGR, ATOXGRN, AESER, AREL (related to
CBX-417/placebo), TRTEMFL (`Y` if ASTDT ≥ TRTSDT and ASTDT ≤ TRTEDT + 30 days), AOCCFL, AOCCSFL, AOCCPFL
(first occurrence flags within TRTEMFL = Y, by subject / SOC / PT, chronological), AESEQ.

**ADLB** (BDS): PARAMCD (e.g. `ALT`), PARAM (`Alanine Aminotransferase (U/L)`), PARCAT1 (`CHEMISTRY` /
`HEMATOLOGY`), AVAL (SI), AVALU? (use PARAM for unit), ADT, ADY, AVISIT, AVISITN, ABLFL (last non-missing
value on or before TRTSDT; for never-treated subjects on or before RANDDT), BASE, CHG, PCHG, ANRLO, ANRHI,
ANRIND, BNRIND, ATOXGR/ATOXGRN for ALT, AST, BILI, NEUT, PLAT, HGB (CTCAE v5-style lab grading — label as
simplified), BTOXGR, ONTRTFL, ANL01FL (one record per subject/parameter/AVISIT: the scheduled record, else the
latest unscheduled within window), SRCDOM = "LB", SRCVAR = "LBSTRESN", SRCSEQ = LBSEQ, TRTA/TRTAN, SAFFL.

**ADVS** (BDS) analogous for SYSBP, DIABP, PULSE, TEMP, WEIGHT.

**ADEG** (BDS, optional) QTCFAG with categories (CRIT1: >450, >480, >500; CRIT2: increase >30, >60).

**ADRS** (BDS): PARAMCD `OVRLRESP` (per visit, investigator), `BOR` (best overall response, unconfirmed),
`CBOR` (confirmed best overall response per SAP), AVALC/AVAL (CR=1, PR=2, SD=3, PD=4, NE=5), ADT, AVISIT,
ANL01FL, SRCDOM/SRCSEQ.

**ADTR** (BDS): PARAMCD `SUMDIAM` by visit with BASE, PCHG, and a `BPCHG` parameter (best % change) for waterfall plots.

**ADTTE** (BDS for TTE): PARAMCD `PFS`, `OS`, `DOR` (responders only). STARTDT (RANDDT; for DOR first
response date), ADT, AVAL (days = ADT − STARTDT + 1), CNSR (0 = event; ≥1 = censored), EVNTDESC,
CNSDTDSC, SRCDOM, SRCVAR, SRCSEQ, TRTP/TRTPN (from TRT01P/TRT01PN), ITTFL, STRAT1R, STRAT2R and
subgroup covariates (AGEGR1, SEX, REGION1, ECOGBL, HISTOL, PDL1CAT, BRAINMET, PRIORIO).

PFS censoring rules (SAP; FDA oncology-endpoint guidance style — label as SAP rules, not regulations):

| Situation | Outcome | Date | CNSR |
|---|---|---|---|
| Documented PD or death, whichever first, with ≤1 missed assessment before it | Event | date of PD / death | 0 |
| No PD, no death | Censored | last adequate tumor assessment | 1 |
| No baseline or no post-baseline assessment, and no death within 2 scheduled intervals (12 weeks + window) | Censored | randomization date | 2 |
| New anticancer therapy started before PD | Censored | last adequate assessment on/before new therapy start | 3 |
| PD or death after ≥2 consecutive missed scheduled assessments | Censored | last adequate assessment before the missed assessments | 4 |

OS: event = death (any cause), CNSR 0 at DTHDT; else censored (CNSR 1) at LSTALVDT (last known alive: max of
all visit/assessment/contact dates on or before DCO).

---

## 6. Outputs of the generator

- `data/oncology/raw/*.csv`, `data/oncology/sdtm/*.csv`, `data/oncology/adam/*.csv`
- `data/oncology/answer-key/data_issues.csv` (and README warning learners not to peek)
- `data/oncology/lineage/sdtm_raw_map.csv`: `DOMAIN, USUBJID, SEQ, RAW_FILE, RECORD_ID, NOTE`
  (every SDTM record → the raw row(s) it came from; note unit conversions / query corrections)
- `data/oncology/manifest.json` conforming to `DatasetManifestSchema` in `src/content/schema.ts`
  (dataset ids `oncology/<layer>/<name>`, e.g. `oncology/sdtm/dm`, `oncology/adam/adtte`, `oncology/raw/ae`)
- `data/oncology/README.md`: data dictionary overview, known simplifications, how to regenerate
- `data/oncology/STUDY_FACTS.md`: key computed numbers (subject flow, PFS/OS events, KM medians with 95% CI,
  Cox HR with 95% CI (stratified and unstratified), log-rank p, ORR by arm with Clopper-Pearson CI,
  TEAE overview counts, top TEAEs by PT, grade ≥3 rates, lab shift highlights) **computed from the
  generated files with R `survival` (not assumed)**, including the R code used.
- `data/oncology/cbx417.sqlite` containing all SDTM and ADaM tables (table names lowercase, e.g. `dm`, `adsl`),
  built from the CSVs.
