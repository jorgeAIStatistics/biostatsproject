## What problem are we trying to solve?

You have SDTM. It is conformant, it passed the checks, the define.xml validates. Your task this morning is Table 14.3.4.1 — mean alanine aminotransferase and mean change from baseline at Cycle 4 Day 1, by treatment arm, safety population.

Try to produce it from `LB` alone and count the decisions you have to make before you can write a single `PROC MEANS`:

1. **Which arm column?** `DM.ARM` is the randomized arm. The table says *safety population, by treatment received*. Three subjects in CBX417-301 got a drug they were not randomized to. `LB` does not carry either column.
2. **Which subjects?** The safety population is "received at least one dose", which lives in `EX`, not in `LB`.
3. **Which record is baseline?** There are screening and Cycle 1 Day 1 records. `LBLOBXFL` flags one of them — but not for the four subjects who were randomized and never dosed, and the table needs those subjects' baselines too.
4. **Which record is "Cycle 4 Day 1"?** `VISIT` says `CYCLE 4 DAY 1` for most subjects. Eleven subjects also have an `UNSCHEDULED` ALT draw that falls inside the Cycle 4 window. Two records, one table cell.
5. **What is the change?** A self-join of `LB` on itself, keyed on subject and test, one side filtered to baseline.

That is four joins and a windowing rule before you compute an average. Every programmer on the study writes their own version of it, and every version is slightly different.

Here is the same table from ADLB:

```r
adlb |>
  filter(PARAMCD == "ALT", AVISIT == "CYCLE 4 DAY 1",
         ANL01FL == "Y", SAFFL == "Y", !is.na(CHG)) |>
  group_by(TRTA) |>
  summarise(n = n(), mean_aval = mean(AVAL), mean_chg = mean(CHG))
```

```text
  TRTA                    n mean_aval mean_chg
1 CBX-417 + Docetaxel   147  28.56463 5.340136
2 Placebo + Docetaxel   145  25.87586 3.020690
```

One filter, one group, one summary. Every decision in that list of five has been made once, written down in a specification, programmed once, and stored as a **variable** — `TRTA`, `SAFFL`, `ABLFL`/`BASE`, `AVISIT`/`ANL01FL`, `CHG`.

That is what ADaM is for. It is not a tidier SDTM. It is the layer where the analysis decisions live.

:::number[Where the 147 and the 5.34 come from]
Computed against `data/oncology/adam/adlb.csv` with the filter shown above. `n = 147` counts CBX-417 subjects with a non-missing `CHG` on the `ANL01FL = "Y"` record at Cycle 4 Day 1.

Drop `ANL01FL == "Y"` and the same code returns **n = 154, mean change 6.43** for the CBX arm and **n = 149, mean change 5.73** for placebo. The extra 7 and 4 records are the unscheduled draws that fell inside the Cycle 4 window — 11 subject-visit cells in total, each contributing two rows instead of one.

Those unscheduled draws are not noise: they were ordered *because* something looked wrong, so they skew high. Forgetting one flag moves the placebo mean change from 3.02 to 5.73 and nearly erases the between-arm difference.
:::

## Intuition

Two layers exist because two different questions need permanently different answers.

**SDTM answers "what happened to the subject?"** Its invariant is fidelity to collection. A partial date stays partial. A local lab result stays in the dataset even if the analysis will ignore it. Nothing is imputed, nothing is selected, nothing is assumed. A reviewer who wants to know what was written on the CRF reads SDTM.

**ADaM answers "what did we analyze, and why that?"** Its invariant is that the numbers in the tables can be reproduced from it and traced through it. Partial dates get imputed *and flagged*. One record per cell gets selected *and flagged*. Baseline gets defined *and flagged*.

The word doing the work in both sentences is **flagged**. ADaM never quietly resolves an ambiguity; it resolves it and leaves a variable behind saying it did.

:::why[Why not just make SDTM analysis-ready and skip a layer?]
Because the two invariants are incompatible.

An analysis needs one baseline value per subject and parameter. Collection produces however many pre-dose records the site happened to draw. If SDTM stored only the selected one, the reviewer could no longer see what was collected. If SDTM stored the selection rule, SDTM would depend on the SAP — and the SAP changes, sometimes after the database is locked.

Keeping them separate means the SAP can change without touching the collected data, and a second, different analysis (a sensitivity analysis with a different baseline rule) can be built from the same SDTM without contradicting the first.

That is why the ADaM datasets for a single study routinely contain the *same* laboratory result three times — in ADLB as `AVAL`, as another record's `BASE`, and inside a `CHG`. Denormalization that would be a design flaw in a database is the point here: each analysis record is self-sufficient.
:::

## Clinical context

An ADaM package for a study like CBX417-301 is a small, predictable set of datasets:

| Dataset | Structure | What it carries |
|---|---|---|
| `ADSL` | One record per randomized subject (420) | Treatment, dates, disposition, baseline covariates, **population flags** |
| `ADAE` | One record per adverse event (2,466) | Treatment-emergent flag, imputed dates, occurrence flags |
| `ADLB`, `ADVS`, `ADEG` | One record per subject, parameter and assessment | Values, baselines, changes, grades, analysis flags |
| `ADRS`, `ADTR` | One record per subject, parameter and assessment | Response, best overall response, tumor size |
| `ADTTE` | One record per subject and parameter (929) | Time to event, censoring code and reason |

`ADSL` is created first and everything else joins to it. That is not a style choice — it is how the treatment variables and population flags get into every other dataset without being re-derived.

:::standard{kind=official}
ADaMIG v1.3 defines three standard structures: **ADSL** (the subject-level dataset, one record per subject), **BDS** (Basic Data Structure, one record per subject per parameter per analysis timepoint) and **OCCDS** (Occurrence Data Structure, for occurrence data such as adverse events and concomitant medications).

ADaMIG v1.3 also states that a sponsor may use a different structure when none of the standard ones fits the analysis — but that the structure and its variables must then be documented in the metadata.
:::

:::standard{kind=convention}
"ADSL first, then everything else" is universal sponsor practice and is implied by the fact that ADSL is the source of the treatment and population variables the other datasets copy. It is not written as a sequencing requirement in ADaMIG v1.3.
:::

## Formal concept

### The fundamental principles

:::standard{kind=official}
The CDISC **ADaM Model v2.1** sets out fundamental principles that ADaM datasets and their metadata must satisfy. Paraphrased — read the document for the exact wording:

1. **Clear and unambiguous communication** of what the data contain.
2. **Traceability** — it must be possible to get from an analysis value back to its source, ultimately to SDTM and to collection.
3. **Readily usable with commonly available software**, which in practice means a flat, rectangular dataset with a documented structure.
4. **Analysis-ready** — the dataset supports the intended analysis with minimal further manipulation.

ADaMIG v1.3 is the implementation guide that turns those principles into named variables and rules.
:::

:::standard{kind=convention}
**"One PROC away"** is the phrase everyone in the industry uses for principle 4. It is not ADaM's own wording and it is not a literal test — an ANCOVA still needs a `MODEL` statement and a `LSMEANS` statement. What it means operationally: *no derivation logic between the dataset and the procedure*. Filters and `BY` statements are fine; a `MERGE` or a conditional assignment is a sign the derivation belongs in ADaM.
:::

### The test that actually matters

A dataset is analysis-ready for a given output if you can produce that output with:

- a `WHERE` / `filter` using only variables already in the dataset,
- a `BY` / `group_by` using only variables already in the dataset,
- and one analytic call.

Apply it to the table from the opening. `PARAMCD`, `AVISIT`, `ANL01FL`, `SAFFL` are all filters. `TRTA` is a group. `AVAL` and `CHG` are the analysis variables. It passes.

Now apply it to a table of **worst post-baseline CTCAE grade**. ADLB has `ATOXGRN` and `ONTRTFL` but no "worst grade" variable, so producing that table needs a `max()` per subject *before* the tabulation. Strictly, ADLB is not analysis-ready for that output.

:::why[So is that a defect in ADLB?]
It is a judgement the sponsor made, and it is the interesting kind of judgement.

Storing the worst post-baseline grade means adding records that are not observations — derived records with no single source. ADaM supports that (`DTYPE` exists precisely to label such records), but it makes the dataset bigger and more confusing for the many outputs that do not need it.

The CBX417-301 SAP takes the other route: worst-grade summaries are computed at reporting time from `ONTRTFL = "Y"` records, and the ADRG says so explicitly. That is a legitimate answer, *because it is written down*. The failure mode is not choosing one over the other; it is choosing silently, so that two programmers compute "worst" over different record sets.

The principle is not "everything must be pre-derived". It is "every derivation happens once, in a place the reviewer can find".
:::

### Choosing a structure

| The analysis is about… | Structure | Example |
|---|---|---|
| The subject as a whole | ADSL | Demographics, exposure duration, population membership |
| A measurement repeated over time | BDS | Lab values, vital signs, tumor size, QTcF |
| Whether a thing occurred, and its attributes | OCCDS | Adverse events, concomitant medications, medical history |
| Time from an origin to an event | BDS | ADTTE — one record per subject per parameter |

ADTTE is the one that surprises people. It looks nothing like ADLB, but it *is* BDS: one record per subject per parameter, with `PARAMCD` (`PFS`, `OS`, `DOR`), `AVAL` (the time) and `ADT` (the analysis date). It is BDS with exactly one timepoint per parameter.

## Worked example

Take one cell of the AE overview table — *subjects with any treatment-emergent adverse event, CBX-417 arm* — and ask what ADaM has to contain for that cell to be one filter away.

The cell is `209 (100.0%)`. Three facts have to already exist:

**The numerator.** "Subjects with at least one TEAE" needs `TRTEMFL`, which needs an analysis start date, which needs partial dates imputed. Twelve of the 2,466 AE records in CBX417-301 have a partial `AESTDTC`. SDTM keeps them partial — correctly. ADAE imputes them and sets `ASTDTF` to `D` or `M` so the reviewer can find every affected record.

**The denominator.** 209 is the number of safety-population subjects whose *actual* treatment was CBX-417 + docetaxel. It is not 210 (randomized to CBX) and it is not 208 (randomized to CBX and dosed). It comes from `ADSL`, counting `SAFFL = "Y"` by `TRT01A`.

**The one-row-per-subject rule.** An incidence table counts subjects, not events. There are 2,410 treatment-emergent records and 414 subjects with at least one. ADAE stores `AOCCFL = "Y"` on exactly 414 records — one per subject — so the count is a filter rather than a `DISTINCT`.

:::number[Why 209 and not 210?]
420 subjects were randomized, 210 to each arm. Four were randomized and never dosed, so `SAFFL = "N"` for them (two in each arm). Of the 416 dosed subjects, actual treatment was CBX-417 + docetaxel for **209** and placebo + docetaxel for **207**.

The extra subject in the CBX column is a dispensing error: two subjects randomized to placebo received at least one CBX-417 kit and are analyzed as CBX; one subject randomized to CBX received only placebo kits and is analyzed as placebo. Verified from `data/oncology/adam/adsl.csv`:

| `TRT01P` | `TRT01A` | n |
|---|---|---:|
| CBX-417 + Docetaxel | CBX-417 + Docetaxel | 207 |
| CBX-417 + Docetaxel | Placebo + Docetaxel | 1 |
| CBX-417 + Docetaxel | (null, never dosed) | 2 |
| Placebo + Docetaxel | CBX-417 + Docetaxel | 2 |
| Placebo + Docetaxel | Placebo + Docetaxel | 206 |
| Placebo + Docetaxel | (null, never dosed) | 2 |

`207 + 2 = 209`. This is exactly why ADSL carries both `TRT01P` and `TRT01A` instead of one "treatment" column: the efficacy tables need one, the safety tables need the other, and the difference is three subjects who must not be silently assigned to whichever column the programmer reached for first.
:::

## Data example

::dataset{id="oncology/adam/adlb" cols="USUBJID,PARAMCD,PARAM,AVISIT,ADY,AVAL,BASE,CHG,ABLFL,ANL01FL,ONTRTFL,SRCDOM,SRCSEQ" rows="8" caption="ADLB — every analysis decision is a column"}

Read that row layout as a list of questions already answered:

| Column | The question it answers |
|---|---|
| `PARAMCD`, `PARAM` | What was measured, and in what unit |
| `AVISIT` | Which analysis timepoint this record belongs to |
| `ANL01FL` | Whether this is *the* record for that timepoint |
| `ABLFL`, `BASE` | Which record is baseline, and what its value was |
| `CHG` | The change, already computed against the right baseline |
| `ONTRTFL` | Whether the record is inside the treatment window |
| `SRCDOM`, `SRCSEQ` | Which SDTM record this value came from |

Every one of those was a decision somebody made and wrote in a specification. None of them is inferrable from SDTM without reading the SAP.

::widget{name="tlf" id="t-lab-chg"}

## Common mistakes

:::mistake[Treating ADaM as "SDTM with better variable names"]
The rename is the least important part. ADLB is not `LB` with `LBSTRESN` called `AVAL` — it is `LB` plus a baseline decision, a visit-window decision, a record-selection decision, a population restriction and a treatment attribution. A dataset that only renames is not analysis-ready; it just moved the work downstream into each individual table program, where it will be done inconsistently.
:::

:::mistake[Deriving in the table program because "it's only one line"]
The one line is `if AVISIT = "CYCLE 4 DAY 1" and VISIT ne "UNSCHEDULED"`. It is correct. It is also invisible to the reviewer, absent from define.xml, absent from the ADRG, and different in the QC program. If a table needs a rule, the rule belongs in ADaM as a flag.
:::

:::mistake[One treatment variable]
`TRT01P` and `TRT01A` are different for three subjects here, and that is the *normal* case, not an error. Using planned treatment in a safety table attributes a CBX-417 adverse event to the placebo column. Using actual treatment in an efficacy analysis breaks the intention-to-treat principle.
:::

:::mistake[Assuming "analysis-ready" means "no programming"]
It means no *derivation* between the dataset and the procedure. `PROC MIXED` still needs a model statement; `coxph` still needs a formula. The test is whether you have to compute a new value first.
:::

:::mistake[Deciding a structure by looking at the source domain]
ADTTE comes from `RS`, `DS`, `EX` and `SS` and is still BDS. ADAE comes from `AE` and is OCCDS. The structure follows the *analysis* — repeated measurements versus occurrences versus one row per subject — not the source.
:::

## Knowledge check

::quiz{ids="adam.purpose.why-two-layers,adam.purpose.one-proc,adam.purpose.structure-choice,adam.purpose.denominator"}

## Hands-on exercise

::practice{ids="adam.purpose.classify-structures,adam.purpose.analysis-ready-code,adam.purpose.flag-count,adam.purpose.missing-flag" title="Practice: what has to be in the dataset"}

## Challenge exercise

::practice{ids="adam.purpose.rebuild-from-sdtm,adam.purpose.spec-gap,adam.purpose.open-principles" title="Challenge: the cost of a missing derivation"}

## Industry note

**The ADaM specification is written before the data exist.** On a well-run study the ADaM specs are drafted from the SAP and the shells during the blinded period, reviewed by the study statistician, and only then programmed. A specification written by reading the data you already have is a specification that documents whatever you did, which is the opposite of the point.

**Interviews test this by asking you to justify a variable.** "Why does ADSL have `TRT01A`?" has a wrong answer ("to record actual treatment") and a right answer ("because safety analyses are by treatment received and efficacy by treatment randomized, and on this study they differ for three subjects"). The second answer shows you know what the variable is *for*.

:::standard{kind=official}
The FDA **Study Data Technical Conformance Guide** and the corresponding Data Standards Catalog specify which CDISC standards are supported for study data submitted to CDER and CBER, including SDTM and ADaM, and reference the Analysis Data Reviewer's Guide as part of the study data package. Check the current version of both documents for what applies to a specific submission — the supported versions change over time, and nothing in this lesson should be read as a statement about a particular submission's requirements.
:::

**Not every table comes from ADaM.** Disposition tables routinely count screen failures, and screen failures are not in ADSL — ADSL on this study has exactly the 420 randomized subjects, while SDTM `DM` has all 468 screened. The ADRG says so in one sentence, and that sentence saves a reviewer an afternoon.

:::interview[Explain to a data manager why you need ADaM when SDTM already has all the data]
"SDTM has all the data; it doesn't have any of the decisions.

Take one cell of a lab table — mean change in ALT at Cycle 4. To get it from `LB` I need to know which record counts as baseline, which of two records in the Cycle 4 window counts as the Cycle 4 value, whether the subject is in the safety population, and which treatment column they belong in. None of those are in `LB`, and all four are in the SAP. So every table programmer would have to re-read the SAP and re-implement the same four rules, and they'd differ.

ADaM is where those rules get implemented once. `ABLFL` and `BASE` are the baseline decision. `ANL01FL` is the record-selection decision. `SAFFL` is the population. `TRTA` is the treatment attribution. After that the table is a filter and a `PROC MEANS`.

The second reason is the reviewer. If someone at the agency queries a number, I need to walk it from the table cell to the analysis record to the SDTM record to the CRF page. ADaM carries `SRCDOM`, `SRCVAR` and `SRCSEQ` on every record so that walk is a lookup rather than a reconstruction.

And to be clear about what ADaM is *not*: it's not a cleaner SDTM. SDTM has to stay faithful to what was collected — partial dates stay partial there. ADaM imputes them and flags the imputation. If we pushed the analysis decisions into SDTM we'd lose the record of what was actually collected, and we'd have to change SDTM every time the SAP changed."
:::
