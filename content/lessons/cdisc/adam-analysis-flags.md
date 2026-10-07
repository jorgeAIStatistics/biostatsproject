## What problem are we trying to solve?

Table 14.3.4.1 wants one number per cell: mean ALT at Cycle 4 Day 1, CBX-417 arm. So it wants one value per subject at Cycle 4 Day 1.

Subject `CBX417-301-1010-0003` has two:

```text
AVISIT         ADT         ADY  AVAL  BASE  CHG  ATOXGR  SRCSEQ
CYCLE 2 DAY 1  2022-12-13   29    14    19   -5       0       3
CYCLE 4 DAY 1  2023-01-19   66   109    19   90       1       4    <- unscheduled draw
CYCLE 4 DAY 1  2023-01-24   71    96    19   77       1       5    <- the scheduled visit
CYCLE 6 DAY 1  2023-03-09  115    10    19   -9       0       6
```

Their baseline ALT was 19 U/L. On study day 66 somebody ordered an unscheduled draw and it came back at 109. Five days later the scheduled Cycle 4 visit measured 96.

Both records belong to the Cycle 4 Day 1 window. Both are real. Neither is an error. And the table needs exactly one of them, because a subject who contributes twice is weighted twice.

**Which one?** There is no answer in the data. There is only an answer in the SAP, and the two studies in this app answer it differently:

| Study | Rule | This subject's selection |
|---|---|---|
| CBX417-301 | The scheduled record if one exists, otherwise the latest unscheduled record in the window | the 96 |
| VTX221-201 | The record closest to the target study day, ties to the later record | would be the 109 — day 66 is 2 days from a target of 64 |

Same variable name, same structure, opposite answers. `ANL01FL` is where that decision gets written down so that every table, every figure and every QC program makes it the same way.

:::number[What it costs to forget the flag]
ALT at Cycle 4 Day 1, records selected by population and visit only:

| | With `ANL01FL = "Y"` | Without |
|---|---:|---:|
| CBX-417: n, mean change | 147, **5.34** | 154, **6.43** |
| Placebo: n, mean change | 145, **3.02** | 149, **5.73** |
| Difference in mean change | **2.32** | **0.70** |

Eleven extra records out of roughly 300. The between-arm difference in mean change falls by two-thirds.

**The extra records are not random.** An unscheduled laboratory draw happens *because* somebody was worried, so those values skew high — this subject's 109 against a study median ALT change of 2 U/L. Counting them twice inflates whichever arm had more of them.
:::

## Intuition

A BDS dataset holds **every** record. A table needs **one** record per cell. Something has to bridge that, and there are only two candidates:

- **Delete the records you do not want.** Then the value is gone from every other output too — the worst post-baseline summary, the shift table, the listing — and a reviewer cannot see that a choice was made.
- **Flag the record you do want.** The dataset stays complete, every output states which flag it used, and the choice is inspectable.

ADaM takes the second, always. The corollary is that a record-level flag is never a data-quality statement. `ANL01FL` null does not mean "bad record"; it means "not the one selected for this analysis". On CBX417-301, **406 records have `ANL01FL` null and `ONTRTFL = "Y"`** — excluded from the by-visit table and still feeding the worst-post-baseline summaries.

:::why[Why is `ANL01FL` numbered? What would `ANL02FL` be?]
Because one dataset can serve analyses that need different single records from the same cell.

`ANLzzFL` is a family, `zz` running 01 to 99. A study might use `ANL01FL` for the by-visit summaries and `ANL02FL` for a different selection — one record per subject per *cycle* rather than per visit, say, or the record used in a per-protocol sensitivity analysis with a narrower window.

Each flag encodes one answer to "which record represents this subject here". Numbering them lets several answers coexist on the same records instead of forcing a second dataset.

**CBX417-301 uses only `ANL01FL`.** That is worth knowing rather than assuming: on a study with more than one, a table that filters on `ANL01FL` because that is the one you have heard of is selecting the wrong record set, and the output will look entirely normal.
:::

## Clinical context

Three kinds of flag live in an ADaM package, and confusing them is a standing source of wrong denominators.

| | Scope | Values | Answers | Examples |
|---|---|---|---|---|
| **Population flag** | Subject | `Y` / `N`, never null | Is this subject in the analysis set? | `ITTFL`, `SAFFL`, `EFFFL`, `PPROTFL` |
| **Record-level analysis flag** | Record | `Y` / null | Is this *the* record for this cell? | `ANL01FL`, `ABLFL`, `TRTEMFL`, `ONTRTFL`, `AOCCFL` |
| **Criterion flag** | Record | `Y` / `N` / null, paired with a criterion text | Does this record meet a stated condition? | `CRITyFL` with `CRITy`; `MCRITy` with `MCRITyML` |

:::standard{kind=official}
ADaMIG v1.3 defines `ANLzzFL` (Analysis Flag zz, for `zz` = 01–99) as record-level flags identifying the records selected for a particular analysis, taking `"Y"` or null. It defines `ONTRTFL` as the On-Treatment Record Flag and `AVISIT` / `AVISITN` as the analysis visit and its numeric sort order.

For criteria, ADaMIG v1.3 defines `CRITy` (the criterion text), `CRITyFL` (whether the record meets it) and `CRITyFN` (its numeric form) for a **binary** criterion, and `MCRITy` (the criterion name), `MCRITyML` (the level met) and `MCRITyMN` (its numeric form) for a **multi-response** criterion, where a record falls into one of several mutually exclusive categories.
:::

:::standard{kind=convention}
**The windowing rules and the selection rule are study-specific**, defined in the SAP, not by ADaM. ADaM provides `AVISIT` and `ANL01FL` and requires them to be documented; it says nothing about how wide a window should be or whether a scheduled record beats an unscheduled one.

CBX417-301's SAP Section 5.4 gives the windows as a table of study-day ranges and the selection rule as "the scheduled record if one exists, otherwise the latest unscheduled record within the window". VTX221-201 uses "closest to the target day, ties to the later record". Both are common; neither is standard.
:::

## Formal concept

### Windowing, then selection — two steps, two failure modes

**Step 1, windowing, decides `AVISIT`.** Every record gets an analysis visit, or none.

CBX417-301's windows from SAP Section 5.4:

| `AVISIT` | Target study day | Window |
|---|---:|---|
| Cycle 1 Day 8 | 8 | 2–14 |
| Cycle 2 Day 1 | 22 | 15–32 |
| Cycle 3 Day 1 | 43 | 33–53 |
| Cycle *n* Day 1 (*n* ≥ 4) | 21(*n*−1) + 1 | target − 10 to target + 10 |

Scheduled records keep their nominal visit; unscheduled records fall into whichever window contains their `ADY`. A record outside every window keeps `AVISIT` null.

**Step 2, selection, decides `ANL01FL`.** Within each subject, parameter and `AVISIT`, exactly one record is flagged.

:::number[What ADLB's 3,316 unflagged records actually are]
| `AVISIT` | `ONTRTFL` | Records | Why not selected |
|---|---|---:|---|
| present (all SCREENING) | null | 2,907 | Screening is not an analysis visit for the by-visit summaries |
| present | `Y` | 392 | Another record won the cell — every duplicated cell has exactly two records |
| null | `Y` | 14 | Outside every window, so there is no cell to represent |
| null | null | 3 | Outside every window and outside the treatment period |

`2,907 + 392 + 14 + 3 = 3,316`.

**406 of them are `ONTRTFL = "Y"`** — 392 that lost a cell and 14 with no cell at all. Those 406 records are excluded from every by-visit summary and included in every worst-post-baseline summary and shift table.

That is the whole argument for flagging rather than deleting in one number.
:::

### Two rules, two answers, on real records

**CBX417-301 — scheduled beats unscheduled.**

```text
USUBJID CBX417-301-1010-0003, PARAMCD ALT, AVISIT CYCLE 4 DAY 1 (target day 64, window 54-74)

  ADY  AVAL  CHG  VISIT (collected)  ANL01FL  ONTRTFL
   66   109   90  UNSCHEDULED        (null)   Y
   71    96   77  CYCLE 4 DAY 1      Y        Y
```

**VTX221-201 — closest to target wins, whatever it was called.**

```text
USUBJID VTX221-201-101-001, PARAMCD SYSBP, AVISIT WEEK 4 (target day 29)

  ADY   AVAL   CHG  VISIT (collected)  ANL01FL
   26  152.0  -9.7  WEEK 4             (null)
   31  152.3  -9.4  UNSCHEDULED        Y
```

Day 26 is 3 days from target; day 31 is 2. The unscheduled record wins.

:::why[Which rule is better?]
Neither, and the question is worth taking seriously because both have a real argument.

**"Scheduled first" protects against selection on outcome.** Unscheduled assessments are ordered in response to something — a symptom, a previous abnormal result — so they are systematically more extreme than scheduled ones. Preferring the scheduled record means the summary is built from measurements taken on a pre-specified calendar, independent of how the subject was doing. For a safety table where the unscheduled draws cluster in the arm with more toxicity, that matters a great deal.

**"Closest to target" protects the timing of the estimate.** A Week 12 endpoint means blood pressure *at twelve weeks*. If a subject's scheduled visit slipped to day 99 and an unscheduled reading exists on day 85, the unscheduled one is a better measurement of the thing being estimated. For an efficacy endpoint defined at a timepoint, that matters more than provenance.

The two studies are not being inconsistent — they are optimising different things. **Which is why the rule is in the SAP and not in ADaM**, and why reading a study's rule before writing a QC program is not optional. Assuming the rule you saw last time produces a flag set that is wrong in a way no check will catch.
:::

### Criterion flags — a different job entirely

`ANL01FL` chooses a record. A criterion flag *classifies* one, and both can be on the same record.

CBX417-301's ADEG uses the multi-response form for QTcF:

| `MCRIT1` | `MCRIT1ML` | `MCRIT1MN` | Records |
|---|---|---:|---:|
| QTcF interval category (ms) | `<=450` | 1 | 1,834 |
| QTcF interval category (ms) | `>450 to <=480` | 2 | 27 |
| QTcF interval category (ms) | `>480 to <=500` | 3 | 2 |
| QTcF interval category (ms) | `>500` | 4 | 4 |

The three variables carry the criterion's **name**, the **level met**, and its **numeric order**. A categorical QTcF table is then a `count()` on `MCRIT1ML`, with no thresholds anywhere in the table program.

:::why[Why not just write `AVAL > 500` in the table program?]
Because then the threshold is in the program, and there are four tables, a figure, a listing and a QC program that need the same threshold.

Three things break when a threshold lives in a table program:

**It is invisible.** define.xml describes `MCRIT1`; it cannot describe a comparison inside a program nobody submits.

**It drifts.** `> 500` and `>= 500` differ on exactly the records that matter, and two programmers will not make the same choice consistently across six outputs.

**It cannot be checked.** With `MCRIT1ML` in the data, a reviewer verifies the categorisation with one cross-tabulation against `AVAL`. With the threshold in a program, verifying it means reading the program.

**The general rule:** if a number appears in more than one output, it belongs in the dataset. `CRITy` and `MCRITy` exist so that the criterion text — the exact wording that appears in the table's row label — travels with the flag.
:::

## Worked example

Implement both selection rules and compare what they choose.

```r
library(dplyr)

flag_analysis_record <- function(bds, rule = c("scheduled-first", "closest-to-target")) {
  rule <- match.arg(rule)

  bds |>
    filter(!is.na(AVISIT), !is.na(AVAL)) |>
    group_by(USUBJID, PARAMCD, AVISIT) |>
    arrange(
      if (rule == "scheduled-first") as.integer(VISIT == "UNSCHEDULED")
      else                           abs(ADY - TARGETDY),
      desc(ADY), SRCSEQ,
      .by_group = TRUE
    ) |>
    mutate(ANL01FL = if_else(row_number() == 1, "Y", NA_character_)) |>
    ungroup()
}
```

The function does one thing: turn the SAP's sentence into a sort order, then flag the first row. Everything study-specific is the first sort key; `desc(ADY)` and `SRCSEQ` are the tie-breakers both rules share.

:::mistake[Selecting with `slice_max()` and hoping]
```r
# WRONG
group_by(USUBJID, PARAMCD, AVISIT) |>
  slice_max(ADT, n = 1) |>
  mutate(ANL01FL = "Y")
```

Three problems:

- **`slice_max` keeps ties**, so two records on the same date both get flagged, and that subject is counted twice.
- **It removes the losing records** rather than flagging the winner, so the 406 records that feed worst-post-baseline summaries are gone.
- **It encodes "latest wins"**, which is neither study's rule.
:::

**The check that must pass afterwards**, regardless of rule:

```r
stopifnot(
  bds |> filter(ANL01FL == "Y") |>
    count(USUBJID, PARAMCD, AVISIT) |> pull(n) |> max() == 1
)
```

At most one flagged record per subject, parameter and analysis visit. Note "at most": a cell whose only record has a missing `AVAL` may legitimately have none.

## Data example

::dataset{id="oncology/adam/adlb" cols="USUBJID,PARAMCD,AVISIT,AVISITN,ADT,ADY,AVAL,BASE,CHG,ATOXGR,ANL01FL,ONTRTFL" rows="10" caption="ADLB — ANL01FL selects one record per subject, parameter and analysis visit"}

**The duplicated cells across the whole dataset:**

| Quantity | Value |
|---|---:|
| Subject-parameter-visit cells with more than one record | 392 |
| Of those, cells with exactly two records | 392 |
| Cells with three or more | 0 |
| ALT at Cycle 4 Day 1 specifically | 11 |

Every duplicated cell contains exactly two records, so each one contributes exactly one extra row to an unflagged summary. That is why the CBX arm gained 7 rows and placebo gained 4 in the table at the top: `7 + 4 = 11`.

::widget{name="tlf" id="t-lab-chg"}

## Code

::::tabs
:::tab[SAS]
```sas
proc sort data=adlb_win;
  by usubjid paramcd avisitn
     sched_rank descending ady srcseq;
run;

data adlb;
  set adlb_win;
  by usubjid paramcd avisitn;
  length anl01fl $1;
  if first.avisitn and not missing(avisit) and not missing(aval)
     then anl01fl = 'Y';
  else anl01fl = '';
run;

proc sql;
  select count(*) as cells_with_multiple_flags
  from  (select usubjid, paramcd, avisit
         from   adlb
         where  anl01fl = 'Y'
         group by usubjid, paramcd, avisit
         having count(*) > 1);
quit;
```

:::lines
2-3: **The whole rule is in the sort key.** `sched_rank` is 0 for a scheduled record and 1 for an unscheduled one, so scheduled records sort first; `descending ady` then takes the latest among equals; `srcseq` is the deterministic final tie-breaker. Change the study and only this line changes.
10-11: `first.avisitn` flags the first record of each cell, which after that sort is the selected one. `not missing(aval)` stops a null result being selected in preference to a real one.
12: The `else` matters. Without it, `anl01fl` retains its value from the previous observation in some code paths, and a flag that leaks across records is very hard to see.
15-22: **"At most one per cell."** This must return 0. It is the single most useful check on a BDS dataset and it takes one query.
:::
:::

:::tab[R]
```r
library(dplyr)

adlb <- adlb_win |>
  filter(!is.na(AVISIT)) |>
  group_by(USUBJID, PARAMCD, AVISIT) |>
  arrange(sched_rank, desc(ADY), SRCSEQ, .by_group = TRUE) |>
  mutate(
    ANL01FL = if_else(row_number() == 1 & !is.na(AVAL),
                      "Y", NA_character_)
  ) |>
  ungroup() |>
  bind_rows(adlb_win |> filter(is.na(AVISIT)))

stopifnot(
  adlb |> filter(ANL01FL == "Y") |>
    count(USUBJID, PARAMCD, AVISIT) |> pull(n) |> max() == 1,
  nrow(adlb) == nrow(adlb_win)
)
```

:::lines
6: The rule as a sort: scheduled rank, then latest, then sequence. Everything study-specific is here.
8-9: Flag the first row of each group. `!is.na(AVAL)` prevents a null result winning a cell that also contains a real one.
12: `bind_rows` puts back the records with no analysis visit. **Filtering them out and forgetting to restore them is the classic version of this bug** — 14 on-treatment records would vanish from the worst-post-baseline summaries and nothing would flag it.
14-18: Two assertions. At most one flag per cell, and the record count unchanged — the second is what catches the missing `bind_rows`.
:::
:::
::::

## Output

```text
> adlb |> mutate(sel = if_else(is.na(ANL01FL), "not selected", "ANL01FL = Y"),
+                ont = if_else(is.na(ONTRTFL), "off treatment", "on treatment")) |>
+   count(sel, ont)

  sel           ont             n
1 ANL01FL = Y   on treatment  18174
2 ANL01FL = Y   off treatment  3953
3 not selected  on treatment    406
4 not selected  off treatment  2910
```

**Row 3 is the one to read.** 406 records were not selected for any by-visit summary and are still on-treatment measurements. They appear in the worst post-baseline grade, in the shift table, and in the listings. Deleting them instead of flagging would remove a real grade 1 ALT elevation of 109 U/L from the safety analysis of a study whose primary safety concern is hepatotoxicity.

## Common mistakes

:::mistake[Filtering on population and visit and forgetting `ANL01FL`]
Eleven cells with two records is enough to move the between-arm difference in mean ALT change from 2.32 to 0.70 U/L. The table still looks normal, the n looks plausible, and the unscheduled records skew in a direction that is not random.
:::

:::mistake[Deleting unselected records instead of flagging them]
406 on-treatment records on this study are `ANL01FL` null. They are excluded from by-visit summaries and required by the worst-post-baseline summaries and the shift table. A BDS dataset holds every record; flags choose among them.
:::

:::mistake[Assuming the selection rule you saw on the last study]
"Scheduled first" and "closest to target" are both common and they disagree on exactly the cells that have two records. Nothing in the dataset tells you which was used and no check will catch the wrong one — you have to read the SAP.
:::

:::mistake[Filtering on `ANL01FL` because it is the flag you know]
On a study with `ANL02FL` as well, `ANL01FL` may encode a different selection from the one your table needs. Read the specification for which flag each output uses, the same way you read which population flag it uses.
:::

:::mistake[Putting a threshold in the table program instead of a criterion flag]
`AVAL > 500` inside one of six outputs is invisible to define.xml, will drift to `>=` in one of them, and cannot be checked without reading code. `MCRIT1`/`MCRIT1ML` put the criterion text and the level met in the data, where a cross-tabulation verifies them.
:::

:::mistake[Confusing `ONTRTFL` with `ANL01FL`]
`ONTRTFL` says the record falls in the treatment window; `ANL01FL` says it represents the subject at an analysis visit. A record can be on-treatment and unselected (406 of them), or selected and off-treatment (3,953 — mostly the baseline records). They answer different questions.
:::

## Knowledge check

::quiz{ids="adam.anl.why-one-record,adam.anl.flag-kinds,adam.anl.two-rules,adam.anl.ontrtfl"}

## Hands-on exercise

::practice{ids="adam.anl.select-code,adam.anl.duplicate-cost,adam.anl.criterion-flag,adam.anl.not-deleted" title="Practice: choosing one record per cell"}

## Challenge exercise

::practice{ids="adam.anl.wrong-rule,adam.anl.open-windowing" title="Challenge: the QC program that used the other rule"}

## Industry note

**Windowing is where two independent derivations diverge most predictably after baseline.** The window boundaries, whether they are inclusive, what happens to a record on a boundary, and the selection rule are four separate decisions, and a SAP that states two of them will produce two different ADLB datasets.

**Unscheduled records are informative, and that is the whole reason the rule matters.** They are ordered because somebody was concerned, so they are systematically more extreme than scheduled records, and they are not balanced across arms. Any rule that admits them into a by-visit summary preferentially admits the arm with more toxicity.

:::standard{kind=official}
ADaMIG v1.3 provides `ANLzzFL`, `AVISIT`, `AVISITN`, `ONTRTFL`, `CRITy`/`CRITyFL`/`CRITyFN` and `MCRITy`/`MCRITyML`/`MCRITyMN`, and requires that their derivations be documented in the analysis metadata. It defines the variables, not the windows or the selection rule — those come from the study's SAP.
:::

**Interviewers ask "why does a BDS dataset need an analysis flag" because the good answer has a number in it.** "To pick one record per visit" is the definition. "Because 392 cells in this study have two records, and forgetting the flag moves the between-arm difference in mean ALT change from 2.32 to 0.70 U/L" is an answer from someone who has checked.

:::interview[A summary table's n is higher than the number of subjects in the population. Where do you look?]
"Duplicate records within a cell, almost certainly — and the first thing I'd do is confirm it, because the fix depends on which kind it is.

I'd count distinct subjects against records for the same filter. If the records exceed the subjects, some subject is contributing twice to one cell.

**The usual cause is a missing `ANL01FL = 'Y'`.** A BDS dataset holds every record, so a subject with an unscheduled draw inside a visit window has two records in that cell and the flag is what picks one. On the study I've worked with, 392 subject-parameter-visit cells have two records — every duplicated cell has exactly two — and 11 of them are ALT at Cycle 4 Day 1. Forgetting the flag there takes the CBX arm's n from 147 to 154 and its mean change from 5.34 to 6.43 U/L, and the between-arm difference from 2.32 to 0.70.

The reason that matters more than the count is that **unscheduled records aren't random**. They're ordered because somebody was worried, so they skew toward the abnormal, and they're not balanced across arms. Including them preferentially inflates whichever arm had more toxicity.

**If the flag is there and the n is still wrong**, I'd check the flag itself: at most one `Y` per subject, parameter and analysis visit. That's one `GROUP BY` with a `HAVING COUNT(*) > 1`, and a derivation that used something like `slice_max` on a date will have flagged both records of a tied cell.

**And I'd check which flag the table should be using.** `ANLzzFL` is a family. If the study defines `ANL02FL` for a different selection, filtering on `ANL01FL` because it's the one you've heard of gives a record set that is wrong in a way no check catches.

What I wouldn't do is delete the unselected records. On this study 406 of them are on-treatment measurements that the worst-post-baseline summaries and the shift table need — including a grade 1 ALT of 109 U/L in a trial whose main safety concern is hepatotoxicity. The dataset keeps everything; the flags choose."
:::
