## What problem are we trying to solve?

Subject 1001-0002 was first dosed on 8 July 2022 and reported diarrhea starting 13 July 2022. You need the study day, so you subtract:

```excel
=D2-B2     → 5
```

The published `AESTDY` for that record is **6**.

You are not out by a rounding error or a timezone. You are out by one, on every adverse event, every lab, every vital sign and every concomitant medication that happened on or after first dose — because **there is no Day 0**. The day of first dose is Day 1, the day before is Day −1, and nothing sits between them.

Across the 2,466 adverse events on this study, `AESTDY` takes 39 negative values and **not one zero**. That is not a coincidence in the data; it is the definition.

And the sixth row down, the one for subject 1001-0004, starts three days *before* the subject was dosed. It has a study day of **−3**, which is not an error either. So whatever you write has to handle both directions.

::widget{name="excel-grid" sheet="study-day"}

Work the first three tasks. `=B2` in a plain-number cell gives **44750**, `=D2-B2` gives 5, and the formula that gives 6 has an `IF` in it.

## Intuition

Start with what a date *is*, because everything else follows from it.

**A date in Excel is a number: whole days since 1899-12-30.** `2022-07-08` is the number 44750. The date-ness is a **number format** — a costume the cell wears — not a type. That single fact explains almost every date behaviour worth knowing:

- Dates can be subtracted, because subtracting two numbers gives a number.
- A number can be made to look like a date by changing the format, and a date can be made to look like a number the same way.
- A number imported into a date-formatted column becomes a plausible date instantly.
- A **partial** date cannot be stored at all, because there is no number meaning "some day in January".

Now the study-day convention. Subtraction is the natural thing and it is off by one, because clinical convention counts the first dose day as Day 1 rather than as zero elapsed days:

```text
first dose − 1 day    →  Day −1
first dose            →  Day  1
first dose + 1 day    →  Day  2
```

The jump from −1 straight to 1 is why a single formula cannot work. Before first dose, the subtraction is already right. On or after it, you add one.

```excel
=IF(ae >= dose, ae - dose + 1, ae - dose)
```

:::why[Why would anyone design a scale with no zero?]
Because it is a count, not an offset. "Day 1 of treatment" is the first day of treatment in the same way that 1 January is the first day of the year rather than the zeroth.

That reading is natural to a clinician — *the event happened on day 3 of dosing* — and unnatural to a programmer, who is thinking in elapsed time. The formula is the translation between the two, and it has an `IF` in it because the clinical scale skips a value and the arithmetic one does not.

The practical consequence is that **every pre-treatment day is shifted** if you get it wrong, not just the boundary. Naive subtraction gives Day 0 for the dosing day, so a plain difference reads one lower than the study day for everything on or after dosing, and exactly right for everything before it.
:::

## Clinical context

| Variable | Anchored on | Where |
|---|---|---|
| `--DY` (e.g. `AESTDY`, `LBDY`, `VSDY`) | `RFSTDTC` in DM | SDTM |
| `ADY` | `TRTSDT` in ADSL | ADaM |
| Treatment-emergent window | `TRTSDT` to `TRTEDT` + a protocol-defined lag | ADaM |
| Visit windows | Scheduled day ± a window from the protocol | ADaM |

:::standard{kind="official"}
SDTMIG v3.4 defines the study-day algorithm as

```text
--DY = date − RFSTDTC + 1     if date ≥ RFSTDTC
--DY = date − RFSTDTC         if date <  RFSTDTC
```

and states that there is no Day 0. **Every `--DY` in a study anchors on the same `RFSTDTC`**, which is why `RFSTDTC` lives in DM and nowhere else. ADaM's `ADY` uses the same two-branch rule against `TRTSDT`.

On CBX417-301 these coincide for the 416 treated subjects: `RFSTDTC` equals `RFXSTDTC`, the first exposure. They do **not** coincide for the four randomized subjects who were never dosed, who have a reference start and no exposure at all — which is why a study-day derivation has to say which anchor it is using rather than assume they are the same.
:::

:::clinical
Getting this wrong by one day is not cosmetic. Treatment-emergence is defined by a date comparison, so an event sitting exactly on the boundary flips between pre-treatment and treatment-emergent, and the safety table it belongs in changes with it.

On this study 16 adverse events have `AESTDY = 1` — they started on the day of first dose. Compute those with a plain subtraction and they become Day 0, which is a value the convention says does not exist. A downstream program that treats "day ≥ 1" as treatment-emergent would drop all sixteen.
:::

## Formal concept

### The epoch, and the reason it is 1899-12-30

Excel counts whole days from **1899-12-30**, which looks like an off-by-one until you know why.

Excel treats **1900 as a leap year**. It is not — a century year is a leap year only when divisible by 400 — but Lotus 1-2-3 had that bug, and Excel reproduced it deliberately so that spreadsheets could be exchanged. Excel therefore has a serial number for 29 February 1900, a day that never existed.

That phantom day shifts everything after it forward by one. Setting the epoch at 1899-12-30 rather than 1899-12-31 cancels the shift, so **every date from 1900-03-01 onwards is correct**. Dates before that are off by one relative to a true day count.

:::number[Does the 1900 leap-year bug ever matter in clinical work?]
Almost never, and it is worth saying so plainly rather than treating it as a lurking hazard.

It affects date arithmetic only when one of the dates is before **1900-03-01**. Trial dates are all recent. The only birth dates that could reach back that far belong to subjects aged well over 125, and this study stores `BRTHDTC` as a year alone in any case.

It is worth knowing for two reasons and no others: it explains why the epoch is 1899-12-30, which otherwise looks like a mistake; and it is why Excel's serial numbers differ from other systems' day counts by a day or two, so a serial number copied between tools cannot be assumed to mean the same date. SAS counts days from 1960-01-01 and has no phantom day; R's `Date` counts from 1970-01-01. **Move dates between systems as ISO 8601 text, never as serial numbers.**
:::

### The study-day formula

```excel
=IF(D2>=B2, D2-B2+1, D2-B2)
```

Three cases, and the sheet has one of each:

| Row | Event | First dose | Result |
|---|---|---|---|
| 8 | 2022-11-04 | 2022-11-07 | **−3** — before dosing, plain subtraction |
| 9 | 2022-11-07 | 2022-11-07 | **1** — the dosing day itself |
| 6 | 2022-11-13 | 2022-07-08 | **129** — after dosing, plus one |

### `DATEDIF` answers a different question

```excel
=DATEDIF(B2,D6,"D")     → 128
=IF(D6>=B2,D6-B2+1,D6-B2) → 129
```

`DATEDIF` returns **elapsed** days — the plain subtraction, with no convention applied. It is not wrong; it answers "how much time passed", which is one less than the study day for anything on or after the anchor.

Two things about `DATEDIF` are worth knowing before you reach for it:

**It is not in Excel's function list.** It exists for Lotus compatibility, has no autocomplete and no argument tooltip, and Microsoft's documentation warns that its `"MD"` unit can return a negative number.

**It refuses a negative interval.** If the end date is before the start date, real Excel returns `#NUM!`. So `DATEDIF` cannot express a pre-treatment study day at all — it errors on exactly the rows where getting the sign right matters most.

:::note
The sandbox's `DATEDIF` is more permissive than Excel's and will return a negative number rather than `#NUM!`. Rely on the rule, not on what the sandbox tolerates.
:::

### Partial dates

SDTM stores dates as **ISO 8601 character strings**, and that is not an accident of implementation. It is what makes a partial date representable:

```text
2022-11-07T09:51    complete date and time
2022-11-07          date only
2022-11             month and year, day unknown
2022                year only
```

A numeric date type cannot hold "some day in November". Excel has no representation for it, so a cell containing `2023-01` is text, and `ISNUMBER` on it returns `FALSE`.

**This study has 12 such records.** Ten give a month without a day, two give a year alone, and `AESTDY` is null on exactly those twelve and on no others.

:::mistake[Imputing a partial date so the arithmetic works]
The first of the month is a tempting fill. It produces a number, the column becomes uniform, and everything downstream computes.

It is also a decision about a subject's data that nobody has authorised. A study day derived from an imputed day is not a study day; it is an estimate presented as a measurement, and nothing in the cell records that.

Imputation rules exist and are legitimate — ADaM has `ASTDTF` and `AENDTF` specifically to flag which part of a date was imputed, and a SAP will specify the rule. **The rule belongs in the SAP and the flag belongs in the data.** In a spreadsheet, the honest answer is to show the reason:

```excel
=IFERROR(D12-B12,"Partial date")
```

A partial date stays partial until someone at the site answers the query.
:::

## Worked example

Each task in the sheet isolates one thing.

**A date is a number.** `=B2` in a plain-number cell gives **44750**. Formatting decides whether you see `2022-07-08` or the day count; the stored value is the same either way. This is why `=D2-B2` works at all.

**Plain subtraction gives 5.** Correct arithmetic, wrong convention.

**The formula gives 6.** `=IF(D2>=B2,D2-B2+1,D2-B2)` matches the published `AESTDY`.

**Row 8 gives −3.** Back pain started 2022-11-04; the subject was first dosed 2022-11-07. The `IF` takes the other branch and the subtraction stands. Note what this is clinically: an event that began before any study drug, which is medical history for the safety analysis rather than a treatment-emergent event.

**Row 9 gives 1.** Emesis on 2022-11-07, the day of first dose. This is the row that proves the convention: the dosing day is Day 1, not Day 0.

**`DATEDIF` gives 128 where the formula gives 129.** Elapsed days against study day.

**The partial date.** `=ISNUMBER(D12)` returns `FALSE`, and `=IFERROR(D12-B12,"Partial date")` shows the reason rather than `#VALUE!`.

**Back to ISO.** `=TEXT(B2,"yyyy-mm-dd")` gives `2022-07-08` — the format every CDISC date uses, and the format to write whenever a value leaves the workbook.

**A protocol visit three months out.** `=TEXT(EDATE(B2,3),"yyyy-mm-dd")` gives `2022-10-08`. `EDATE` moves whole months and handles month lengths, so a 31 January start plus one month lands on 28 February rather than on a date that does not exist.

::widget{name="study-day-calculator"}

:::mistake[Subtracting datetimes and getting a fraction]
Every one of the 25,450 `LBDTC` values on this study carries a time: `2022-06-17T08:51`. `RFSTDTC` carries one too — `2022-07-08T10:41`.

Import both and Excel stores a **fractional** serial number, where the fraction is the time of day. Subtracting them gives something like 20.9 days, and the study-day formula then produces a non-integer study day that no table can use.

Strip the time before any day arithmetic:

```excel
=IF(INT(D2)>=INT(B2), INT(D2)-INT(B2)+1, INT(D2)-INT(B2))
```

`INT` truncates to the start of the day. It is also worth noticing what this means clinically: a study day is a *calendar* day comparison, not a 24-hour-elapsed comparison. A dose at 22:00 and an event at 01:00 the next morning are three hours apart and one study day apart, and the study day is the answer the convention wants.
:::

## Data example

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AETERM,AESTDTC,AESTDY,AEENDTC,AEENDY" rows="8" caption="AE — AESTDY runs from −25 to 865 on this study, and is never 0"}

Three properties of `AESTDY` across all 2,466 records, and each one is a check you can run on any study:

**It is never 0.** 39 records are negative, 16 are exactly 1, and none is zero. A single `AESTDY = 0` anywhere in a dataset means the two-branch rule was not applied.

**It is null on exactly the partial dates.** Twelve records have an incomplete `AESTDTC` and those same twelve have no `AESTDY`. A null study day beside a complete date means something else went wrong; a study day beside an incomplete date means something was imputed.

**Its range is plausible.** −25 to 865. A value in the thousands, or a large negative, usually means the anchor date was wrong — a missing `RFSTDTC` treated as zero puts the event about 44,000 days after the epoch.

:::number[Why is a missing anchor so recognisable?]
Because an empty cell is 0 in arithmetic, and 0 is 1899-12-30 as a date.

If `RFSTDTC` is blank and you compute `D2-B2`, Excel reads the blank as zero and returns the AE date's own serial number: around **45,000** for a recent date. A study day of 45,000 is roughly 123 years, which is obvious enough to catch.

The dangerous version is the reverse — a missing *event* date against a real anchor, giving about **−44,750**. Large and negative, and pre-treatment study days are legitimately negative, so it lands in a column where negatives are expected.

`=IF(OR(ISBLANK(B2),ISBLANK(D2)),"Missing date",IF(D2>=B2,D2-B2+1,D2-B2))` costs nothing and removes the whole class.
:::

## Code

The same derivation in four places.

::::tabs
:::tab[Excel]
```excel
=IF(INT(D2)>=INT(B2), INT(D2)-INT(B2)+1, INT(D2)-INT(B2))
=TEXT(B2,"yyyy-mm-dd")
=TEXT(EDATE(B2,3),"yyyy-mm-dd")
```

:::lines
1: The two-branch rule with the time component stripped. `INT` on a date-only value is harmless, so this form is safe whether or not times are present.
2: Back to ISO 8601 for anything leaving the workbook. Excel writes a date to CSV in whatever format the cell displays, so this is not optional.
3: `EDATE` for a visit window three months out. It handles month lengths, so 31 January plus one month is 28 February rather than an invalid date.
:::
:::

:::tab[SAS]
```sas
data ae2;
  set ae;
  aestdt = input(substr(aestdtc,1,10), yymmdd10.);
  rfstdt = input(substr(rfstdtc,1,10), yymmdd10.);
  if not missing(aestdt) and not missing(rfstdt) then
    aestdy = aestdt - rfstdt + (aestdt >= rfstdt);
run;
```

:::lines
3-4: `SUBSTR(...,1,10)` takes the date part of an ISO datetime. A partial date fails `yymmdd10.` and becomes missing, which is the correct outcome — it is not a date.
5-6: `(aestdt >= rfstdt)` evaluates to 1 or 0 in SAS, so adding it implements both branches without an `IF`/`ELSE`. Compact and idiomatic; the `IF` form is easier for a reviewer to check against the SDTMIG wording.
:::
:::

:::tab[R]
```r
study_day <- function(date, anchor) {
  d <- as.Date(substr(date,   1, 10), format = "%Y-%m-%d")
  a <- as.Date(substr(anchor, 1, 10), format = "%Y-%m-%d")
  ifelse(is.na(d) | is.na(a), NA_integer_,
         as.integer(d - a) + (d >= a))
}
```

:::lines
2-3: An incomplete string returns `NA` under an explicit format rather than being guessed at.
4: Missing propagates to `NA` explicitly. Without this line, `NA` arithmetic would still give `NA` — stating it makes the intent reviewable.
5: `(d >= a)` is `TRUE`/`FALSE`, which coerces to 1/0 in the addition. The same trick as the SAS version.
:::
:::

:::tab[Python]
```python
import pandas as pd

d = pd.to_datetime(ae["AESTDTC"].str[:10], format="%Y-%m-%d", errors="coerce")
a = pd.to_datetime(ae["RFSTDTC"].str[:10], format="%Y-%m-%d", errors="coerce")

ae["AESTDY"] = (d - a).dt.days + (d >= a)
```

:::lines
3-4: `errors="coerce"` turns a partial date into `NaT` instead of raising. That is the right behaviour here and it is worth being deliberate about, because silently coercing is exactly what you would not want elsewhere.
6: `(d >= a)` is a boolean Series adding 1 or 0. Rows where either date is `NaT` come out as missing.
:::
:::
::::

## Common mistakes

:::mistake[Plain subtraction]
Off by one for everything on or after the anchor, and exactly right for everything before it — which is what makes it survive a spot-check. The tell is a single `--DY` of 0 anywhere in the dataset.
:::

:::mistake[Using `DATEDIF` as a study day]
It returns elapsed days, one less than the study day for on-or-after events, and in real Excel it returns `#NUM!` when the end date is earlier than the start — so it cannot produce a pre-treatment study day at all.
:::

:::mistake[Forgetting that a blank is zero]
An empty anchor cell is 0 in arithmetic, and 0 is 1899-12-30. The result is a study day around 45,000 or around −44,750, depending on which side was blank. Guard with `ISBLANK` before subtracting.
:::

:::mistake[Subtracting datetimes]
A fractional serial gives a fractional study day. Wrap both sides in `INT`. Every lab date on this study carries a time, so this is the common case rather than the exception.
:::

:::mistake[Imputing a partial date to make the column uniform]
A study day derived from an imputed day is an estimate presented as a measurement. ADaM has `ASTDTF` to flag imputation and the SAP specifies the rule; a spreadsheet has neither, so it should show `Partial date` and stop.
:::

:::mistake[Sending a serial number to another system]
44750 means 2022-07-08 in Excel, a different date in SAS and a different date again in R, because the epochs differ and Excel has a phantom 29 February 1900. Export ISO 8601 text.
:::

## Knowledge check

::quiz{ids="excel.dates.no-day-zero,excel.dates.serial,excel.dates.datedif,excel.dates.partial"}

## Hands-on exercise

::practice{ids="excel.dates.pretreatment,excel.dates.dosing-day,excel.dates.blank-anchor,excel.dates.datetime-fraction" title="Practice: all three branches, and the ones that break"}

## Challenge exercise

::practice{ids="excel.dates.hotspot,excel.dates.qc-diff,excel.dates.open-partial" title="Challenge: a study-day column with three different defects"}

## Industry note

**Study day is one of the most-derived quantities in clinical data and one of the most reliably wrong.** It appears on every event and findings domain in SDTM, on every BDS analysis dataset in ADaM, and in the definition of treatment-emergence, of visit windows and of analysis periods. An off-by-one propagates into all of them.

It is also a good QC target precisely because it has verifiable properties. Study day is **never zero**. It is **null exactly when the date is incomplete**. Its range should be plausible for the study's duration. Those three checks take minutes, run against any study, and catch the naive subtraction, the imputed partial date and the missing anchor respectively.

**Where a spreadsheet is appropriate here** is checking a handful of records against a programmed output — pulling ten rows, computing the study day by hand and confirming the derivation agrees. That is a genuinely useful independent check and it is exactly the kind of thing Excel is good at.

Where it stops being appropriate is deriving the column for 2,466 records that go into a dataset. Not because the formula is hard — it is one `IF` — but because there is no record of which rows had partial dates, which anchor was used, or whether the time component was stripped, and all three are decisions a reviewer needs to see.

:::interview[How would you check a study-day derivation you did not write?]
"I'd start with three properties that hold for any study, because they need no knowledge of this one.

**No zeros.** The convention has no Day 0, so a single `--DY` of 0 anywhere means the two-branch rule wasn't applied. That is the fastest check there is — one `COUNTIF`.

**Nulls line up with partial dates.** Study day should be missing on exactly the records with an incomplete date and nowhere else. On the study I've worked with that's 12 records out of 2,466. A null study day beside a complete date means something failed; a study day beside an incomplete date means somebody imputed a day, and I'd want to see the SAP rule and the `ASTDTF` flag.

**The range is plausible.** Mine runs −25 to 865 for a study with that follow-up. A value near 45,000 is a blank anchor being read as zero, which is 1899-12-30. Near −44,750 is the same thing with the sides swapped, and that one is nastier because pre-treatment days are legitimately negative, so it lands in a column where negatives look normal.

Then the things specific to the study. Which anchor — `RFSTDTC` for SDTM `--DY`, `TRTSDT` for ADaM `ADY`. They're equal for the treated subjects on my study but not for the four who were randomized and never dosed, so the derivation has to say which it used rather than assume.

And whether the time component was stripped. Every lab date in that study carries a time, so subtracting datetimes gives fractional study days. If the column is integers, either `INT` was applied or the dates were truncated on the way in, and I'd want to know which.

Finally I'd recompute a handful of records by hand — including one before first dose, one on the dosing day and one well after — because those are the three branches and the boundary ones are where an off-by-one hides."
:::
