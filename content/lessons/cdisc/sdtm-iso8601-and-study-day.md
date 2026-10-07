## What problem are we trying to solve?

A statistician asks for a listing of adverse events with their study days. You write the obvious thing:

```sas
aestdy = input(aestdtc, yymmdd10.) - input(rfstdtc, yymmdd10.);
```

Three problems appear, in increasing order of how long they take to find.

**Problem 1, immediate.** Twelve AE records come back missing, because their `AESTDTC` is `2023-06` or
`2024`. `input()` returns `.` on a seven-character string read with `YYMMDD10.`, silently.

**Problem 2, within a day.** `RFSTDTC` for treated subjects is `2022-07-08T10:41` — sixteen characters,
with a `T` in the middle. `YYMMDD10.` reads the first ten and happens to work. On a date with no time it
also works. You have written code whose correctness depends on a coincidence.

**Problem 3, found in QC three weeks later.** Every study day is exactly one too low. An adverse event
starting on the day of first dose comes out as `0`, and an event the day before comes out as `-1`,
which looks right until someone notices there is no `1`.

**SDTM has no day 0.** The day of the reference date is day 1; the day before it is day −1. The
arithmetic has two branches, and the branch you skipped is the one that makes the whole scale correct.

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AETERM,AESTDTC,AESTDY,AEENDTC,AEENDY,AEENRTPT,EPOCH" rows="8" caption="AE — ISO 8601 text dates, derived study days, and a relative timing variable for events with no end date"}

## Intuition

Two ideas, and they pull in opposite directions.

**ISO 8601 stores exactly what is known.** If the month is known and the day is not, the value is
`2023-06`. Seven characters, and the missing day is missing by construction rather than by convention.
There is no `2023-06-UN`, no `2023-06-01` standing in for an unknown day, no separate "day known" flag.
The *length of the string* is the precision.

**`--DY` is a number, and numbers have no precision.** Study day 43 cannot express "some day in June".
So when the date is partial, `--DY` is null. In CBX417-301 this is exact: all 501 `CM` records with a
partial `CMSTDTC` have a null `CMSTDY`, and all 3,039 complete ones have it populated. Same in `AE`:
twelve partial start dates, twelve null `AESTDY`.

:::why[Why store dates as text at all? Why not a SAS date with a missing-flag variable?]
Because the alternative requires inventing something.

A SAS numeric date cannot represent "June 2023". To store it you must either impute a day — which
fabricates information and, worse, fabricates it *silently*, so every downstream program treats it as
observed — or carry a companion flag on every date variable, doubling the date columns and requiring
every program to check the flag.

ISO 8601 text solves it by making precision **self-describing**. `2023-06-15` is a day, `2023-06` is a
month, `2023` is a year, and you can tell which by looking. There is no second variable to forget.

The cost is real: you cannot do arithmetic on text. Every program converts to a numeric date on read.
**That conversion is the right place for the precision check**, because it is the one place every
program must pass through.
:::

## Clinical context

### What the EDC sends, and what SDTM stores

CBX417-301's raw exports use the EDC's display format, with explicit unknown tokens:

| Raw (`DD MON YYYY`) | SDTM `--DTC` | Precision |
|---|---|---|
| `13 JUL 2022` | `2022-07-13` | day |
| `UN OCT 2019` | `2019-10` | month — day unknown |
| `UN UNK 2013` | `2013` | year — day and month unknown |

Counted across the raw files:

| Raw file | Records | Unknown day | Also unknown month |
|---|---:|---:|---:|
| `mh.csv` | 871 | 476 | 184 |
| `cm.csv` | 3,540 | 501 | 104 |
| `ae.csv` | 2,472 | 12 | 2 |

Which produces exactly this in SDTM:

| Domain | Complete (10 chars) | Year-month (7) | Year (4) |
|---|---:|---:|---:|
| `CM.CMSTDTC` | 3,039 | 397 | 104 |
| `MH.MHSTDTC` | 704 | 380 | 208 |
| `AE.AESTDTC` | 2,454 | 10 | 2 |

:::number[Why medical history is 55% partial and adverse events are 0.5%]
Because of *when* the event is recorded relative to when it happened.

An adverse event is reported while it is happening, by a site that saw the subject. A medical-history
condition is recalled at screening — "I was diagnosed with hyperlipidaemia sometime in 2019" — and
nobody knows the day.

**This is not a data-quality problem and it will not be fixed by querying the site.** It is what the
information is. A study design that requires complete diagnosis dates will get imputed ones, which is
worse than partial ones because the imputation is invisible.

The consequence for programming is that **partial dates cluster in specific domains**. `MH` and `CM` are
where they live; `AE`, `LB`, `VS` and `EX` are nearly complete because those events are recorded as they
occur. Test your date handling on `MH`, not on `LB`.
:::

:::standard{kind="official"}
SDTMIG v3.4 requires `--DTC` variables to use the **ISO 8601 extended format**: `YYYY-MM-DD` for a date,
`YYYY-MM-DDThh:mm:ss` for a datetime, with reduced precision expressed by truncation
(`YYYY-MM`, `YYYY`). Intervals and durations use ISO 8601 duration syntax — `P28D` for 28 days, `P18Y`
for 18 years. **Imputation is not performed in SDTM.** A partial date stays partial; imputation, when the
analysis needs it, happens in ADaM with the imputation flagged (`ADAE.ASTDTF` and similar).
:::

CBX417-301 uses durations in its trial-design domains:

| Domain | Variable | Value | Meaning |
|---|---|---|---|
| `TE` | `TEDUR` | `P28D` | The screening element lasts up to 28 days |
| `TS` | `AGEMIN` | `P18Y` | Minimum planned age, 18 years |
| `TS` | `CRMDUR` | `P28D` | Confirmed response minimum duration |
| `TS` | `SDMDUR` | `P35D` | Stable disease minimum duration |

### Times, and when they matter

`--DTC` carries a time only when a time was collected and matters.

::dataset{id="oncology/sdtm/ex" cols="USUBJID,EXSEQ,EXTRT,EXDOSE,EXSTDTC,EXENDTC,EXSTDY,EXENDY" rows="8" caption="EX — the first dose of each agent carries a time; subsequent oral intervals do not"}

:::number[Which EX records have a time, and why]
Of 7,070 `EX` records:

| `EXTRT` | Date only | With time |
|---|---:|---:|
| `CBX-417` | 2,137 | 207 |
| `PLACEBO` | 1,585 | 209 |
| `DOCETAXEL` | 0 | **2,932** |

**Every docetaxel record has a time** because each is a single infusion with a start and an end an hour
or so apart — the time is the observation.

**Exactly 416 oral records have a time**, one per treated subject: the first dose. That timestamp is
what `DM.RFXSTDTC` and `DM.RFSTDTC` carry, and it is why `RFSTDTC` is sixteen characters for treated
subjects and ten for the four who were randomized and never dosed.

The remaining oral records are multi-day constant-dose intervals — "200 mg daily from 29 July to 18
August" — where a time would be meaningless.

**This is the trap in the opening program.** `input(rfstdtc, yymmdd10.)` reads sixteen-character values
correctly by accident, because the first ten characters are the date. Change the informat, or change the
study, and it stops working. Extract the date deliberately: `substr(rfstdtc, 1, 10)`.
:::

## Formal concept

### The `--DY` formula, both branches

$$
\text{--DY} =
\begin{cases}
(\text{date} - \text{RFSTDTC}) + 1 & \text{if date} \ge \text{RFSTDTC} \\[4pt]
(\text{date} - \text{RFSTDTC}) & \text{if date} < \text{RFSTDTC}
\end{cases}
$$

Read it as: **the reference day is day 1, and there is no day 0.** Day −1 is immediately followed by day
1.

| Date relative to `RFSTDTC` | Difference | `--DY` |
|---|---:|---:|
| 2 days before | −2 | **−2** |
| 1 day before | −1 | **−1** |
| Same day | 0 | **1** |
| 1 day after | +1 | **2** |
| 20 days after | +20 | **21** |

:::standard{kind="official"}
The `--DY` calculation is defined in SDTMIG v3.4: the reference start date is study day 1 and the day
before it is study day −1; **there is no study day 0**. The same rule applies to `--STDY`, `--ENDY` and
ADaM's `ADY`. It is stated in this study's own SDTM specification as *"`--DY = date − RFSTDTC + 1` when
the date is on or after `RFSTDTC`, otherwise `date − RFSTDTC`; there is no day 0."*
:::

::widget{name="study-day-calculator"}

:::number[Verified on CBX417-301]
Every `DMDY` across the 420 randomized subjects and every non-null `AESTDY` across 2,454 records
satisfies the two-branch formula, and **no record in either domain has `--DY = 0`**.

The `AESTDY` range is **−25 to 865**:

| | Records | `EPOCH` |
|---|---:|---|
| `AESTDY` negative | 39 | all `SCREENING` |
| `AESTDY` = 1 | 16 | `TREATMENT` |
| `AESTDY` positive | 2,415 | 2,316 `TREATMENT`, 99 `FOLLOW-UP` |
| `AESTDY` null | 12 | partial start dates |

The 39 negative ones are pre-treatment adverse events — reported during screening, after consent and
before first dose. They are real events and they are **not treatment-emergent**, which is what the sign
of the study day tells you at a glance.
:::

### `--ENDY` can be negative too, and that is not a bug

Ten AE records in CBX417-301 have a negative `AEENDY` — events that both started and finished before the
first dose:

| `USUBJID` | `AETERM` | `AESTDTC` | `AESTDY` | `AEENDTC` | `AEENDY` |
|---|---|---|---:|---|---:|
| `…-1015-0014` | nausea | 2023-11-12 | −3 | 2023-11-14 | **−1** |
| `…-1022-0003` | Nauseous | 2023-02-01 | −15 | 2023-02-01 | −15 |
| `…-1029-0005` | Nauseous | 2023-03 | *(null)* | 2023-03-20 | −1 |

The first row is the cleanest illustration of the no-day-0 rule in the wild: the event resolved on the
day **immediately before** first dose, so `AEENDY = −1` and the next day is day 1.

The last row is the one that surprises people: `AESTDY` is null because the start date is partial, while
`AEENDY` is −1 because the end date is complete. **`--STDY` and `--ENDY` are derived independently**, and
a record can have one and not the other.

### When there is no end date at all

312 AE records have a null `AEENDTC` — the event was still ongoing when the data was cut. SDTM does not
impute a cutoff date into `AEENDTC`. It uses a pair of relative timing variables instead:

```text
AEENDTC   = (null)
AEENRTPT  = "ONGOING"
AEENTPT   = "DATA CUTOFF"     or   "END OF STUDY"
```

:::standard{kind="official"}
`--ENRTPT` ("End Relative to Reference Time Point") uses the non-extensible codelist **STENRF (C66728)**
and `--ENTPT` names the reference point it is relative to. The pair says *"still ongoing as of X"*
without inventing a date. `CM` and `MH` use the same pattern for medications and conditions that had not
ended.
:::

## Worked example

Convert one raw date, both ways, and compute its study day.

**The raw record** (`raw/ae.csv`, subject `1001-0002`):

```text
AE_START = "13 JUL 2022"   AE_END = "25 JUL 2022"   AE_ONGOING = "N"
```

**The subject's anchor** (`DM`): `RFSTDTC = "2022-07-08T10:41"`.

::::tabs
:::tab[SAS]
```sas
data ae;
  set raw.ae;
  length aestdtc aeendtc $19;

  aestdtc = put(input(ae_start, date9.), yymmdd10.);
  aeendtc = put(input(ae_end,   date9.), yymmdd10.);

  if length(ae_start) = 11 and substr(ae_start, 1, 2) ne 'UN' then
       _st = input(aestdtc, yymmdd10.);
  else _st = .;

  _ref = input(substr(rfstdtc, 1, 10), yymmdd10.);

  if n(_st, _ref) = 2 then
       aestdy = _st - _ref + (_st >= _ref);
  else aestdy = .;
run;
```

:::lines
4: `DATE9.` reads `13 JUL 2022`; `YYMMDD10.` writes `2022-07-13`. The round trip through a SAS date is what normalises the format — and it is also what fails silently on `UN JUL 2022`, returning a missing value with a note in the log rather than an error.
8: The length-and-prefix test is the explicit precision check. **Do not rely on `input()` returning missing**; test the string before converting, so that the program can distinguish "partial date" from "conversion failed".
13: `substr(rfstdtc, 1, 10)` strips the time deliberately. `input(rfstdtc, yymmdd10.)` would also work on a sixteen-character value, and that is exactly the accident this avoids.
16: `(_st >= _ref)` evaluates to 1 or 0 in SAS, which implements both branches of the `--DY` formula in one expression. Written out: add 1 when the date is on or after the reference, add nothing when it is before.
:::
:::

:::tab[R]
```r
library(dplyr); library(lubridate)

to_iso <- function(x) {
  d <- suppressWarnings(dmy(x))
  ifelse(is.na(d), NA_character_, format(d, "%Y-%m-%d"))
}

study_day <- function(dtc, ref) {
  d <- suppressWarnings(as.Date(dtc))
  r <- as.Date(substr(ref, 1, 10))
  ifelse(is.na(d) | is.na(r), NA_integer_,
         as.integer(d - r) + as.integer(d >= r))
}

ae <- raw_ae |>
  mutate(
    AESTDTC = to_iso(AE_START),
    AEENDTC = to_iso(AE_END),
    AESTDY  = study_day(AESTDTC, RFSTDTC),
    AEENDY  = study_day(AEENDTC, RFSTDTC)
  )
```

:::lines
4: `lubridate::dmy()` parses `13 JUL 2022` and returns `NA` for `UN JUL 2022`, which is why the suppressed warning is deliberate rather than lazy — the `NA` is the intended result for a partial date.
11: `substr(ref, 1, 10)` again: strip the time explicitly. `as.Date("2022-07-08T10:41")` happens to parse correctly in R, which is another accident not to depend on.
13: `as.integer(d >= r)` is the two-branch formula. Both `AESTDY` and `AEENDY` call the same function with the same anchor, which is why they can disagree about being null.
:::
:::
::::

**The result:**

```text
AESTDTC = "2022-07-13"   AESTDY = 2022-07-13 − 2022-07-08 = 5, +1 = 6
AEENDTC = "2022-07-25"   AEENDY = 2022-07-25 − 2022-07-08 = 17, +1 = 18
```

Which is what the delivered domain contains for that record.

:::mistake[Writing `aestdy = _st - _ref` and fixing it with `+1` everywhere]
The single-branch version is wrong on **both** sides of the anchor, not just one. It gives 0 for the
reference day and −1 for the day before — so adding 1 unconditionally fixes the forward side and breaks
the backward side, turning day −1 into day 0.

The two branches are not a special case for negatives. They are what "no day 0" means.
:::

## Data example

Partial dates in the domain where they actually live:

::dataset{id="oncology/sdtm/mh" cols="USUBJID,MHSEQ,MHTERM,MHDECOD,MHCAT,MHSTDTC,MHENRTPT,MHENTPT" rows="10" caption="MH — 588 of 1,292 start dates are partial, because nobody remembers the day they were diagnosed"}

`MH` has no `MHSTDY` column at all. That is a deliberate design choice by this study, and a defensible
one: with 45% of start dates partial, a study-day column would be null for nearly half the domain and
would tempt readers into treating the populated half as comparable.

`MHENRTPT` and `MHENTPT` carry the ongoing information instead — conditions that had not resolved at the
reference point.

::::tabs
:::tab[What SDTM does]
```text
MHSTDTC  = "2019-10"           precision: month
MHSTDY   = (not in this domain)
```
Nothing is imputed. The reader sees exactly what was known.
:::

:::tab[What ADaM does]
```text
ASTDT    = 2019-10-01          imputed
ASTDTF   = "D"                 the DAY was imputed
```
ADaM imputes when the analysis requires a date, and flags the imputation so that the reader can
distinguish an observed date from a constructed one. `ADAE.ASTDTF` in this study does exactly this.
:::
::::

:::why[Why is imputing in ADaM acceptable when imputing in SDTM is not?]
Because of what each layer is for, and because of the flag.

SDTM is the record of what was collected. An imputed date in SDTM is a value nobody observed, sitting in
a dataset whose whole purpose is to hold observations, with nothing to mark it — and every downstream
consumer treats it as collected.

ADaM is the record of what was analysed, and it is *allowed* to contain decisions as long as they are
visible. `ASTDTF = "D"` says "the day in this date was supplied by me, not by the site". A reviewer can
count the imputed records, run a sensitivity analysis without them, and see exactly how the imputation
rule was applied.

**The rule is not "never impute". It is "never impute invisibly".**
:::

## Common mistakes

:::mistake[Omitting the two-branch --DY formula]
`date − RFSTDTC` gives 0 for the reference day. `date − RFSTDTC + 1` gives 0 for the day before it.
Neither is right on its own, and the second is worse because the error is on the side you look at least.
:::

:::mistake[Reading a --DTC with a fixed-width informat]
`RFSTDTC` is 16 characters for 416 subjects in this study and 10 for four of them. `EXSTDTC` is 16 for
every docetaxel record and 10 for most oral ones. `substr(x, 1, 10)` before converting is explicit;
relying on the informat to stop at the right place is a coincidence.
:::

:::mistake[Letting a partial date become a missing date silently]
`input("2023-06", yymmdd10.)` returns missing with a note. So does a genuine data error. Test the string
length or pattern first, so that "partial, correctly null" and "failed to convert, investigate" are
distinguishable outcomes.
:::

:::mistake[Imputing partial dates in SDTM]
SDTM stores what is known. A `2019-10` stays `2019-10`. Imputation belongs in ADaM with an imputation
flag, so a reviewer can identify and exclude imputed values.
:::

:::mistake[Assuming --STDY and --ENDY are both present or both absent]
One record in this study has a null `AESTDY` and an `AEENDY` of −1: a partial start date and a complete
end date. The two are derived independently against the same anchor.
:::

:::mistake[Writing a cutoff date into --ENDTC for ongoing events]
312 AE records here are ongoing. `AEENDTC` stays null and the pair `AEENRTPT = "ONGOING"` /
`AEENTPT = "DATA CUTOFF"` carries the information. Writing 2025-03-31 into `AEENDTC` fabricates a
resolution that did not happen.
:::

## Knowledge check

::quiz{ids="sdtm.dy.no-day-zero,sdtm.dy.partial-null,sdtm.dy.ongoing-pair,sdtm.dy.impute-layer"}

## Hands-on exercise

::practice{ids="sdtm.dy.calc-forward,sdtm.dy.calc-backward,sdtm.dy.convert-code,sdtm.dy.partial-count" title="Practice: dates in, study days out"}

## Challenge exercise

::practice{ids="sdtm.dy.offbyone-hotspot,sdtm.dy.endy-negative,sdtm.dy.open-partial-strategy" title="Challenge: the off-by-one that passes review"}

## Industry note

**The off-by-one in `--DY` is the single most common SDTM arithmetic error**, and it has a distinctive
signature: a study day of 0 anywhere in any domain. One line finds it across a whole submission:

```r
any(sapply(domains, function(d) any(d[[dy_var]] == 0, na.rm = TRUE)))
```

Pinnacle 21 checks it too. Running the check yourself first is cheaper than reading it in a report.

**Partial-date handling is a SAP decision, not a programming preference.** The imputation rule — first of
the month, last of the month, the reference date itself — changes which adverse events are
treatment-emergent and therefore changes the primary safety table. It belongs in the SAP with the flag
variable named, and the ADRG explains what was done.

:::standard{kind="convention"}
The common imputation convention for a partial **start** date is the earliest possible date (first of
the month, first of the year) and for a partial **end** date the latest possible (last of the month,
last of the year), because that is conservative for treatment-emergence: it makes an event as likely as
possible to fall inside the treatment window. This is sponsor practice, not a CDISC rule, and it is not
universal — some SAPs impute to the reference date instead when that is more conservative for the
specific endpoint. Read the SAP.
:::

:::interview[A listing shows an adverse event on study day 0. What happened?]
"Study day 0 doesn't exist in SDTM, so it's an arithmetic error, and almost always the same one: the
`--DY` derivation used a single formula instead of two branches.

The rule is that the reference date is day 1 and the day before it is day −1. So it's
`date − RFSTDTC + 1` when the date is on or after the reference, and plain `date − RFSTDTC` when it's
before. If you drop the `+1` you get 0 for the reference day; if you add it unconditionally you get 0 for
the day before. Both produce a zero, on opposite sides, and the second one is harder to spot because you
look at pre-treatment records less often.

I'd check two other things while I was there. Whether the anchor is right — on the study I worked with,
`RFSTDTC` is sixteen characters with a dose time for treated subjects and ten for the four who were
randomized and never dosed, so a fixed-width informat that happens to work on one doesn't necessarily
work on the other. And whether partial dates are being converted silently: twelve adverse events in that
study have a partial start date, `2023-06` or `2024`, and their `AESTDY` is correctly null. A program
that can't tell 'partial, so null' from 'conversion failed' will report both the same way.

The check itself is one line — any `--DY` equal to zero, across every domain — and it's worth running
before anyone else does."
:::
