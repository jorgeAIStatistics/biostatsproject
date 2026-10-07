## What problem are we trying to solve?

The SAP gives you one sentence:

> Baseline is the last non-missing assessment on or before the date (and, where collected, the time) of the first dose of study drug.

Now write it. Here is subject `CBX417-301-1002-0001`'s ALT, and it is easy:

| `AVISIT` | `ADT` | `ADY` | `AVAL` |
|---|---|---:|---:|
| SCREENING | 2022-05-11 | −12 | 18 |
| BASELINE | 2022-05-23 | 1 | 15 |

Two records on or before first dose; the later one wins; `ABLFL = "Y"` on the Day 1 record and `BASE = 15` everywhere.

Then the edge cases arrive, and every one of them is a real subject in this study:

1. **A subject who was randomized and never dosed.** There is no first dose date. Four subjects.
2. **A parameter with no pre-dose record at all.** Subject `CBX417-301-1019-0002`'s first ALT is at Cycle 2 Day 1. Two subject-parameter cells.
3. **A record on the first-dose day whose time is *after* the first dose.** The Cycle 1 Day 1 ECG is taken post-dose and shares its date with the dose.
4. **Two records on the same day with the same time.** The rule as written selects both.

The sentence is a page of specification and a week of programming, and the reason is that **"last" and "on or before" both need tie-breakers the sentence does not contain**. A baseline rule that is not fully specified will be implemented two different ways by two programmers, and every change from baseline in the study inherits the difference.

:::number[How many baseline records should ADLB have?]
420 subjects × 7 parameters = **2,940** subject-parameter cells. ADLB has **2,938** records with `ABLFL = "Y"`.

The two missing:

| Subject | `PARAMCD` | First record |
|---|---|---|
| CBX417-301-1010-0001 | HGB | Cycle 1 Day 8 |
| CBX417-301-1019-0002 | ALT | Cycle 2 Day 1 |

Neither has any assessment on or before first dose for that parameter, so neither has a baseline. Their `BASE` is null, their `CHG` is null on all 5 of their records, and they drop out of change summaries for that parameter while staying in the population and in every other summary.

**"At most one per subject and parameter", not "exactly one".** A check that asserts 2,940 fails on a correct dataset.
:::

## Intuition

`ABLFL` is a **selection** and `BASE` is a **broadcast**.

The selection picks exactly one record from the candidates. The broadcast copies that record's `AVAL` onto every record for the same subject and parameter — including the baseline record itself, and including records collected before it.

That second part surprises people. The screening record above has `BASE = 15`, which is the *later* Day 1 value. It looks backwards, and it is right: `BASE` is not "the value before this record", it is "this subject's baseline for this parameter", and there is only one of those.

:::why[Why broadcast at all? Why not join to the baseline record when you need it?]
Because the join is a chance to get it wrong, and it gets taken hundreds of times.

Every table involving change from baseline, every shift table, every figure with a reference line, every listing — each one would carry its own self-join of the dataset onto itself, keyed on subject and parameter and filtered to `ABLFL = "Y"`. Each one is an opportunity for an inner join that drops the two subjects with no baseline, or a join that fans out because a duplicate `ABLFL` slipped through.

Broadcasting means the join happened once, in the derivation program, under QC. After that, change from baseline is subtraction and a shift table is a cross-tabulation of two columns on the same row.

It also makes the failure visible. If two records were flagged as baseline, the broadcast would fan the dataset out and you would notice immediately. A per-table join would silently duplicate rows in one table and not another.
:::

## Clinical context

The variables baseline produces, all broadcast from the same selected record:

| Variable | Holds |
|---|---|
| `ABLFL` | `"Y"` on the selected record, null on all others |
| `BASE` | The selected record's `AVAL`, on every record |
| `BASEC` | The selected record's `AVALC`, when the parameter is categorical |
| `BNRIND` | The selected record's `ANRIND` — the baseline reference-range indicator |
| `BTOXGR`, `BTOXGRN` | The selected record's toxicity grade |

`BNRIND` and `BTOXGR` are what make a shift table possible without a join: the baseline category and the post-baseline category are on the same row.

:::standard{kind=official}
ADaMIG v1.3 defines `ABLFL` as the Baseline Record Flag, a record-level flag taking `"Y"` or null, and `BASE` as the baseline value of `AVAL` for the subject and parameter. It requires that **no more than one record per subject and parameter be flagged as baseline** for a given baseline definition, and `BASE` to be the `AVAL` of that flagged record.

ADaMIG v1.3 does not define *what* baseline is. The definition comes from the protocol and the SAP; ADaM only defines how it is recorded.
:::

:::standard{kind=convention}
The tie-breaking rules — later collection time, then higher `--SEQ` — are sponsor practice written into the SAP, not ADaM rules. What ADaM requires is that the result be a single record; how you get there is your specification's job.

CBX417-301's SAP Section 5.3 states: *"ties are broken by the later collection time, then by the higher `--SEQ`"*. Without that sentence two programmers implementing the same rule can select different records.
:::

## Formal concept

### `ABLFL` is not `--LOBXFL`

SDTM has a similar-looking flag. It is a different variable with a different owner and a different definition, and conflating them is a standing source of QC findings.

| | SDTM `--LOBXFL` | ADaM `ABLFL` |
|---|---|---|
| Name | Last Observation Before Exposure Flag | Baseline Record Flag |
| Defined by | SDTMIG v3.4 — last non-missing value before first study treatment exposure | The study's SAP |
| Owner | The SDTM programmer | The ADaM programmer |
| When there is no exposure | Not applicable — there is no exposure to be "before" | The SAP's fallback applies |
| Parameter-specific exceptions | None | Whatever the SAP says |

:::number[They agree on 2,910 records and disagree on 28. The 28 are the interesting ones.]
Joining every ADLB record to its source `LB` record through `SRCSEQ`:

| | `LBLOBXFL = "Y"` | `LBLOBXFL` null |
|---|---:|---:|
| `ABLFL = "Y"` | **2,910** | **28** |
| `ABLFL` null | 0 | 22,505 |

No record is flagged in SDTM and not in ADaM. Twenty-eight are flagged in ADaM and not in SDTM, and they are **4 subjects × 7 parameters** — precisely the four subjects who were randomized and never dosed.

SDTM is right to leave them null: `--LOBXFL` means "last observation before *exposure*", and a subject with no exposure has nothing for the flag to be before. ADaM is right to flag them: the SAP says that for never-treated subjects baseline is the last assessment on or before **randomization**, because an ITT analysis still needs their baseline characteristics.

**Two correct flags, disagreeing on 28 records, for a reason a reviewer can check in one query.** This is the single clearest illustration of why ADaM does not simply inherit SDTM's flag.
:::

### Where the tie-breakers come from

The rule "last non-missing assessment on or before first dose" has three places it can fail to resolve:

**Two records on the same date.** The first-dose day often has both a pre-dose safety draw and a repeat. Dates alone cannot separate them, so the rule falls back to collection time, which is why `LB` carries `LBDTC` with a time component and ADSL carries `TRTSDTM` as well as `TRTSDT`.

**Two records at the same date and time.** Rare, and it happens — a re-entered record, or a time recorded only to the hour. The final tie-breaker is the higher `--SEQ`, which is arbitrary but *deterministic*, and deterministic is the property that matters: two independent programs get the same answer.

**A record on the dose day whose time is after the dose.** This is the ECG problem, and it needs a different rule rather than a tie-breaker.

:::why[Why does the ECG baseline have its own rule?]
Because the Cycle 1 Day 1 ECG is performed **after** dosing, and its date is the first-dose date.

"On or before the date of first dose" would select it. That is a post-dose measurement being used as the baseline it is compared against, which would systematically understate the drug's effect on QTcF — the exact quantity the analysis exists to measure.

Subject `CBX417-301-1002-0001`, first dose 2022-05-23, shows both rules side by side:

| Dataset | Selected baseline | `ADY` | Why |
|---|---|---:|---|
| ADLB (ALT) | 2022-05-23 08:43 | 1 | Pre-dose blood draw on the dose day — qualifies |
| ADEG (QTcF) | 2022-05-11 10:12 | −12 | The 2022-05-23 11:23 ECG was **post**-dose, so the screening ECG is used |

Same subject, same day, two parameters, two different baseline records. The lab draw at 08:43 is before dosing; the ECG at 11:23 is after.

**The general principle:** when the collection schedule puts an assessment after dosing on the dose day, the baseline rule has to be "strictly before the first dose" rather than "on or before the date". The SAP has to name each such parameter, because the data cannot tell you which — a date without a usable time looks identical either way.

CBX417-301 has two such exceptions in SAP Section 5.3: ECG, and tumor assessment, where baseline is the last assessment on or before **randomization** rather than first dose, because the protocol requires the baseline scan within 28 days before randomization.
:::

## Worked example

Implement the rule, tie-breakers and all.

```r
library(dplyr)

adlb_base <- adlb_pre |>
  # candidates: non-missing, on or before the baseline reference date
  mutate(
    base_ref = coalesce(TRTSDTM, as.POSIXct(paste(TRTSDT, "23:59:59"))),
    cand     = !is.na(AVAL) & ADTM <= base_ref
  ) |>
  group_by(USUBJID, PARAMCD) |>
  arrange(ADTM, SRCSEQ, .by_group = TRUE) |>
  mutate(
    bl_row = if (any(cand)) max(which(cand)) else NA_integer_,
    ABLFL  = if_else(!is.na(bl_row) & row_number() == bl_row,
                     "Y", NA_character_)
  ) |>
  mutate(
    BASE   = AVAL[!is.na(ABLFL)][1],
    BNRIND = ANRIND[!is.na(ABLFL)][1],
    BTOXGR = ATOXGR[!is.na(ABLFL)][1]
  ) |>
  ungroup() |>
  mutate(CHG = if_else(!is.na(ABLFL), NA_real_, AVAL - BASE))
```

The four lines that carry the whole rule:

**`cand`** defines eligibility — non-missing *and* at or before the reference point. Missing values are excluded before the "last" is taken, which matters: the SAP says "last non-missing", and a null result on the dose day must not beat a real result from screening.

**`arrange(ADTM, SRCSEQ)`** makes the tie-breaking explicit. Datetime first, sequence second. This is the line that would otherwise be left to whatever order the dataset happened to arrive in.

**`if (any(cand)) … else NA_integer_`** handles the cells with no eligible record at all. Without the guard, `max()` over an empty set returns `-Inf` with a warning, and a warning inside a grouped mutate on 2,940 groups is a warning nobody reads.

**`BASE = AVAL[!is.na(ABLFL)][1]`** is the broadcast. `[1]` returns `NA` when no record is flagged, which is the correct result for the two subject-parameter cells with no baseline — and it is why the code does not need a branch for them.

:::mistake[Sorting by date and taking the last row without checking eligibility]
```r
# WRONG
group_by(USUBJID, PARAMCD) |>
  filter(ADT <= TRTSDT) |>
  slice_max(ADT, n = 1) |>
  mutate(ABLFL = "Y")
```

Three failures in four lines:

- `filter()` **removes** the post-baseline records from the dataset instead of flagging one — you now have a baseline-only dataset.
- `slice_max(ADT)` breaks ties by keeping *all* tied rows, so a subject with two records on the dose day gets two `ABLFL = "Y"` flags.
- `ADT <= TRTSDT` compares dates, so the post-dose Cycle 1 Day 1 ECG qualifies.

The version that flags rather than filters, and sorts on datetime then sequence, avoids all three.
:::

## Data example

::dataset{id="oncology/adam/adlb" cols="USUBJID,PARAMCD,AVISIT,ADT,ADY,AVAL,BASE,CHG,ANRIND,BNRIND,ATOXGR,BTOXGR,ABLFL,ONTRTFL" rows="10" caption="ADLB — BASE, BNRIND and BTOXGR broadcast from the ABLFL record"}

**The two subjects with no baseline, in full:**

```text
USUBJID              PARAMCD AVISIT        ADT        ADY AVAL BASE CHG  ABLFL
CBX417-301-1010-0001 HGB     CYCLE 1 DAY 8 2022-05-25   7  132   NA  NA  (null)
CBX417-301-1010-0001 HGB     CYCLE 2 DAY 1 2022-06-09  22  131   NA  NA  (null)
CBX417-301-1010-0001 HGB     CYCLE 4 DAY 1 2022-07-21  64  123   NA  NA  (null)
CBX417-301-1019-0002 ALT     CYCLE 2 DAY 1 2022-08-30  22   22   NA  NA  (null)
CBX417-301-1019-0002 ALT     CYCLE 4 DAY 1 2022-10-11  64   23   NA  NA  (null)
```

Five records, no `ABLFL`, null `BASE`, null `CHG`.

:::why[Should these records be in the dataset at all?]
Yes, and deleting them would be a mistake with two separate consequences.

**They are still values.** Subject 1010-0001's haemoglobin of 123 g/L at Cycle 4 is a real measurement. It contributes to the worst post-baseline summary, to the shift table's "missing baseline" category, and to any listing. Only the *change* is undefined.

**Their absence would be invisible.** A reviewer looking at ADLB can see that this subject has haemoglobin starting at Cycle 1 Day 8 and ask why. A reviewer looking at a dataset with those records removed sees nothing at all.

The SAP handles it explicitly: *"subjects without a baseline value are excluded from change-from-baseline summaries for that parameter but remain in the population and in all other summaries."* That sentence is why `CHG` is null rather than the record being dropped — the exclusion is expressed as a null, which every summary handles the same way.

**And this is why the QC check is "at most one", not "exactly one".** Asserting 2,940 baseline records fails on a correct dataset.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc sort data=adlb_pre out=elig;
  where not missing(aval) and adtm <= base_ref;
  by usubjid paramcd adtm srcseq;
run;

data blkey(keep=usubjid paramcd blseq);
  set elig;
  by usubjid paramcd;
  if last.paramcd;
  blseq = srcseq;
run;

proc sql;
  create table adlb as
  select a.*,
         case when a.srcseq = k.blseq then 'Y' else '' end as ablfl length=1,
         b.aval   as base,
         b.anrind as bnrind,
         b.atoxgr as btoxgr
  from       adlb_pre as a
  left join  blkey    as k on a.usubjid = k.usubjid and a.paramcd = k.paramcd
  left join  adlb_pre as b on b.usubjid = k.usubjid and b.paramcd = k.paramcd
                          and b.srcseq  = k.blseq
  ;
quit;

proc sql;
  select count(*) as cells_with_multiple_baselines
  from  (select usubjid, paramcd from adlb where ablfl = 'Y'
         group by usubjid, paramcd having count(*) > 1);
quit;
```

:::lines
2: Eligibility as a `WHERE` on the sort: non-missing **and** at or before the reference datetime. `base_ref` is the first-dose datetime, or the end of the randomization day for a never-treated subject, or strictly-before-dose for the parameters with an exception.
3: **The sort is the tie-breaker.** `adtm` then `srcseq` — datetime first, then the sequence number as the deterministic final resort. Leaving `srcseq` out makes the result depend on input order.
9: `if last.paramcd` keeps the final row of each group, which after an ascending sort is the latest eligible record. Groups with no eligible record never reach this step at all, so they simply have no key.
16: The flag, set by comparing each record's sequence number with the group's baseline key.
20-22: Two **left** joins: one to find the key, one to fetch the flagged record's values. Left, so the two subject-parameter cells with no baseline get a null `base` rather than disappearing.
27-31: **"At most one", not "exactly one".** This query must return 0. A query asserting 2,940 baseline records would fail on a correct dataset, because two cells legitimately have none.
:::
:::

:::tab[R]
```r
library(dplyr)

adlb <- adlb_pre |>
  group_by(USUBJID, PARAMCD) |>
  arrange(ADTM, SRCSEQ, .by_group = TRUE) |>
  mutate(
    cand   = !is.na(AVAL) & ADTM <= base_ref,
    bl_row = if (any(cand)) max(which(cand)) else NA_integer_,
    ABLFL  = if_else(!is.na(bl_row) & row_number() == bl_row,
                     "Y", NA_character_)
  ) |>
  mutate(
    BASE   = AVAL[!is.na(ABLFL)][1],
    BNRIND = ANRIND[!is.na(ABLFL)][1],
    BTOXGR = ATOXGR[!is.na(ABLFL)][1]
  ) |>
  ungroup() |>
  mutate(
    CHG  = if_else(!is.na(ABLFL), NA_real_, AVAL - BASE),
    PCHG = if_else(!is.na(ABLFL) | BASE == 0, NA_real_,
                   100 * (AVAL - BASE) / BASE)
  )

stopifnot(
  adlb |> filter(ABLFL == "Y") |> count(USUBJID, PARAMCD) |> pull(n) |> max() == 1,
  all(is.na(adlb$CHG[is.na(adlb$BASE)]))
)
```

:::lines
5: The explicit sort inside the group. Without `.by_group = TRUE` the arrange applies across groups and the `row_number()` below is meaningless.
7: Eligibility: non-missing and at or before the reference point.
8: `max(which(cand))` is the last eligible row after the sort, and the `if (any(cand))` guard returns `NA` for a group with no eligible record instead of `-Inf` and a warning.
9-10: One flag per group by construction — the tie-breaking lives in the `arrange`, not here.
13-15: The broadcast. `[!is.na(ABLFL)][1]` returns `NA` when no record is flagged, which is exactly right for the two cells with no baseline and removes the need for a branch.
20: `CHG` is null on the baseline record itself, by this study's convention, and null wherever `BASE` is null.
21-22: `PCHG` additionally guards against a zero baseline, which would otherwise be a division by zero.
26: **"At most one."** `max(n) == 1` passes on a correct dataset; `nrow() == 2940` would not.
:::
:::
::::

## Output

```text
> adlb |> summarise(
+     cells     = n_distinct(paste(USUBJID, PARAMCD)),
+     baselines = sum(ABLFL == "Y", na.rm = TRUE),
+     no_base   = sum(is.na(BASE)),
+     bad_chg   = sum(!is.na(CHG) & is.na(BASE)))

  cells baselines no_base bad_chg
1  2940      2938       5       0
```

2,940 subject-parameter cells, 2,938 baselines, 5 records with no `BASE` across the two cells that have none, and no record with a change computed against a missing baseline.

## Common mistakes

:::mistake[Asserting exactly one baseline per subject and parameter]
ADaMIG requires *at most* one. On this study two subject-parameter cells have no pre-dose assessment, so a check asserting 2,940 fails on correct data — and then somebody "fixes" it by flagging a post-baseline record as baseline, which corrupts every change for that subject.
:::

:::mistake[Using SDTM's `--LOBXFL` as `ABLFL`]
They are different variables with different definitions and different owners. On this study they disagree on 28 records — the four never-dosed subjects, whose ADaM baseline falls back to randomization. Copying `LBLOBXFL` would leave those four subjects with no baseline in an ITT analysis that needs their baseline characteristics.
:::

:::mistake[Comparing dates when the schedule has post-dose assessments on the dose day]
The Cycle 1 Day 1 ECG is taken after dosing and shares its date with the first dose. `ADT <= TRTSDT` selects it as baseline, and the QTcF change from baseline then compares a post-dose value against a post-dose value. Compare datetimes, and name the exception in the SAP.
:::

:::mistake[Filtering instead of flagging]
`filter(ADT <= TRTSDT)` produces a dataset containing only pre-baseline records. `ABLFL` is a flag precisely so the post-baseline records survive — a BDS dataset holds every record and marks the ones the analysis uses.
:::

:::mistake[Leaving the tie-breaker to the sort order of the input]
"Last on or before first dose" does not resolve two records at the same datetime. Without an explicit final tie-breaker — the higher `--SEQ` — two independent programs can select different records, and every change from baseline for that subject differs. The rule has to be deterministic, not merely reasonable.
:::

:::mistake[Deleting records with no baseline]
Their values are still real and still feed worst-post-baseline summaries, shift tables and listings. Only the change is undefined, and a null `CHG` expresses that in a way every summary handles correctly. Deleting them makes the gap invisible to a reviewer.
:::

## Knowledge check

::quiz{ids="adam.base.lobxfl,adam.base.at-most-one,adam.base.ecg-exception,adam.base.broadcast"}

## Hands-on exercise

::practice{ids="adam.base.derive-code,adam.base.tiebreak,adam.base.no-baseline,adam.base.never-treated" title="Practice: implementing a baseline rule"}

## Challenge exercise

::practice{ids="adam.base.spec-gaps,adam.base.open-review" title="Challenge: the baseline rule that two programmers implemented differently"}

## Industry note

**Baseline is the most common source of disagreement between two independent derivations.** Production and QC implement the same SAP sentence and select different records, usually because of a tie, a time component one program ignored, or a never-treated subject. Reconciling them before database lock is routine, and the fix is almost always a sentence added to the specification rather than a bug in either program.

**Write the baseline rule with its exceptions in one place.** CBX417-301's SAP Section 5.3 states the general rule, the tie-breakers, the never-treated fallback and the two parameter-specific exceptions in six sentences. That section is what the ADRG points at and what the QC programmer implements from.

**Interviewers use baseline because it separates people who have read about ADaM from people who have built it.** "How do you derive baseline" has a short answer everyone knows. The follow-up — "what about a subject who was never dosed", or "what if two records share a datetime" — is the actual question.

:::standard{kind=official}
ADaMIG v1.3 provides `ABLFL`, `BASE`, `BASEC`, `BNRIND` and `BTOXGR` and constrains their relationship: at most one baseline record per subject and parameter for a given baseline definition, with `BASE` holding that record's `AVAL`. SDTMIG v3.4 provides `--LOBXFL`, the Last Observation Before Exposure Flag, as a separate SDTM variable. Neither standard defines what baseline *is* for a particular study — that is the protocol's and the SAP's job.
:::

**Some studies need more than one baseline definition.** A crossover trial has a baseline per period; a study with a run-in may want both a screening baseline and a post-run-in baseline. ADaM supports this through additional flags (`ABLFL` plus sponsor-defined alternatives) and through `BASETYPE`, which labels which definition a record's `BASE` belongs to. CBX417-301 is a single-period parallel-group study and needs only one, which is why `BASETYPE` does not appear in its datasets.

:::interview[Walk me through deriving baseline.]
"The rule itself is one sentence — the last non-missing assessment on or before the first dose — and everything interesting is in the cases that sentence doesn't resolve.

**Ties.** Two records on the dose day is normal: a pre-dose safety draw and a repeat. Dates can't separate them, so you sort on datetime, and then you need a final tie-breaker for records at the same datetime — usually the higher `--SEQ`. That last one is arbitrary but it's *deterministic*, which is the property that matters, because two independent programs have to land on the same record.

**Assessments that are after the dose on the dose day.** On the study I've worked with the Cycle 1 Day 1 ECG is taken post-dose and shares its date with the first dose, so 'on or before the date' picks it — and you'd be comparing a post-dose QTcF to itself. That parameter needs 'strictly before the first dose', and the SAP has to name it, because the data can't tell you which parameters are affected.

**Never-treated subjects.** There's no first dose date at all. Four subjects on this study. The SAP falls back to randomization, and that's the single clearest place where ADaM's `ABLFL` diverges from SDTM's `--LOBXFL` — SDTM correctly leaves `LBLOBXFL` null, because there's no exposure for an observation to be before, and ADaM correctly flags a baseline, because an ITT analysis still needs those subjects' baseline characteristics. Twenty-eight records disagree between the two flags and all 28 are those four subjects across seven parameters.

**Subjects with no pre-dose record for a parameter.** Two cells on this study. They get no `ABLFL`, null `BASE`, null `CHG`, and they stay in the dataset — the values are still real and still feed worst-post-baseline summaries. Which means the QC check is 'at most one baseline per subject and parameter', not 'exactly one'. A check asserting 2,940 fails on correct data, and then somebody fixes the check by flagging a post-baseline record, which corrupts every change for that subject.

Then `BASE` is broadcast to every record for the subject and parameter, along with `BNRIND` and `BTOXGR` so a shift table is a cross-tabulation of two columns on the same row rather than a self-join in every table program."
:::
