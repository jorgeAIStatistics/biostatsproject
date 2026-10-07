# Capstone 2 — SDTM mapping project

> Map cleaned raw data into SDTM-style DM, AE, EX, LB and VS domains, with a mapping specification and conformance checks.

**Difficulty:** advanced · **Estimated effort:** 14 hours

---

## Objective

Take the raw exports and produce SDTM-style DM, AE, EX, LB and VS datasets: correct structure, correct keys,
ISO 8601 dates, controlled terminology, standardized units and study days — together with the mapping
specification that documents how each variable was derived.

Compare your output with the reference SDTM in `data/oncology/sdtm/`, and explain every difference. Some will be
your errors; some will be legitimate alternative decisions that your specification must justify.

## Why this matters

Mapping is the daily work of a clinical statistical programmer at a CRO. Being able to show your own SDTM mapping,
with a specification and a conformance discussion, is the single most convincing artifact for a first programming role.

---

## Data

Everything is **synthetic**. Read the `README.md` and `manifest.json` in each study folder before you
start — they document every column, its origin and its derivation.

| Dataset id | Where it lives |
|---|---|
| `oncology/raw/demographics` | `data/oncology/` — see that study's `manifest.json` for raw/demographics |
| `oncology/raw/ae` | `data/oncology/` — see that study's `manifest.json` for raw/ae |
| `oncology/raw/labs` | `data/oncology/` — see that study's `manifest.json` for raw/labs |
| `oncology/raw/vitals` | `data/oncology/` — see that study's `manifest.json` for raw/vitals |
| `oncology/sdtm/dm` | `data/oncology/` — see that study's `manifest.json` for sdtm/dm |
| `oncology/sdtm/ae` | `data/oncology/` — see that study's `manifest.json` for sdtm/ae |

Regenerate any study from scratch with `npm run data`.

---

## Deliverables

- Programs that build DM, AE, EX, LB and VS from the raw files.
- A variable-level mapping specification (source variable, rule, controlled terminology, origin).
- A conformance summary: keys unique, required variables present, dates ISO 8601, --DY consistent with RFSTDTC, CT values valid.
- A difference report against the reference SDTM with an explanation for each difference.

---

## Steps

### 1. Write the specification first

For each target domain, list every variable you will create, its source, the transformation rule, the
controlled terminology codelist and the origin (Collected, Derived, Assigned, Predecessor).

Use `python3 scripts/tools/ct_lookup.py <CODELIST>` to confirm codelist values rather than inventing them.

**Done when:** A specification table exists for every domain you will build.

### 2. Build DM

One record per subject. Construct USUBJID consistently, derive the reference dates (RFSTDTC, RFXSTDTC,
RFXENDTC, RFICDTC, RFENDTC), map ARM/ARMCD/ACTARM/ACTARMCD, and handle the subjects who are screen failures or
were randomized but never treated with ARMNRS instead of inventing arm values.

**Done when:** DM has exactly one row per subject and your screen-failure and never-treated handling matches your specification.

### 3. Build AE

Preserve the verbatim term, attach the coded term and body system, map seriousness criteria and action taken to
controlled terminology, keep partial dates as partial ISO 8601, derive AESTDY/AEENDY against RFSTDTC, and set
AESEQ deterministically.

**Done when:** AE passes your key-uniqueness and CT checks, and partial dates survive unchanged.

### 4. Build LB and VS

The lab file arrives long; the vitals form arrives wide. Transpose what needs transposing, map vendor test codes
to CDISC LBTESTCD, standardize units into --STRESN/--STRESU with documented factors, and carry the original
result in --ORRES/--ORRESU.

Derive the baseline-related flag your specification chose (--LOBXFL in SDTMIG v3.4) and say why.

**Done when:** LB and VS have one record per test per visit, with both original and standardized results.

### 5. Run conformance checks and compare

Check: keys unique, no missing required variables, dates parseable, --DY never zero, CT values valid, subject
sets consistent across domains.

Then compare with the reference SDTM domain by domain and classify each difference as an error, a specification
difference or a tie-breaking choice.

**Done when:** A difference report exists where every line has an explanation.

---

## How you will be assessed

| Criterion | What good looks like |
|---|---|
| Structure | Each domain has the right grain, keys and required variables. |
| Terminology | Values come from the correct codelists; extensions are justified. |
| Dates | ISO 8601 throughout, partial dates preserved, study days correct with no day zero. |
| Specification quality | Another programmer could rebuild your datasets from the specification alone. |
| Difference analysis | Differences from the reference are identified and explained rather than hidden. |

---

## Suggested layout

This folder is a starting point, not a cage. Rearrange it if you have a better idea — but keep the
pipeline **rerunnable from scratch with no manual steps**, because that is what is being assessed.

```
02-sdtm-mapping/
  README.md          this brief
  python/         your Python code
  output/            tables, figures and datasets your code writes
  notes.md           decisions, assumptions, and anything you had to guess
```

Work in `python/` as the deliverables require.

`output/` is git-ignored: everything in it must be reproducible by rerunning your code. If something
in there cannot be regenerated, it belongs in version control instead.

---

## If you publish this

Educational SDTM-style mapping of synthetic eCRF and vendor data, with a variable-level specification and conformance checks.

Suggested repository name: `sdtm-style-mapping`

**State the limitations honestly.** Copy this into your README:

> Built on synthetic data for teaching. Not a submission package: no Define-XML, no full conformance-rule engine
> (e.g. Pinnacle 21), and domain coverage is limited to the five domains listed.

Do not describe this work as submission-ready, validated, GMP-compliant or FDA-anything. It is a
teaching exercise on synthetic data, and saying so plainly is more impressive to an interviewer than
overclaiming.

---

<sub>Generated from `content/capstones/capstones.yaml` by `scripts/tools/gen-capstone-starters.ts`.
Edit the YAML, not this file — `npm run capstones` overwrites it.</sub>
