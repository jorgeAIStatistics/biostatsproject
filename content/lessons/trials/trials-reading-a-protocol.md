## What problem are we trying to solve?

You have just been assigned to CBX417-301. Before you write a line of code, your lead asks you to "read the protocol and tell me what you think the data will look like." The protocol is well over a hundred pages; the synopsis alone is several dense pages. Where do you start, and what are you reading *for*?

A biometrics professional does not read a protocol the way a clinician does. You read it to answer questions like:

- Which variables must be collected for the primary endpoint to be computable?
- When does each clock start — randomization, first dose, or informed consent?
- Which visits produce which data, and which record will count as baseline?
- Which design features (stratification, blinding, dose modification) must reappear in datasets and models?

Every sentence of the synopsis has a data consequence. Missing one early is expensive: a field that was never collected cannot be derived at database lock.

## Intuition

Read the protocol as a **specification written in clinical language**. Your job is to translate it into data language:

| The protocol says… | You hear… |
|---|---|
| "Primary endpoint: PFS per investigator, RECIST 1.1" | Tumor-response records per visit, a PD date, death dates, censoring rules, an `ADTTE` parameter |
| "Stratified by ECOG PS (0 vs 1) and prior anti-PD-(L)1 therapy" | Two stratification variables from IxRS that must appear in `ADSL` and in the model |
| "Tumor assessments every 6 weeks from randomization" | A calendar schedule independent of dosing; windows of ±7 days; a rule for missed scans |
| "AEs recorded until 30 days after last dose" | A treatment-emergent window of last dose + 30 days |
| "ECG at C1D1 post-dose" | The C1D1 ECG cannot be baseline even though it is on the first-dose date |

The synopsis is where you start; the body of the protocol (schedule of assessments, statistical section, dose modification rules) is where you confirm details.

::doc{id="protocol-synopsis" label="Open the CBX417-301 protocol synopsis"}

## Clinical context

CBX417-301 tests whether adding a fictional oral targeted agent, CBX-417, to docetaxel delays progression in adults with previously treated advanced or metastatic non-small cell lung cancer (NSCLC). Docetaxel is a common later-line chemotherapy in this setting, so the control arm receives placebo plus docetaxel: patients in both arms get an active standard therapy, and the question is what CBX-417 adds.

Three design facts shape almost everything you will program:

1. **Randomized 1:1, double-blind for CBX-417 vs placebo, open-label docetaxel.** Treatment assignment lives in IxRS, not in the EDC; the blind must be protected until database lock.
2. **Event-driven.** The final PFS analysis happens when 331 PFS events have been observed; the data cutoff (DCO) for this study is 2025-03-31. Anything after the DCO is excluded.
3. **Oncology conventions.** Tumor response follows RECIST 1.1, AEs are graded with NCI CTCAE v5.0, and dosing can be reduced or interrupted, so "planned" and "actual" exposure differ.

## Formal concept

### The anatomy of a synopsis

| Section | What to extract | Data/analysis implication |
|---|---|---|
| **Objectives** | Primary, key secondary, other secondary, exploratory | Defines the hierarchy of analyses and multiplicity control |
| **Endpoints** | Exact definitions, assessment method, who assesses | Derivation rules, source domains, `PARAMCD` values |
| **Design** | Phase, randomization ratio, stratification, blinding, control | IxRS data, stratified models, blinding procedures |
| **Population / eligibility** | Inclusion and exclusion criteria | Screening data to collect, screen-failure reasons, deviation categories |
| **Treatment** | Doses, schedules, modification rules | Exposure (EX) structure, dose intensity derivations |
| **Schedule of assessments** | What is measured at which visit | Visit structure, baseline definition, windows |
| **Statistical considerations** | Sample size, analyses, interim | SAP scope, analysis timing, alpha spending |

### CBX417-301 at a glance

- **Primary endpoint:** progression-free survival (PFS), per investigator, RECIST 1.1 — time from randomization to documented progression or death from any cause.
- **Key secondary:** overall survival (OS). **Other secondary:** confirmed objective response rate (ORR), duration of response (DoR), safety.
- **Population:** adults ≥18 with advanced/metastatic NSCLC after 1–2 prior lines including a platinum doublet, ECOG 0–1, measurable disease per RECIST 1.1, no actionable EGFR/ALK alteration.
- **Treatment:** CBX-417 200 mg once daily (reductions to 150 then 100 mg) or matching placebo, continuous 21-day cycles; docetaxel 75 mg/m² IV on Day 1 of each cycle (one reduction to 60 mg/m² permitted).
- **Sample size:** 420 randomized (210 per arm); 331 PFS events for 90% power to detect HR 0.70 at two-sided α = 0.05; one interim analysis at about 66% of events.

### The schedule of assessments, read as data

| Assessment | Visits | What it implies |
|---|---|---|
| Labs (hematology, chemistry) | Screening, C1D1 pre-dose, C1D8, every CnD1, EOT, safety follow-up | Baseline is usually the C1D1 pre-dose sample; C1D8 captures the docetaxel neutrophil nadir |
| Vital signs, weight | Screening (with height), every CnD1, EOT, safety follow-up | Height only once, so BSA and BMI use the screening height |
| ECOG PS | Screening, every CnD1, EOT | Baseline ECOG for subgroups; also a stratification factor collected separately in IxRS |
| ECG (QTcF, HR) | Screening, C1D1 **post-dose**, C2D1, C4D1, EOT | The only pre-dose ECG is at screening |
| Tumor assessment | Screening, then every 6 weeks (±7 days) from randomization to week 48, then every 9 weeks | Calendar-driven, independent of dose delays; continues after treatment stops for reasons other than PD |
| Survival follow-up | Every 12 weeks by phone | Source of last-known-alive dates for OS censoring |

:::why[Why are tumor scans scheduled from randomization, not from dosing?]
If scans followed the dosing calendar, an arm with more dose delays (for example, because of toxicity) would have its scans pushed later — and progression would be *detected* later, making PFS look longer for reasons unrelated to efficacy. A fixed calendar from randomization gives both arms the same opportunity to detect progression. This is also why PFS uses randomization, not first dose, as its start date.
:::

:::standard{kind="convention"}
Visit numbering in CBX417-301 (`CYCLE n DAY 1` = VISITNUM n×10, unscheduled = previous scheduled VISITNUM + 0.01) is a sponsor convention documented in the study specifications. CDISC defines what `VISITNUM` is, not how to number visits.
:::

## Worked example

Take four sentences from the synopsis and translate each one into data and analysis requirements.

**Sentence 1:** *"Randomization 1:1, stratified by ECOG PS (0 vs 1) and prior anti-PD-(L)1 therapy (Yes vs No); permuted blocks of 4 within stratum via IxRS."*

- *Data:* the IxRS randomization file must carry the stratum values used at randomization (`STRAT_ECOG`, `STRAT_PRIOR_IO`), the randomization date and the assigned arm.
- *ADaM:* `ADSL.STRAT1R` and `STRAT2R` hold the strata **as randomized**, and `RANDDT` the randomization date.
- *Analysis:* the primary log-rank test and Cox model are stratified by these two factors, so four strata (2 × 2) appear in the analysis.
- *Watch out:* the ECOG recorded in EDC at screening may disagree with the IxRS stratum (a mis-stratification). The SAP must say which one the model uses — normally the IxRS value, because it reflects how randomization was actually balanced.

**Sentence 2:** *"Docetaxel 75 mg/m² IV on Day 1 of each 21-day cycle."*

- *Data:* each infusion needs date, planned dose per m², actual dose in mg, BSA and reason for any change.
- *Derivation:* planned dose (mg) = 75 × BSA, with BSA by the Mosteller formula:

$$
\text{BSA} = \sqrt{\frac{\text{height (cm)} \times \text{weight (kg)}}{3600}}
$$

:::number[What dose does a 170 cm, 70 kg patient get?]
BSA = √(170 × 70 / 3600) = √(11900 / 3600) = √3.3056 = 1.818 m². Planned dose = 75 × 1.818 = 136.4 mg. After a reduction to 60 mg/m², it would be 60 × 1.818 = 109.1 mg. Whether BSA is recalculated each cycle from the current weight is a protocol detail you must check, because it changes planned dose and dose intensity.
:::

**Sentence 3:** *"ECG at screening, C1D1 (post-dose), C2D1, C4D1, EOT."*

- *Baseline:* the SAP's generic rule — "last non-missing value on or before first dose" — would pick the C1D1 ECG if you compare dates only, because it is recorded on the first-dose date. But it is **post-dose**. Either time must be compared (ECG time vs dose time) or the ECG baseline must be defined as the screening value. Spot this now and ask for the SAP to state it.

**Sentence 4:** *"AEs are collected from informed consent until 30 days after the last dose."*

- *Data:* AEs before the first dose will exist (between consent and C1D1) and must not be counted as treatment-emergent.
- *ADaM:* `TRTEMFL = "Y"` when the analysis start date is on or after the first dose and no later than last dose + 30 days — the window mirrors the collection period.

## Interpretation

Reading the synopsis this way produces a list of **questions and requirements**, not answers:

- Items the SAP must pin down (ECG baseline, which stratification source, how missed scans are handled).
- Fields the CRF must contain (ECG time, dose times, BSA inputs, reasons for dose changes).
- Derivations you will own later (`RANDDT`, `TRTSDT`, `TRTEDT`, strata, PFS dates).

What the protocol does **not** give you: the detailed derivation rules. "PFS per RECIST 1.1" does not say what happens when a subject misses two scans and then progresses — that is the SAP's job. If you find a gap, the right reaction is a question to the statistician, not an assumption in code.

## Common mistakes

:::mistake[Starting the clock at first dose]
PFS, OS and DoR-from-randomization analyses in a randomized trial start at randomization (`RANDDT`), not first dose (`TRTSDT`). Using `TRTSDT` excludes never-treated subjects' time and breaks the comparison that randomization protects. Safety windows, by contrast, are anchored to dosing.
:::

:::mistake[Assuming "baseline" means screening]
For labs, baseline is typically the last value on or before first dose — usually the C1D1 pre-dose sample, not screening. For ECG in this study, the reverse is true because C1D1 is post-dose. Read the schedule for each assessment type.
:::

:::mistake[Ignoring the stratification source]
Using EDC screening ECOG in the stratified model when the protocol stratified on the IxRS value changes the strata for mis-stratified subjects. The SAP should name the source; `STRAT1R`/`STRAT2R` are named "…R" precisely to signal *as randomized*.
:::

:::mistake[Treating the synopsis as the whole protocol]
The synopsis summarizes; details such as dose-modification rules, the visit windows and the definition of "adequate" tumor assessment live in the body and appendices. Confirm every derivation-relevant detail in the full text.
:::

## Knowledge check

::quiz{ids="trials.protocol.calendar-scans,trials.protocol.element-implication,trials.protocol.ecg-baseline,trials.protocol.clock-start"}

## Hands-on exercise

::practice{ids="trials.protocol.bsa-dose,trials.protocol.eligibility-data,trials.protocol.events-variant" title="Practice: translate the protocol into data"}

## Challenge exercise

::practice{ids="trials.protocol.synopsis-inconsistency" title="Debug: find the inconsistencies in a draft synopsis"}

## Industry note

- **Protocol review is a real deliverable.** Biostatisticians and lead programmers review draft protocols and CRFs specifically for "can we analyze what we promise?" Catching a missing ECG time or an undefined baseline at this stage saves weeks later.
- **Keep a protocol-to-data traceability note.** Many teams maintain a table mapping each endpoint to its CRF pages, SDTM domains and ADaM parameters. It becomes the backbone of the SAP, the specs and the reviewer guides.
- **Amendments change data.** Protocols are amended (eligibility tweaks, extra assessments). Check which version applied to each subject; the effective date of an amendment can change what was collected.

:::interview[You are handed a new protocol. What do you look at first, and why?]
"The synopsis first — objectives, endpoints, design and schedule of assessments — because together they tell me what data must exist and how they will be analyzed. For each endpoint I note the source data, the start of the clock and anything needing a rule: censoring, windows, baseline, imputation. I check stratification factors, blinding and how treatment is assigned, since those drive ADSL and the models. Then I read the full schedule of assessments to see which visit produces baseline for each measurement. I finish with a list of questions for the statistician — undefined baselines, missing times, ambiguous windows — before any programming starts."
:::
