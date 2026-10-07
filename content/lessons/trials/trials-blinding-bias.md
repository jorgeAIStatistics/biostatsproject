## What problem are we trying to solve?

CBX417-301 is still running. You are building the ADaM datasets and TLF programs so that final outputs can be produced within days of database lock. Three requests arrive in the same week:

1. The clinical scientist asks for "a quick AE summary by arm — just for internal planning."
2. A data manager sends you the IxRS kit list "in case you need it for the exposure derivation."
3. The medical monitor wants a listing of all subjects with rash, including the kit numbers dispensed.

Each request, innocently, could **unblind** the study team. If the team learns which subjects receive CBX-417 while the trial is ongoing, every later judgment — how scans are read, which AEs get reported, how the SAP is finalized — becomes open to bias, and the trial's credibility with regulators suffers.

A programmer on a blinded study must know what bias is, what blinding protects, which data can break it, and how to build outputs without it.

## Intuition

A randomized trial compares groups that differ, at the start, only by chance. **Bias** is anything that makes them differ systematically *after* randomization for reasons other than the treatment itself:

- Doctors who know a patient is on placebo may monitor them differently, or treat symptoms more aggressively.
- A radiologist who knows a patient is on the experimental drug may read an ambiguous scan as "stable" rather than "progressed."
- Patients who believe they are on placebo may drop out sooner or report symptoms differently.

**Blinding** removes the knowledge that drives these differences. If nobody involved in treating, assessing or analyzing patients knows who got what, their behavior cannot depend on it.

For you as a programmer, blinding has a practical meaning: **treatment assignment is a restricted variable**. Until lock and unblinding, it (and anything that reveals it) stays with a small, separate, unblinded group.

## Clinical context

In CBX417-301, blinding is **partial by design**:

| Component | Blinded? | Why |
|---|---|---|
| CBX-417 vs placebo tablets | Double-blind | Matching placebo tablets in kits with non-informative kit numbers |
| Docetaxel | Open-label | Both arms receive it; there is nothing to blind |
| Randomization list, kit list | Restricted | IxRS vendor and unblinded personnel only |
| PFS assessment | Investigator, blinded to CBX-417 vs placebo | Reduces assessment bias in the primary endpoint |

Oncology adds a specific threat: **functional unblinding**. If an experimental drug causes characteristic toxicities (for example rash, diarrhea or hypertension), investigators may correctly guess assignment for some patients even though the kits are identical. Blinding still helps — guesses are uncertain — but sponsors monitor for it and often plan a blinded independent central review (BICR) of scans when investigator-assessed PFS is primary.

:::standard{kind="official" source="ICH E9 Statistical Principles for Clinical Trials, Section 2.3.1"}
ICH E9 describes a double-blind trial as one in which neither the subjects nor the investigator or sponsor staff involved in treating or clinically evaluating them know the treatment received, and it asks that the blind be maintained through data cleaning and until the analysis plan is finalized.
:::

## Formal concept

### Sources of bias after randomization

| Bias | Mechanism | Main safeguard |
|---|---|---|
| **Selection** | Choosing which patient gets the next assignment | Randomization with allocation concealment |
| **Performance** | Different care or co-interventions by arm | Blinding of patients and care providers |
| **Detection / assessment** | Outcome measured or interpreted differently by arm | Blinded assessors, BICR, objective endpoints |
| **Attrition** | Different dropout by arm, related to outcome | Blinding, ITT analysis, follow-up after treatment stops |
| **Reporting / analysis** | Choosing analyses after seeing results | Prespecified SAP finalized before unblinding |

### Levels of blinding

- **Open-label:** everyone knows the assignment. Common when blinding is impossible (e.g., surgery vs drug, or different schedules).
- **Single-blind:** usually the patient does not know, the investigator does.
- **Double-blind:** patients, investigators and sponsor staff involved in the conduct and evaluation do not know.
- **"Triple-blind"** is sometimes used informally for trials where the data analysts are also blinded. The labels are not standardized — the protocol should state *who* is blinded, not just a label.

### Who may be unblinded during a blinded trial

| Who | Why | Scope |
|---|---|---|
| Independent Data Monitoring Committee (IDMC) and its independent statistician/programmer | Interim safety and efficacy review | Aggregate unblinded data, firewalled from the sponsor study team |
| Pharmacovigilance | Expedited reporting of suspected unexpected serious adverse reactions (SUSARs) | Individual cases, not shared with the study team |
| Investigator | Medical emergency where treatment knowledge is needed | Individual subject via IxRS, logged and reported |
| IxRS vendor / unblinded supply staff | Randomization and drug supply | Operational, no access to clinical outcome analyses |

### Data that can break the blind

- The randomization export (`ARM_ASSIGNED`) and the kit list (`KIT_CONTENT` maps each kit to *CBX-417* or *placebo*).
- Any dataset joining kit numbers to kit content, or deriving actual treatment.
- Pharmacokinetic concentrations of CBX-417 (non-zero only on active drug).
- Summaries **by arm** of anything — AEs, labs, efficacy.
- Sometimes, sufficiently specific patterns (a lab effect only the active drug causes).

## Worked example

Handle the three requests from the opening scenario.

**Request 1 — "a quick AE summary by arm."** A by-arm summary during the blinded phase is unblinded information, whatever its purpose. Offer instead: a **pooled** summary (both arms together) for planning, or refer the request to the unblinded IDMC process if it concerns safety. If development outputs are needed by arm, produce them with **dummy randomization** and label them clearly.

**Request 2 — the kit list.** `kit_list.csv` links each `KIT_NUMBER` to `KIT_CONTENT`. Combined with dispensing records (`ex_study_drug.csv`), it reveals every subject's treatment. Do not store it in the blinded study area. Your exposure program can be written and tested on a **dummy kit list** (same structure, scrambled content) and run on the real one after unblinding.

**Request 3 — rash listing with kit numbers.** Kit numbers alone are not informative (they are designed to be non-sequential and non-revealing), but anyone holding the kit list can decode them. The listing should omit kit numbers unless there is a documented need, and must never include kit content.

:::number[Why does a pooled summary protect the blind but a by-arm summary does not?]
A pooled table of AE rates for all 416 treated subjects is the same number whichever subjects received CBX-417 — it contains no information about the assignment. A by-arm table splits the counts by assignment, so any difference between the columns *is* information about the treatment effect. The protection is the aggregation over arms, not the aggregation over subjects.
:::

### Dummy randomization in practice

During development, programs read treatment from a single controlled source — the real randomization data after unblinding, a **dummy** file before. A typical dummy file assigns arms at random with the same structure (same variable names, same values, same number of subjects per arm), so every program runs end-to-end. Outputs carry a banner such as "DUMMY RANDOMIZATION — NOT STUDY RESULTS" in the title or footnote until the real codes are loaded.

## Data example

The CBX417-301 kit list is part of the synthetic data. In a live trial this file would be restricted to the unblinded supply team until database lock:

::dataset{id="oncology/raw/kit_list" cols="KIT_NUMBER,KIT_CONTENT" rows="6" caption="IxRS kit list — unblinding information in a live trial"}

Notice that the kit content is all that separates a blinded dispensing record from an unblinded one. The same is true of `ARM_ASSIGNED` in the randomization transfer.

## Interpretation

- **Blinding protects decisions, not just data.** The SAP must be finalized before unblinding precisely so that analysis choices cannot be tuned to the results.
- **Unblinding is an event.** Emergency unblindings and any accidental disclosures are documented; the CSR discusses them and reviewers look for them.
- **Partial blinding still has value.** In CBX417-301 docetaxel toxicity is visible in both arms, which actually helps: common chemotherapy side effects do not point to either arm.
- **Blinding is not a substitute for objective endpoints.** Overall survival is robust to assessment bias because death is unambiguous; PFS depends on scan interpretation, which is why its assessment process matters.

## Common mistakes

:::mistake[Treating "internal" as "harmless"]
An unblinded table shown only "internally" to the study team still unblinds the study team — the very people whose decisions blinding protects. Route unblinded needs to the IDMC or independent statistician.
:::

:::mistake[Keeping restricted files in the study area]
Randomization and kit lists saved to a shared project folder are accessible to everyone with folder access. Use separate, access-controlled locations and dummy files for development.
:::

:::mistake[Forgetting indirect unblinding]
PK concentration listings, dose-related lab effects or a column of kit numbers next to a kit-content lookup can reveal assignment without any "arm" variable. Review listings for columns that encode treatment.
:::

:::mistake[Unlabeled dummy outputs]
Development outputs with dummy randomization that look like real tables get pasted into slides. Always label dummy outputs in titles or footnotes, and control the switch to real codes.
:::

## Knowledge check

::quiz{ids="trials.blinding.bias-types,trials.blinding.kit-list,trials.blinding.who-unblinded"}

## Hands-on exercise

::practice{ids="trials.blinding.functional-unblinding,trials.blinding.unblinding-steps" title="Practice: protecting the blind"}

## Challenge exercise

::practice{ids="trials.blinding.listing-review,trials.blinding.by-arm-request" title="Debug: requests and outputs that could unblind"}

## Industry note

- **Firewalls are real.** Interim analyses for an IDMC are usually produced by an independent statistical group, often at a separate CRO, precisely so the sponsor team stays blinded. Programmers may be asked to hand over validated programs that the independent group runs on unblinded data.
- **Expect questions about blinding in interviews.** "How would you program a double-blind study before unblinding?" tests whether you know about dummy randomization, restricted files and pooled blinded data reviews.
- **Blinded data review meetings** before lock look at pooled data: missing data patterns, protocol deviations, outliers and population assignments (who is in the per-protocol set) — decisions made blind and documented before the codes are released.

:::interview[How do you work on a double-blind study before unblinding?]
"I develop everything on real clinical data but with dummy treatment assignments: a dummy randomization file with the same structure as the real one, so SDTM, ADaM and TLF programs run end to end. Outputs are labeled as dummy. Real randomization and kit lists stay with the unblinded team or vendor in restricted locations; I don't store them in the study area and I don't produce by-arm summaries for the study team. Blinded data reviews use pooled summaries. After database lock, the real codes are loaded in a controlled step, the programs are rerun, and QC confirms the final outputs. Any request for unblinded data during the study goes to the IDMC process."
:::
