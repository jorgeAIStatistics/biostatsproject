# Capstone 3 — ADaM analysis datasets

> Derive ADSL, ADAE and ADLB from SDTM with explicit, traceable derivations and QC of every flag.

**Difficulty:** advanced · **Estimated effort:** 14 hours

---

## Objective

Build ADSL (one row per randomized subject, with treatment variables, dates, population flags and baseline
covariates), ADAE (treatment-emergent flags, imputed analysis dates, first-occurrence flags) and ADLB (parameters,
baseline, change from baseline, analysis flags, toxicity grades).

Every derived variable must have a written rule, and every rule must be checked — by an independent method, not by
rerunning your own code.

## Why this matters

ADaM is where statistical thinking and programming meet: the flags you derive determine which subjects appear in
which table. Interviewers ask about TRTEMFL, ABLFL and population flags precisely because they separate people who
have done the work from people who have read about it.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/sdtm/dm` | `data/oncology/` — see that study's `manifest.json` for sdtm/dm |
| `oncology/sdtm/ex` | `data/oncology/` — see that study's `manifest.json` for sdtm/ex |
| `oncology/sdtm/ae` | `data/oncology/` — see that study's `manifest.json` for sdtm/ae |
| `oncology/sdtm/lb` | `data/oncology/` — see that study's `manifest.json` for sdtm/lb |
| `oncology/adam/adsl` | `data/oncology/` — see that study's `manifest.json` for adam/adsl |
| `oncology/adam/adae` | `data/oncology/` — see that study's `manifest.json` for adam/adae |
| `oncology/adam/adlb` | `data/oncology/` — see that study's `manifest.json` for adam/adlb |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- Programs producing ADSL, ADAE and ADLB from SDTM.
- A derivation specification for every variable you create.
- A QC report comparing your datasets with the reference ADaM (`PROC COMPARE`-style: observations, variables, value differences).
- A short note on the three derivations that were hardest to get right and why.

---

## Steps

### 1. ADSL — populations and treatment

Derive TRT01P/TRT01A (and explain the three subjects where they differ), TRTSDT/TRTEDT from EX, treatment
duration, ITTFL, SAFFL, EFFFL and PPROTFL.

Write the population definitions in words first. Then count: your ITT, safety and efficacy counts must match the
study facts (420 / 416 / see the study README) or you have a bug — or a better definition you must justify.

**Done when:** Population counts reconcile, and the planned-vs-actual treatment logic is documented.

### 2. ADAE — treatment-emergent

Implement the TEAE definition from the SAP, including the partial-date imputation rules, and derive the
first-occurrence flags.

Prove your flag: list the subjects whose AE start date is within a day of the treatment window boundary and check
each one by hand.

**Done when:** TEAE counts match the reference within your documented differences, and boundary cases are verified individually.

### 3. ADLB — baseline and change

Build the BDS structure (PARAMCD/PARAM, AVAL, AVISIT), select baseline with the SAP rule, derive BASE, CHG and
PCHG, add reference ranges and CTCAE-style grades, and set the analysis flag for the record used per visit.

Check for subjects with more than one candidate baseline record and confirm your tie-breaker behaves.

**Done when:** Exactly one ABLFL per subject and parameter where a baseline exists; CHG = AVAL − BASE everywhere.

### 4. QC against the reference

Compare your datasets with `data/oncology/adam/`. Classify differences: value differences, extra/missing
records, attribute differences.

For each difference decide whether the reference or your version is right, and write the finding as you would in
a QC log: what differs, why, what you changed.

**Done when:** A QC log exists with a resolution for every difference.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Correct flags | Population, treatment-emergent, baseline and analysis flags follow the stated rules exactly. |
| Traceability | Source variables are carried (SRCDOM/SRCVAR/SRCSEQ or equivalent) so any value can be traced to SDTM. |
| Independent QC | Differences are found by an independent method and documented, not by rerunning the same code. |
| Specification | Derivations are written clearly enough for a QC programmer to reproduce them. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
03-adam-analysis/
  README.md          this brief
  sas/            your SAS code
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
```

Work in `sas/` as the deliverables require.

`output/` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

Educational ADaM-style derivation (ADSL, ADAE, ADLB) from synthetic SDTM data, with independent QC.

Suggested repository name: `adam-derivation-and-qc`

**State the limitations honestly.** Copy this into your README:

> Synthetic data; no Define-XML or ADRG is produced, and the QC is a single-programmer exercise rather than a
> two-programmer process with sign-off.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
