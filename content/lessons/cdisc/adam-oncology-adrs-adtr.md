## What problem are we trying to solve?

Two rows from the CBX417-301 efficacy shells. They are one word apart.

```text
Table 14.2.3  Objective response, intent-to-treat population

                                      CBX-417 + Docetaxel   Placebo + Docetaxel
                                            (N = 210)             (N = 210)

  Best overall response (unconfirmed)       70 (33.3%)            38 (18.1%)
  Confirmed objective response              58 (27.6%)            31 (14.8%)
```

The word is **confirmed**, and it moves 19 subjects out of the responder column. Each of those 19 had a partial response recorded by their investigator on a real scan. None of them is a responder in the primary ORR analysis.

Now try to produce either row from SDTM. `RS` has 1,928 investigator responses, one per assessment per subject, each a three-letter string: `CR`, `PR`, `SD`, `PD`, `NE`. Nothing in `RS` says which of a subject's assessments was their best, whether a response was confirmed, or whether an assessment should have been looked at at all.

**ADRS answers those three questions once**, as data, with a date and a pointer to the record the answer came from. **ADTR holds the measurement underneath** — the sum of target-lesion diameters behind the category, and the percentage change behind a waterfall plot.

:::number[108 responders, 89 confirmed responders, 19 downgrades]
Verified from `data/oncology/adam/adrs.csv`, one record per subject for each of `BOR` and `CBOR`:

| `AVALC` | `BOR` (unconfirmed) | `CBOR` (confirmed) |
|---|---:|---:|
| CR | 1 | 1 |
| PR | 107 | 88 |
| SD | 227 | 246 |
| PD | 71 | 71 |
| NE | 14 | 14 |

CR + PR is **108 unconfirmed** and **89 confirmed**. The cross-tabulation of the two parameters is diagonal except for one cell: **19 subjects move from PR to SD**, 12 on CBX-417 and 7 on placebo. Nobody moves the other way, and no CR, PD or NE changes.

By arm: `BOR` responders 70 and 38; `CBOR` responders 58 and 31, so `58 / 210 = 27.6%` and `31 / 210 = 14.8%`. The 89 confirmed responders are also exactly the 89 subjects with a `DOR` record in ADTTE — duration of response can only exist for a subject who responded.
:::

## Intuition

ADRS holds three parameters that look alike and are three different kinds of thing.

| `PARAMCD` | Records | What it is |
|---|---:|---|
| `OVRLRESP` | 1,928 | **Observation.** One per assessment, copied from `RS.RSSTRESC` |
| `BOR` | 420 | **Conclusion.** One per subject: the best `OVRLRESP` the rules allow you to count |
| `CBOR` | 420 | **Conclusion under a different rule.** The same, with confirmation required |

`OVRLRESP` is data. `BOR` and `CBOR` are *arguments* — a chain of reasoning about a subject, reduced to one letter. ADaM stores them as records rather than as variables so that the reasoning keeps the things reasoning needs: a date, a source pointer, and a parameter whose definition lives in define.xml.

ADTR is the same shape one layer down: `SUMDIAM` is the measurement at each visit, `BPCHG` is a conclusion about the subject.

:::why[Why is best overall response a record rather than a variable on ADSL?]
Because a conclusion has provenance, and a subject-level variable has nowhere to put it.

Subject `CBX417-301-1002-0001`'s `CBOR` is `PR`, reached **on 2022-08-11** from **`RS` sequence 2**. As `PARAMCD = "CBOR"` those two facts live in `ADT` and `SRCSEQ`, which every BDS dataset already has. As an ADSL variable `CBORRESP` they need two more variables invented for the purpose — then two more for `BOR`, and two more for the next endpoint.

It also matters that `BOR` and `CBOR` are *the same question under different rules*. As parameters they sit side by side, differ for 19 subjects, and can be compared in one `count()`. As ADSL variables they would look like two unrelated facts — and a reviewer checking one subject's derivation would need the program rather than four rows of ADRS.
:::

## Clinical context

The RECIST 1.1 rules behind these categories — target lesions, nadir, the 30% and 20% thresholds — are covered elsewhere and are not repeated here.

::lesson{id="trials-oncology-response-recist" label="Review: RECIST 1.1, best overall response and the PFS censoring rules"}

:::standard{kind=official}
**RECIST 1.1 is a published criteria document, not a CDISC standard.** It is *New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1)*, Eisenhauer et al., European Journal of Cancer 2009;45:228–247. It defines measurable disease, the response categories and the progression criteria. It says nothing about dataset structure, variable names or `PARAMCD` values — those come from ADaM and from the sponsor.

In CBX417-301's SDTM, `RS.RSCAT = "RECIST 1.1"` records which criteria the investigator applied — a value identifying the criteria document, not a statement that the data follow a CDISC response standard.
:::

:::standard{kind=convention}
**The parameter codes are sponsor choices.** ADaMIG v1.3 requires `PARAMCD` to exist and to have a one-to-one relationship with `PARAM`; it does not enumerate parameter codes for oncology response. `OVRLRESP`, `BOR`, `CBOR`, `SUMDIAM` and `BPCHG` are conventional names in wide use, not standardised ones, and another sponsor's define.xml will name theirs differently.

**The confirmation rule is also a sponsor choice.** CBX417-301's SAP requires a subsequent assessment at least 28 days later showing the same or a better response, and an SD at least 35 days after randomization before SD can be the best response. RECIST 1.1 states that confirmation is required in non-randomized trials where response is the primary endpoint and is not required in randomized ones; many randomized-trial SAPs require it anyway, as this one does.
:::

The variables that do the work, in both datasets:

| Group | ADRS | ADTR |
|---|---|---|
| **Parameter** | `PARAMCD`, `PARAM`, `PARCAT1` | `PARAMCD`, `PARAM` |
| **Value** | `AVALC` and `AVAL` | `AVAL`, `BASE`, `CHG`, `PCHG` |
| **Timing** | `ADT`, `ADY`, `AVISIT`, `AVISITN` | `ADT`, `ADY`, `AVISIT`, `AVISITN` |
| **Selection** | `ANL01FL` | `ABLFL`, `ANL01FL` |
| **Traceability** | `SRCDOM`, `SRCVAR`, `SRCSEQ` | `SRCDOM`, `SRCVAR`, `SRCSEQ` |
| **From ADSL** | `TRTP`, `TRTPN`, `ITTFL`, `EFFFL`, `STRAT1R`, `STRAT2R` | the same |

## Formal concept

### `AVALC` and `AVAL` for an ordered category

A response is a word. BDS wants a number. ADRS carries both.

| `AVALC` | `AVAL` | Meaning |
|---|---:|---|
| CR | 1 | Complete response |
| PR | 2 | Partial response |
| SD | 3 | Stable disease |
| PD | 4 | Progressive disease |
| NE | 5 | Not evaluable |

:::standard{kind=official}
ADaMIG v1.3 defines `AVAL` as the numeric analysis value and `AVALC` as its character counterpart, and states that when both are populated they must have a **one-to-one relationship within a parameter**. `AVALC` is intended for results that are genuinely categorical; it is not a place to keep a formatted copy of `AVAL`.

The one-to-one requirement is what makes `AVAL` safe to use. Two different `AVALC` values sharing an `AVAL`, or one `AVALC` appearing with two `AVAL` values, breaks every summary that groups on one and labels with the other.
:::

:::why[Why number them at all, when the analysis is a count of CR and PR?]
Because "best" is a minimum, and you cannot take a minimum of a string.

The coding is deliberately ordered so that **lower is better**, which makes the core of the derivation one expression:

```r
BOR <- AVALC[which.min(AVAL)]
```

That is not a cosmetic choice. `NE = 5` sits *below* `PD = 4` precisely so that a subject with one progression and three unevaluable scans gets `PD`, not `NE` — a progression is information and an unevaluable scan is not.

The ordering is also why `AVAL` must not be treated as a quantity. A mean `AVAL` of 2.7 is not a response, and nothing in a CSR ever reports one.
:::

### `ANL01FL` decides which assessments the derivation is allowed to see

80 of the 1,928 `OVRLRESP` records have a null `ANL01FL`: 38 `PR`, 28 `SD` and 14 `PD`, across 16 subjects. They are assessments recorded **after the first progression or after the start of a new anticancer therapy**, and the derivation does not look at them.

:::number[Four subjects whose responses are real and are not counted]
Ignoring `ANL01FL` and taking the minimum `AVAL` over every `OVRLRESP` record changes `BOR` for 8 subjects — and turns **four of them into responders**: `CBX417-301-1001-0008`, `1013-0009`, `1039-0003` and `1039-0007`.

All four have the same ADTTE record: `PARAMCD = "PFS"`, `CNSR = 3`, `EVNTDESC = "NEW ANTICANCER THERAPY BEFORE PD OR DEATH"`.

Subject `1039-0003` is the clearest. Their `OVRLRESP` series after week 6 is `PR` at every one of fifteen consecutive assessments, from week 12 to week 120. Their `BOR` is `SD`.

```text
PARAMCD   AVISIT    ADT         ADY  AVALC  ANL01FL
OVRLRESP  WEEK 6    2022-11-24   37  SD     Y
OVRLRESP  WEEK 12   2023-01-06   80  PR     (null)
OVRLRESP  WEEK 18   2023-02-21  126  PR     (null)
…  thirteen more PR assessments, through 2025-01-31  …
BOR                 2022-11-24   37  SD     Y
```

Those partial responses happened, and they are not evidence about CBX-417, because by week 12 the subject was on a different anticancer therapy — the same reason their PFS record is censored on day 39 rather than counted as an event.

**`ANL01FL` and the PFS censoring rules are the same decision, expressed twice.** A derivation that respects one and not the other builds an ORR from a window the time-to-event analysis has already declared uninformative: 4 subjects here, 108 becoming 112, every one of them plausible in a listing.
:::

### Derived records, and when `DTYPE` is the variable you need

`BOR` and `CBOR` records are not copies of anything. They are added by the ADRS program, and their `ADT` and `SRCSEQ` point at whichever `OVRLRESP` assessment supplied the answer.

:::standard{kind=official}
ADaMIG v1.3 defines `DTYPE` (Derivation Type) to identify records that were **added to a parameter** or whose analysis value was **derived differently from the other records of that parameter**. A record with a populated `DTYPE` did not come from a single predecessor observation; a record with a null `DTYPE` did. CDISC publishes controlled terminology for `DTYPE` with values such as `LOCF`, `WOCF` and `AVERAGE`.
:::

:::why[ADRS has no `DTYPE` variable at all. Is that a defect?]
No — and knowing why is the point.

`DTYPE` distinguishes derived records **within** a parameter. It exists for the case where a parameter's records are mostly observations and one of them was imputed: a week 12 haemoglobin carried forward gets `DTYPE = "LOCF"`, so a summary of that parameter can include or exclude it deliberately.

ADRS has no such case. The derived values were given **their own parameters**: every `OVRLRESP` record is an observation, every `BOR` record is a derivation, and no parameter mixes the two.

The design rule is **a new `PARAMCD` when the derived value answers a different question, `DTYPE` when it answers the same question a different way.** Best overall response is a different question from the response at week 12, so it is a parameter.

What the absence does require is a sentence in the reviewer's guide. "`DTYPE` is empty" and "`DTYPE` is absent" are different statements, and only one of them can be checked from the data. Had ADRS imputed a missing assessment, `DTYPE` would be mandatory and its absence a real finding.
:::

## Worked example

One subject, followed through both datasets and back to the CRF.

`CBX417-301-1002-0001`. Baseline sum of target diameters 162 mm, measured four days before randomization.

```text
ADTR, PARAMCD = SUMDIAM                                 ADRS, PARAMCD = OVRLRESP
AVISIT     ADT         ADY   AVAL  BASE    PCHG  SRCSEQ  AVALC  SRCSEQ
BASELINE   2022-05-19   -4    162   162       .       1      .       .
WEEK 6     2022-06-29   38    122   162  -24.69       2     SD       1
WEEK 12    2022-08-11   81     86   162  -46.91       3     PR       2
WEEK 18    2022-09-22  123     66   162  -59.26       4     PR       3
WEEK 24    2022-11-04  166     56   162  -65.43       5     PR       4
WEEK 30    2022-12-15  207     58   162  -64.20       6     PR       5
WEEK 36    2023-01-27  250     63   162  -61.11       7     PD       6
```

**Week 6 is `SD` because −24.69% is not a 30% shrinkage; week 12 is `PR` because −46.91% is.** The arithmetic in ADTR and the category in ADRS agree visit by visit, which is the first check worth running on a pair of oncology datasets.

**Confirmation.** The `PR` at week 12 (2022-08-11) is followed by a `PR` at week 18, 42 days later and more than 28, with no progression in between. So `CBOR = "PR"` with `ADT = 2022-08-11` — the date of the **first** qualifying assessment, not the date it was confirmed. **`BPCHG` is `−65.43`**, the minimum `PCHG` over the analysis records, from the week 24 scan: the bar this subject contributes to the waterfall plot.

:::number[Why week 36 is progression even though the tumour is 61% smaller than at baseline]
`SUMDIAM` at week 36 is 63 mm. The smallest value so far was 56 mm at week 24. That is +12.5% and +7 mm — **neither** RECIST progression criterion is met, and the target-lesion response at week 36 is stable disease.

The overall response is `PD` anyway, because a **new lesion** was recorded at that visit. Under RECIST 1.1 any new lesion is progression regardless of the sum of diameters.

**And this is where the traceability chain ends inside the submitted data.** The new-lesion indicator is on the CRF page and in the raw export; this study's SDTM keeps only the sum of diameters and the investigator's overall response, so `RS.RSSTRESC = "PD"` is the earliest submitted record of that decision. A reviewer who recomputes the response from `TR` alone gets `SD` at week 36 and is right to ask why — which is exactly the sort of thing the reviewer's guide has to state first.
:::

:::why[Why does the week-6 `SD` matter to `BOR`?]
Because of the 35-day rule, and because two subjects on this study fail it.

The SAP will only accept `SD` as a best overall response if an assessment of SD or better occurred **at least 35 days after randomization** — six weeks minus the visit window. An SD recorded too early is not evidence of stability; it is evidence that not enough time has passed.

Subjects `CBX417-301-1012-0008` and `1027-0015` each have exactly two assessments: `SD` at day 30 and day 29 respectively, then `PD`. The minimum `AVAL` over their analysis records is 3, which decodes to `SD`. Their `BOR` is `PD`.

**Those two subjects are the entire gap between `BOR` and a naive `which.min()`** — over the 406 subjects with at least one analysis-window assessment, `AVALC[which.min(AVAL)]` reproduces `BOR` for 404. The rule that catches the other two is one line in the SAP and is invisible in any output.
:::

## Data example

::dataset{id="oncology/adam/adrs" cols="USUBJID,PARAMCD,PARAM,AVALC,AVAL,ADT,ADY,AVISIT,ANL01FL,SRCDOM,SRCVAR,SRCSEQ,TRTP" rows="10" caption="ADRS — one record per subject, parameter and assessment; 2,768 records over 420 subjects"}

::dataset{id="oncology/adam/adtr" cols="USUBJID,PARAMCD,PARAM,AVAL,ADT,ADY,AVISIT,ABLFL,BASE,CHG,PCHG,ANL01FL,SRCDOM,SRCSEQ" rows="10" caption="ADTR — sum of diameters by visit plus the best percent change; 2,736 records"}

### The two subjects with no baseline scan

`SUMDIAM` has 2,332 records over all 420 subjects and only **418** baseline records. Two subjects — `CBX417-301-1036-0003` and `1038-0009` — have no tumour assessment on or before randomization; their first scan is at week 6, in the treatment epoch. Between them they contribute **14 post-baseline records with a null `BASE`**, and therefore a null `CHG` and `PCHG`. Both carry `EFFFL = "N"` in ADSL, for exactly this reason.

:::number[The same waterfall filter, two answers: 620 records or 634]
A programmer selects the assessments that met the RECIST partial-response threshold: a shrinkage of at least 30% from baseline.

Over the 1,914 post-baseline `SUMDIAM` records:

| | Records | Subjects |
|---|---:|---:|
| R: `PCHG <= -30` | **620** | **112** |
| SAS: `if pchg <= -30` | **634** | **114** |

Same rule, same data, 14 records apart. **In SAS a missing numeric compares as lower than any number**, so the 14 records with no baseline satisfy `pchg <= -30` and two never-evaluable subjects appear among the responders. In R, `NA <= -30` is `NA`, and a filter on `NA` keeps nothing. Neither language is wrong; they answer different questions with the same syntax. Say what you mean:

```sas
if not missing(pchg) and pchg <= -30;
```

**The direction matters.** The SAS version silently *adds* subjects to a response count. Two subjects with no baseline scan, whose ADSL row says `EFFFL = "N"`, arrive in an efficacy numerator through a comparison operator.

**A footnote that is worth knowing and not worth relying on.** All 14 of those records also have a null `ANL01FL`, so a program that filters on `anl01fl = 'Y'` first never reaches the comparison and gets 581 records over 108 subjects either way. That is luck, not protection: nothing guarantees the two conditions coincide, and the next dataset's missing values will sit somewhere else.
:::

::widget{name="waterfall-plot"}

:::number[404 bars, not 420 — and one bar in the wrong place]
`BPCHG` exists for **404** subjects; the other 16 have no post-baseline sum of diameters with a usable baseline, so they have no bar. A waterfall plot prints no denominator, so 420 bars means sixteen were invented and nobody can see it.

Of the 404, **108 have `BPCHG <= -30`** — exactly the 108 subjects whose `BOR` is CR or PR. That agreement is a property of this synthetic study, not a rule: it holds because the simplified tumour data has no new lesion or non-target progression before a best response. In real data a subject can shrink 40% and still have `BOR = "PD"`, and a QC check asserting the two always agree would fail — correctly.

**Subject `1039-0003` is the bar worth looking at.** Their deepest recorded shrinkage is −53.75% at week 57 and their `BPCHG` is **−27.5%**, from week 6, because every later scan is outside `ANL01FL`. The plot shows them just short of the response threshold, which is the honest place for them.
:::

## Code

::::tabs
:::tab[SAS]
```sas
proc sql;
  create table orr as
  select r.trtp,
         count(*)                                      as n,
         sum(r.avalc in ('CR', 'PR'))                  as resp,
         100 * sum(r.avalc in ('CR', 'PR')) / count(*) as pct
  from   adam.adrs as r
  where  r.paramcd = 'CBOR' and r.ittfl = 'Y'
  group by r.trtp;
quit;

data shrink;
  set adam.adtr;
  where paramcd = 'SUMDIAM' and anl01fl = 'Y' and ablfl ne 'Y';
  if not missing(pchg) and pchg <= -30;
run;

proc sql noprint;
  select count(*) into :bad
  from   adam.adrs
  where  (avalc = 'CR' and aval ne 1) or (avalc = 'PR' and aval ne 2)
      or (avalc = 'SD' and aval ne 3) or (avalc = 'PD' and aval ne 4)
      or (avalc = 'NE' and aval ne 5);
quit;
%if &bad > 0 %then %put ERROR: &bad ADRS rows break the AVAL/AVALC pairing;
```

:::lines
4: The denominator is `count(*)` over the ITT subjects **in this dataset**, which works only because `CBOR` has one record for every one of the 420 subjects. A parameter with fewer records than the population — `DOR` in ADTTE, for instance — needs its denominator from ADSL.
8: `where r.paramcd = 'CBOR'` is the whole difference between the two rows of Table 14.2.3. `BOR` in its place gives 70 and 38 instead of 58 and 31.
14: `anl01fl = 'Y'` keeps the selection inside the analysis window; `ablfl ne 'Y'` excludes the baseline record, whose `PCHG` is null by construction.
15: **`not missing(pchg)` is not defensive padding.** Without it, SAS's ordering of missing values makes the 14 records with no baseline satisfy `pchg <= -30`, adding two never-evaluable subjects to the count.
19-23: The `AVAL`/`AVALC` pairing is a one-to-one relationship ADaMIG requires and nothing enforces. Five comparisons, run on every build.
25: Failing the build rather than writing to the log, because a break in the pairing corrupts every table that groups on one variable and labels with the other.
:::
:::

:::tab[R]
```r
library(dplyr)

orr <- adrs |>
  filter(PARAMCD == "CBOR", ITTFL == "Y") |>
  group_by(TRTP) |>
  summarise(n = n(), resp = sum(AVALC %in% c("CR", "PR")), .groups = "drop") |>
  mutate(pct = 100 * resp / n)

bor_check <- adrs |>
  filter(PARAMCD == "OVRLRESP", ANL01FL == "Y") |>
  group_by(USUBJID) |>
  slice_min(AVAL, n = 1, with_ties = FALSE) |>
  ungroup() |>
  select(USUBJID, naive = AVALC) |>
  inner_join(adrs |> filter(PARAMCD == "BOR") |> select(USUBJID, BOR = AVALC),
             by = "USUBJID")

codes <- c(CR = 1, PR = 2, SD = 3, PD = 4, NE = 5)
stopifnot(
  all(adrs$AVAL == codes[adrs$AVALC]),
  sum(adrs$PARAMCD == "BOR")  == 420,
  sum(adrs$PARAMCD == "CBOR") == 420,
  nrow(bor_check) == 406
)
```

:::lines
4: `ITTFL == "Y"` is redundant on this dataset — every ADRS subject is ITT — and it is still worth writing, because it states the population the table claims to be on.
6: `sum(AVALC %in% c("CR", "PR"))` counts on the **character** value. Counting `AVAL <= 2` gives the same answer here and stops being equivalent the moment a study adds a sixth category.
9-13: The naive best response: minimum `AVAL` within the analysis window. `with_ties = FALSE` matters — a subject with two `PR` assessments has two minima, and `slice_min` would return both.
14-16: Joining the naive answer to the real `BOR`. On this study they differ for 2 of the 406 subjects with assessments, both because of the 35-day rule for stable disease.
18: The codebook as a named vector, so the pairing check is one vectorised comparison rather than five.
19-24: Four assertions: the `AVAL`/`AVALC` pairing holds on all 2,768 records; both derived parameters have exactly one record per subject; and 406 subjects have at least one in-window assessment, which is 420 minus the 14 with none.
:::
:::
::::

## Output

```text
> orr
# A tibble: 2 × 4
  TRTP                    n  resp   pct
  <chr>               <int> <int> <dbl>
1 CBX-417 + Docetaxel   210    58  27.6
2 Placebo + Docetaxel   210    31  14.8

> bor_check |> count(naive == BOR)
# A tibble: 2 × 2
  `naive == BOR`     n
  <lgl>          <int>
1 FALSE              2
2 TRUE             404

> bor_check |> filter(naive != BOR)
# A tibble: 2 × 3
  USUBJID              naive BOR
  <chr>                <chr> <chr>
1 CBX417-301-1012-0008 SD    PD
2 CBX417-301-1027-0015 SD    PD
```

Two subjects, and the reason is the same for both: their only non-progression assessment was 30 and 29 days after randomization, short of the 35 days the SAP requires before stable disease can be a best overall response.

## Common mistakes

:::mistake[Deriving best overall response without `ANL01FL`]
Assessments after the first progression or after a new anticancer therapy are in ADRS and must not be in the derivation. On this study ignoring the flag changes `BOR` for 8 subjects and makes responders of 4 of them, every one of whom has a PFS record censored for starting a different therapy. The response analysis and the time-to-event analysis would then disagree about the same window.
:::

:::mistake[Reporting `BOR` where the SAP says `CBOR`]
One word in the row label, 19 subjects, and 33.3% instead of 27.6%. Both parameters are in the dataset and both are correct; only one of them is the ORR endpoint. Read the shell's row label and the SAP, not the parameter that sorts first.
:::

:::mistake[`if pchg <= -30` in SAS without a missing-value guard]
A missing numeric compares as lower than any number, so the 14 records belonging to the two subjects with no baseline scan pass the filter. Two subjects with `EFFFL = "N"` arrive in a response count. Write `if not missing(pchg) and pchg <= -30`.
:::

:::mistake[Averaging `AVAL`]
`AVAL` on a response parameter is an ordered code, not a quantity. A mean of 2.7 is not a response, no CSR reports one, and the number is stable enough across arms to look meaningful. Count categories; use `AVAL` only to rank and to select.
:::

:::mistake[Expecting a `BPCHG` record for every subject]
`BPCHG` has 404 records, not 420. Sixteen subjects have no post-baseline sum of diameters with a usable baseline. A waterfall plot with 420 bars has invented sixteen of them, and a denominator taken from `nrow()` is wrong by the same amount.
:::

:::mistake[Taking `BPCHG` as the subject's deepest shrinkage]
It is the deepest shrinkage **within the analysis window**. Subject `1039-0003` reached −53.75% at week 57 and has `BPCHG = -27.5%` from week 6, because everything after their change of therapy is outside `ANL01FL`. The larger number is real and is not attributable to the study drug.
:::

## Knowledge check

::quiz{ids="adam.onc.bor-vs-cbor,adam.onc.avalc-pairing,adam.onc.anl01fl-window,adam.onc.dtype-absent"}

## Hands-on exercise

::practice{ids="adam.onc.orr-code,adam.onc.classify-params,adam.onc.bpchg-count,adam.onc.sas-missing" title="Practice: building the response row and the waterfall input"}

## Challenge exercise

::practice{ids="adam.onc.orr-diff,adam.onc.bpchg-window,adam.onc.open-response-review" title="Challenge: two ORR tables nineteen subjects apart"}

## Industry note

**ADRS is where oncology programming stops being bookkeeping.** A best overall response derivation is a chain of conditional reasoning over a subject's whole assessment history, and two competent programmers working from the same SAP routinely disagree on a handful of subjects. The disagreements cluster in the same three places every time: whether an assessment is "adequate" enough to count, what the confirmation window does when a scan slipped inside its visit window, and whether an early stable disease meets the minimum-duration rule. All three are gaps in the SAP's wording rather than bugs, and the fix is a sentence added to the specification — dated before lock — not a patch.

**Independent central review changes the shape of the whole thing.** CBX417-301 uses investigator assessment only, so ADRS has one set of response records. A study with blinded independent central review has two, distinguished by `PARCAT1` or by the evaluator in the source, with the primary analysis on one and a concordance analysis between them. Asking which assessment the primary endpoint uses is a good early question.

**`ADTTE` is built after `ADRS`, not beside it.** Progression dates come from the response dataset, so a change to `ANL01FL` propagates into PFS. The reviewer's guide states the dependency for exactly that reason.

:::standard{kind=simplification}
CBX417-301's tumour data are deliberately reduced: `TR` carries only `SUMDIAM`, there is no `TU` domain, and non-target response and the new-lesion indicator stay in the raw export rather than being submitted. A production oncology SDTM carries individual lesions, non-target assessments and new-lesion records, and ADTR would carry per-lesion parameters alongside the sum.

The consequence is worth naming: the week-36 `PD` for subject `1002-0001` cannot be reproduced from `TR`, because the new lesion that caused it is not in the submitted data.
:::

:::interview[How would you derive and check best overall response?]
"I'd separate three things that get run together: which assessments are eligible, what the best of them is, and whether it needed confirming.

**Eligibility first**, because it is the part that changes the answer most and is easiest to skip. On the study I worked with that is `ANL01FL` — assessments up to and including the first progression, and on or before the start of any new anticancer therapy. Eighty of the 1,928 visit-level records fail it. If you derive over all of them instead, eight subjects get a different best response and four become responders, and all four are subjects the PFS analysis censored for switching therapy. So the response endpoint and the time-to-event endpoint would be using different definitions of the same window.

**Then the best.** `AVAL` is coded so that lower is better — CR 1 through NE 5 — so best is a minimum over the eligible records, and `NE` deliberately sorts below `PD` so a subject with a progression and some unevaluable scans gets PD. On that study `which.min` reproduced `BOR` for 404 of the 406 subjects with any eligible assessment. The two it missed were both the minimum-duration rule: the SAP will not accept stable disease unless it was recorded at least 35 days after randomization, and both subjects had a single SD at day 29 or 30 before progressing.

**Then confirmation**, which is the ORR endpoint. A CR or PR counts only if a later assessment at least 28 days on shows the same or better, with no progression in between. That moved 19 subjects from PR to SD — 108 responders unconfirmed, 89 confirmed, so 33.3% against 27.6% in the active arm. Both parameters stay in the dataset; the shell's row label decides which one the table uses.

**For checking, I'd start outside ADRS.** The response category and the percentage change in the tumour dataset have to agree visit by visit, and the confirmed-responder count has to match the number of `DOR` records in ADTTE, which it did at 89. Then the structural checks: one `BOR` and one `CBOR` record per subject, and the `AVAL`/`AVALC` pairing one-to-one across every record, because ADaM requires it and nothing enforces it.

And the thing I'd want a second pair of eyes on is the wording rather than the code — what counts as adequate, what the confirmation window does when a scan drifts. That is where two independent derivations disagree, and it gets fixed with a sentence in the specification rather than a patch."
:::
