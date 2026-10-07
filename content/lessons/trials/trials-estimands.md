## What problem are we trying to solve?

Two statisticians review the CBX417-301 PFS censoring rules and disagree.

- Statistician A: "Subjects who start a new anticancer therapy before progression should be censored at their last scan before the new therapy. We want the effect of CBX-417, not of whatever they took next."
- Statistician B: "In real life patients do switch therapy. Their later progression is still part of the outcome. Don't censor — follow them."

Neither is wrong. They are answering **different questions**. Statistician A estimates the effect *had no one started new therapy*; Statistician B estimates the effect *of being assigned to CBX-417, whatever happens next*. Arguing about the censoring rule before agreeing on the question is arguing about the answer before the question.

ICH E9(R1) gives trials a formal way to state the question first: the **estimand**. For you, as statistician or programmer, estimands explain *why* the SAP's rules look the way they do — and they are one of the most common biostatistics interview topics.

## Intuition

A treatment effect sounds simple until something happens after randomization that complicates it:

- A patient stops CBX-417 because of rash. Is their later progression "caused" by CBX-417 or by stopping it?
- A patient starts a new cancer drug before progressing. Whose effect does their subsequent progression reflect?
- A patient dies before any scan shows progression. Did the drug "fail"?

These are **intercurrent events**: things that happen after treatment starts and change either how an outcome should be interpreted or whether it can be observed at all. Every trial has them. For each one, you must decide what the question *means* in its presence — that decision is part of the estimand.

Think of an estimand as the **target** you aim at before choosing the **weapon** (the estimator: the model, the censoring rule) and firing (the estimate: the number in the table).

## Clinical context

Before ICH E9(R1), trials often stated "ITT analysis of PFS" and let the censoring rules implicitly define the question. Different sponsors' rules for the same endpoint answered subtly different questions, and regulators, clinicians and statisticians talked past each other.

:::standard{kind="official" source="ICH E9(R1) Addendum on Estimands and Sensitivity Analysis in Clinical Trials (finalized by ICH, November 2019)"}
The addendum introduces a framework that aligns trial objectives, design, conduct, analysis and interpretation. It defines the estimand through its attributes, names five strategies for intercurrent events, and distinguishes sensitivity analyses (the same estimand under different assumptions) from supplementary analyses. Regulators including FDA and EMA have adopted it.
:::

In oncology, the estimand is closely tied to the censoring rules you program in `ADTTE`. In chronic diseases (hypertension, diabetes), it is tied to how rescue medication and treatment discontinuation are handled in longitudinal models. The two worked estimands below show both.

## Formal concept

### The five attributes

| Attribute | Question it answers |
|---|---|
| **Treatment** | Which treatment condition(s) are compared — including background therapy and allowed modifications? |
| **Population** | Which patients is the effect meant for? |
| **Variable** (endpoint) | What is measured for each patient? |
| **Intercurrent events** | Which ones are anticipated, and how is each handled (via the strategies below)? |
| **Population-level summary** | How are the variables compared between treatments (hazard ratio, difference in means, …)? |

### The five strategies for intercurrent events

| Strategy | Idea | Example |
|---|---|---|
| **Treatment policy** | The intercurrent event is irrelevant; use the outcome whatever happened | Keep scanning and counting PFS after study treatment is stopped |
| **Hypothetical** | Envisage a scenario in which the event does not occur | PFS had no new anticancer therapy been started |
| **Composite variable** | The event is part of the outcome itself | Death is a PFS event |
| **While on treatment** | Use outcomes only up to the event | Adverse events while on treatment (+30 days) |
| **Principal stratum** | Target the subpopulation defined by potential occurrence of the event | Effect among patients who would tolerate treatment on either arm |

### Estimand, estimator, estimate

- **Estimand:** the target of estimation (the question, stated with the five attributes).
- **Estimator:** the method (for example, a stratified Cox model on data censored per SAP rules).
- **Estimate:** the number it produces.

### Missing data is a different problem

An intercurrent event is part of the **question**. Missing data are a problem of **estimation**: data that exist in principle (and are relevant to the estimand) but were not collected. In CBX417-301, a patient who skips two scans and then progresses has *missing assessments*, not an intercurrent event — the censoring rule for that case (CNSR = 4) is a missing-data assumption, and it is exactly the kind of assumption a **sensitivity analysis** should vary.

:::why[Why distinguish sensitivity from supplementary analyses?]
A sensitivity analysis keeps the estimand fixed and changes assumptions (for example, how missed scans are handled) to see whether the conclusion is robust. A supplementary analysis targets something else (for example, the treatment-policy PFS that ignores new therapy). Calling a different-estimand analysis a "sensitivity analysis" confuses robustness with a change of question.
:::

## Worked example

### Estimand 1 — CBX417-301 primary PFS

| Attribute | Specification |
|---|---|
| Treatment | CBX-417 200 mg QD + docetaxel 75 mg/m² q3w vs placebo QD + docetaxel, including protocol-permitted dose reductions and interruptions |
| Population | Adults with previously treated advanced/metastatic NSCLC meeting the eligibility criteria (represented by the ITT population, `ITTFL = "Y"`) |
| Variable | Time from randomization to documented progression per RECIST 1.1 (investigator) or death from any cause |
| Intercurrent events | (1) Discontinuation of study treatment — **treatment policy**: scans continue, later progression counts. (2) Start of new anticancer therapy before progression — **hypothetical**: PFS had new therapy not been started. (3) Death before documented progression — **composite**: death is an event. |
| Population-level summary | Hazard ratio (CBX-417 vs placebo) from a Cox model stratified by the randomization strata, with Kaplan–Meier medians as descriptive summaries |

How each strategy becomes code in `ADTTE`:

| Intercurrent event | Strategy | Implementation | `CNSR` |
|---|---|---|---|
| Treatment discontinuation | Treatment policy | Keep following; no censoring at last dose | — |
| New anticancer therapy before PD | Hypothetical | Censor at the last adequate assessment on or before the new therapy start | 3 |
| Death without PD | Composite | Event at death date | 0 |

:::number[Why does censoring implement a hypothetical strategy?]
Censoring removes the subject from the risk set after the last assessment before the new therapy. The Cox model then treats their unobserved future as if it behaved like that of similar subjects still at risk — which estimates what would have happened without the new therapy, **provided** censoring is non-informative. That proviso is an assumption: patients who start new therapy early may be doing worse. A sensitivity or supplementary analysis that counts progression after new therapy tests how much the conclusion depends on it.
:::

Note what is **not** an intercurrent event here: the CNSR = 4 rule (progression after two or more missed scans) handles missing assessments; CNSR = 1 and 2 are administrative censoring and absence of data. They are estimation details, not parts of the question.

### Estimand 2 — a blood-pressure trial

Consider a 12-week randomized trial of a new antihypertensive vs placebo in adults with uncontrolled hypertension (a generic cardiovascular example). The clinical question: how much does the drug lower systolic blood pressure?

| Attribute | Specification |
|---|---|
| Treatment | New drug vs placebo, each on top of stable background therapy |
| Population | Adults with uncontrolled hypertension as defined by eligibility |
| Variable | Change from baseline to week 12 in mean seated SBP (mmHg) |
| Intercurrent events | (1) Discontinuation of study drug — **treatment policy**: measure SBP at week 12 regardless. (2) Start of rescue antihypertensive medication — **hypothetical**: SBP had rescue not been started. |
| Population-level summary | Difference in mean change from baseline (drug − placebo) |

The choices have consequences for data collection and analysis:

- **Treatment policy for discontinuation** requires that sites keep measuring SBP at week 12 for patients who stopped the drug (retrieved dropouts). If those visits are not in the schedule of assessments, the estimand cannot be estimated well.
- **Hypothetical for rescue** means SBP values after rescue are not used as observed; they are treated as missing and modeled (for example, a mixed model for repeated measures under an assumption about what would have happened without rescue).
- A **composite** alternative would define "needing rescue" as treatment failure — for example a responder endpoint (SBP < 140 mmHg at week 12 *and* no rescue).

:::clinical
A treatment-policy estimand for rescue would ask a different question: "what happens to SBP when patients are assigned the drug in a system where rescue is available?" Because rescue lowers SBP in the placebo arm most, that estimand will usually show a smaller difference. Neither answer is wrong; the protocol must say which one the trial is designed to deliver.
:::

## Data example

In the CBX417-301 `ADTTE`, the estimand's decisions are visible as censoring indicators and descriptions:

::dataset{id="oncology/adam/adtte" cols="USUBJID,PARAMCD,AVAL,CNSR,EVNTDESC,CNSDTDSC" filter="PARAMCD=PFS" rows="12" caption="ADTTE — PFS records with censoring codes and descriptions"}

Look for subjects with `CNSR = 3`: their records end at the last adequate scan before a new anticancer therapy — the hypothetical strategy in data form. Subjects whose treatment stopped long before their PFS event show the treatment-policy strategy: nothing in their PFS record reflects the discontinuation.

## Interpretation

- **The estimand explains the censoring table.** When an interviewer asks "why censor at new anticancer therapy?", the answer is "because the SAP targets a hypothetical estimand for that intercurrent event — and here is the assumption it rests on."
- **Different strategies answer different questions**, and regulators may prefer different ones for different decisions. Many oncology SAPs now present a supplementary treatment-policy analysis alongside the primary one.
- **Every estimand choice has a data consequence.** Treatment-policy estimands need follow-up after treatment stops; hypothetical estimands need modeling assumptions; composite estimands need an outcome definition that includes the event.

## Common mistakes

:::mistake[Calling an analysis population an estimand]
"The estimand is the ITT population" confuses one attribute with the whole. The population is only one of five attributes; without the variable, the intercurrent-event strategies and the summary measure, the question is undefined.
:::

:::mistake[Treating missing data as intercurrent events]
Missed scans, lost-to-follow-up and administrative censoring are about data availability. Handling them with "strategies" muddles the question with the estimation problem. Handle them with assumptions and test those assumptions in sensitivity analyses.
:::

:::mistake[Labeling a different estimand as a sensitivity analysis]
An analysis that stops censoring at new anticancer therapy changes the intercurrent-event strategy — it targets a different estimand. Label it supplementary.
:::

:::mistake[Choosing a strategy the data cannot support]
A treatment-policy estimand for discontinuation requires outcome data after discontinuation. If the protocol stops assessments at end of treatment, the data needed to estimate it do not exist. Estimand decisions belong in the protocol, before data collection.
:::

## Knowledge check

::quiz{ids="trials.estimands.attributes-map,trials.estimands.censor-new-therapy,trials.estimands.strategy-classify,trials.estimands.missed-scans"}

## Hands-on exercise

::practice{ids="trials.estimands.sensitivity-vs-supplementary,trials.estimands.cardio-ice-map,trials.estimands.treatment-policy-data,trials.estimands.draft-os" title="Practice: build and interpret estimands"}

## Challenge exercise

::practice{ids="trials.estimands.sap-inconsistency" title="Debug: an estimand that contradicts its censoring rules"}

## Industry note

- **Estimands are now standard in protocols and SAPs.** Programmers see them as the section that justifies censoring and imputation rules; when a rule seems odd, the estimand usually explains it.
- **Oncology is converging on explicit estimands for PFS and OS**, with the new-therapy and treatment-discontinuation strategies spelled out and supplementary analyses for alternative strategies.
- **Interview signal:** for biostatistician roles, expect to define an estimand, list the five attributes and strategies, and apply them to an example. For programmer roles, expect to connect the strategy to an `ADTTE` censoring rule or an imputation in `ADLB`/`ADVS`.

:::interview[What is an estimand, and why did ICH add it?]
"An estimand is a precise description of the treatment effect a trial aims to estimate. ICH E9(R1) defines it through five attributes — treatment, population, variable, the handling of intercurrent events, and the population-level summary. Intercurrent events are things like treatment discontinuation, rescue medication, new therapy or death that affect how outcomes are interpreted or whether they exist. For each, you choose a strategy: treatment policy, hypothetical, composite, while on treatment or principal stratum. ICH added the framework because analyses were often chosen before the question was clear — censoring and imputation rules silently defined different effects. For example, in an oncology PFS analysis, censoring at new anticancer therapy implements a hypothetical strategy; a supplementary treatment-policy analysis would count progression regardless. Sensitivity analyses then test the assumptions behind the chosen estimator, without changing the estimand."
:::
