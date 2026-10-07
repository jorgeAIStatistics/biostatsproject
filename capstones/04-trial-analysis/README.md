# Capstone 4 — Clinical trial analysis from the SAP

> Read the SAP, build the analysis, program the tables and figures, and write the results section.

**Difficulty:** advanced · **Estimated effort:** 16 hours

---

## Objective

Work the way a study team works: the SAP and the shells define the deliverable, and you produce it. Program the
demographics table, the disposition table, the AE overview, the TEAE-by-SOC/PT table, a laboratory shift table and
the response table — then write the paragraphs that would go into the CSR.

## Why this matters

Every statistical programming interview includes some version of "walk me through how you'd program this table".
Having actually done it — including the denominators, the footnotes and the decimal conventions — is the answer.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/adam/adsl` | `data/oncology/` — see that study's `manifest.json` for adam/adsl |
| `oncology/adam/adae` | `data/oncology/` — see that study's `manifest.json` for adam/adae |
| `oncology/adam/adlb` | `data/oncology/` — see that study's `manifest.json` for adam/adlb |
| `oncology/adam/adrs` | `data/oncology/` — see that study's `manifest.json` for adam/adrs |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- Programs producing each table from ADaM, with output that matches the shells.
- A mapping from each shell to the ADaM variables and population flags it uses.
- Draft CSR text for the safety and response results, with correct interpretation and no overclaiming.

---

## Steps

### 1. Read the SAP and shells like a programmer

For each shell, write down: population, denominator, treatment variable (planned or actual), the statistics
required, decimal places, sort order and footnotes.

Any ambiguity you find is a question for the statistician — list them. Real specifications always have some.

**Done when:** A table of requirements per output, plus a list of open questions.

### 2. Program the tables

Build each table from ADaM. Separate computing the statistics from rendering the table — it makes QC far easier
and is how production code is usually structured.

**Done when:** Every table is produced by code, with no hand edits.

### 3. Check the numbers three ways

For each table: do the column headers (big N) match ADSL population counts? Do row percentages use the right
denominator? Does the total of a categorical variable equal N (or explain the difference)? Spot-check two cells
by listing the underlying subjects.

**Done when:** Every table has been reconciled against subject counts.

### 4. Write the results text

Write the safety and efficacy paragraphs. State estimates with confidence intervals, describe the populations,
and be explicit about what the analysis does not establish.

Avoid: "significantly improved" without an effect size, "trend toward" for a non-significant result, and causal
language for subgroup findings.

**Done when:** Draft text written and self-reviewed against the interpretation checklist in the Communication lessons.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Specification adherence | Outputs match the shells: populations, denominators, statistics, ordering and footnotes. |
| Numerical correctness | Counts reconcile with ADSL; spot-checked cells match the underlying records. |
| Code structure | Statistics and presentation are separated; the programs are rerunnable. |
| Interpretation | The written results are accurate, quantified and appropriately hedged. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
04-trial-analysis/
  README.md          this brief
  r/              your R code
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
```

Work in `r/` as the deliverables require.

`output/` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

Educational end-to-end programming of clinical tables and figures from an SAP using synthetic ADaM data.

Suggested repository name: `clinical-trial-tlf-programming`

**State the limitations honestly.** Copy this into your README:

> Synthetic study; outputs are illustrative and were not produced under a validated system or reviewed by a
> statistician.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
