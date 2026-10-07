## What problem are we trying to solve?

A safety reviewer asks: *"How many subjects had a low creatinine?"*

You filter `LBTESTCD = "CREAT"` and `LBNRIND = "LOW"` and get 233 records. Then you look at one of them
and it stops you:

```text
LBORRES   = 0.69        LBORRESU  = mg/dL
LBSTRESN  = 61          LBSTRESU  = umol/L
LBSTNRLO  = 61.9        LBSTNRHI  = 106.1
LBNRIND   = LOW
```

The site reported **0.69 mg/dL**, which is a normal creatinine anywhere in the world. The record says
`LOW`. Both statements are correct.

The laboratory that ran it — a local laboratory at site 1033 — reported in mg/dL against a reference
range of 0.70 to 1.20 mg/dL. Converted to the study's standard unit, 0.69 mg/dL is 61.0 µmol/L and the
range becomes 61.9 to 106.1 µmol/L. **The value is 0.9 µmol/L below the lower limit**, and it was
0.01 mg/dL below in the original units too. Nothing went wrong; you are simply reading a converted
number against a converted range.

::dataset{id="oncology/sdtm/lb" cols="USUBJID,LBTESTCD,LBORRES,LBORRESU,LBORNRLO,LBORNRHI,LBSTRESC,LBSTRESN,LBSTRESU,LBSTNRLO,LBSTNRHI,LBNRIND,LBNAM" filter="LBORRESU=mg/dL" rows="8" caption="LB — eight records where the original and standard units differ"}

**`LB` is the domain where the Findings result pair matters most**, because 25,450 results arrive from
four laboratories in seven units, and every one of them has to end up comparable without losing what was
reported.

## Intuition

Every Findings record has **two results**, and they answer different questions:

| | Question |
|---|---|
| `--ORRES` / `--ORRESU` | What did the source report, in the units it used? |
| `--STRESC` / `--STRESN` / `--STRESU` | What is that in the study's standard units? |

Keeping both is not redundancy. It is the difference between a dataset you can analyse and a dataset you
can audit.

- **Analysis needs one unit.** You cannot compute a mean over a column that mixes mg/dL and µmol/L.
- **Verification needs the original.** A reviewer, or a data manager chasing a query with the
  laboratory, needs the number the laboratory actually printed on its report.

:::why[Why three standard-result variables and only one original?]
Because standard results can be numeric or not.

`--STRESC` is **character** and always populated. `--STRESN` is **numeric** and populated only when the
standardized result is a number.

A laboratory result of `2.06` gives `LBSTRESC = "2.06"` and `LBSTRESN = 2.06`. A result of `NEGATIVE`
gives `LBSTRESC = "NEGATIVE"` and a null `LBSTRESN`. In a domain with both — a urinalysis panel, or an
ECG interpretation — the character variable holds everything and the numeric variable holds what you can
average.

CBX417-301's `LB` is all quantitative, so `LBSTRESC` and `LBSTRESN` agree everywhere. Its **`EG`**
domain is the instructive contrast: `EGSTRESC` holds `NORMAL` or `ABNORMAL` for the 1,867
interpretation records, and `EGSTRESN` is null for every one of them.
:::

## Clinical context

CBX417-301's laboratory panel, and where each value comes from:

| `LBTESTCD` | `LBTEST` | `LBCAT` | `LBSPEC` | Records | Standard unit |
|---|---|---|---|---:|---|
| `ALT` | Alanine Aminotransferase | CHEMISTRY | SERUM | 3,409 | U/L |
| `AST` | Aspartate Aminotransferase | CHEMISTRY | SERUM | 3,409 | U/L |
| `BILI` | Bilirubin | CHEMISTRY | SERUM | 3,409 | µmol/L |
| `CREAT` | Creatinine | CHEMISTRY | SERUM | 3,409 | µmol/L |
| `HGB` | Hemoglobin | HEMATOLOGY | BLOOD | 3,938 | g/L |
| `NEUT` | Neutrophils | HEMATOLOGY | BLOOD | 3,938 | 10^9/L |
| `PLAT` | Platelets | HEMATOLOGY | BLOOD | 3,938 | 10^9/L |

:::standard{kind="official"}
`LBTESTCD` uses the NCI/CDISC codelist **LBTESTCD (C65047)**, extensible, with 2,505 published terms;
`LBTEST` uses **LBTEST (C67154)**. All seven test codes here are published terms. `LBORRESU` and
`LBSTRESU` use **UNIT (C71620)**, extensible, and all seven units used here are published. `LBNRIND`
uses **NRIND (C78736)**, extensible, publishing `NORMAL`, `HIGH`, `LOW` and `ABNORMAL`. `LBSTAT` uses
**ND (C66789)**, non-extensible, with a single value: `NOT DONE`. `LBSPEC` uses **SPECTYPE (C78734)**.
:::

### The vendor sends its own codes

`raw/labs.csv` does not contain `LBTESTCD`. It contains the laboratory's internal codes:

| `VENDOR_TEST_CODE` | `TEST_NAME` | Source | `LBTESTCD` |
|---|---|---|---|
| `CH010` | ALT (SGPT) | CENTRAL | `ALT` |
| `CH011` | AST (SGOT) | CENTRAL | `AST` |
| `CH020` | Bilirubin, Total | CENTRAL | `BILI` |
| `CH030` | Creatinine | CENTRAL | `CREAT` |
| `HE001` | Hemoglobin | CENTRAL | `HGB` |
| `HE010` | Absolute Neutrophil Count | CENTRAL | `NEUT` |
| `HE020` | Platelet Count | CENTRAL | `PLAT` |
| `L-ALT` | Alanine transaminase | LOCAL | `ALT` |
| `L-ANC` | Neutrophils, absolute | LOCAL | `NEUT` |
| `L-AST` | Aspartate transaminase | LOCAL | `AST` |
| `L-CREA` | Creatinine, serum | LOCAL | `CREAT` |
| `L-HGB` | Haemoglobin | LOCAL | `HGB` |
| `L-PLT` | Platelets | LOCAL | `PLAT` |
| `L-TBIL` | Total bilirubin | LOCAL | `BILI` |

**Fourteen source codes, seven test codes.** The central laboratory's seven and a local-laboratory set
that uses different codes, different test names and UK spelling (`Haemoglobin`).

:::mistake[Mapping on the test name instead of the vendor code]
`Hemoglobin` and `Haemoglobin` are the same test spelled differently. `ALT (SGPT)` and
`Alanine transaminase` are the same test named differently. The **code** is the stable key; the name is
free text that varies between laboratories and sometimes between transfers from the same laboratory.

The mapping table lives in the SDTM specification, it is reviewed by someone clinical, and it is the
first thing to check when a test is missing from an output — a new vendor code appearing mid-study is
routine, and a mapping that silently drops unmatched codes loses results without complaining.
:::

### Four laboratories

| `LBNAM` | Records |
|---|---:|
| `CENTRAL LAB` | 25,320 |
| `LOCAL LAB (SITE 1005)` | 63 |
| `LOCAL LAB (SITE 1001)` | 44 |
| `LOCAL LAB (SITE 1033)` | 23 |

130 of 25,450 records — half a percent — come from three local laboratories, and they are the source of
almost every unit conversion and every non-standard reference range in the domain. **Local laboratory
results are a small fraction of the data and a large fraction of the problems**, which is why `LBNAM` is
worth carrying and worth looking at first when something is odd.

## Formal concept

### Unit conversion, and why the reference range converts with it

::::tabs
:::tab[What gets converted]
| Test | Original | Standard | Factor | Example |
|---|---|---|---|---|
| `BILI` | mg/dL | µmol/L | × 17.104 | 0.5 → 8.6 |
| `CREAT` | mg/dL | µmol/L | × 88.4 | 0.55 → 48.6 |
| `HGB` | g/dL | g/L | × 10 | 14.1 → 141 |
| `NEUT` | 10^3/µL | 10^9/L | × 1 | 2.06 → 2.06 |
| `PLAT` | 10^3/µL | 10^9/L | × 1 | 213 → 213 |
| `ALT`, `AST` | U/L | U/L | × 1 | unchanged |
:::

:::tab[Records affected]
| Test | Original unit | Records |
|---|---|---:|
| `BILI` | mg/dL | 4 |
| `CREAT` | mg/dL | 4 |
| `HGB` | g/dL | 38 |
| `NEUT` | 10^3/µL | 38 |
| `PLAT` | 10^3/µL | 38 |

122 records out of 25,450. Every one of them is from a local laboratory.

Plus **7 records with no unit at all** in the raw export — a missing-unit problem that has to be
resolved before the value can be converted, because a bilirubin of `0.5` means completely different
things in mg/dL and µmol/L.
:::
::::

:::number[The trap: NEUT and PLAT convert by a factor of 1]
`10^3/µL` and `10^9/L` are numerically identical. 2.06 × 10^3 cells per µL is 2.06 × 10^9 cells per
litre — the unit changes and the number does not.

This is the conversion most likely to be got wrong, **because getting it wrong produces a plausible
number.** Multiply by 1,000 and a neutrophil count of 2.06 becomes 2,060, which is not obviously absurd
to someone unfamiliar with the units and would be graded as a wildly abnormal value.

The defence is not arithmetic care. It is a **range check after conversion**: every standardized result
should fall in a plausible physiological interval for its test, and a conversion error puts a whole
laboratory's worth of results three orders of magnitude outside it at once.
:::

**The reference range converts too, and this is the part that surprises people.** `LBORNRLO`/`LBORNRHI`
are the laboratory's range in its own units; `LBSTNRLO`/`LBSTNRHI` are that range in standard units. Both
pairs are stored.

You cannot compare a converted result against an unconverted range, and you cannot compare a result
against a *different laboratory's* range. Which is why this happens:

| `LBTESTCD` | `SEX` | `LBSTNRLO` | `LBSTNRHI` | Records |
|---|---|---:|---:|---:|
| `ALT` | F | 7 | 35 | 1,364 |
| `ALT` | M | 10 | 50 | 2,041 |
| `AST` | F | 13 | 35 | 1,364 |
| `AST` | M | 15 | 40 | 2,041 |
| `CREAT` | F | 44 | 80 | 1,364 |
| `CREAT` | M | 62 | 106 | 2,041 |
| `HGB` | F | 120 | 155 | 1,560 |
| `HGB` | M | 130 | 175 | 2,340 |

**Four of the seven tests have sex-specific reference ranges.** `BILI`, `NEUT` and `PLAT` do not.

:::why[Why does that matter beyond LB?]
Because `LBNRIND` — and anything derived from it — depends on the subject's sex being right.

Recall that `SEX` arrived from the EDC in nine spellings including the numeric codes `1` and `2`. If
that mapping had been reversed, 11 subjects would have the wrong sex, and every one of their ALT, AST,
creatinine and haemoglobin results would be compared against the wrong reference range.

The failure would be invisible: no value changes, no unit changes, no conformance check fires.
`LBNRIND` simply comes out wrong on four tests for eleven subjects, and a shift table built from it is
wrong in a way nobody can see.

**This is what "everything is connected" means in practice.** A demographics mapping decision propagates
into a laboratory safety table through a reference range.
:::

### LBNRIND is a flag, not a grade

| `LBNRIND` | Records |
|---|---:|
| `NORMAL` | 20,908 |
| `LOW` | 3,637 |
| `HIGH` | 898 |
| *(null)* | 7 |

`LBNRIND` says only whether the value is inside the laboratory's reference interval. It is **not** a
toxicity grade, and 3,637 low values does not mean 3,637 toxicities — 2,782 of them are haemoglobin,
which is unsurprising in a chemotherapy population where mild anaemia is near-universal.

:::standard{kind="official"}
`LBNRIND` ("Reference Range Indicator") uses **NRIND (C78736)** and indicates the result's position
relative to the reference range only. **CTCAE grading is not an SDTM variable.** Toxicity grades for
laboratory values are derived in ADaM — `ADLB.ATOXGRN` in this study — because grading requires
criteria the laboratory range cannot supply, and the grading version is a SAP decision.
:::

:::standard{kind="simplification"}
CBX417-301's ADaM laboratory grading follows CTCAE v5 thresholds but always compares against the normal
range, **not** the CTCAE rules for subjects whose baseline is already abnormal. Real CTCAE grading of,
for example, an ALT increase in a subject with an elevated baseline uses a multiple of the subject's own
baseline rather than the upper limit of normal. The study's README labels this as an educational
simplification.
:::

### Records that were not done

```text
LBSTAT   = "NOT DONE"
LBREASND = "SAMPLE HEMOLYZED"   (4 records)   or   "SAMPLE CLOTTED"   (3 records)
LBORRES  = (null)   LBSTRESC = (null)   LBSTRESN = (null)
```

Seven records with `LBSTAT = "NOT DONE"`. **The record exists even though the result does not**, and
that is deliberate: the test was scheduled and ordered, and the record documents why there is no value.
Omitting the row would be indistinguishable from the test never having been scheduled.

## Worked example

`LBLOBXFL` — the last observation before first exposure — and the two subjects who do not have one.

::dataset{id="oncology/sdtm/lb" cols="USUBJID,LBTESTCD,VISIT,LBDTC,LBDY,LBORRES,LBSTRESN,LBSTRESU,LBNRIND,LBSTAT,LBLOBXFL" filter="USUBJID=CBX417-301-1010-0001" rows="10" caption="LB for one subject — note the two NOT DONE haemoglobin records at the start"}

:::standard{kind="official"}
`--LOBXFL` ("Last Observation Before Exposure Flag") is populated `Y` on the **last non-missing
observation before the first study treatment**, for each subject and test. It is an SDTM variable
determined by the data and the exposure dates. It is **not** ADaM's `ABLFL`, which flags the record the
statistical analysis plan treats as baseline. CBX417-301 does not populate `--BLFL`, which is
Permissible in SDTMIG v3.4, and makes the baseline choice explicitly in ADaM instead.
:::

:::number[2,910 flags, and why it is not 2,912]
416 treated subjects × 7 tests would be **2,912**. The domain has **2,910**.

| `LBTESTCD` | Flagged |
|---|---:|
| `AST`, `BILI`, `CREAT`, `NEUT`, `PLAT` | 416 each |
| `ALT` | **415** |
| `HGB` | **415** |

Two subject-and-test combinations have no pre-exposure observation at all, and both have the same cause:

| Subject | Test | Screening | Cycle 1 Day 1 |
|---|---|---|---|
| `CBX417-301-1019-0002` | `ALT` | `NOT DONE` — sample haemolysed | `NOT DONE` — sample haemolysed |
| `CBX417-301-1010-0001` | `HGB` | `NOT DONE` — sample clotted | `NOT DONE` — sample clotted |

Both pre-dose draws failed, for the same test, for the same reason. There is no non-missing observation
before first exposure, so there is nothing to flag — and `--LOBXFL` correctly has no `Y`.

**This is exactly the 0.07% of subjects that a baseline derivation has to handle.** A program that
assumes every subject has a baseline for every parameter will produce a null change-from-baseline for
these two, or crash, or — worst — silently pick the first *post*-dose value. The four `NOT DONE` records
are the evidence that the absence is real and not a programming failure, which is the whole reason for
keeping them.
:::

### The conversion, in code

::::tabs
:::tab[SAS]
```sas
proc format;
  value $lbtest 'CH010','L-ALT'  = 'ALT'   'CH011','L-AST'  = 'AST'
                'CH020','L-TBIL' = 'BILI'  'CH030','L-CREA' = 'CREAT'
                'HE001','L-HGB'  = 'HGB'   'HE010','L-ANC'  = 'NEUT'
                'HE020','L-PLT'  = 'PLAT';
run;

data lb;
  set raw.labs;
  length lbtestcd $8 lbstresu $12;

  lbtestcd = put(vendor_test_code, $lbtest.);
  if lbtestcd = '' then put 'ERROR: unmapped vendor code ' vendor_test_code=;

  lborres  = result;
  lborresu = unit;

  select (catx('|', lbtestcd, unit));
    when ('BILI|mg/dL')     do; _f = 17.104; lbstresu = 'umol/L'; end;
    when ('CREAT|mg/dL')    do; _f = 88.4;   lbstresu = 'umol/L'; end;
    when ('HGB|g/dL')       do; _f = 10;     lbstresu = 'g/L';    end;
    when ('NEUT|10^3/uL',
          'PLAT|10^3/uL')   do; _f = 1;      lbstresu = '10^9/L'; end;
    otherwise               do; _f = 1;      lbstresu = unit;     end;
  end;

  lbstresn = input(result, ?? best.) * _f;
  lbstnrlo = input(ref_low,  ?? best.) * _f;
  lbstnrhi = input(ref_high, ?? best.) * _f;
  lbstresc = strip(put(lbstresn, best.));

  if      lbstresn = .        then lbnrind = '';
  else if lbstresn < lbstnrlo then lbnrind = 'LOW';
  else if lbstresn > lbstnrhi then lbnrind = 'HIGH';
  else                             lbnrind = 'NORMAL';

  drop _:;
run;
```

:::lines
14: The `SELECT` keys on **test and unit together**, because the factor depends on both. A conversion table keyed on unit alone would apply the creatinine factor to a bilirubin in mg/dL.
19: `NEUT` and `PLAT` get an explicit factor of 1 rather than falling through to `otherwise`. Writing it out makes the reader confirm it is deliberate; leaving it implicit is how a later edit turns it into 1,000.
24: The **reference range is converted with the same factor**. This is the line most often missing, and its absence produces the failure in the opening example in reverse: a converted result compared against an unconverted range, flagging normal values as abnormal by a factor of 88.
28: `LBNRIND` is derived **after** conversion, from the standardized result and the standardized range. Deriving it from the original pair would also be correct and would give the same answer; deriving it from one of each would not.
11: `put 'ERROR: ...'` on an unmapped vendor code. A new code appearing mid-study is routine and a mapping that silently returns blank loses results without complaining.
:::
:::

:::tab[R]
```r
library(dplyr)

testcd <- c(CH010 = "ALT",  `L-ALT`  = "ALT",   CH011 = "AST",  `L-AST`  = "AST",
            CH020 = "BILI", `L-TBIL` = "BILI",  CH030 = "CREAT", `L-CREA` = "CREAT",
            HE001 = "HGB",  `L-HGB`  = "HGB",   HE010 = "NEUT", `L-ANC`  = "NEUT",
            HE020 = "PLAT", `L-PLT`  = "PLAT")

conv <- tribble(
  ~LBTESTCD, ~LBORRESU,  ~factor, ~LBSTRESU,
  "BILI",    "mg/dL",     17.104, "umol/L",
  "CREAT",   "mg/dL",     88.4,   "umol/L",
  "HGB",     "g/dL",      10,     "g/L",
  "NEUT",    "10^3/uL",   1,      "10^9/L",
  "PLAT",    "10^3/uL",   1,      "10^9/L"
)

lb <- raw_labs |>
  mutate(LBTESTCD = unname(testcd[VENDOR_TEST_CODE]),
         LBORRES  = RESULT,
         LBORRESU = UNIT) |>
  { \(d) { stopifnot(!any(is.na(d$LBTESTCD))); d } }() |>
  left_join(conv, by = c("LBTESTCD", "LBORRESU")) |>
  mutate(
    factor   = coalesce(factor, 1),
    LBSTRESU = coalesce(LBSTRESU, LBORRESU),
    LBSTRESN = as.numeric(LBORRES)  * factor,
    LBSTNRLO = as.numeric(REF_LOW)  * factor,
    LBSTNRHI = as.numeric(REF_HIGH) * factor,
    LBSTRESC = as.character(LBSTRESN),
    LBNRIND  = case_when(
      is.na(LBSTRESN)          ~ NA_character_,
      LBSTRESN < LBSTNRLO      ~ "LOW",
      LBSTRESN > LBSTNRHI      ~ "HIGH",
      TRUE                     ~ "NORMAL")
  )
```

:::lines
6: The conversion table is keyed on **test and original unit**, so a lookup miss means "no conversion needed" rather than "wrong factor applied".
21: The assertion on unmapped vendor codes, before anything downstream depends on `LBTESTCD`.
25: `coalesce(factor, 1)` handles the unmatched rows — results already in the standard unit — which is the large majority.
29: Range and result multiplied by the same factor, on adjacent lines, so a reader can see that they match.
33: `LBNRIND` derived from the standardized pair, with the null case first so that a `NOT DONE` record gets a null indicator rather than being classified.
:::
:::
::::

## Data example

The 130 local-laboratory records are half a percent of the domain and carry most of its irregularity:

::dataset{id="oncology/sdtm/lb" cols="USUBJID,LBNAM,LBTESTCD,LBORRES,LBORRESU,LBORNRLO,LBORNRHI,LBSTRESN,LBSTRESU,LBSTNRLO,LBSTNRHI,LBNRIND" filter="LBNAM~LOCAL" rows="10" caption="LB — local laboratory results, with their own units and their own reference ranges"}

Three kinds of irregularity live in these rows:

1. **Different units** — mg/dL, g/dL, 10^3/µL — needing conversion.
2. **Different reference ranges in the same units.** A local laboratory's creatinine range is 61.9 to
   106.1 µmol/L where the central laboratory's is 62 to 106. Both are that laboratory's own validated
   range and neither is wrong; ranges are laboratory-specific and **must not be overwritten with the
   central laboratory's**.
3. **UK spelling and different test names**, which is why the mapping keys on the vendor code.

:::why[Why keep both ranges at all? Why not just standardise everything to the central laboratory's?]
Because the reference range is a statement about the assay, not about the analyte.

Two laboratories measuring creatinine with different instruments and different calibrators genuinely
have different normal intervals for their own populations and methods. Replacing a local laboratory's
range with the central laboratory's would assert that its results should be interpreted against an
interval its assay was never validated for.

That has a visible consequence in the analysis, and it is why some SAPs specify that **only central
laboratory results are used for the primary laboratory analysis**, with local results listed separately.
CBX417-301 carries all of them in `LB` — as it must, since they were collected — and the decision about
which feed which analysis belongs to ADaM.
:::

## Common mistakes

:::mistake[Converting the result and not the reference range]
`LBSTNRLO` and `LBSTNRHI` are the *converted* range. A converted creatinine of 61.0 µmol/L compared
against an unconverted range of 0.70 to 1.20 would be flagged `HIGH` by a factor of fifty. Multiply both
with the same factor, on adjacent lines.
:::

:::mistake[Overwriting a local laboratory's reference range with the central laboratory's]
Ranges are laboratory-specific and assay-specific. The local range of 61.9 to 106.1 µmol/L is that
laboratory's validated interval. If the analysis needs one range, that is an ADaM and SAP decision, not
an SDTM one.
:::

:::mistake[Mapping vendor codes by test name]
`Hemoglobin` and `Haemoglobin`, `ALT (SGPT)` and `Alanine transaminase`. Fourteen source codes map to
seven `LBTESTCD` values in this study, and the code is the stable key.
:::

:::mistake[Assuming 10^3/µL needs a factor of 1,000]
It needs a factor of **1**. The units are numerically identical, and multiplying by 1,000 produces a
plausible-looking number that is three orders of magnitude wrong. A physiological range check after
conversion catches it; arithmetic care does not.
:::

:::mistake[Treating LBNRIND as a toxicity grade]
3,637 `LOW` results, 2,782 of them haemoglobin. `LBNRIND` says "outside the reference interval" and
nothing more. CTCAE grading is an ADaM derivation with a SAP-specified version.
:::

:::mistake[Dropping the NOT DONE records]
Seven records have no result and a reason. The record is what distinguishes "the sample haemolysed" from
"the test was never scheduled" — and it is what explains why two subjects have no `LBLOBXFL` for one of
their tests.
:::

:::mistake[Confusing LBLOBXFL with ADaM's ABLFL]
`LBLOBXFL` is the last non-missing observation before first exposure, determined by the data.
`ABLFL` is the record the SAP calls baseline. They agree on most records in most studies and they are
not the same variable.
:::

## Knowledge check

::quiz{ids="sdtm.lb.result-pair,sdtm.lb.range-converts,sdtm.lb.nrind-not-grade,sdtm.lb.lobxfl-meaning"}

## Hands-on exercise

::practice{ids="sdtm.lb.convert-bili,sdtm.lb.vendor-map,sdtm.lb.lobxfl-count,sdtm.lb.convert-code" title="Practice: units, ranges and the baseline flag"}

## Challenge exercise

::practice{ids="sdtm.lb.factor-1000,sdtm.lb.sex-range-chain,sdtm.lb.open-local-lab" title="Challenge: conversions that produce plausible wrong numbers"}

## Industry note

**Central laboratory data arrives as a vendor transfer, not through the EDC**, usually on a weekly or
monthly schedule, in the vendor's own format with its own codes and units. A **data transfer
specification** agreed with the vendor before first patient in defines the file layout, the test codes,
the units and the reference-range structure. When a transfer breaks a mapping — a new test code, a
changed unit, a range that moved — that document is what the conversation is about.

**Laboratory data is the largest domain in most studies.** 25,450 records here against 2,466 adverse
events, and that ratio is typical. It is also the domain where a systematic error does the most damage,
because a wrong conversion factor affects every result of that test for every subject at once.

::widget{name="trace-value" tlf="lab-chg"}

:::standard{kind="convention"}
Whether the primary laboratory analysis uses **central results only** is a SAP decision that varies by
sponsor and by study. Local results exist because a site needed a result the same day — before dosing,
to decide whether to treat — and they are genuine clinical data. Common approaches: central only, with
local listed separately; central preferred with local used when central is missing; or all results
pooled. CBX417-301 carries all 130 local records in `LB`, and which of them feed the analysis is decided
in ADaM. What is not acceptable is silently dropping them, because a subject's worst on-treatment value
may be one of them.
:::

:::interview[A laboratory result says the value is normal and LBNRIND says LOW. What do you check?]
"First, whether the comparison is being made in the same units, because that is the common cause.

`LBORRES` and `LBORRESU` are what the laboratory reported; `LBSTRESN` and `LBSTRESU` are the
standardized result. `LBNRIND` is derived from the **standardized** result against the **standardized**
range, `LBSTNRLO` and `LBSTNRHI`. If someone converted the result and not the range, a creatinine of
0.69 mg/dL becomes 61 µmol/L and gets compared against 0.70 to 1.20, which flags it wildly high.

But the specific case I'd expect is the opposite of a bug. On the study I've been working with there is
a record with `LBORRES = 0.69 mg/dL` — a perfectly normal creatinine — and `LBNRIND = 'LOW'`. Converted,
it is 61.0 µmol/L against a range of 61.9 to 106.1, so it is 0.9 below the limit. It was also 0.01 below
in the original units. Nothing is wrong; the record is just very slightly outside a local laboratory's
range and the conversion makes that harder to see by eye.

So the checks in order: are the result and range in the same units; is the range the one from the
laboratory that ran the test, not overwritten with the central laboratory's; and does the test have a
**sex-specific** range — ALT, AST, creatinine and haemoglobin do in that study — because if so, the
indicator depends on `DM.SEX` being right, which depends on a demographics mapping that had to
disambiguate nine different spellings including numeric codes.

And I'd say what `LBNRIND` is not: it isn't a toxicity grade. There are 3,637 `LOW` results in that
domain and 2,782 of them are haemoglobin, which is what a chemotherapy population looks like. Grading is
ADaM."
:::
