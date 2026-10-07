# Statistical Analysis Plan — CBX417-301

> **Educational, fictional document.** A statistical analysis plan for the synthetic study
> CBX417-301, written to be realistic and internally consistent for training. No results are
> reported here: the SAP is written and approved before unblinding.

| | |
|---|---|
| Protocol | CBX417-301 v3.0 (Amendment 2) |
| SAP version | 2.0 |
| SAP date | 28 February 2025 (before database lock and unblinding) |
| Prepared by | Biostatistics, Halden Therapeutics (fictional) |
| Data cutoff (DCO) for the primary analysis | 31 March 2025 |

---

## 1. Introduction

### 1.1 Purpose

This plan specifies the analyses supporting the primary analysis of CBX417-301 and the clinical study report. It expands the statistical section of the protocol and, together with the mock table, listing and figure (TLF) shells, defines every output. It is finalized before database lock and release of the treatment codes; any change made afterwards is documented in Section 11 and described in the CSR.

### 1.2 Responsibilities

Biostatistics owns this plan and the shells; statistical programming implements the analyses in SDTM-derived ADaM datasets and produces the TLFs; an independent programmer performs QC of every output.

### 1.3 Software

Analyses are performed with SAS 9.4 or later. Where a second implementation is used for QC (for example R with the `survival` package), the options named in this plan are set explicitly in both, because software defaults differ (for example tie handling in Cox models and the transformation used for Kaplan-Meier confidence limits).

---

## 2. Objectives, endpoints and estimands

### 2.1 Objectives and endpoints

| Type | Objective | Endpoint | ADaM source |
|---|---|---|---|
| Primary | Compare PFS between arms | Time from randomization to documented progression per RECIST 1.1 (investigator) or death from any cause | `ADTTE`, `PARAMCD = "PFS"` |
| Key secondary | Compare OS | Time from randomization to death from any cause | `ADTTE`, `PARAMCD = "OS"` |
| Secondary | Compare confirmed objective response | Confirmed CR or PR per RECIST 1.1 | `ADRS`, `PARAMCD = "CBOR"` |
| Secondary | Describe duration of response | Time from first documented (subsequently confirmed) response to PD or death, in confirmed responders | `ADTTE`, `PARAMCD = "DOR"` |
| Secondary | Characterize safety | TEAEs, laboratory values, vital signs, ECG, exposure | `ADAE`, `ADLB`, `ADVS`, `ADEG`, `ADSL` |
| Exploratory | Explore consistency across subgroups | PFS and OS by prespecified subgroups | `ADTTE` |

### 2.2 Primary estimand (PFS)

| Attribute | Specification |
|---|---|
| Treatment | CBX-417 200 mg QD + docetaxel 75 mg/m² q3w versus placebo QD + docetaxel, including protocol-permitted dose reductions and interruptions |
| Population | Adults with previously treated advanced or metastatic NSCLC meeting the eligibility criteria, represented by the ITT population |
| Variable | Time from randomization to documented progression per RECIST 1.1 (investigator) or death from any cause, whichever occurs first |
| Intercurrent events | (a) Discontinuation of study treatment: **treatment policy** — tumor assessments continue and subsequent progression counts. (b) Start of a new anticancer therapy before progression: **hypothetical** — implemented by censoring at the last adequate assessment on or before the start of the new therapy (Section 9.4). (c) Death before documented progression: **composite** — death is an event |
| Population-level summary | Hazard ratio (CBX-417 + docetaxel versus placebo + docetaxel) from a stratified Cox model, with Kaplan-Meier medians as descriptive summaries |

### 2.3 Key secondary estimand (OS)

Identical to Section 2.2 except that the variable is time from randomization to death from any cause, and **both** intercurrent events (treatment discontinuation and new anticancer therapy) are handled with a **treatment-policy** strategy: survival follow-up continues and all deaths on or before the data cutoff are counted.

---

## 3. Study design and sample size

### 3.1 Design

Randomized, double-blind (CBX-417 versus placebo), placebo-controlled, multicenter, parallel-group study with 1:1 allocation. Docetaxel is open-label in both arms.

### 3.2 Randomization and stratification

Randomization is central, through IxRS, in permuted blocks within strata, stratified by ECOG performance status (0 versus 1) and prior anti-PD-(L)1 therapy (Yes versus No), producing four strata. All stratified analyses use the stratum values **as recorded in IxRS at randomization** (`ADSL.STRAT1R`, `ADSL.STRAT2R`), not the values later recorded on the CRF. The number of subjects whose CRF values differ from the IxRS values (mis-stratification) is reported, and a sensitivity analysis using CRF values is described in Section 9.6.

### 3.3 Blinding

Subjects, investigators, site staff and the sponsor study team are blinded to CBX-417 versus placebo. Interim analyses are prepared by an independent statistical group for the IDMC. The study team remains blinded until database lock.

### 3.4 Sample size

331 PFS events give 90% power to detect a hazard ratio of 0.70 with a two-sided α of 0.05:

d = 4 (1.9600 + 1.2816)² / (ln 0.70)² = 42.03 / 0.12722 = 330.4 → **331 events**

With 420 randomized subjects, an assumed control median PFS of 4.2 months and approximately 20 months of accrual, 331 events are expected about 34 months after the first subject is randomized.

### 3.5 Interim analysis and alpha spending

One interim analysis of PFS is performed after approximately 66% of the planned events (about 219 events), for the IDMC. Type I error is controlled with a Lan-DeMets alpha-spending function of the O'Brien-Fleming type, two-sided α = 0.05. Planned boundaries, assuming the interim occurs at exactly 219 of 331 events (information fraction 0.662):

| Analysis | Events | Information fraction | Cumulative α spent (two-sided) | Boundary (absolute Z) | Nominal two-sided p |
|---|---:|---:|---:|---:|---:|
| Interim | 219 | 0.662 | 0.0160 | 2.410 | ≤ 0.0160 |
| Final | 331 | 1.000 | 0.0500 | 2.013 | ≤ 0.0441 |

Boundaries are recomputed at the analyses using the actual information fractions. The final boundary above corresponds to an observed hazard ratio of approximately 0.80 or lower at 331 events.

---

## 4. Analysis populations

| Population | Flag | Definition | Analyzed by |
|---|---|---|---|
| Randomized / ITT | `RANDFL`, `ITTFL` | All randomized subjects, whether or not they received study treatment | Randomized treatment (`TRT01P`) |
| Safety | `SAFFL` | All randomized subjects who received at least one dose of any study drug (CBX-417/placebo or docetaxel) | Treatment actually received (`TRT01A`) |
| Efficacy-evaluable | `EFFFL` | ITT subjects with measurable disease at baseline and at least one post-baseline tumor assessment, or death before the first scheduled post-baseline assessment | Randomized treatment |
| Per-protocol | `PPROTFL` | ITT subjects without a major protocol deviation affecting efficacy (Section 6.2) | Randomized treatment |

Actual treatment is assigned as follows: a subject who received at least one CBX-417 kit is analyzed as CBX-417 + docetaxel; a subject randomized to CBX-417 who received only placebo kits is analyzed as placebo + docetaxel; subjects who received no study drug have `TRT01A` missing and `SAFFL = "N"`.

Efficacy analyses use the ITT population unless stated otherwise. Safety analyses use the safety population. Per-protocol and efficacy-evaluable analyses are supportive.

---

## 5. General considerations

### 5.1 Reporting conventions

| Statistic | Decimals |
|---|---|
| n (counts) | Integer |
| Percentages | 1 decimal; percentages are not shown when the count is 0 |
| Minimum, maximum | Precision of the collected data |
| Mean, median | Precision of the collected data + 1 |
| Standard deviation | Precision of the collected data + 2 |
| Kaplan-Meier estimates of time (months) | 1 decimal (95% CI, 1 decimal) |
| Hazard ratios, odds ratios and their CIs | 2 decimals |
| Response rates and differences (percent) | 1 decimal |
| p-values | 4 decimals; values below 0.0001 are shown as "<0.0001" |

Percentages use the population count of the corresponding treatment column as denominator unless the shell states otherwise. Treatment columns are ordered CBX-417 + docetaxel, then placebo + docetaxel.

### 5.2 Study day and time conversions

Study day for safety and BDS analyses is `ADY = ADT − TRTSDT + 1` when `ADT ≥ TRTSDT`, and `ADY = ADT − TRTSDT` otherwise (there is no day 0). Time-to-event values are `AVAL = ADT − STARTDT + 1` in days, converted for reporting with months = days / 30.4375.

### 5.3 Baseline definition

Baseline is the **last non-missing assessment on or before the date (and, where collected, the time) of the first dose of study drug**; for randomized subjects who were never treated, the last non-missing assessment on or before randomization. The baseline record is flagged `ABLFL = "Y"` in the BDS datasets. Exceptions:

- **ECG**: the C1D1 assessment is performed post-dose, so the baseline ECG is the last assessment strictly before the first dose (in practice the screening ECG).
- **Tumor assessment**: baseline is the last assessment on or before randomization (within 28 days before randomization per protocol).
- **ECOG**: baseline is the last assessment on or before the first dose; for never-treated subjects, on or before randomization.

Only one record per subject and parameter is flagged as baseline; ties are broken by the later collection time, then by the higher `--SEQ`.

### 5.4 Analysis visit windows

Scheduled records keep their nominal visit as the analysis visit. Unscheduled records are assigned to the analysis visit whose window contains their study day:

| Analysis visit (`AVISIT`) | Target study day | Window (study days) |
|---|---:|---|
| Baseline | ≤ 1 | Last non-missing on or before first dose |
| Cycle 1 Day 8 | 8 | 2–14 |
| Cycle 2 Day 1 | 22 | 15–32 |
| Cycle 3 Day 1 | 43 | 33–53 |
| Cycle n Day 1 (n ≥ 4) | 21(n−1) + 1 | target − 10 to target + 10 |
| End of treatment | — | Records collected at the EOT visit |
| Safety follow-up | — | Records collected at the safety follow-up visit |

Within an analysis visit, `ANL01FL = "Y"` identifies the record used in by-visit summaries: the scheduled record if one exists, otherwise the latest unscheduled record within the window. Records outside all windows keep `AVISIT` blank and `ANL01FL` null; they are still used in "worst post-baseline" summaries when `ONTRTFL = "Y"`.

### 5.5 Handling of missing data

- **Efficacy**: no imputation of missing tumor assessments or missing survival status. Missing information is handled by the censoring rules in Section 9.4 (PFS, DoR) and Section 9.8 (OS).
- **Safety**: partial or missing AE start and end dates are imputed as in Section 10.1.2; laboratory and vital-sign values are not imputed.
- **Baseline**: subjects without a baseline value are excluded from change-from-baseline summaries for that parameter but remain in the population and in all other summaries.
- **Partial dates elsewhere**: partial concomitant medication start dates are imputed to the first day of the month (first day of the year when month and day are missing) for the purpose of classifying prior versus concomitant use; no other date imputation is performed.

### 5.6 Multi-center design

Data are pooled across centers; no center effect is included in the models. Country and region are summarized descriptively and region is a subgroup factor.

---

## 6. Disposition and protocol deviations

### 6.1 Disposition

The number of subjects screened, who failed screening (with reasons), randomized, treated, who discontinued study treatment (with primary reason), who discontinued the study (with primary reason), who died, and who were ongoing at the data cutoff, by treatment arm and total. Screening counts come from SDTM (`DM`, `DS`); all other counts come from `ADSL`.

### 6.2 Protocol deviations

Deviations are summarized by category and severity for the ITT population. **Major deviations affecting efficacy**, which exclude subjects from the per-protocol population, are: violation of a key eligibility criterion affecting the primary endpoint; receipt of the wrong randomized treatment for more than one cycle; use of a prohibited anticancer therapy during study treatment; and absence of a baseline tumor assessment. Classification is finalized at the blinded data review meeting before database lock.

---

## 7. Demographics and baseline characteristics

Summarized for the ITT population by randomized treatment and total: age (continuous and `<65` / `≥65`), sex, race, ethnicity, region, country, ECOG performance status, histology, disease stage, time since diagnosis, PD-L1 category (`<1%`, `1–49%`, `≥50%`, not done), prior lines of therapy, prior anti-PD-(L)1 therapy, brain metastases, smoking status, baseline sum of diameters, weight, height, BMI and BSA. Continuous variables: n, mean, SD, median, minimum, maximum. Categorical variables: n (%).

No statistical tests comparing baseline characteristics between randomized arms are performed.

The stratification factors are summarized **as randomized (IxRS)** and **as recorded on the CRF**, with the number of discordant subjects.

---

## 8. Exposure and concomitant medications

For the safety population by actual treatment: duration of treatment (`TRTDURD = TRTEDT − TRTSDT + 1` days), number of cycles started, cumulative dose, dose intensity (cumulative actual dose divided by cumulative planned dose, as a percentage), subjects with any dose reduction, interruption or discontinuation of each study drug, and reasons.

Concomitant medications are summarized by drug class and preferred name for the safety population; prior and subsequent anticancer therapies are summarized separately, and the number of subjects starting a subsequent anticancer therapy before documented progression is reported (these subjects are censored in the primary PFS analysis, Section 9.4).

---

## 9. Efficacy analyses

### 9.1 Primary endpoint definition

PFS is the time from randomization to the first documented progression per RECIST 1.1 as assessed by the investigator, or death from any cause, whichever occurs first. The date of progression is the date of the tumor assessment (scheduled or unscheduled) at which progression is first documented. Assessments and deaths after the data cutoff are not used.

An **adequate tumor assessment** is one with an overall response of CR, PR, SD or PD. A scheduled assessment is **missed** when its entire ±7-day window passes without an adequate assessment.

### 9.2 Primary analysis

The null hypothesis of no difference in PFS between arms is tested with a **log-rank test stratified by ECOG performance status (0 versus 1) and prior anti-PD-(L)1 therapy (Yes versus No), as recorded in IxRS**, two-sided, in the ITT population, at the significance level given by the alpha-spending boundary in Section 3.5.

### 9.3 Estimation of the hazard ratio

The hazard ratio (CBX-417 + docetaxel versus placebo + docetaxel) and its 95% confidence interval are estimated from a **Cox proportional hazards model with treatment as the only covariate, stratified by the same two factors**. **Ties are handled with the Efron method** (`TIES=EFRON` in `PROC PHREG`; note that the SAS default is Breslow and the R `coxph()` default is Efron). Confidence limits are Wald limits from the model. A hazard ratio below 1 favors CBX-417 + docetaxel.

The proportional-hazards assumption is examined descriptively by inspecting log(−log S(t)) plots by arm and the trend in scaled Schoenfeld residuals over time. No formal test drives the primary conclusion; if the assumption appears clearly violated, the restricted mean survival time difference at the minimum of the largest observed times in each arm is reported as a supplementary summary.

### 9.4 PFS censoring rules

| Situation | Outcome | Date used | `CNSR` |
|---|---|---|---|
| Documented progression or death, whichever first, with at most 1 missed scheduled assessment immediately before it | Event | Date of progression or death | 0 |
| No progression and no death on or before the data cutoff | Censored | Date of the last adequate tumor assessment | 1 |
| No baseline assessment, or no post-baseline assessment, and no death within two scheduled assessment intervals plus the window (91 days) of randomization | Censored | Date of randomization | 2 |
| New anticancer therapy started before documented progression or death | Censored | Date of the last adequate tumor assessment on or before the start of the new therapy (randomization date if none) | 3 |
| Progression or death occurring after two or more consecutive missed scheduled assessments | Censored | Date of the last adequate tumor assessment before the missed assessments (randomization date if none) | 4 |

The rules are applied in the order shown: first the "no baseline or no post-baseline assessment" rule, then new anticancer therapy, then missed assessments, then event, and finally the no-event rule. Operationally, two or more missed scheduled assessments correspond to more than 91 days between the last adequate assessment (or randomization) and the event while assessments are 6-weekly, and more than 133 days once assessments are 9-weekly; the definitive criterion is the number of scheduled assessment windows that passed without an adequate assessment.

`ADTTE` records the event or censoring reason in `EVNTDESC` and the origin of the censoring date in `CNSDTDSC`.

### 9.5 Kaplan-Meier summaries

Kaplan-Meier estimates are computed **by treatment arm, unstratified**: the number of events and censored subjects, the median with a 95% confidence interval, the 25th and 75th percentiles, and the event-free rates at 3, 6, 9, 12 and 18 months with 95% confidence intervals. Confidence intervals for quantiles use the **Brookmeyer-Crowley method with a log-log transformation** (`CONFTYPE=LOGLOG` in `PROC LIFETEST`, which is the SAS default; in R, `conf.type = "log-log"` must be set because the default is "log"). Event-free rates use Greenwood standard errors with a log-log transformation.

Kaplan-Meier curves by arm are plotted with censoring marks and a number-at-risk table at each summary time point.

### 9.6 Sensitivity and supplementary analyses of PFS

| # | Analysis | Purpose | Estimand |
|---|---|---|---|
| S1 | Events after two or more missed assessments counted as events at the documented date (no CNSR = 4 censoring) | Tests the missed-assessment assumption | Same |
| S2 | Unstratified log-rank test and unstratified Cox model | Tests dependence on the stratification | Same |
| S3 | Stratified analysis using stratification values as recorded on the CRF | Tests the effect of mis-stratification | Same |
| S4 | Analysis in the per-protocol population | Tests the effect of major deviations | Same, different population |
| S5 | Progression and death after the start of a new anticancer therapy counted as events (no CNSR = 3 censoring) | Treatment-policy handling of new therapy | **Different** (supplementary) |
| S6 | Cox model adjusted for baseline covariates (age group, sex, region, histology, PD-L1 category, brain metastases) in addition to the strata | Explores covariate influence | Same |

S1–S4 and S6 are sensitivity analyses of the primary estimand; S5 targets a different estimand and is reported as supplementary.

### 9.7 Subgroup analyses

The hazard ratio and its 95% CI are estimated in each of the following subgroups with an unstratified Cox model (stratified within the subgroup where the subgroup variable is itself a stratification factor, and unstratified when a stratum would be empty), and displayed as a forest plot with the overall result: age group (`<65`, `≥65`), sex, region, ECOG (0, 1), histology (non-squamous, squamous), PD-L1 category, brain metastases (yes, no), prior anti-PD-(L)1 therapy (yes, no), and number of prior lines (1, 2). Subgroups with fewer than 20 events in total are displayed without a confidence interval. Subgroup analyses are exploratory; no multiplicity adjustment is applied and no claims are based on them. An interaction test is presented descriptively.

### 9.8 Overall survival

OS is the time from randomization to death from any cause. Subjects not known to have died are censored at the last date known to be alive (`LSTALVDT`, the latest of all visit, assessment and survival-contact dates on or before the data cutoff), `CNSR = 1`. Deaths after the data cutoff are not counted. The analysis follows Sections 9.2, 9.3 and 9.5 (stratified log-rank test, stratified Cox model with Efron ties, Kaplan-Meier summaries), and is formally tested only if the PFS null hypothesis is rejected (Section 9.11). Subsequent anticancer therapy is summarized by arm to support interpretation.

### 9.9 Objective response rate

Confirmed ORR is the proportion of subjects with a confirmed complete or partial response (`ADRS`, `PARAMCD = "CBOR"`, `AVALC` in {CR, PR}) among all subjects of the analysis population, including subjects without a post-baseline assessment (counted as non-responders).

- Best overall response is derived from the visit-level investigator responses from randomization until the first documented progression, the start of a new anticancer therapy, or the data cutoff, whichever is earliest.
- A CR or PR is **confirmed** when a subsequent assessment at least 28 days later shows the same or a better response, with no progression in between.
- Stable disease requires an assessment of SD or better at least 35 days after randomization; otherwise the best overall response is NE unless progression is documented.
- ORR is presented per arm with a two-sided 95% **Clopper-Pearson exact** confidence interval.
- The difference in ORR between arms is estimated with the **Mantel-Haenszel common risk difference stratified by the randomization factors**, with a 95% confidence interval (Sato variance estimator), and the stratified Cochran-Mantel-Haenszel test p-value is reported descriptively.
- Best overall response categories (CR, PR, SD, PD, NE) and the disease control rate (CR + PR + SD) are summarized per arm.
- A supportive analysis repeats ORR in the efficacy-evaluable population.

### 9.10 Duration of response

DoR is analyzed in subjects with a confirmed response. It runs from the date of the first documented response that was subsequently confirmed to the date of progression or death, censored per the rules of Section 9.4 applied from the response date. Kaplan-Meier medians with 95% confidence intervals are presented per arm, and the proportion of responders remaining in response at 6 and 12 months. DoR is conditional on response, a post-randomization outcome; it is therefore presented descriptively and no formal between-arm test is performed.

### 9.11 Multiplicity

The family-wise type I error rate is controlled at a two-sided 0.05 across the primary and key secondary endpoints with a **fixed-sequence (hierarchical) procedure**:

1. **PFS** is tested first, at the alpha-spending boundary of Section 3.5.
2. **OS** is tested only if the PFS null hypothesis is rejected, at two-sided α = 0.05 at this data cutoff.

If PFS is not significant, the OS p-value is reported as nominal and no confirmatory claim is made. All other endpoints are descriptive, with nominal p-values where presented.

---

## 10. Safety analyses

All safety analyses use the safety population by actual treatment; no formal hypothesis tests are performed.

### 10.1 Adverse events

#### 10.1.1 Treatment-emergent adverse events

A TEAE is an adverse event with an analysis start date on or after the date of the first dose of any study drug and no later than **30 days after the last dose** (`TRTSDT ≤ ASTDT ≤ TRTEDT + 30`), flagged `TRTEMFL = "Y"` in `ADAE`. For subjects still on treatment at the data cutoff, `TRTEDT` is the last dose date recorded on or before the data cutoff.

#### 10.1.2 Imputation of partial adverse event dates

| Situation | Rule | `ASTDTF` |
|---|---|---|
| Start date complete | No imputation | (blank) |
| Start day missing | Impute the first day of the month, **unless** the month and year are those of `TRTSDT`, in which case impute `TRTSDT` | `D` |
| Start month and day missing | Impute 1 January, **unless** the year is that of `TRTSDT`, in which case impute `TRTSDT` | `M` |
| Any imputed start date later than a complete AE end date | Set the imputed start date to the end date | as above |
| Start date completely missing | Not imputed; the event is treated as treatment-emergent unless the end date is before `TRTSDT` | (blank) |

End dates: a missing day is imputed to the last day of the month, and a missing month and day to 31 December; an imputed end date later than the death date or the data cutoff is set to that date (`AENDTF` records the imputation level). Imputed dates are used for analysis only; SDTM retains the collected partial dates.

#### 10.1.3 Adverse event summaries

- **Overview**: subjects with any TEAE, any treatment-related TEAE (related to CBX-417/placebo), any grade ≥ 3 TEAE, any serious TEAE, any TEAE leading to dose reduction, interruption or discontinuation of each study drug, and any TEAE with outcome of death.
- **By system organ class and preferred term**: subjects with at least one TEAE, counted once per SOC and once per preferred term, sorted by descending frequency of the preferred term in the CBX-417 arm.
- **By maximum CTCAE grade**, **grade ≥ 3**, **serious**, **related**, and **leading to discontinuation**: same structure.
- A subject with several occurrences of the same preferred term is counted once, at the worst grade.
- Non-treatment-emergent adverse events and all serious adverse events regardless of treatment emergence are listed.

MedDRA version is recorded in a footnote of every AE output.

### 10.2 Deaths

Deaths are summarized by arm: total deaths, deaths within 30 days of the last dose, and primary cause of death. All deaths are listed with dates, cause and the related adverse event where applicable.

### 10.3 Laboratory data

#### 10.3.1 Grading and reference ranges

Laboratory values are reported in SI units. Reference ranges from the central laboratory determine `ANRIND` (low, normal, high). For ALT, AST, total bilirubin, neutrophils, platelets and hemoglobin, CTCAE v5.0-style grades are derived (`ATOXGR`), using the criteria for subjects with a normal baseline value — a documented simplification of CTCAE, which also defines criteria relative to an abnormal baseline.

#### 10.3.2 Shift tables

For each graded parameter, a shift table cross-tabulates the **baseline grade** against the **worst post-baseline grade** among on-treatment records (`ONTRTFL = "Y"`: `TRTSDT < ADT ≤ TRTEDT + 30`), including unscheduled records. Subjects without a baseline or without a post-baseline value are shown in separate "missing" categories. A second shift table uses the reference-range indicator (low / normal / high) instead of grade.

#### 10.3.3 Values and change from baseline

For each parameter and analysis visit (Section 5.4), records with `ANL01FL = "Y"` are summarized: n, mean, SD, median, minimum and maximum of the value and of the change from baseline (`CHG = AVAL − BASE`).

#### 10.3.4 Liver safety

Subjects meeting any of the following are listed with all their liver-related values: ALT or AST > 3 × ULN; total bilirubin > 2 × ULN; ALP ≥ 2 × ULN; and the combination ALT or AST > 3 × ULN **with** total bilirubin > 2 × ULN (potential Hy's law), for which a plot of peak ALT versus peak total bilirubin (both in multiples of ULN, log scales, reference lines at 3 × and 2 × ULN) is produced by arm. Identification of potential Hy's law cases is a screen for medical review, not a diagnosis.

### 10.4 Vital signs

Values and changes from baseline are summarized by analysis visit for systolic and diastolic blood pressure, pulse rate, temperature and weight. Subjects meeting predefined criteria of potential clinical importance (for example systolic blood pressure ≥ 160 mmHg with an increase of ≥ 20 mmHg from baseline) are summarized and listed.

### 10.5 ECG

QTcF values and changes from baseline are summarized by visit. Categorical summaries report subjects with any post-baseline QTcF > 450, > 480 and > 500 ms, and with increases from baseline > 30 and > 60 ms. The baseline ECG is the last pre-dose assessment (Section 5.3).

---

## 11. Changes from the protocol-planned analyses

| Change | Rationale |
|---|---|
| The tie-handling method (Efron) and the confidence-interval transformation for Kaplan-Meier quantiles (log-log) are stated explicitly; the protocol did not specify them | Ensures identical results across software and independent QC |
| Analysis visit windows and the rule for selecting one record per subject, parameter and visit (`ANL01FL`) are specified | Required for reproducible by-visit summaries |
| The supplementary treatment-policy analysis of PFS (S5) is added | Provides the alternative intercurrent-event strategy alongside the primary hypothetical strategy |

Any further change made after unblinding will be identified here and in the CSR as a post hoc analysis.

---

## Appendix A — List of planned tables, listings and figures (extract)

| Number | Title | Population | Shell id |
|---|---|---|---|
| 14.1.1 | Subject disposition | All screened / randomized | `t-disp` |
| 14.1.2 | Demographic and baseline characteristics | ITT | `t-demog` |
| 14.2.1.1 | Summary of progression-free survival | ITT | `t-pfs` |
| 14.2.1.2 | Kaplan-Meier plot of progression-free survival | ITT | `f-km-pfs` |
| 14.2.1.3 | Forest plot of progression-free survival by subgroup | ITT | `f-forest-pfs` |
| 14.2.3.1 | Confirmed objective response | ITT | `t-orr` |
| 14.3.1.1 | Overview of treatment-emergent adverse events | Safety | `t-ae-overview` |
| 14.3.1.2 | TEAEs by system organ class and preferred term | Safety | `t-ae-soc-pt` |
| 14.3.1.3 | Grade ≥ 3 TEAEs by system organ class and preferred term | Safety | `t-ae-grade3` |
| 14.3.1.4 | Serious TEAEs by system organ class and preferred term | Safety | `t-sae` |
| 14.3.4.1 | Shift from baseline to worst post-baseline CTCAE grade (selected laboratory tests) | Safety | `t-lab-shift` |
| 14.3.4.2 | Laboratory values and change from baseline by visit | Safety | `t-lab-chg` |
| 16.2.7.2 | Listing of serious adverse events | Safety | `l-sae` |

Additional outputs (overall survival, duration of response, exposure, concomitant medications, protocol deviations, vital signs, ECG and further listings) are specified in the full TLF list.
