# Capstone 5 — Oncology survival analysis

> Derive time-to-event variables with real censoring rules, fit Kaplan–Meier and Cox models, and interpret them honestly.

**Difficulty:** expert · **Estimated effort:** 14 hours

---

## Objective

Build ADTTE for PFS and OS from the tumour assessments, deaths and disposition data — implementing every censoring
rule in the SAP — then produce the KM figure with numbers at risk, the survival summary table, the stratified Cox
model, and a proportional-hazards assessment.

Censoring is where most of the work (and most of the errors) live.

## Why this matters

Time-to-event programming is the highest-value skill in oncology biometrics, and the censoring rules are what
separate a correct analysis from a plausible-looking one.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/sdtm/rs` | `data/oncology/` — see that study's `manifest.json` for sdtm/rs |
| `oncology/sdtm/ds` | `data/oncology/` — see that study's `manifest.json` for sdtm/ds |
| `oncology/adam/adsl` | `data/oncology/` — see that study's `manifest.json` for adam/adsl |
| `oncology/adam/adtte` | `data/oncology/` — see that study's `manifest.json` for adam/adtte |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- ADTTE with PARAMCD PFS and OS, CNSR, EVNTDESC, CNSDTDSC and source traceability.
- KM figure with numbers at risk; survival summary table with medians and confidence intervals.
- Stratified Cox model results with a hazard ratio and confidence interval, plus a PH assessment.
- A censoring audit: for each censoring reason, the number of subjects and one worked example.

---

## Steps

### 1. Translate the censoring rules into code

Write each SAP censoring rule as a condition and an assigned date. Decide the order in which rules are applied —
it matters when more than one applies.

**Done when:** A rules table with condition, event/censor, date and CNSR value.

### 2. Derive ADTTE

Build the analysis dataset. For each subject, the event or censoring date must come from a specific source
record; carry SRCDOM/SRCSEQ so it can be traced.

Sanity checks: no negative times, no event dates after the data cutoff, every subject appears exactly once per
parameter.

**Done when:** ADTTE passes your checks and the event/censoring counts are stable when you rerun.

### 3. Kaplan–Meier and Cox

Produce the KM estimates by arm with the log-log confidence interval used by SAS, the median with its CI, the
numbers at risk, the stratified log-rank test and the stratified Cox hazard ratio.

Run the model twice, with Breslow and Efron ties, and note the difference.

**Done when:** Results are produced and the two ties methods are compared.

### 4. Check the assumption you are relying on

Assess proportional hazards with a log(−log) plot and scaled Schoenfeld residuals. If it is questionable, say
what you would report instead (restricted mean survival time, piecewise hazard ratios, landmark analysis).

**Done when:** A written assessment with the diagnostic plots.

### 5. Sensitivity to the censoring rules

Re-run PFS under an alternative censoring approach (for example, ignoring the "two consecutive missed
assessments" rule, or censoring at new anticancer therapy versus treating it as an event) and compare the hazard
ratios.

Report how much the conclusion depends on the rule. This is the analysis that separates a programmer from an
analyst.

**Done when:** A small table of hazard ratios under each rule set, with a written conclusion.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Censoring correctness | Every SAP rule is implemented, applied in the right order and traceable to a source record. |
| Analysis correctness | KM, log-rank and Cox results are correct and reproducible; ties handling is stated. |
| Assumption checking | Proportional hazards is assessed and the consequences discussed. |
| Interpretation | The hazard ratio is described accurately, without "lives 35% longer" style claims. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
05-oncology-survival/
  README.md          this brief
  r/              your R code
  sas/            your SAS code
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
```

Work in `r/`, `sas/` as the deliverables require.

`output/` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

Educational time-to-event derivation and survival analysis (PFS/OS) on a synthetic oncology trial.

Suggested repository name: `oncology-survival-analysis`

**State the limitations honestly.** Copy this into your README:

> Synthetic data generated with known effects; results describe the simulation, not any real therapy. No
> independent statistical review was performed.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
