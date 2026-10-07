# Analysis Data Reviewer's Guide — CBX417-301 (excerpt)

> **Educational, fictional document.** An excerpt of an Analysis Data Reviewer's Guide for the
> synthetic study CBX417-301, written in the spirit of the community ADRG templates (the wording is
> original). It describes the analysis datasets shipped with this training app, which are synthetic
> and not a regulatory submission.

| | |
|---|---|
| Study | CBX417-301 |
| Analysis datasets | ADSL, ADAE, ADLB, ADVS, ADEG, ADRS, ADTR, ADTTE |
| Standards | ADaMIG v1.3 conventions; source SDTM datasets follow SDTM v2.0 / SDTMIG v3.4 conventions |
| Controlled terminology | CDISC SDTM CT package dated 2026-03-27 (as shipped with this app) |
| Dictionaries | Adverse events and medical history: preferred terms and system organ classes in a MedDRA-like structure, **without dictionary codes** (the dictionary is licensed). Medications: standardized names and drug classes, without WHODrug codes |
| Data cutoff | 31 March 2025 |
| Analysis software | SAS 9.4 and R 4.x (`survival`) for independent verification |

## 1. Purpose

This guide helps a reviewer use the CBX417-301 analysis datasets: what each dataset contains, which conventions apply across datasets, how the non-obvious variables were derived, what the datasets depend on, and how to trace a result back to collected data. It complements — and does not repeat — the machine-readable metadata in define.xml.

## 2. Study in brief

CBX417-301 is a randomized, double-blind, placebo-controlled study of CBX-417 plus docetaxel versus placebo plus docetaxel in adults with previously treated advanced or metastatic non-small cell lung cancer. 420 subjects were randomized 1:1, stratified by ECOG performance status (0 versus 1) and prior anti-PD-(L)1 therapy (Yes versus No) through an interactive response system. The primary endpoint is investigator-assessed progression-free survival per RECIST 1.1; the key secondary endpoint is overall survival.

## 3. Analysis datasets overview

| Dataset | Structure | Purpose | Key analysis variables |
|---|---|---|---|
| `ADSL` | One record per randomized subject | Subject-level analysis attributes and populations | `ITTFL`, `SAFFL`, `EFFFL`, `PPROTFL`, `TRT01P`, `TRT01A`, `STRAT1R`, `STRAT2R`, `RANDDT`, `TRTSDT`, `TRTEDT`, `LSTALVDT`, `DCUTDT` |
| `ADAE` | One record per adverse event | Safety summaries of treatment-emergent adverse events | `TRTEMFL`, `ASTDT`/`ASTDTF`, `ATOXGRN`, `AOCCFL`, `AOCCSFL`, `AOCCPFL`, `TRTA` |
| `ADLB` | One record per subject, parameter and collection date | Laboratory values, changes and shifts | `PARAMCD`, `AVAL`, `BASE`, `CHG`, `ANRIND`, `BNRIND`, `ATOXGR`, `BTOXGR`, `ABLFL`, `ANL01FL`, `ONTRTFL` |
| `ADVS`, `ADEG` | As `ADLB` | Vital signs and ECG | Analogous |
| `ADRS` | One record per subject, parameter and assessment | Visit-level response, best overall response (`BOR`) and confirmed best overall response (`CBOR`) | `PARAMCD`, `AVALC`, `AVAL`, `ADT`, `ANL01FL` |
| `ADTR` | One record per subject, parameter and assessment | Sum of diameters and percentage change, including best percentage change for waterfall plots | `PARAMCD` (`SUMDIAM`, `BPCHG`), `AVAL`, `BASE`, `PCHG` |
| `ADTTE` | One record per subject and parameter | Time-to-event analyses | `PARAMCD` (`PFS`, `OS`, `DOR`), `STARTDT`, `ADT`, `AVAL`, `CNSR`, `EVNTDESC`, `CNSDTDSC` |

`ADSL` contains only randomized subjects (420). Screen failures are not represented in any analysis dataset; the disposition table derives screening counts from SDTM `DM` and `DS`.

## 4. Conventions that apply across datasets

1. **Treatment variables.** Efficacy analyses use planned treatment (`TRT01P` in `ADSL`, `TRTP` in BDS datasets); safety analyses use actual treatment (`TRT01A`, `TRTA`). They differ for three subjects affected by dispensing errors: two subjects randomized to placebo received at least one CBX-417 kit, and one subject randomized to CBX-417 received only placebo kits. These subjects are therefore in different columns in efficacy and safety tables — intended behavior, not an inconsistency.
2. **Population flags.** Subject-level flags are `Y`/`N` and never null; record-level flags (`ABLFL`, `ANL01FL`, `TRTEMFL`, `ONTRTFL`, occurrence flags) are `Y` or null.
3. **Dates.** Dates are numeric in the SAS datasets. Imputation is performed only in ADaM, never in SDTM, and is always flagged (`ASTDTF`, `AENDTF`).
4. **Study day.** `ADY = ADT − TRTSDT + 1` when `ADT ≥ TRTSDT`, otherwise `ADT − TRTSDT`. There is no day 0.
5. **Time units.** `ADTTE.AVAL` is in days; tables convert to months with the constant 30.4375.
6. **Data cutoff.** Assessments, deaths and adverse events after 31 March 2025 are excluded from analysis; `ADSL.DCUTDT` carries the cutoff for reference.

## 5. Derivations that need explanation

### 5.1 Stratification factors as randomized

`STRAT1R` and `STRAT2R` hold the stratum values entered in the IxRS at randomization, not values derived from the CRF. A small number of subjects have a baseline ECOG on the CRF that differs from the IxRS stratum (mis-stratification). All stratified analyses use the IxRS values, matching how randomization was performed; a sensitivity analysis using CRF values is reported separately. Reviewers comparing `STRAT1R` with `ECOGBL` will therefore find discordant subjects by design.

### 5.2 Actual treatment

`TRT01A` is derived from dispensing records joined to the IxRS kit list: any subject who received at least one CBX-417 kit is analyzed as CBX-417 + docetaxel. This conservative rule attributes potential drug-related harm to the active arm. Subjects who received no study drug have `TRT01A` null and `SAFFL = "N"`.

### 5.3 Treatment-emergent adverse events and partial dates

`TRTEMFL = "Y"` when the analysis start date falls between the first dose and 30 days after the last dose. Partial adverse event start dates are imputed with the rules in the SAP: a missing day becomes the first of the month unless the month matches the first-dose month (then the first-dose date); a missing month and day become 1 January unless the year matches the first-dose year (then the first-dose date); an imputed start date is never later than a complete end date. `ASTDTF` shows which component was imputed, so a reviewer can identify every affected record. For subjects still on treatment at the data cutoff, `TRTEDT` is the last dose date on or before the cutoff, which keeps the treatment-emergent window well defined.

### 5.4 Baseline definitions

Baseline is the last non-missing assessment on or before the first dose (on or before randomization for never-treated subjects), flagged `ABLFL = "Y"`. Two exceptions are worth noting: the ECG baseline is the last **pre-dose** assessment, because the Cycle 1 Day 1 ECG is taken after dosing and shares its date with the first dose; and the tumor-assessment baseline is the last assessment on or before randomization.

### 5.5 Analysis visits and `ANL01FL`

Scheduled records keep their nominal visit. Unscheduled records are assigned to the analysis visit whose window contains their study day (windows in the SAP). Within each subject, parameter and analysis visit, `ANL01FL = "Y"` marks the record used in by-visit summaries: the scheduled record when one exists, otherwise the latest unscheduled record in the window. Records outside all windows keep `AVISIT` null; they still contribute to worst post-baseline summaries when `ONTRTFL = "Y"`.

### 5.6 PFS censoring

`ADTTE` implements the SAP censoring rules in a fixed order: no baseline or post-baseline assessment (`CNSR = 2`), new anticancer therapy before progression (`CNSR = 3`), event after two or more consecutive missed scheduled assessments (`CNSR = 4`), event (`CNSR = 0`), otherwise censored at the last adequate assessment (`CNSR = 1`). `EVNTDESC` and `CNSDTDSC` describe the event or the origin of the censoring date on every record, so each subject's classification can be checked without rerunning the derivation. Censoring at new anticancer therapy implements the hypothetical strategy of the primary estimand; a supplementary analysis that counts those events is reported alongside the primary result.

### 5.7 Response derivations

`ADRS` carries the investigator's visit-level overall response (`OVRLRESP`), unconfirmed best overall response (`BOR`) and confirmed best overall response (`CBOR`). Confirmation requires a subsequent assessment at least 28 days later showing the same or a better response, without intervening progression; an unconfirmed partial response becomes stable disease when the stable-disease criterion is met. Assessments after the first progression, after a new anticancer therapy or after the data cutoff are excluded from the derivation.

## 6. Data dependencies

| Dataset | Depends on |
|---|---|
| `ADSL` | SDTM `DM`, `SUPPDM`, `DS`, `EX`, `VS`, `RS`, `TR`, IxRS-derived variables |
| `ADAE` | SDTM `AE`, `SUPPAE`; `ADSL` (treatment dates, treatment, population flags) |
| `ADLB` | SDTM `LB`; `ADSL` |
| `ADRS`, `ADTR` | SDTM `RS`, `TR`; `ADSL` |
| `ADTTE` | `ADRS` (progression dates), `ADSL` (randomization, death, last known alive), SDTM `CM` (subsequent anticancer therapy start dates) |

`ADTTE` must therefore be produced after `ADRS` and `ADSL`. Reproducing a PFS analysis requires `ADTTE` and `ADSL` only; reproducing the censoring decisions requires `ADRS` and the subsequent-therapy records as well.

## 7. Traceability

Every BDS record carries `SRCDOM`, `SRCVAR` and `SRCSEQ` identifying the SDTM record that produced `AVAL`. Subject-level derived dates in `ADSL` are documented in define.xml with their source domains. A number in a table can therefore be followed: table cell → analysis records selected by the population and analysis flags → `SRCSEQ` → SDTM record → annotated CRF field or vendor transfer. The lineage file shipped with the synthetic data maps each SDTM record back to its raw row, which extends the chain one step further than a real submission normally does.

## 8. Conformance

The analysis datasets were checked with the conformance rules available in this environment. Known, intentional findings:

| Finding | Explanation |
|---|---|
| Dictionary code variables are absent for coded terms | MedDRA and WHODrug are licensed; the synthetic data use realistic term text without codes |
| `TR` contains only `SUMDIAM`; `TU` is absent | Educational simplification of the tumor data model, documented in the SDTM specification and the cSDRG |
| Several baseline disease characteristics are in `SUPPDM` | Educational simplification; a production implementation would use `MH`, `SU`, `CM` and a findings domain |
| `ADLB` includes local laboratory results | Retained for completeness; by-visit summaries use central laboratory records only, as specified in the SAP |

## 9. Programs

The programs that create the analysis datasets and the primary and secondary efficacy outputs are provided as text files. Each program header records its purpose, inputs, outputs, the data cutoff and the version of the specification implemented. Programs run in the order `ADSL` → `ADAE`/`ADLB`/`ADVS`/`ADEG`/`ADRS`/`ADTR` → `ADTTE` → outputs.
