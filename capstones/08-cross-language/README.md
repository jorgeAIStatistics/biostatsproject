# Capstone 8 — Cross-language challenge

> Produce the same analysis in SAS, R and Python — then explain every difference between them.

**Difficulty:** expert · **Estimated effort:** 10 hours

---

## Objective

Take one analysis — the PFS survival summary and a laboratory change-from-baseline summary — and implement it three
times: SAS, R and Python.

Then do the part that matters: reconcile the outputs. Where they differ, find out whether it is a default, a
definition or a bug.

## Why this matters

Teams increasingly use more than one language, and the person who can explain why PROC PHREG and coxph disagree by
0.005, or why a median differs between SAS and R, becomes the person others bring their discrepancies to.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/adam/adsl` | `data/oncology/` — see that study's `manifest.json` for adam/adsl |
| `oncology/adam/adtte` | `data/oncology/` — see that study's `manifest.json` for adam/adtte |
| `oncology/adam/adlb` | `data/oncology/` — see that study's `manifest.json` for adam/adlb |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- Three implementations producing the same summary statistics and model results.
- A reconciliation table: statistic, SAS value, R value, Python value, difference, cause.
- A short write-up of the default differences you found (ties handling, quantile definitions, CI transformations, rounding).

---

## Steps

### 1. Implement the analysis three times

Write each implementation independently rather than translating line by line — translation hides the semantic
differences you are trying to find.

**Done when:** Three programs that run and produce the statistics.

### 2. Reconcile the numbers

Compare to at least four decimal places. Do not stop at "close enough": small differences usually have specific,
nameable causes.

**Done when:** A reconciliation table with every difference explained.

### 3. Catalogue the defaults

Document the defaults that bit you: Efron vs Breslow ties, quantile definition (SAS QNTLDEF=5 vs R type 7),
log-log vs log confidence intervals for survival, rounding half away from zero vs half to even, and how missing
values are handled in each language.

**Done when:** A reference note you would actually reuse at work.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Equivalence | The three implementations answer the same question on the same population. |
| Reconciliation depth | Differences are explained by mechanism, not dismissed. |
| Reusability | The defaults note is concrete enough to be useful on a real project. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
08-cross-language/
  README.md          this brief
  r/              your R code
  python/         your Python code
  sas/            your SAS code
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
```

Work in `r/`, `python/`, `sas/` as the deliverables require.

`output/` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

Educational triple implementation of a clinical analysis in SAS, R and Python with a documented reconciliation of differences.

Suggested repository name: `sas-r-python-reconciliation`

**State the limitations honestly.** Copy this into your README:

> Synthetic data; SAS results were produced in a separate SAS environment and are not reproducible inside this
> training application.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
