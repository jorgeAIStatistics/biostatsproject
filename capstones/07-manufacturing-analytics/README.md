# Capstone 7 — Pharmaceutical manufacturing analytics

> Build a pipeline from messy instrument exports to a validated predictive model of batch quality — with the leakage traps avoided.

**Difficulty:** advanced · **Estimated effort:** 14 hours

---

## Objective

Instrument exports arrive with inconsistent headers, units and delimiters. Standardize them into an analysis table,
explore the process data, reduce the correlated measurements with PCA, and build a model that predicts batch
potency — validated in a way that does not fool you.

The central lesson is that a model whose cross-validation splits rows within a batch will look excellent and be
useless.

## Why this matters

Analytics roles in biotech manufacturing and process development look for exactly this: the ability to take
instrument data, make it trustworthy, and model it without leaking information between training and test sets.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `manufacturing/process/batches` | `data/manufacturing/` — see that study's `manifest.json` for process/batches |
| `manufacturing/process/sensor-timeseries` | `data/manufacturing/` — see that study's `manifest.json` for process/sensor-timeseries |
| `manufacturing/process/spectra` | `data/manufacturing/` — see that study's `manifest.json` for process/spectra |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- An automated ingestion pipeline (messy exports → tidy analysis table) with a data-quality report.
- Exploratory analysis: distributions, correlations, VIFs, trends by line and supplier.
- PCA with scree plot, scores and loadings, and an interpretation of the first components.
- A predictive model with honest validation (grouped by batch), diagnostics and a short scientific report.

---

## Steps

### 1. Automate the ingestion

Write a pipeline that reads every export in the raw folder regardless of header spelling, delimiter, units or
metadata lines, and produces one tidy table plus a report of what it had to fix or reject.

Make it idempotent: running it twice produces the same output, and a new export file requires no code change.

**Done when:** All exports are ingested, with a quality report listing every anomaly handled.

### 2. Explore before modelling

Distributions by line and supplier, drift over time, correlations among process parameters, variance inflation
factors. Identify the genuine process excursions and decide how to treat them.

**Done when:** You can describe the correlation structure and name the variables that move together.

### 3. Reduce and interpret

Standardize, run PCA, choose the number of components with a stated criterion, and interpret the loadings. Say
what each retained component appears to represent — and what it does not.

**Done when:** A scree plot, a scores plot coloured by an outcome, and a written interpretation with caveats.

### 4. Model with honest validation

Fit a model for potency. Use grouped cross-validation by batch, put every preprocessing step inside the
cross-validation loop, and compare with the naive row-level split so you can quantify the optimism.

**Done when:** A table comparing row-level and batch-grouped performance, with an explanation of the difference.

### 5. Write the report

Two pages: question, data, method, results with uncertainty, limitations, and what you would do next. Write for a
process scientist, not for a data scientist.

**Done when:** Report written and reviewed against the communication checklist.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Pipeline robustness | New or malformed files are handled predictably and reported, not silently dropped. |
| Analysis quality | Multicollinearity, scaling and outliers are handled deliberately and explained. |
| Validation integrity | No leakage; grouped validation is used and the optimism of naive splitting is quantified. |
| Communication | The report is accurate, quantified and readable by a non-modeller. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
07-manufacturing-analytics/
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

Educational analytics pipeline from synthetic instrument exports to a batch-quality model with leakage-safe validation.

Suggested repository name: `manufacturing-process-analytics`

**State the limitations honestly.** Copy this into your README:

> Synthetic process data generated from a known latent structure; performance figures reflect that generator, not a
> real manufacturing process. No GMP or validation framework is implied.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
