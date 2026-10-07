## What problem are we trying to solve?

Your task: *"Total CBX-417 dose received, per subject."*

The protocol says 200 mg once daily. The subject was on study for 153 days. So 153 × 200 = 30,600 mg,
and you are done before lunch.

Then you open `EX` for that subject and there are **nine records**, not one:

::dataset{id="oncology/sdtm/ex" cols="USUBJID,EXSEQ,EXTRT,EXDOSE,EXDOSU,EXDOSFRQ,EXADJ,EXSTDTC,EXENDTC,EXSTDY,EXENDY" filter="USUBJID=CBX417-301-1001-0002" rows="10" caption="EX for one subject — the oral drug in nine intervals, interleaved with docetaxel infusions"}

Look at the dates on the oral records. `EXSEQ = 1` ends **2022-07-12**. `EXSEQ = 3` starts
**2022-07-17**. Four days in the middle where the subject took nothing — an interruption for diarrhoea,
recorded in `EXADJ`, and corroborated by an adverse event running from study day 6 to 18 with
`AEACN = "DRUG INTERRUPTED"`.

The subject was **on study** for 153 days. They were **on drug** for 153 days too, as it happens — but
only because the interruption is already excluded from the intervals. Had you multiplied elapsed
calendar time by the daily dose you would have included four days of drug that was never taken, and
done it for every subject with an interruption.

**`EX` does not record "the subject was on drug". It records constant-dose intervals**, and the gaps
between them are as informative as the intervals themselves.

## Intuition

The modelling decision behind the whole domain: **one record per period of constant dosing.**

A record starts when something changes and ends when something changes again. What counts as a change:

- The **dose** changes — 200 mg becomes 150 mg.
- Dosing **stops** and later resumes — the gap ends one record and the resumption starts another.
- The **treatment** changes — a different drug is a different record.
- The **frequency, route or form** changes.

Everything within a record is constant, which is why a single `EXDOSE` value can describe a
three-week interval.

:::why[Why intervals rather than one record per administration?]
Because of volume, and because of what you would lose.

CBX-417 is a daily oral tablet. A subject on treatment for two years would generate **730 records** —
one per tablet — almost all of them identical, and none of them observed: nobody watches the subject
swallow it. The site records "200 mg daily from 29 July to 18 August", and that is genuinely what was
collected.

Docetaxel is different. Each infusion is a discrete, observed event with a start time and an end time,
so `EX` carries **one record per infusion**: 2,932 of them, every single one with a time.

**The domain accommodates both** because the interval model degenerates gracefully — an infusion is
simply an interval that lasts an hour.

What you would lose with one-record-per-day is the gap. An interruption is visible as a *discontinuity
between intervals*, and nine intervals for one subject is a compressed history of everything that
happened to their dosing.
:::

## Clinical context

CBX417-301's `EX` domain in one table:

| | CBX-417 | Placebo | Docetaxel |
|---|---:|---:|---:|
| Records | 2,344 | 1,794 | 2,932 |
| `EXDOSU` | mg | mg | mg |
| `EXDOSFRM` | `TABLET` | `TABLET` | `INJECTION, SOLUTION, CONCENTRATE` |
| `EXDOSFRQ` | `QD` | `QD` | `ONCE` |
| `EXROUTE` | `ORAL` | `ORAL` | `INTRAVENOUS` |
| `EXREFID` | kit number | kit number | *(null)* |
| Records with a time | 207 | 209 | **2,932** |
| Distinct `EXDOSE` values | 3 | 2 | 81 |

Three facts in that table are worth stopping on.

**`EXREFID` is null for docetaxel.** CBX-417 and placebo are blinded and dispensed as numbered kits;
docetaxel is open-label supply drawn from site stock. The kit number is the *only* link between a
blinded subject and what they actually received, which is why `DM.ACTARM` is derived from it.

**416 oral records carry a time**, one per treated subject: the first dose. That timestamp becomes
`DM.RFXSTDTC`, which becomes `DM.RFSTDTC`, which anchors every `--DY` in the study.

**Docetaxel has 81 distinct doses** because it is dosed at 75 mg/m2 of body surface area, so every
subject's milligram dose is different. `EX` carries the **administered milligrams** — 85 to 179 mg —
and not the protocol's 75 mg/m2.

:::number[Why EXDOSE is in mg and not mg/m2]
`EXDOSE` records what was administered. The subject received 132 mg of docetaxel; they did not receive
"75 mg/m2", which is a rule for computing a dose rather than a dose.

The raw file keeps all three pieces:

```text
BSA = 1.76   PLANNED_DOSE_MG_M2 = 75   ACTUAL_DOSE_MG = 132
```

and 1.76 × 75 = 132. `EX` takes `ACTUAL_DOSE_MG`.

SDTMIG does provide `EXDOSEU`-style body-surface variables for studies that need them, but the
principle holds: **the domain records the administration, and the protocol's rule for deriving it lives
in the protocol.** A programmer who put 75 in `EXDOSE` with `EXDOSU = "mg/m2"` would produce a domain in
which every subject received an identical dose, which is exactly the information the variable exists to
destroy.
:::

:::standard{kind="official"}
`EX` (Exposure) is an SDTMIG v3.4 Interventions domain, one record per **constant-dosing interval** per
treatment per subject. `EXTRT` is the topic variable. `EXDOSU` uses **UNIT (C71620)**, `EXDOSFRQ` uses
**FREQ (C71113)**, `EXROUTE` uses **ROUTE (C66729)** and `EXDOSFRM` uses **FRM (C66726)** — all
extensible, and all four values used here are published terms.
:::

### EX and EC

`EX` holds what the subject **received**. `EC` (Exposure as Collected) holds what was **collected** when
that differs — the protocol-planned amount, the amount dispensed, the amount returned.

:::standard{kind="official"}
`EC` is a separate SDTMIG v3.4 Interventions domain for exposure as collected. It exists for the common
case where the CRF captures something other than the amount actually administered: tablets dispensed and
returned, an infusion bag prepared with a volume discarded, a planned dose that was not fully given.
`EX` is then **derived** from `EC`, and both are submitted.
:::

CBX417-301 has **no `EC` domain**, and that is a legitimate design: the CRF records the dose taken
directly, so there is nothing collected that differs from what was administered. A study that collected
tablet counts — "30 dispensed, 4 returned" — would need `EC` to hold the counts and `EX` to hold the
derived exposure, and the derivation would belong in the SDTM specification.

## Formal concept

### Reading a subject's dosing history from the intervals

Subject `CBX417-301-1001-0002`, oral records only:

| `EXSEQ` | `EXSTDTC` | `EXENDTC` | Days | `EXDOSE` | `EXADJ` |
|---:|---|---|---:|---:|---|
| 1 | 2022-07-08T10:41 | 2022-07-12 | 5 | 200 | |
| 3 | 2022-07-17 | 2022-07-28 | 12 | 200 | Resumed after interruption for diarrhea |
| 4 | 2022-07-29 | 2022-08-18 | 21 | 200 | |
| 6 | 2022-08-19 | 2022-09-08 | 21 | 200 | |
| 8 | 2022-09-09 | 2022-09-29 | 21 | 200 | |
| 10 | 2022-09-30 | 2022-10-20 | 21 | 200 | |
| 12 | 2022-10-21 | 2022-11-10 | 21 | 200 | |
| 14 | 2022-11-11 | 2022-12-01 | 21 | 200 | |
| 16 | 2022-12-02 | 2022-12-11 | 10 | 200 | |

Three things are readable from the structure alone:

1. **The even-numbered `EXSEQ` values are missing** because they are the docetaxel infusions,
   interleaved in the same sequence. `--SEQ` is unique within subject and domain, not within treatment.
2. **The gap between records 1 and 3** — 13 July to 16 July inclusive — is the interruption. Four days,
   not dosed, and no record covers them.
3. **The 21-day rhythm** is the three-week cycle. Records 4 through 14 are exactly 21 days each; the
   first is short because dosing started mid-cycle and the last is short because treatment ended.

:::number[Cumulative dose, done correctly]
$$
\text{total mg} = \sum_{i} \text{EXDOSE}_i \times \left( \text{EXENDTC}_i - \text{EXSTDTC}_i + 1 \right)
$$

For this subject: 5 + 12 + 21 + 21 + 21 + 21 + 21 + 21 + 10 = **153 dosing days**, all at 200 mg, giving
**30,600 mg**.

The `+1` is the same no-day-0 arithmetic as `--DY`: an interval from the 8th to the 12th is **five**
days, not four.

**Calendar time gives a different answer.** From 2022-07-08 to 2022-12-11 is 157 days. The four-day gap
is exactly the difference, and multiplying elapsed time by the daily dose would credit the subject with
800 mg they did not take.

Across the whole domain, 500 records carry an `EXADJ`. Of the 4,138 oral records, **300** do — 230
resumptions after an interruption and 70 dose reductions. **The 230 resumptions are exactly the
population where calendar time and dosing days diverge.**
:::

### Dose reductions

`EXDOSE` for the oral drug takes three values:

| `EXDOSE` | CBX-417 records | Placebo records |
|---:|---:|---:|
| 200 | 1,858 | 1,648 |
| 150 | 448 | 146 |
| 100 | 38 | 0 |

A reduction ends one interval and starts another, with `EXADJ` recording the reason:

```text
Dose reduced to 150 mg due to diarrhea            14 records
Dose reduced to 150 mg due to neutropenia          9
Dose reduced to 150 mg due to pneumonia            6
Dose reduced to 100 mg due to diarrhea             3
```

**The asymmetry between arms is itself a finding.** 486 CBX-417 records are at a reduced dose against
146 placebo records — dose reductions are three times more frequent on the active arm, which is a
tolerability signal visible in `EX` before any adverse-event table is written.

### EX and DM must agree

```text
DM.RFXSTDTC = min(EX.EXSTDTC)   per subject
DM.RFXENDTC = max(EX.EXENDTC)   per subject, date part
```

Verified across all 416 treated subjects: both hold exactly, to the minute for `RFXSTDTC`.

:::mistake[Deriving RFXSTDTC from the wrong subset of EX]
`RFXSTDTC` is the first dose of **any** study treatment. For this study that means the minimum across
CBX-417, placebo *and* docetaxel, not just the investigational product.

It matters because the two are not always the same day: the oral drug and the first infusion are
usually given on the same day, but a subject whose infusion was delayed would have a first dose of one
agent and not the other. Filtering `EX` to `EXTRT ne "DOCETAXEL"` before taking the minimum is a
plausible-looking line that produces a wrong anchor for a handful of subjects — and a wrong anchor
nulls or shifts every `--DY` they have.
:::

## Worked example

Build the oral exposure records for subject `1001-0002` from the raw dosing page.

**The raw rows** (`raw/ex_study_drug.csv`):

```csv
CYCLE,KIT_NUMBER,DRUG_NAME_ENTERED,START_DATE,START_TIME,END_DATE,DOSE_MG,DOSE_CHANGE_REASON
1,850669,CBX-417/Placebo,08 JUL 2022,10:41,12 JUL 2022,200,
1,850669,CBX-417/Placebo,17 JUL 2022,,28 JUL 2022,200,Resumed after interruption for diarrhea
2,527918,CBX-417/Placebo,29 JUL 2022,,18 AUG 2022,200,
```

Note that cycle 1 already has **two rows**. The site split the cycle when dosing was interrupted — the
constant-dose-interval model is how the CRF was designed, not something SDTM imposes afterwards.

::::tabs
:::tab[SAS]
```sas
proc sql;
  create table ex_oral as
  select
      cats('CBX417-301-', e.site_id, '-', e.subject_id)      as usubjid length=40,
      'EX'                                                   as domain  length=2,
      k.kit_content                                          as _content length=40,
      case when index(k.kit_content, 'CBX-417') > 0
           then 'CBX-417' else 'PLACEBO' end                 as extrt   length=20,
      e.dose_mg                                              as exdose,
      'mg'                                                   as exdosu  length=10,
      'TABLET'                                               as exdosfrm length=30,
      'QD'                                                   as exdosfrq length=10,
      'ORAL'                                                 as exroute length=20,
      e.kit_number                                           as exrefid length=20,
      e.dose_change_reason                                   as exadj   length=200
  from raw.ex_study_drug as e
  left join raw.kit_list as k
    on e.kit_number = k.kit_number;
quit;
```

:::lines
4: The kit list is joined **first**, because everything else depends on it. `KIT_CONTENT` is the only unblinded statement of what the subject received.
6: `EXTRT` is derived from the kit content, not from `DRUG_NAME_ENTERED`. The collected drug-name field has six spellings across the study — `CBX-417/Placebo`, `Study drug`, `CBX417/PBO`, and a misspelling `CBX-471` — and none of them is usable, because the site is blinded.
10: `EXDOSU`, `EXDOSFRM`, `EXDOSFRQ` and `EXROUTE` are **assigned constants** from the protocol, not collected. Their origin in define.xml is `Protocol`, and a reviewer reading the aCRF will not find a CRF field for any of them.
17: A `LEFT JOIN` rather than an inner join, deliberately: four raw records carry a kit number that is not in the kit list — a transposed digit, `236O09` with a letter O — and an inner join would silently drop them. The left join keeps them with a null `EXTRT`, which a subsequent check can catch.
:::
:::

:::tab[R]
```r
library(dplyr)

ex_oral <- raw_ex_study_drug |>
  left_join(kit_list, by = "KIT_NUMBER") |>
  mutate(
    USUBJID  = paste0("CBX417-301-", SITE_ID, "-", SUBJECT_ID),
    DOMAIN   = "EX",
    EXTRT    = if_else(grepl("CBX-417", KIT_CONTENT), "CBX-417", "PLACEBO"),
    EXDOSE   = as.numeric(DOSE_MG),
    EXDOSU   = "mg",
    EXDOSFRM = "TABLET",
    EXDOSFRQ = "QD",
    EXROUTE  = "ORAL",
    EXREFID  = KIT_NUMBER,
    EXADJ    = DOSE_CHANGE_REASON,
    EXSTDTC  = iso_datetime(START_DATE, START_TIME),
    EXENDTC  = iso_date(END_DATE)
  )

stopifnot(!any(is.na(ex_oral$EXTRT)))
```

:::lines
4: The join comes before anything else. Without the kit list there is no `EXTRT`.
14: `EXREFID` keeps the kit number in the domain. It is what a reviewer uses to verify the blind was maintained, and what `DM.ACTARM` is derived from.
17: `iso_datetime` combines date and time only when a time exists — 416 records in this study, the first dose of each subject. The rest get a date.
20: The assertion catches the unmatched kit numbers. Without it they become a null `EXTRT`, which is a null topic variable on an Interventions record — a record about nothing.
:::
:::
::::

:::number[Four kit numbers that are not in the kit list]
The answer key documents them: `8853893`, `236O09` (letter O for zero), `48657`, `573422`. Four records
out of 4,131.

**The resolution is not a programming decision.** Each needs a query to the site to establish which kit
was actually dispensed, because the alternative — guessing from the subject's other cycles — assumes
the dispensing was consistent, which is precisely the thing in doubt.

Three *other* records in the study have a kit number that **is** in the list and contains the wrong
product: the dispensing errors. `598581`, `982483` and `302898` are flagged in the answer key as
`TRUE FINDING (NOT AN ERROR): DISPENSING ERROR`. Those are not data problems at all — they are what
happened, and they drive `DM.ACTARM` being null for two subjects and disagreeing with `ARM` for a third.

**The two situations look identical in a validation report and are completely different.** One is a
transcription error to be corrected; the other is a real event to be preserved.
:::

## Data example

### Thirteen EX records that are not in the raw export

`raw/ex_study_drug.csv` has 4,131 records and the oral part of `EX` has **4,138**. `raw/ex_docetaxel.csv`
has 2,926 and `EX` has **2,932**. SDTM has *more* records than the raw files.

All 13 belong to one subject, `CBX417-301-1009-0002`. The answer key explains it:

> *"Query: dosing pages not entered before the data transfer (labs, AEs and visits show the subject was
> treated). Site entered the pages; SDTM EX built from the resolved data."*

:::why[How do you notice a subject whose dosing pages are simply absent?]
Not by looking at `EX`, because there is nothing there to look at. You notice it by **cross-domain
consistency**, which is the general technique:

- The subject is in `DM` with `ARMCD` populated — they were randomized.
- `LB` has post-baseline results for them, `AE` has on-treatment adverse events, `SV` has visits.
- `EX` has nothing.

A randomized subject with visits, laboratory results and adverse events but no exposure is either a
genuine never-treated subject — this study has four, and they have no post-baseline data either — or a
missing transfer. The distinguishing evidence is the rest of the study.

**The check to write:** every subject with `ARMCD` populated either has `EX` records or has
`ARMNRS = "ASSIGNED, NOT TREATED"`. On the resolved data this passes for all 420 randomized subjects.

The reverse gap exists too, in the other direction: two subjects were *treated* with no record in the
IxRS randomization export, resolved by the vendor re-sending the record.
:::

### The check that would have caught the calendar-time error

```r
ex |>
  filter(EXTRT != "DOCETAXEL") |>
  group_by(USUBJID) |>
  summarise(
    dosing_days  = sum(as.integer(as.Date(EXENDTC) - as.Date(substr(EXSTDTC, 1, 10))) + 1),
    calendar_days = as.integer(max(as.Date(EXENDTC)) - min(as.Date(substr(EXSTDTC, 1, 10)))) + 1
  ) |>
  filter(dosing_days != calendar_days)
```

Any subject where the two differ has a gap, and the gap is either an interruption or a missing record.
`EXADJ` tells you which.

## Common mistakes

:::mistake[Computing exposure from calendar time]
Elapsed time from first to last dose includes interruptions. 500 records in this study carry an `EXADJ`
— 230 of them resumptions after an interruption — and for those subjects the two numbers differ. Sum the
intervals.
:::

:::mistake[Forgetting the +1 in interval length]
An interval from the 8th to the 12th is five dosing days. The same no-day-0 arithmetic as `--DY`, and the
same off-by-one, applied here to every interval in the study rather than to one date.
:::

:::mistake[Deriving EXTRT from the collected drug name in a blinded study]
Six spellings, including a misspelled product name, and none of them usable — the site does not know
what the subject received. `EXTRT` comes from the kit number joined to the IxRS kit list.
:::

:::mistake[Taking RFXSTDTC from only the investigational product]
`RFXSTDTC` is the first dose of *any* study treatment. Filtering out docetaxel before taking the minimum
produces a wrong anchor for any subject whose agents started on different days, and a wrong anchor moves
every `--DY` that subject has.
:::

:::mistake[Inner-joining to the kit list]
Four records have a kit number that is not in the list. An inner join drops them silently; a left join
plus an assertion on a null `EXTRT` turns them into a query.
:::

:::mistake[Putting the protocol dose in EXDOSE]
`EXDOSE` is what was administered. Docetaxel at 75 mg/m2 becomes 81 distinct milligram values across
this study, from 85 to 179. Writing 75 with `EXDOSU = "mg/m2"` makes every subject look identically
dosed.
:::

## Knowledge check

::quiz{ids="sdtm.ex.interval-model,sdtm.ex.refid-null,sdtm.ex.rfxstdtc-source,sdtm.ex.ec-vs-ex"}

## Hands-on exercise

::practice{ids="sdtm.ex.cumulative-dose,sdtm.ex.gap-days,sdtm.ex.dose-reduction-map,sdtm.ex.exposure-code" title="Practice: exposure from constant-dose intervals"}

## Challenge exercise

::practice{ids="sdtm.ex.missing-pages,sdtm.ex.kit-mismatch,sdtm.ex.open-exposure-table" title="Challenge: the dosing records that are not there"}

## Industry note

**Exposure tables are among the first safety outputs produced and among the most often revised**, because
"duration of exposure" has several defensible definitions and the SAP has to pick one. Time from first to
last dose plus the dosing interval; total dosing days; cumulative dose; relative dose intensity against
the protocol-planned dose. Each answers a different question and each gives a different number on the
same `EX` domain.

CBX417-301's own facts file reports **median 23.7 weeks of exposure on CBX-417 plus docetaxel against
16.4 weeks on placebo plus docetaxel**, and a median of 5 docetaxel infusions with a maximum of 50.
Which of the definitions above that uses is a SAP question, and the table footnote has to say.

::widget{name="sdtm-explorer"}

:::standard{kind="convention"}
**Relative dose intensity** — cumulative dose received divided by cumulative dose planned, as a
percentage — is a standard oncology exposure measure and is not an SDTM variable. It is derived in ADaM
(commonly `ADEX`) from `EX` plus the protocol's planned dosing, and every part of it is a SAP decision:
whether delays count against the denominator, whether the planned dose is recomputed after a
protocol-permitted reduction, and what happens to the period after treatment discontinuation. Two
programmers given the same `EX` and no further instruction will produce different numbers.
:::

:::interview[How would you compute a subject's total exposure to study drug?]
"From the intervals, never from calendar time.

`EX` is one record per constant-dose interval: it starts when something changes and ends when something
changes again. So total dose is the sum over intervals of dose times interval length, with the interval
length being end minus start plus one — the same no-day-0 arithmetic as study day, and the same
off-by-one if you forget it.

The reason it can't be calendar time is the gaps. On the study I've been working with, one subject has
nine oral records where the first ends on 12 July and the next starts on 17 July — a four-day
interruption for diarrhoea, with `EXADJ` recording it and a corresponding adverse event with
`AEACN = 'DRUG INTERRUPTED'`. Elapsed time from first to last dose is 157 days; actual dosing days are
153. Multiply 157 by the daily dose and you've credited the subject with 800 mg they didn't take, and
you've done it for the 12% of records that carry an `EXADJ`.

Two other things I'd check. `EXDOSE` has to be what was administered — the docetaxel in that study takes
81 distinct milligram values between 85 and 179 mg because it's dosed on body surface area, and putting the protocol's
75 mg/m2 in there would make every subject look identical. And `DM.RFXSTDTC` should equal the minimum
`EXSTDTC` across *all* treatments, not just the investigational one; it holds for all 416 treated
subjects there, and it's worth asserting because that value anchors every study day in the study.

And I'd say upfront that 'exposure' needs defining. Duration, dosing days, cumulative dose and relative
dose intensity are four different numbers from the same domain, and the SAP picks."
:::
