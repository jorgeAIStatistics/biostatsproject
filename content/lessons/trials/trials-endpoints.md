## What problem are we trying to solve?

The CBX417-301 SAP lists one primary endpoint, one key secondary endpoint, several other secondary endpoints and a handful of exploratory ones. Your lead asks you to estimate the programming effort for each, and the biostatistician asks you to check that the ADaM design supports all of them.

To do either, you need to know what each endpoint *is*: the question it answers, the data it needs, how it is summarized, and why it sits where it does in the hierarchy. You also need the vocabulary interviewers expect — primary vs secondary, surrogate, PFS vs OS, why DoR is not a randomized comparison — because "why is PFS the primary endpoint and not OS?" is a question you will be asked.

## Intuition

An **objective** is a question ("Does CBX-417 delay disease progression?"). An **endpoint** is the measurement that answers it ("time from randomization to documented progression or death"). The **hierarchy** says how much each answer counts:

- The **primary** endpoint decides whether the trial succeeded. The sample size is built around it and the type I error is controlled for it.
- **Key secondary** endpoints can support claims too, but only inside a prespecified testing strategy that keeps the overall false-positive rate at the planned α.
- **Other secondary** endpoints add supportive evidence and are usually reported descriptively or with nominal p-values.
- **Exploratory** endpoints generate hypotheses for future studies.

A **surrogate** endpoint stands in for the outcome patients actually care about, because it arrives sooner or is easier to measure. Tumor shrinkage stands in for living longer; blood pressure stands in for fewer strokes. Surrogates speed up trials — and occasionally mislead, when a treatment moves the surrogate without moving the real outcome.

## Clinical context

### CBX417-301 endpoint hierarchy

| Level | Endpoint | Question it answers |
|---|---|---|
| Primary | PFS per investigator, RECIST 1.1 | Does adding CBX-417 delay progression or death? |
| Key secondary | OS | Does it help patients live longer? |
| Other secondary | Confirmed ORR; DoR; safety (AEs, labs, vital signs, ECG) | Does it shrink tumors, for how long, and at what cost in toxicity? |
| Exploratory | Examples: subgroup consistency, biomarker (PD-L1) relationships | What should the next study test? |

### The oncology endpoints

| Endpoint | Definition (CBX417-301) | Strengths | Weaknesses |
|---|---|---|---|
| **OS** | Randomization to death from any cause | Unambiguous, directly meaningful | Needs long follow-up; diluted by subsequent therapies |
| **PFS** | Randomization to documented progression (RECIST 1.1) or death, whichever first | Earlier; not affected by post-progression therapy | Depends on scan timing and interpretation; its link to OS varies by setting |
| **ORR** | Proportion with confirmed complete or partial response | Direct evidence of anti-tumor activity; usable in single-arm trials | Does not capture stable disease or duration |
| **DoR** | First documented response to progression or death, among responders | Shows durability | Defined only in responders — not a randomized comparison |

:::standard{kind="official" source="FDA Guidance: Clinical Trial Endpoints for the Approval of Cancer Drugs and Biologics (2018)"}
FDA's guidance describes OS as the most reliable cancer endpoint and discusses PFS, ORR and DoR, including their assessment challenges (for example, the value of blinded independent review for PFS in some settings). Whether an endpoint can support approval depends on the disease setting and the size of the effect; the guidance is the place to check.
:::

:::standard{kind="official" source="21 CFR 314 Subpart H; 21 CFR 601 Subpart E (US accelerated approval)"}
US accelerated approval may be based on a surrogate endpoint that is reasonably likely to predict clinical benefit, with confirmatory trials required. FDA also publishes a table of surrogate endpoints that have been used as the basis of approval.
:::

### Patient-reported outcomes

PROs capture how patients feel and function — symptom scales, quality of life, physical functioning — collected with validated questionnaires. In lung cancer trials they are often analyzed as *time to deterioration* (a time-to-event endpoint) or change from baseline (a longitudinal endpoint). In SDTM they live in the QS domain. The synthetic CBX417-301 data do not include PROs; a real trial in this setting usually would.

## Formal concept

### Endpoint types and their summary measures

| Endpoint type | Example | Typical summary | Typical comparison |
|---|---|---|---|
| Time-to-event | PFS, OS, DoR | Kaplan–Meier median (months) with 95% CI | Hazard ratio (Cox), log-rank test |
| Binary | ORR | Proportion with exact (Clopper–Pearson) 95% CI | Difference in proportions, odds ratio, CMH test |
| Continuous | Change from baseline in SBP | Mean (SD), LS mean | Difference in means (ANCOVA/MMRM) |
| Count | Number of exacerbations | Rate per patient-year | Rate ratio (negative binomial) |
| Ordinal / categorical | Best overall response category | n (%) per category | Descriptive or ordinal model |

Time-to-event endpoints need **censoring**: a subject without the event by the data cutoff contributes the time they were observed, marked as censored. How censoring dates are chosen (last adequate scan, last known alive) is defined in the SAP — see the RECIST lesson for PFS.

### Units and time conventions

`ADTTE.AVAL` for CBX417-301 is in **days**: `AVAL = ADT − STARTDT + 1`. Tables report months, commonly using

$$
\text{months} = \frac{\text{days}}{30.4375}, \qquad 30.4375 = \frac{365.25}{12}.
$$

:::standard{kind="convention"}
The divisor 30.4375 is a widespread convention, not a regulatory requirement. Some sponsors use 30.44 or report weeks. What matters is that the SAP states the rule and every program uses the same one.
:::

### The endpoint hierarchy and multiplicity

Testing several endpoints each at α = 0.05 inflates the chance of at least one false-positive claim. CBX417-301 uses a **fixed-sequence (hierarchical)** strategy: OS is formally tested only if PFS is statistically significant. Each test uses the full α, and the familywise error rate stays at 0.05 because testing stops at the first non-significant result.

## Worked example

A single-arm Phase 2 study of a hypothetical drug (not CBX-417) treats 60 patients with measurable disease. At the analysis, 18 have a **confirmed** partial or complete response, 12 more had a PR that was **not** confirmed on the next scan, and the rest had stable or progressive disease or were not evaluable.

**Step 1 — numerator.** Only confirmed responses count toward confirmed ORR: 18. The 12 unconfirmed PRs count as stable disease for best overall response if the SD criteria are met.

**Step 2 — denominator.** All 60 treated patients with measurable disease — including those who never had a post-baseline scan. Dropping unevaluable patients from the denominator would flatter the result.

**Step 3 — estimate and exact CI.** ORR = 18 / 60 = 30.0%. The Clopper–Pearson 95% CI, based on the binomial distribution, is 18.9% to 43.2%.

:::number[Where do 18.9% and 43.2% come from?]
The Clopper–Pearson interval inverts two one-sided binomial tests: the lower limit is the response probability *p* for which P(X ≥ 18 | n = 60, p) = 0.025, and the upper limit the *p* for which P(X ≤ 18 | n = 60, p) = 0.025. Computed with R `binom.test(18, 60)` they are 0.1885 and 0.4321. If the 12 unconfirmed responses were wrongly counted, the ORR would be 30 / 60 = 50.0% — a very different story.
:::

**Step 4 — DoR.** Duration of response is computed for the 18 confirmed responders only, from each one's first documented response to progression or death, and summarized with a Kaplan–Meier median. It cannot be compared across arms as if randomized, because responders on each arm are a selected subgroup.

## Interpretation

- **PFS and OS answer different questions.** A PFS benefit without an OS benefit may reflect effective subsequent therapies, a short-lived effect, or a surrogate that does not translate in this setting. Report both honestly.
- **An HR summarizes the whole curve; a median is one point on it.** Two arms can have similar medians and a meaningful HR (or vice versa) when curves separate late. Report both, plus the KM plot.
- **ORR is a proportion of randomized (or treated) patients, not of evaluable ones.** Check the denominator in every shell.
- **Secondary endpoints are interpreted within the hierarchy.** An OS p-value is confirmatory only if the PFS test succeeded first.

## Common mistakes

:::mistake[Counting unconfirmed responses in confirmed ORR]
RECIST 1.1 responses in CBX417-301 require confirmation at least 4 weeks later. Using the single best response inflates ORR. ADaM should carry both unconfirmed (`BOR`) and confirmed (`CBOR`) best overall response parameters so each table picks the right one.
:::

:::mistake[Shrinking the ORR denominator]
Excluding subjects with no post-baseline assessment from the denominator turns an ITT proportion into a "responders among the evaluable" proportion. If the SAP wants that, it will say so (for example, the efficacy-evaluable population) — and the population line of the table must say it.
:::

:::mistake[Comparing DoR between arms as a randomized result]
DoR is conditional on response. If CBX-417 produced more responders, including some with shorter responses, the DoR comparison is confounded. Present DoR descriptively (KM median per arm) unless the SAP specifies a method that accounts for this.
:::

:::mistake[Mixing time units]
Programs that compute months with different divisors (30, 30.4375, 365.25/12 rounded) produce medians that differ in the second decimal between production and QC. Use the SAP's constant everywhere.
:::

## Knowledge check

::quiz{ids="trials.endpoints.hierarchy-classify,trials.endpoints.surrogate,trials.endpoints.summary-measure,trials.endpoints.why-pfs-primary"}

## Hands-on exercise

::practice{ids="trials.endpoints.orr-calc,trials.endpoints.dor-caveat,trials.endpoints.pfs-statements" title="Practice: compute and interpret oncology endpoints"}

## Challenge exercise

::practice{ids="trials.endpoints.orr-denominator-bug" title="Debug: an ORR that is too good"}

## Industry note

- **Endpoints drive the ADaM design.** Each time-to-event endpoint becomes an `ADTTE` parameter (`PFS`, `OS`, `DOR`); response endpoints become `ADRS` parameters (`OVRLRESP`, `BOR`, `CBOR`). Knowing the endpoint list tells you the datasets you will build.
- **Regulatory conversations center on endpoints.** Sponsors discuss endpoint choice with FDA and other agencies before Phase 3. Your programming work will often support these discussions with exploratory analyses of earlier trials.
- **Interviewers probe the trade-offs.** Expect "PFS or OS?", "What is a surrogate endpoint?", "Why confirm responses?" — answer with the question each endpoint answers, its data requirements and its weaknesses.

:::interview[Why would a trial use PFS as the primary endpoint instead of OS?]
"OS is the most reliable endpoint — death is unambiguous and it's what patients care about — but it needs long follow-up and can be diluted by therapies patients receive after progression. PFS is observed earlier and measures the drug's effect on the disease before subsequent therapy, so trials need fewer events or less time. The cost is that PFS depends on when scans happen and how they're read, so the protocol fixes a calendar scan schedule from randomization, the SAP defines censoring rules, and sometimes a blinded central review supports the investigator assessment. Whether PFS is an acceptable basis for approval depends on the setting, which is why OS is often the key secondary endpoint, tested hierarchically after PFS."
:::
