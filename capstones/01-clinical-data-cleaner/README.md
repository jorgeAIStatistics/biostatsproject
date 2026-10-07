# Capstone 1 — Clinical data cleaner

> Turn messy raw CRF and vendor exports into validated, documented datasets with an issue report a data manager could act on.

**Difficulty:** intermediate · **Estimated effort:** 10 hours

---

## Objective

The CBX417-301 raw exports contain the kinds of problems every study has: duplicate rows, impossible dates, mixed
units, inconsistent coding of sex and treatment, partial dates, subjects present in one source but not another,
outliers that are data-entry errors and outliers that are real.

Your job is to produce (a) a cleaned dataset for each raw file, (b) a machine-readable issue report listing every
problem you found — file, record id, variable, issue type, raw value, proposed resolution — and (c) a short memo
that a data manager could use to raise queries.

You must not silently "fix" anything: every change is recorded, and anything that needs a site's answer stays
flagged rather than guessed.

## Why this matters

Data cleaning is the first task most junior programmers are given, and the one where careless work does the most
damage. Being able to show a reproducible cleaning pipeline with a documented issue log is a direct signal that you
can be trusted with study data.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/raw/demographics` | `data/oncology/` — see that study's `manifest.json` for raw/demographics |
| `oncology/raw/labs` | `data/oncology/` — see that study's `manifest.json` for raw/labs |
| `oncology/raw/ae` | `data/oncology/` — see that study's `manifest.json` for raw/ae |
| `oncology/raw/vitals` | `data/oncology/` — see that study's `manifest.json` for raw/vitals |
| `oncology/raw/randomization` | `data/oncology/` — see that study's `manifest.json` for raw/randomization |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- A script (Python, R or SAS) that reads the raw files and writes cleaned versions — rerunnable from scratch, no manual edits.
- `issues.csv` with one row per detected problem (file, record id, variable, issue type, raw value, proposed resolution).
- A one-page memo summarizing the issues by type and severity, with the three you would escalate first.
- A short README describing how to run the pipeline and what "clean" means for each file.

---

## Steps

### 1. Inventory the raw data

Open every file in `data/oncology/raw/` in the dataset viewer. For each one write down: the grain (what is one
row?), the key, the date columns and their format, and any column whose values look inconsistent.

Record counts matter: note how many rows and how many distinct subjects each file has. You will use these
numbers later to prove that your cleaning did not lose anyone.

**Done when:** You can state the grain and key of every raw file, and the subject counts per file.

### 2. Write the validation rules before writing code

List the checks you will run, in plain language, grouped by type: structural (duplicate keys, orphan records),
format (dates, numeric fields stored as text), range (implausible values), consistency (end date before start
date, AE starting before consent), cross-file (randomized subjects with no exposure; exposure with no
randomization; kit numbers not in the kit list).

For each rule decide in advance: is a failure a *query* (ask the site) or a *derivation* (handled in the
mapping)? That distinction is the difference between cleaning and inventing data.

**Done when:** A written rule list where every rule has an owner — query or derivation.

### 3. Implement the checks

Write the pipeline. Structure it so each rule is a small function returning the offending rows, and the main
script collects them into one issue table. Keep a `RECORD_ID` on every issue so it can be traced back.

Resist the temptation to drop rows quietly. The cleaned output should keep everything that is usable and mark
the rest.

**Done when:** Running the script on a fresh checkout reproduces `issues.csv` byte-for-byte.

### 4. Handle units and coding properly

The lab file mixes conventional and SI units and some rows have no unit at all; vitals include temperatures in
°F and weights in lb; sex is coded five different ways.

Convert with explicit, documented factors (e.g. creatinine mg/dL × 88.4 → µmol/L), never by guessing from the
magnitude alone — and flag rows where the unit is missing rather than assuming.

**Done when:** A conversion table appears in your README, and no converted value is produced without a unit.

### 5. Write the memo

Summarize: how many issues of each type, which subjects are affected, which three issues block analysis, and
what you need from the sites. Write it for a data manager, not for a programmer.

Then compare your issue list with `data/oncology/answer-key/data_issues.csv`. Note what you missed and why —
the miss pattern is more informative than the score.

**Done when:** Memo written, and you have compared against the answer key and noted the gaps.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Reproducibility | The pipeline runs end-to-end from raw files with no manual steps; outputs are identical on a rerun. |
| Completeness | Every injected issue type is detected, with few false positives on values that are genuinely extreme but valid. |
| Traceability | Every issue points at a specific file, record id and variable; every correction is recorded. |
| Judgement | Queries and derivations are correctly separated; nothing is silently imputed. |
| Communication | The memo is readable by a non-programmer and prioritizes correctly. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
01-clinical-data-cleaner/
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

Educational implementation of a clinical data-cleaning and query-generation pipeline using synthetic CRF exports.

Suggested repository name: `clinical-data-cleaning-pipeline`

**State the limitations honestly.** Copy this into your README:

> The data is synthetic and the issue set was generated deliberately, so detection rates here do not transfer to
> real studies. No query management system, audit trail or database lock process is simulated.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
