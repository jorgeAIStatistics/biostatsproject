## What problem are we trying to solve?

One row of Table 14.3.1.2, TEAEs by system organ class and preferred term:

```text
                          CBX-417 + Docetaxel    Placebo + Docetaxel
                                 (N = 209)             (N = 207)

  Diarrhea                      102 (48.8%)            46 (22.2%)
```

Four numbers. Each one is a decision somebody had to make, and none of them is in SDTM `AE`.

**102 is not the number of diarrhoea events.** There are 136 diarrhoea events in the CBX arm, spread over 102 subjects; one subject had four. An incidence table counts **subjects**, because a subject who reports diarrhoea four times has not become four patients.

**209 is not the number randomized.** It is the safety population by *actual* treatment: 210 were randomized to CBX-417, 2 were never dosed, 1 received only placebo kits, and 2 randomized to placebo received a CBX-417 kit.

**102 is not every subject who ever reported diarrhoea.** It counts subjects with a *treatment-emergent* event — one that started on or after the first dose and no later than 30 days after the last. On this study 56 of the 2,466 AE records are not treatment-emergent: 40 started before the first dose and 16 after the window closed.

**And the window itself depends on dates that were partly imputed.** Twelve AE records have a partial start date in SDTM. For one of them, the imputation is the reason the event is treatment-emergent at all.

ADAE exists so that all four of those decisions happen once, before any table program runs.

:::number[136 events, 102 subjects, 148 subjects across both arms]
Verified from `data/oncology/adam/adae.csv`, records with `TRTEMFL = "Y"` and `AEDECOD = "Diarrhea"`:

| Arm | Events | Subjects |
|---|---:|---:|
| CBX-417 + Docetaxel | 136 | 102 |
| Placebo + Docetaxel | 54 | 46 |
| **Total** | **190** | **148** |

`102 / 209 = 48.8%` and `46 / 207 = 22.2%` — the numbers in the shell.

If the table counted events instead, the CBX cell would read `136 / 209 = 65.1%`, a percentage that has nothing to do with the proportion of subjects affected and is not bounded by 100%.

**`AOCCPFL = "Y"` appears on exactly 148 diarrhoea records** — one per subject per preferred term. That is what makes the incidence count a filter rather than a `DISTINCT`.
:::

## Intuition

OCCDS is the structure for data where the question is **"did this happen, and what was it like"** rather than "what was the value".

That single difference drives everything:

| | BDS (ADLB) | OCCDS (ADAE) |
|---|---|---|
| Topic | A parameter with a value | An occurrence with attributes |
| Key | subject, parameter, timepoint | subject, `AESEQ` |
| Selection | one record per cell (`ANL01FL`) | one record per subject per term (`AOCCzzFL`) |
| Missing data | a visit with no value | nothing — an event that did not happen has no record |
| Denominator | subjects with a value at that visit | subjects in the population |

:::why[Why is the denominator different, and why does that matter so much?]
Because an adverse event dataset has no rows for things that did not happen, and the absence of a row is the *information*.

In ADLB, a subject with no Week 12 haemoglobin is missing data, and the denominator of the Week 12 row shrinks accordingly. In ADAE, a subject with no diarrhoea record did not have diarrhoea — that is not missingness, it is the answer. So the denominator stays at the full population.

That is why every AE table carries `N = 209` in the column header and why the n in an ADLB by-visit table changes row by row. It also means **an AE table's denominator can never be recovered from ADAE alone**: the subjects with no events for that term are not in the dataset. The denominator comes from ADSL, counting `SAFFL = "Y"` by `TRT01A`.

The practical consequence: a programmer who computes percentages from `count(AEDECOD, TRTA)` has divided by whatever the largest term's subject count happened to be, and the answer will look plausible.
:::

## Clinical context

The ADAE variables that do the work:

| Group | Variables | What they decide |
|---|---|---|
| **Analysis dates** | `ASTDT`, `ASTDTF`, `AENDT`, `AENDTF`, `ASTDY`, `AENDY`, `ADURN` | When the event happened, after imputation, and whether it was imputed |
| **Treatment emergence** | `TRTEMFL` | Whether the event is in the safety analysis at all |
| **Severity and causality** | `ATOXGR`, `ATOXGRN`, `AREL`, `AERELDOC` | Which grade and relatedness tables the event enters |
| **Occurrence flags** | `AOCCFL`, `AOCCSFL`, `AOCCPFL` | Which record represents the subject in each level of the incidence table |
| **From ADSL** | `TRTA`, `TRTAN`, `SAFFL`, `TRTSDT`, `TRTEDT` | Column, population, and the bounds of the emergence window |

:::standard{kind=official}
ADaMIG v1.3 defines **OCCDS** (the Occurrence Data Structure) for data such as adverse events, concomitant medications and medical history, where the topic is an occurrence rather than a measured parameter. It specifies `ASTDT`/`AENDT` and the imputation flags `ASTDTF`/`AENDTF`, `TRTEMFL` as the Treatment Emergent Analysis Flag, and the occurrence flag family `AOCCFL`, `AOCCSFL` and `AOCCPFL`.

All of these are record-level flags taking `"Y"` or null.
:::

:::standard{kind=convention}
**The 30-day window is a sponsor decision**, not a standard. `TRTSDT ≤ ASTDT ≤ TRTEDT + 30` is CBX417-301's definition, from SAP Section 10.1.1. Thirty days is the most common choice in oncology; 28 days, 7 days and "through the end of the study" all appear, and a drug with a long half-life may use much longer.

**The imputation rules are also sponsor decisions.** ADaM requires that imputation be flagged; it does not say how to impute. Different rules produce different `TRTEMFL` values on the same records.
:::

## Formal concept

### Partial dates: the imputation that creates a treatment-emergent event

SDTM keeps `AESTDTC` exactly as collected, including `"2022-04"` when the site recorded a month and no day. ADaM has to produce a usable `ASTDT`, and the rule it uses decides whether the event is in the safety table.

CBX417-301's rule, from SAP Section 10.1.2:

| Situation | Rule | `ASTDTF` |
|---|---|---|
| Start date complete | No imputation | (blank) |
| Day missing | First of the month — **unless** the month and year are those of `TRTSDT`, in which case `TRTSDT` | `D` |
| Month and day missing | 1 January — **unless** the year is that of `TRTSDT`, in which case `TRTSDT` | `M` |
| Any imputed start later than a complete end date | Set to the end date | as above |
| Start completely missing | Not imputed; treated as emergent unless the end date precedes `TRTSDT` | (blank) |

:::number[Two adjacent records where the rule decides everything]
Twelve of 2,466 ADAE records carry an `ASTDTF`: ten `"D"` and two `"M"`.

**Record 1 — the exception makes the event emergent.**

```text
USUBJID CBX417-301-1026-0001, AESEQ 1, "tiredness" / Fatigue
AESTDTC 2022-04        TRTSDT 2022-04-11
ASTDT   2022-04-11     ASTDTF D      ASTDY 1      TRTEMFL Y
```

The day is missing and the month matches the first-dose month, so the exception applies and `ASTDT` becomes `TRTSDT`. `ASTDY = 1`, and the event is treatment-emergent.

**Without the exception** — plain "first of the month" — `ASTDT` would be 2022-04-01, `ASTDY = −10`, and `TRTEMFL` would be null. A fatigue event that a site recorded as starting in the month the subject began treatment would have been classified as pre-treatment.

**Record 2 — the end-date cap makes the event *not* emergent.**

```text
USUBJID CBX417-301-1029-0005, AESEQ 2, "Nauseous" / Nausea
AESTDTC 2023-03        AEENDTC 2023-03-20      TRTSDT 2023-03-21
ASTDT   2023-03-20     ASTDTF D      ASTDY -1     TRTEMFL (null)
```

The month matches, so the exception would give `ASTDT = TRTSDT = 2023-03-21`. But the event *ended* on 2023-03-20, and a start date after a complete end date is impossible. The fourth rule caps it at the end date, `ASTDY` becomes −1, and the event is correctly pre-treatment.

**Two records, same month-missing situation, opposite classifications** — and the difference comes entirely from a rule in the SAP rather than from anything in the data.
:::

:::why[Why impute at all instead of excluding partial-date events?]
Because excluding them is itself an imputation, with a worse bias.

An event with a partial date is an event that happened. Dropping it removes it from the numerator while the subject stays in the denominator, which understates the incidence — and partial dates are not randomly distributed. They cluster at sites with weaker data entry and in events reported retrospectively, which skews toward events the subject did not report promptly.

Imputing puts every event somewhere, flags which ones were placed rather than observed, and lets a reviewer count them and run a sensitivity analysis. `ASTDTF` is the variable that makes that possible: 12 records on this study, findable in one query.

**And note the direction the rules choose.** "First of the month unless it matches the first-dose month" pushes an ambiguous event *into* the treatment-emergent window rather than out of it. That is the conservative direction for a safety analysis — it counts a possible drug-related event rather than discarding it.
:::

### Occurrence flags: one record per subject, per level of the table

An incidence table has three levels, and each needs a different "one record per subject":

| Flag | One record per | Used by | `"Y"` on |
|---|---|---|---:|
| `AOCCFL` | subject | "Subjects with any TEAE" | 414 |
| `AOCCSFL` | subject × system organ class | the SOC rows | 1,673 |
| `AOCCPFL` | subject × preferred term | the PT rows | 2,142 |

:::number[Why 414, 1,673 and 2,142 rather than 2,410]
2,410 records are treatment-emergent. They belong to **414 subjects**.

- `AOCCFL = "Y"` on 414 records — the chronologically first TEAE for each subject. Counting them gives the "any TEAE" row directly.
- `AOCCSFL = "Y"` on 1,673 — each subject's first event in each system organ class. A subject with events in five SOCs contributes five.
- `AOCCPFL = "Y"` on 2,142 — each subject's first event of each preferred term. For diarrhoea specifically, 148 records across both arms, matching the 102 + 46 subject counts exactly.

The flags are derived **after** restricting to `TRTEMFL = "Y"` and sorting by `USUBJID`, `ASTDT`, `AESEQ`. The ordering matters: the flag marks the *first* occurrence, so a table of time-to-first-event reads `ASTDY` off the flagged record.

**Counting distinct `USUBJID` gives the same answer** and the ADaM specification names it as the recommended QC method. The flags exist so the table program is a filter, not because a `DISTINCT` would be wrong.
:::

:::mistake[Using an occurrence flag for a grade table]
`AOCCPFL` marks the **first** occurrence. A table of maximum CTCAE grade by preferred term needs each subject's **worst** occurrence, which is a different record.

```text
Subject with three diarrhoea events: grade 1 (day 14), grade 3 (day 40), grade 2 (day 70)

AOCCPFL = "Y" on the day-14 record — grade 1
The grade table needs the day-40 record — grade 3
```

Filtering a grade table on `AOCCPFL` understates severity, and it does so silently: every subject is still counted once, the totals are right, and the grade distribution is wrong. The specification says it explicitly — grade-based tables select each subject's maximum `ATOXGRN` within the summarized grouping, not the occurrence-flagged record.
:::

## Worked example

Build the diarrhoea row, and then the row above it.

```r
library(dplyr)

denom <- adsl |>
  filter(SAFFL == "Y") |>
  count(TRTA = TRT01A, name = "N")

pt_row <- adae |>
  filter(TRTEMFL == "Y", AOCCPFL == "Y", AEDECOD == "Diarrhea") |>
  count(TRTA, name = "n") |>
  left_join(denom, by = "TRTA") |>
  mutate(pct = 100 * n / N)
```

```text
  TRTA                    n   N   pct
1 CBX-417 + Docetaxel   102 209 48.80
2 Placebo + Docetaxel    46 207 22.22
```

**The `left_join` to ADSL is the important line.** ADAE cannot supply the denominator: subjects with no diarrhoea record are not in it. Every AE percentage is a numerator from ADAE over a denominator from ADSL, and they are joined on the treatment column.

:::why[What happens if a term appears in only one arm?]
The `count()` returns one row, the join fills the other arm with nothing, and the table prints a blank cell instead of `0 (0.0%)`.

That is a shell decision — CBX417-301's SAP Section 5.1 says percentages are not shown when the count is zero — but it has to be implemented by joining the *denominator* frame to the counts rather than the other way round, so every arm always has a row.

The same argument applies at the term level: a full AE table needs every term crossed with every arm, which is a `complete()` or a Cartesian join, not a `count()`. Otherwise a term reported only on placebo appears with one cell filled and the other empty, and a reader cannot tell a zero from a missing row.
:::

**The row above** — "Subjects with any TEAE" — uses `AOCCFL` and no term filter:

```r
adae |>
  filter(TRTEMFL == "Y", AOCCFL == "Y") |>
  count(TRTA, name = "n") |>
  left_join(denom, by = "TRTA") |>
  mutate(pct = 100 * n / N)
```

```text
  TRTA                    n   N    pct
1 CBX-417 + Docetaxel   209 209 100.00
2 Placebo + Docetaxel   205 207  98.55
```

Every subject who received CBX-417 had at least one treatment-emergent adverse event. That is normal in a docetaxel-combination trial and is exactly the kind of number a reviewer checks against the denominator: 209 of 209 is only meaningful because 209 is the right denominator.

::widget{name="denominator-explorer"}

## Data example

::dataset{id="oncology/adam/adae" cols="USUBJID,AESEQ,AETERM,AEDECOD,AEBODSYS,ASTDT,ASTDTF,AENDT,ASTDY,ATOXGRN,AESER,AREL,TRTEMFL,AOCCFL,AOCCSFL,AOCCPFL,TRTA" rows="10" caption="ADAE — one record per adverse event, 2,466 records over 414 subjects"}

**The whole dataset in five counts:**

| | Records |
|---|---:|
| Total AE records | 2,466 |
| `TRTEMFL = "Y"` | 2,410 |
| Not treatment-emergent: started before first dose (`ASTDY < 1`) | 40 |
| Not treatment-emergent: started after `TRTEDT + 30` | 16 |
| With an imputed start date (`ASTDTF` populated) | 12 |

And the severity distribution, over all records:

| `ATOXGRN` | Records |
|---:|---:|
| 1 | 1,175 |
| 2 | 789 |
| 3 | 378 |
| 4 | 96 |
| 5 | 28 |

:::number[Two subjects in the safety population have no ADAE record at all]
416 subjects received treatment; ADAE contains 414. Two placebo subjects — one with 417 days of exposure — reported no adverse event of any kind.

**They are still in the denominator.** `SAFFL = "Y"`, so they count in the 207, and they contribute to no numerator. That is the correct behaviour and it is why the denominator has to come from ADSL: ADAE has no row to tell you they exist.

It is also a data-quality question worth asking. A subject on cytotoxic chemotherapy for 417 days with zero recorded adverse events is unusual enough that a data manager would query the site. The analysis handles it correctly either way; the monitoring plan is where it gets noticed.
:::

## Code

::::tabs
:::tab[SAS]
```sas
data adae;
  merge ae (in=a) adsl (keep=usubjid saffl trt01a trt01an trtsdt trtedt
                             rename=(trt01a=trta trt01an=trtan) in=b);
  by usubjid;
  if a and b;

  length astdtf $1;
  if length(aestdtc) >= 10 then do;
    astdt = input(substr(aestdtc, 1, 10), yymmdd10.);
    astdtf = '';
  end;
  else if length(aestdtc) = 7 then do;
    if input(substr(aestdtc, 1, 7), yymmn6.) = intnx('month', trtsdt, 0, 'b')
      then astdt = trtsdt;
      else astdt = input(cats(aestdtc, '-01'), yymmdd10.);
    astdtf = 'D';
  end;
  if not missing(aendt) and astdt > aendt then astdt = aendt;

  astdy = astdt - trtsdt + (astdt >= trtsdt);

  length trtemfl $1;
  if saffl = 'Y' and not missing(trtsdt)
     and trtsdt <= astdt <= trtedt + 30 then trtemfl = 'Y';
  else trtemfl = '';
run;
```

:::lines
1-5: `if a and b` keeps only AE records for subjects present in ADSL. `merge` without it would silently create rows for ADSL subjects with no adverse events — 2 on this study — with every AE variable null, and those phantom rows would count in any `where trtemfl = ''` query.
2-3: The rename happens in the `KEEP`, so the ADAE variables are `TRTA`/`TRTAN` as OCCDS names them, sourced from ADSL's `TRT01A`/`TRT01AN`.
12-16: The month-missing exception. When the AE's year-month equals the first dose's year-month, the imputed start is `TRTSDT` rather than the first of the month — which is what makes subject 1026-0001's fatigue treatment-emergent.
18: **The cap.** An imputed start date later than a complete end date is impossible. This one line is what makes subject 1029-0005's nausea correctly pre-treatment.
20: `astdt - trtsdt + (astdt >= trtsdt)` is the no-day-zero rule written as one expression: add 1 on or after the first dose, add 0 before it.
23-24: `TRTEMFL` needs `saffl = 'Y'` as well as the window. A never-dosed subject has a null `trtsdt` and the comparison would be missing, which evaluates as false — but stating the condition documents it.
25: `else trtemfl = ''` — the flag is `'Y'` or null, never `'N'`.
:::
:::

:::tab[R]
```r
library(dplyr)

adae <- ae |>
  inner_join(
    adsl |> select(USUBJID, SAFFL, TRTA = TRT01A, TRTAN = TRT01AN,
                   TRTSDT, TRTEDT),
    by = "USUBJID"
  ) |>
  mutate(
    ASTDTF = case_when(nchar(AESTDTC) >= 10 ~ NA_character_,
                       nchar(AESTDTC) ==  7 ~ "D",
                       nchar(AESTDTC) ==  4 ~ "M"),
    ASTDT  = case_when(
      nchar(AESTDTC) >= 10 ~ as.Date(substr(AESTDTC, 1, 10)),
      nchar(AESTDTC) ==  7 &
        format(TRTSDT, "%Y-%m") == AESTDTC ~ TRTSDT,
      nchar(AESTDTC) ==  7 ~ as.Date(paste0(AESTDTC, "-01")),
      format(TRTSDT, "%Y") == AESTDTC ~ TRTSDT,
      TRUE ~ as.Date(paste0(AESTDTC, "-01-01"))
    ),
    ASTDT   = if_else(!is.na(AENDT) & ASTDT > AENDT, AENDT, ASTDT),
    ASTDY   = as.integer(ASTDT - TRTSDT) + if_else(ASTDT >= TRTSDT, 1L, 0L),
    TRTEMFL = if_else(SAFFL == "Y" & !is.na(TRTSDT) &
                        ASTDT >= TRTSDT & ASTDT <= TRTEDT + 30,
                      "Y", NA_character_)
  )
```

:::lines
4-8: An **inner** join. A left join from ADSL would create rows for the 2 safety subjects with no adverse events; a left join from `ae` would keep AE records for subjects not in ADSL, of which there should be none — and asserting that is cheaper than hoping.
10-12: `ASTDTF` records the imputation level before anything is imputed, so the flag cannot drift out of step with the date.
13-20: The `case_when` order *is* the rule's precedence. The exceptions are tested before the general cases, because `case_when` returns the first match.
21: The end-date cap, applied after imputation to every branch.
22: `as.integer(ASTDT - TRTSDT) + if_else(ASTDT >= TRTSDT, 1L, 0L)` — no day zero.
23-25: `TRTEMFL` is `"Y"` or `NA`, never `"N"`. `if_else` propagates `NA` when the condition is `NA`, which is the right behaviour for a subject with no `TRTSDT`.
:::
:::
::::

## Output

```text
> adae |> count(imputed = !is.na(ASTDTF), emergent = !is.na(TRTEMFL))

  imputed emergent     n
1 FALSE   FALSE       55
2 FALSE   TRUE      2399
3 TRUE    FALSE        1
4 TRUE    TRUE        11
```

Twelve imputed start dates, eleven of them treatment-emergent and one not — subject 1029-0005, whose imputed start was capped at the end date.

**That single row is the reason `ASTDTF` exists.** A reviewer can produce this cross-tabulation in one line, see that 12 records had a date placed rather than observed, and check each one against the rule. Without the flag, the imputed dates would be indistinguishable from collected ones.

## Common mistakes

:::mistake[Counting events instead of subjects]
Diarrhoea in the CBX arm: 136 events, 102 subjects. The table says 102 (48.8%). Counting events gives 65.1%, a "percentage of subjects" that is not bounded by 100% and does not describe anything. Filter on `AOCCPFL = "Y"` or count distinct `USUBJID`.
:::

:::mistake[Taking the denominator from ADAE]
Subjects with no event for a term are not in ADAE at all — and two subjects in the safety population have no ADAE record whatsoever. The denominator is always `count(SAFFL = "Y")` by `TRT01A` from ADSL, joined onto the counts.
:::

:::mistake[Using `AOCCPFL` for a grade table]
It marks the first occurrence, not the worst. A subject whose diarrhoea was grade 1 on day 14 and grade 3 on day 40 is counted at grade 1. Every subject is still counted once and the totals still add up, which is what makes it invisible.
:::

:::mistake[Deriving occurrence flags before filtering to treatment-emergent]
`AOCCFL` must mark the first *treatment-emergent* event. Derive it over all records and a subject whose first AE was pre-treatment has the flag on a record that `TRTEMFL = "Y"` will then exclude — so they vanish from the "any TEAE" row while remaining in the denominator.
:::

:::mistake[Excluding partial-date events instead of imputing them]
Dropping them removes events from the numerator while the subjects stay in the denominator, and partial dates cluster non-randomly. Impute, flag with `ASTDTF`, and let a reviewer count them — 12 records here, one query.
:::

:::mistake[Treating `TRTEMFL` null as `"N"`]
Record-level flags are `"Y"` or null. `where trtemfl ne 'N'` is true for every record in SAS and includes the 56 non-emergent ones. Test `= 'Y'`.
:::

## Knowledge check

::quiz{ids="adam.adae.subjects-not-events,adam.adae.denominator-source,adam.adae.occ-vs-grade,adam.adae.imputation-effect"}

## Hands-on exercise

::practice{ids="adam.adae.pt-row-code,adam.adae.trtemfl-cases,adam.adae.occurrence-order,adam.adae.astdtf" title="Practice: building an incidence row"}

## Challenge exercise

::practice{ids="adam.adae.wrong-flag,adam.adae.open-safety-review" title="Challenge: an AE table that counts everybody once and is still wrong"}

## Industry note

**The AE tables are the most-read part of a CSR after the efficacy summary, and they are almost entirely denominators and flags.** Very little arithmetic happens in them. Almost all of the risk is in which subjects are in the column, which records are in the numerator, and whether a subject is counted once.

**The treatment-emergent window is a clinical decision with a statistical implementation.** Thirty days after the last dose reflects a judgement about how long an event could still be attributable to the drug. A drug with a long half-life or a delayed immune mechanism needs longer, and the SAP has to justify it rather than copy the previous protocol.

:::standard{kind=official}
ICH E2A defines an adverse event and a serious adverse event and establishes the expedited-reporting framework, and ICH E3 Section 12 describes how safety data are presented in a clinical study report — adverse events summarised by body system and preferred term, with listings of deaths, serious events and discontinuations. Neither document prescribes the treatment-emergent window, which is why it lives in the protocol and SAP.
:::

**Interviewers reach for the denominator question because it separates people who have produced an AE table from people who have read one.** "How do you build the diarrhoea row" has an obvious answer. "Where does the 209 come from, and is it the same 209 as in the demographics table" does not — and on this study it is not: demographics is on ITT with 210.

:::interview[Walk me through producing the AE overview table.]
"Every number in it is a count of subjects over a denominator from a different dataset, so I'd start with the denominator.

**The denominator is ADSL**, not ADAE: `SAFFL = 'Y'` counted by `TRT01A`. On the study I worked with that's 209 and 207 — not 210 and 210, because four subjects were never dosed and three got a drug they weren't randomized to. ADAE can't supply it, because subjects with no events for a term aren't in the dataset; two subjects in the safety population have no ADAE record at all and they still belong in the 207.

**The numerators count subjects, not events.** Diarrhoea in the CBX arm is 136 events over 102 subjects — one subject had four. `AOCCPFL = 'Y'` gives one record per subject per preferred term, so the count is a filter; counting distinct `USUBJID` gives the same answer and is the recommended QC method. `AOCCSFL` does the same at system organ class level, and `AOCCFL` once per subject for the 'any TEAE' row.

**Two things about those flags I'd want to get right.** They're derived *after* restricting to treatment-emergent records — derive them first and a subject whose first event was pre-treatment has the flag on a record the table then excludes, so they disappear from the numerator while staying in the denominator. And they mark the *first* occurrence, so they're wrong for a maximum-grade table, which needs each subject's worst event. That error counts every subject exactly once and gets the totals right, which is why nobody notices.

**Then `TRTEMFL`**, which decides what's in the table at all: start on or after first dose and no later than 30 days after last dose. The 30 days is a sponsor decision in the SAP, not a standard. On this study 56 of 2,466 records aren't emergent — 40 pre-treatment, 16 after the window.

**And the partial dates.** Twelve records had an imputed start date, and for at least one of them the imputation is what makes the event emergent: a fatigue event recorded as '2022-04' in the month the subject started treatment. Under a plain 'first of the month' rule it would have been day −10 and excluded. `ASTDTF` flags all twelve so a reviewer can find them in one query and run a sensitivity analysis.

The check I'd run before showing anyone the table is that no numerator exceeds its denominator and the 'any TEAE' row is at least as large as every other row in its column."
:::
