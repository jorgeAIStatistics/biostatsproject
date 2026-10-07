# Capstone 6 — Statistical programming submission simulation

> Assemble a submission-style package — datasets, outputs, specifications, QC documentation and a reviewer's guide.

**Difficulty:** expert · **Estimated effort:** 18 hours

---

## Objective

Package the work of capstones 2–5 the way a submission is packaged: standardized datasets, analysis datasets,
outputs, specifications, programs, QC documentation and a reviewer-facing guide that explains the decisions a
reviewer would otherwise have to guess.

This is explicitly an educational simulation, and your documentation must say so.

## Why this matters

Most programmers never see the whole package until they work on a filing. Understanding what goes into it — and
writing documentation a reviewer could actually use — is a differentiator in interviews for submission-facing roles.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/sdtm/dm` | `data/oncology/` — see that study's `manifest.json` for sdtm/dm |
| `oncology/adam/adsl` | `data/oncology/` — see that study's `manifest.json` for adam/adsl |
| `oncology/adam/adtte` | `data/oncology/` — see that study's `manifest.json` for adam/adtte |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- A folder structure containing tabulation datasets, analysis datasets, outputs, programs and documentation.
- Dataset-level and variable-level specifications.
- A reviewer's-guide-style document (analysis datasets, key derivations, data dependencies, known issues).
- A QC summary: what was independently programmed, what was checked by review, what remains open.

---

## Steps

### 1. Build the package structure

Create the folder layout and a manifest of what goes where. Name programs so their run order is obvious, and
make sure every output names the program that produced it.

**Done when:** A reviewer could locate any output's source program in under a minute.

### 2. Finish the specifications

Complete dataset-level and variable-level specifications for the datasets you submit. Include origin, codelists
and derivation text for every derived variable.

**Done when:** No variable in your analysis datasets is undocumented.

### 3. Write the reviewer's guide

Cover: study design summary, the analysis datasets and how they relate, key derivations (populations,
treatment-emergent, censoring), data dependencies between datasets, and any known issues or deviations.

Be explicit that the study and data are synthetic and educational.

**Done when:** A guide exists that someone unfamiliar with your code could read before opening a dataset.

### 4. Document the QC

For each output: who produced it, how it was checked (independent programming, review, both), what was found and
what was resolved. Leave open items visible rather than deleted.

**Done when:** A QC summary table covering every output in the package.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Completeness | Every dataset and output in the package is documented and reproducible. |
| Reviewer orientation | Documentation answers a reviewer's questions instead of describing code. |
| Honesty | Limitations, open issues and the educational nature of the package are stated clearly. |
| Organization | Structure and naming make the package navigable without explanation. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
06-submission-simulation/
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

Educational simulation of a statistical programming deliverable package built on synthetic study data.

Suggested repository name: `biometrics-submission-simulation`

**State the limitations honestly.** Copy this into your README:

> This is a teaching exercise, not a regulatory submission: no Define-XML validation, no electronic submission
> format, no sponsor quality system, and all data are synthetic.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
