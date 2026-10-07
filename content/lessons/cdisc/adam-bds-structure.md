## What problem are we trying to solve?

A study collects seven laboratory tests at up to twenty visits, blood pressure and pulse at six visits, QTcF and heart rate at five, tumor size at every scan. Design a dataset that can produce a by-visit summary table for any of them.

The instinct is one column per measurement:

```text
USUBJID               VISIT          ALT  AST  BILI  CREAT  HGB  NEUT  PLAT
CBX417-301-1002-0001  CYCLE 4 DAY 1   16   20    11     78  128   3.4   210
```

It reads beautifully and it fails immediately:

- **The by-visit table program has to name the columns.** Seven parameters means seven `PROC MEANS` calls or a macro loop, and adding a parameter means editing a program.
- **Baseline and change need a column each.** `ALT`, `ALT_BASE`, `ALT_CHG`, `ALT_PCHG`, `AST`, `AST_BASE`… twenty-eight columns for seven tests.
- **Reference ranges differ by test.** `ALT_ANRLO`, `ALT_ANRHI`, and now you are at forty-two columns.
- **The unit is in nobody's data.** It lives in the column name, or in the programmer's head, or in the table footnote where it can silently disagree with the values.
- **Adding a derived measurement means altering the table's shape**, which means every downstream program.

Now the same record as BDS:

```text
USUBJID              PARAMCD PARAM                          AVISIT        AVAL BASE CHG
CBX417-301-1002-0001 ALT     Alanine Aminotransferase (U/L) CYCLE 4 DAY 1   16   15   1
```

One row per subject, per parameter, per analysis timepoint. Seven tests become seven values of `PARAMCD` instead of seven columns. The by-visit table becomes **one** program with `BY PARAMCD AVISIT`. The unit is inside `PARAM`, travelling with the value. Adding a parameter adds rows, and no program changes.

That is the Basic Data Structure. It is the shape that almost every analysis dataset in a study uses, and the reason is that it makes the *number of parameters* a data property rather than a program property.

:::number[How much does this actually save?]
CBX417-301's ADLB holds **25,443 records** across 7 parameters and 41 analysis visits. As a wide dataset with value, baseline, change, percent change, two reference limits, two range indicators and two grades per parameter, that would be 7 x 10 = 70 parameter columns plus the identifiers — and Table 14.3.4.1 would still need a loop.

As BDS it is 30 columns and one program. Verified parameters:

| `PARAMCD` | `PARAM` | `PARCAT1` |
|---|---|---|
| `ALT` | Alanine Aminotransferase (U/L) | CHEMISTRY |
| `AST` | Aspartate Aminotransferase (U/L) | CHEMISTRY |
| `BILI` | Bilirubin (umol/L) | CHEMISTRY |
| `CREAT` | Creatinine (umol/L) | CHEMISTRY |
| `HGB` | Hemoglobin (g/L) | HEMATOLOGY |
| `NEUT` | Neutrophils (10^9/L) | HEMATOLOGY |
| `PLAT` | Platelets (10^9/L) | HEMATOLOGY |
:::

## Intuition

BDS is one idea applied consistently: **the thing being measured is data, not schema.**

Everything else follows. If the parameter is data, its name has to be data too — so `PARAM` carries the full description including the unit. If the parameter is data, the table needs to sort parameters in a specified order — so `PARAMN` carries that order. If parameters group into panels, the grouping is data — so `PARCAT1` carries it.

And the same logic applies to time. The visit at which a value is analyzed is a decision, so it is data: `AVISIT`, separate from the `VISIT` the site recorded.

:::why[Why is `AVISIT` a different variable from `VISIT` rather than a cleaned-up version of it?]
Because they answer different questions and a reviewer needs both.

`VISIT` is what happened: the subject came in for an early-termination visit, or an unscheduled one. `AVISIT` is what the analysis calls it: the visit whose window that day falls into.

In the VTX221-201 hypertension study the two differ for 60 of 3,082 records:

| `VISIT` | `AVISIT` | n |
|---|---|---:|
| EARLY TERMINATION | WEEK 2 | 12 |
| EARLY TERMINATION | WEEK 4 | 18 |
| EARLY TERMINATION | WEEK 8 | 10 |
| EARLY TERMINATION | WEEK 12 | 6 |
| UNSCHEDULED | WEEK 2 | 8 |
| UNSCHEDULED | WEEK 4 | 4 |
| UNSCHEDULED | WEEK 8 | 2 |

Those 60 records were collected at a visit the protocol did not schedule, and the analysis still needs them — a subject who terminated early on Day 80 has a Week 12 blood pressure, and throwing it away would bias the completer analysis further than it is already biased.

Overwriting `VISIT` would destroy the reviewer's ability to see that the Week 12 column contains six early-termination visits. Keeping both means the windowing is inspectable: `count(VISIT, AVISIT)` is the whole audit.
:::

## Clinical context

The BDS variables you will see on essentially every study:

| Variable | Role |
|---|---|
| `PARAMCD` | Short parameter code — the thing you filter on |
| `PARAM` | Full description including the unit — the thing you print |
| `PARAMN` | Numeric order for sorting parameters in a table |
| `PARCAT1` | Parameter category, e.g. `CHEMISTRY` / `HEMATOLOGY` — the panel headings |
| `AVAL` | The numeric analysis value |
| `AVALC` | The character analysis value, when the result is categorical |
| `ADT`, `ADY` | Analysis date and study day |
| `AVISIT`, `AVISITN` | Analysis visit and its sort order |
| `ABLFL`, `BASE` | Which record is baseline, and its value carried to every record |
| `CHG`, `PCHG` | Change and percent change from baseline |
| `ANL01FL` | Which record represents the subject at that analysis visit |

:::standard{kind=official}
ADaMIG v1.3 requires `PARAM` in every BDS dataset and requires a **one-to-one relationship between `PARAMCD` and `PARAM`** within a dataset — the same code never describes two different things and the same description never has two codes.

`PARAMCD` values are limited to **8 characters and must not start with a digit**, so that a transposed dataset can use them as variable names.

`AVAL` is numeric and `AVALC` is character. When both are populated for a parameter, ADaMIG v1.3 requires a one-to-one relationship between them within that parameter.
:::

:::standard{kind=convention}
Putting the unit inside `PARAM` — `"Alanine Aminotransferase (U/L)"` rather than `"Alanine Aminotransferase"` plus an `AVALU` column — follows from ADaMIG's requirement that `PARAM` describe the parameter completely, and is near-universal sponsor practice. It is not spelled out as a separate rule.

The consequence is a rule with teeth: **if the unit changes, the parameter changes.** Glucose in mg/dL and glucose in mmol/L are two values of `PARAMCD`, not one parameter with two units, because averaging them would be meaningless.
:::

## Formal concept

### `AVAL` and `AVALC` for ordered categories

A laboratory result is a number and `AVAL` holds it. A RECIST response is a category, and categories cannot be averaged — but they can be *ordered*, and an ordered category is much more useful with a numeric companion.

CBX417-301's ADRS does this:

| `AVALC` | `AVAL` | Meaning |
|---|---:|---|
| `CR` | 1 | Complete response |
| `PR` | 2 | Partial response |
| `SD` | 3 | Stable disease |
| `PD` | 4 | Progressive disease |
| `NE` | 5 | Not evaluable |

:::why[Why is complete response 1 and progressive disease 4 — isn't "better" usually higher?]
Because the pairing exists so that **"better" is a comparison rather than a lookup table.**

With this coding, better means smaller. `AVAL < 3` is "at least stable disease"; `min(AVAL)` over a subject's assessments is a first approximation to best overall response. With `CR = 4` it would be `max()`, which is equally fine — but the direction has to be consistent across the study, and RECIST's own hierarchy reads CR, PR, SD, PD, so ascending is the natural transcription.

The property that matters is not which direction but that **the numeric order encodes the clinical order**. A coding of CR = 1, PD = 2, PR = 3 would satisfy ADaM's one-to-one rule and would silently break every comparison in the study.

**A first approximation is not the derivation.** On CBX417-301, `BOR.AVAL` equals the minimum `OVRLRESP.AVAL` for 401 of the 409 subjects with at least one assessment. The eight exceptions are where the SAP's extra rules bite — assessments after a new anticancer therapy or after the data cutoff are excluded from the derivation, and a partial response needs the confirmation rules applied. The ordering does not make the derivation trivial; it makes the derivation *expressible* as comparisons instead of a decision table.

`NE = 5` is placed last deliberately. "Not evaluable" is not clinically worse than progression — it is an absence of information — but putting it at the end means a comparison-based derivation returns `NE` only when nothing else is available, which is the behaviour you want. On this study 14 subjects have `BOR = "NE"` and their `BOR` records carry a null `SRCDOM` — 11 because they have no response assessment at all, and 3 whose assessments were all excluded by the SAP's rules, for example because a new anticancer therapy started first.
:::

### Adding a derived parameter

The most powerful property of BDS: **a new analysis parameter is new rows, not a new dataset and not a change to SDTM.**

CBX417-301's ADTR carries two parameters:

| `PARAMCD` | `PARAM` | Records | What it is |
|---|---|---:|---|
| `SUMDIAM` | Sum of Diameters of Target Lesions (mm) | 2,332 | One per subject per scan — collected |
| `BPCHG` | Best Percent Change from Baseline in Sum of Diameters (%) | 404 | One per subject — **derived** |

`BPCHG` is the number behind every point of a waterfall plot. It exists as a parameter rather than as a variable because a waterfall plot is a by-parameter analysis like any other, and because putting it in the same dataset lets a single program produce both the spaghetti plot and the waterfall plot.

Here is one subject's ADTR, trimmed:

```text
PARAMCD  AVISIT    ADY   AVAL   BASE  CHG   PCHG   SRCSEQ
SUMDIAM  BASELINE   -4   27.00    27   NA     NA        1
SUMDIAM  WEEK 6     43   23.00    27   -4  -14.81       2
SUMDIAM  WEEK 12    88   22.00    27   -5  -18.52       3
SUMDIAM  WEEK 18   122   21.00    27   -6  -22.22       4
SUMDIAM  WEEK 30   211   19.00    27   -8  -29.63       6
SUMDIAM  WEEK 36   253   20.00    27   -7  -25.93       7
...
BPCHG    (null)    211  -29.63    27   NA     NA        6
```

The `BPCHG` record's `AVAL` is `-29.63` — the most negative `PCHG` the subject reached, at Week 30. Its `ADY` is 211 and its `SRCSEQ` is 6, both pointing at the Week 30 assessment.

:::number[Why does the derived record carry the *source* assessment's day and sequence?]
Because "best percent change" is a **selection**, not a computation. The value came from one specific scan, so the record can point at it.

That makes the derivation checkable in one line across all 404 subjects: `BPCHG.AVAL` must equal the `PCHG` of the `SUMDIAM` record its `SRCSEQ` names. A reviewer asking "when did this subject have their best response?" reads `ADY = 211` off the record instead of re-scanning sixteen rows.

Note what the record does **not** have: `AVISIT` is null, because the best percent change does not belong to an analysis visit — it belongs to the subject. `CHG` and `PCHG` are null, because `AVAL` already *is* a percent change and a percent change of a percent change is nonsense. A derived parameter inherits the BDS column set, and the columns that do not apply stay empty.
:::

## Worked example

Produce the by-visit summary the SAP asks for — n, mean, SD, median, min and max of value and of change — for every parameter and visit, in one call.

```r
library(dplyr)

by_visit <- adlb |>
  filter(SAFFL == "Y", ANL01FL == "Y", !is.na(AVISIT)) |>
  group_by(PARCAT1, PARAMCD, PARAM, AVISITN, AVISIT, TRTA) |>
  summarise(
    n         = sum(!is.na(AVAL)),
    mean_aval = mean(AVAL, na.rm = TRUE),
    sd_aval   = sd(AVAL,   na.rm = TRUE),
    n_chg     = sum(!is.na(CHG)),
    mean_chg  = mean(CHG,  na.rm = TRUE),
    sd_chg    = sd(CHG,    na.rm = TRUE),
    .groups   = "drop"
  ) |>
  arrange(PARCAT1, PARAMCD, AVISITN)
```

**Seven parameters, 41 analysis visits, two arms, one call.** Add an eighth laboratory test to the study and this program does not change — the new parameter appears as new rows and new groups.

:::why[Why group on `PARAMCD` *and* `PARAM`?]
Because you filter on the code and print the description, and grouping on both keeps them together without a second lookup.

It is safe precisely because of the one-to-one rule: grouping on two variables that are in one-to-one correspondence produces exactly the same groups as grouping on either alone. If the rule were violated — the same `PARAMCD` with two different `PARAM` strings, usually from a units change mid-study — this grouping would silently split one parameter into two rows in the table.

Which makes it a check worth running: `n_distinct(PARAM)` per `PARAMCD` must be 1, and the reverse too.
:::

`AVISITN` earns its place in the `arrange`. Sorting on `AVISIT` alphabetically gives `CYCLE 10 DAY 1` before `CYCLE 2 DAY 1`, and `BASELINE` in the middle of the table. `AVISITN` is the specified display order:

| `AVISIT` | `AVISITN` |
|---|---:|
| SCREENING | −1 |
| BASELINE | 0 |
| CYCLE 1 DAY 8 | 11 |
| CYCLE 2 DAY 1 | 20 |
| CYCLE 4 DAY 1 | 40 |
| … | … |
| END OF TREATMENT | 800 |
| SAFETY FOLLOW-UP | 810 |

The large gaps are deliberate: 800 and 810 keep the end-of-study visits at the bottom however many cycles a subject completes, and there is room to insert a visit later without renumbering.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,PARAMCD,PARAM,PARAMN,VISIT,AVISIT,AVISITN,ADT,ADY,AVAL,BASE,CHG,PCHG,ABLFL,ANL01FL" rows="10" caption="VTX221-201 ADVS — two parameters, six analysis visits, 3,082 records"}

The hypertension study's ADVS is BDS at its simplest — two parameters, one value each, no grades or reference ranges:

| `PARAMCD` | `PARAM` | `PARAMN` |
|---|---|---:|
| `SYSBP` | Systolic Blood Pressure (mmHg) | 1 |
| `DIABP` | Diastolic Blood Pressure (mmHg) | 2 |

`PARAMN` here is doing exactly one job: making systolic print above diastolic in every table, regardless of how the data happen to sort. `"DIABP"` sorts before `"SYSBP"` alphabetically, and the shells want the reverse.

And the record counts by analysis visit show the shape of the study:

| `AVISIT` | `AVISITN` | Records | Subjects with a value |
|---|---:|---:|---:|
| SCREENING | −1 | 540 | 270 |
| BASELINE | 0 | 540 | 270 |
| WEEK 2 | 2 | 526 | — |
| WEEK 4 | 4 | 508 | — |
| WEEK 8 | 8 | 492 | — |
| WEEK 12 | 12 | 476 | — |

Two records per subject per visit — one systolic, one diastolic — so 540 at baseline is 270 subjects. The decline from 540 to 476 is dropout, and it is the reason the primary analysis is an MMRM rather than a complete-case ANCOVA.

::widget{name="tlf" id="t-lab-chg"}

## Common mistakes

:::mistake[Re-using a `PARAMCD` when the unit changes]
A central laboratory switches glucose from mg/dL to mmol/L mid-study. Keeping `PARAMCD = "GLUC"` and changing `PARAM` violates the one-to-one rule, and worse, the by-visit mean now averages two scales. Either convert to one unit at derivation, or use two parameters. The conversion is usually right; the silent mixture never is.
:::

:::mistake[Overwriting `VISIT` with the windowed value]
`VISIT` is what the site recorded; `AVISIT` is what the analysis calls it. Losing `VISIT` means a reviewer can no longer see that six of the Week 12 records are early-termination visits, and the windowing rule becomes unverifiable from the data.
:::

:::mistake[Sorting on `AVISIT` instead of `AVISITN`]
Alphabetical order puts `CYCLE 10 DAY 1` before `CYCLE 2 DAY 1` and `BASELINE` in the middle. `AVISITN` exists for exactly this, and `PARAMN` exists for the same reason at parameter level.
:::

:::mistake[Encoding `AVALC` into `AVAL` in a clinically meaningless order]
`CR = 1, PR = 2, SD = 3, PD = 4` makes "best response" a `min()`. An arbitrary order satisfies ADaM's one-to-one rule and silently breaks every derivation that relies on the ordering.
:::

:::mistake[Putting a derived quantity in a new variable instead of a new parameter]
Adding a `BESTPCHG` column to every `SUMDIAM` record repeats one value on sixteen rows, cannot carry its own `ADY` or `SRCSEQ`, and makes the waterfall plot a different kind of program from every other BDS analysis. As a parameter it is one record, traceable to the scan it came from, and the same program handles it.
:::

:::mistake[Assuming one record per subject and visit]
BDS is one record per subject, parameter and analysis *timepoint* — and a timepoint can legitimately contain more than one record before `ANL01FL` selects one. In CBX417-301's ADLB, 392 subject-parameter-visit cells contain two records. Counting rows is not counting subjects.
:::

## Knowledge check

::quiz{ids="adam.bds.param-unique,adam.bds.avisit-vs-visit,adam.bds.avalc-order,adam.bds.paramn"}

## Hands-on exercise

::practice{ids="adam.bds.by-visit-code,adam.bds.param-check,adam.bds.derived-param,adam.bds.wide-to-long" title="Practice: working in the long shape"}

## Challenge exercise

::practice{ids="adam.bds.unit-change,adam.bds.open-structure" title="Challenge: the parameter that changed units"}

## Industry note

**Almost every analysis dataset you will build is BDS.** ADLB, ADVS, ADEG, ADRS, ADTR, ADTTE, ADPC, ADQS — laboratory, vital signs, ECG, response, tumor size, time-to-event, pharmacokinetics, questionnaires. The exceptions are ADSL and the occurrence datasets. Learning BDS well is most of learning ADaM.

**The parameter list is a specification artefact, not a discovery.** The ADaM specification names every `PARAMCD`, its `PARAM` text and its `PARAMN` before any data is read. Deriving the parameter list from `distinct(LBTESTCD)` produces whatever the laboratory happened to send, including tests nobody plans to analyze.

**Transposing BDS back to wide is a normal and specific step, not a failure.** A correlation matrix, an MMRM with an unstructured covariance, and a scatter plot of two parameters all need the wide shape. The point of BDS is that the *storage* is long; the analysis transposes what it needs, which is why `PARAMCD` is limited to eight characters and cannot start with a digit — so it can become a variable name.

:::standard{kind=official}
ADaMIG v1.3 describes BDS as one record per subject, per parameter, per analysis timepoint as needed, and lists the required, conditionally required and permissible variables for the structure. Whether a dataset needs `AVISIT`, `ABLFL`, `CHG` or `ANL01FL` depends on the analyses it supports — a BDS dataset with a single timepoint per parameter, like ADTTE, carries none of them.
:::

:::interview[Why is ADaM long instead of wide?]
"Because the set of things being measured is data, not schema, and once you accept that everything else follows.

Concretely: a wide lab dataset needs a column per test, and then a column per test for baseline, change, percent change, both reference limits and the grade. Seven tests and that's seventy columns. Adding an eighth test changes the shape of the dataset, which means changing every program that reads it. In BDS the eighth test is more rows and nothing changes.

The table program is the clearest benefit. By-visit summaries for seven parameters across forty-two visits and two arms is one `group_by` and one `summarise` — the parameter is a grouping variable, not a column name.

There are two second-order benefits people miss. One is that the unit lives in `PARAM` and travels with the value, so there's no way for a table footnote to disagree with the data. That creates a real rule: if the unit changes, the parameter changes, because averaging mg/dL with mmol/L is meaningless.

The other is derived parameters. In the study I've worked with, best percent change in tumor size is a parameter with one record per subject, sitting in the same dataset as the per-scan sums of diameters. It carries its own analysis day and its own source sequence pointing at the scan it came from, so the waterfall plot and the spaghetti plot come from the same dataset and the same kind of program. As a column on every record it would repeat one value sixteen times and couldn't carry either.

The cost is that some analyses want wide — a correlation matrix, an MMRM with unstructured covariance — so you transpose. That's why `PARAMCD` is capped at eight characters and can't start with a digit: it has to be able to become a variable name."
:::
