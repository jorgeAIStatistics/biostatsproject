## What problem are we trying to solve?

Four date bugs, all silent, all from real clinical work:

```r
as.Date("14/03/2025")            # "14-03-20"   <- a nonsense date, not NA
as.Date("2025-03")               # Error
adt - trtsdt                     # 0 on the day of first dose — but Day 0 does not exist
ifelse(x > 0, adt, NA)           # 20161 — the Date class is gone
```

**The first one is the worst.** It does not error and it does not return `NA`. It returns year 14, month 3, day 20 — a date in the first century, silently, because R tried its default formats and one of them almost fit.

Dates are where clinical programming is most dangerous, for a structural reason: **almost every derived variable in ADaM is a date calculation**. Study day, treatment-emergent flags, baseline selection, time-to-event, exposure duration, age at randomization. A date that is quietly wrong propagates into all of them, and nothing about the output looks unusual.

This lesson covers the four things that actually go wrong: the epoch difference between SAS and R, the missing Day 0, partial dates, and class loss.

## Intuition

A date is **a number with an attribute saying "this is a date"**. In both R and SAS.

```r
d <- as.Date("2025-03-14")
as.numeric(d)   # 20161
```

20,161 days since **1970-01-01**, R's epoch.

SAS stores the same date as **23,814** — days since **1960-01-01**, SAS's epoch.

:::number[Where does the difference of 3,653 come from?]
It is the number of days between the two epochs: 1960-01-01 to 1970-01-01 is ten years containing three leap days (1960, 1964, 1968), so $10 \times 365 + 3 = 3653$.

$$20161 + 3653 = 23814$$

**This matters the moment a date crosses between systems as a number rather than as text.** A SAS dataset read with `haven` is converted correctly, because `haven` knows about the epochs. A numeric date exported to CSV and read back is not — it is just a number, and 23,814 read as an R date is **2025-03-14 plus ten years**.

The defence is to move dates between systems as **ISO 8601 text**, never as numbers. Which is, not coincidentally, exactly what SDTM requires.
:::

The second idea is that **a date and a date-time are different types**, and mixing them causes trouble:

| Type | Represents | Timezone? |
|---|---|---|
| `Date` | A calendar day | No |
| `POSIXct` | An instant | **Yes** |

A `Date` has no timezone and no time of day. A `POSIXct` has both, and if you do not set the timezone it silently uses your machine's — which means the same code gives different answers on a laptop in Boston and a server in London.

:::mistake[Using a date-time where a date will do]
Lab collection dates, visit dates, AE onset dates: all calendar days. Use `Date`.

Reach for `POSIXct` only when the time genuinely matters — a pre-dose lab drawn at 08:15 versus a first dose at 09:00 on the same calendar day, where the ordering decides whether the sample is baseline. Then set `tz = "UTC"` explicitly, because the alternative is a value that depends on where the program ran.
:::

## Clinical context

| Derivation | Why dates are the hard part |
|---|---|
| `ADY` / `--DY` (study day) | **No Day 0** — the formula has two branches |
| `TRTEMFL` | Comparing AE onset against first dose, with partial onset dates |
| `ABLFL` | Last assessment on or before first dose; ties need time or sequence |
| `AVAL` in ADTTE | Event date minus origin date, in days |
| `TRTDURD` | Last dose minus first dose, plus 1 |
| `AGE` at randomization | Birth date to randomization — and leap years |

Every one of these is a subtraction, and every one has an edge case that a naive subtraction gets wrong.

## Formal concept

### Study day has no Day 0

$$
\text{ADY} =
\begin{cases}
\text{ADT} - \text{TRTSDT} + 1 & \text{if } \text{ADT} \ge \text{TRTSDT} \\[4pt]
\text{ADT} - \text{TRTSDT} & \text{if } \text{ADT} < \text{TRTSDT}
\end{cases}
$$

The day before first dose is **Day −1**; the day of first dose is **Day 1**. There is no Day 0.

:::number[What does a naive subtraction get wrong?]
With a treatment start of 2025-03-14:

| Assessment date | Naive `ADT - TRTSDT` | Correct `ADY` |
|---|---:|---:|
| 2025-03-12 | −2 | **−2** |
| 2025-03-13 | −1 | **−1** |
| 2025-03-14 | **0** | **1** |
| 2025-03-15 | **1** | **2** |

The pre-treatment days are already right — the naive subtraction only breaks on and after the reference date, where it is short by exactly one.

That single day shifts every post-baseline assessment. It changes which visit window an assessment falls into, and it produces a Day 0 that does not exist in any CDISC standard — a conformance finding as well as a wrong number.
:::

This is the same rule for SDTM's `--DY` variables, anchored on `RFSTDTC` in DM.

### Date arithmetic returns `difftime`, not a number

```r
a <- as.Date("2025-03-14")
b <- as.Date("2025-01-01")

a - b            # Time difference of 72 days
class(a - b)     # "difftime"
```

A `difftime` prints with its units attached and mostly behaves like a number — until it does not. `as.numeric()` converts it, and **you should convert explicitly** whenever the result feeds another calculation:

```r
as.numeric(a - b) + 1     # 73
```

The safer general form is `difftime(a, b, units = "days")`, which states the units rather than letting them be inferred. For two `Date` objects the units are always days; for `POSIXct` they are inferred from the magnitude, so a two-hour gap comes back in hours and a two-day gap in days — and code that assumed days silently gets the wrong number.

### Partial dates cannot be parsed

```r
as.Date("2025-03")   # Error in charToDate(x) : character string is not in a standard unambiguous format
as.Date("2025")      # Error
```

SDTM `--DTC` variables are **character** ISO 8601 strings precisely so that `2025-03` — March 2025, day unknown — can exist. No numeric date type can represent it.

**Read `--DTC` as character.** Impute in ADaM, per the SAP's rule, and flag the imputed records with `DTYPE` so an analysis can exclude them.

:::why[Why does the imputation rule matter so much for adverse events?]
Because it decides whether an event is treatment-emergent.

An AE with onset `2025-03` in a subject first dosed on 2025-03-20 could have started before or after first dose. The SAP's rule decides, and the convention is **conservative** — treat it as treatment-emergent unless it can be ruled out — because under-counting adverse events is the more dangerous error.

That is a clinical and regulatory judgement, not a programming convenience, and it belongs in the SAP rather than in whatever a date parser happens to do.
:::

### Format strings, and the silent nonsense

R's `as.Date()` with no `format` tries `"%Y-%m-%d"` then `"%Y/%m/%d"`. Anything else either errors or — worse — half-matches:

```r
as.Date("14/03/2025")    # "14-03-20"
```

**That is not an error and not `NA`.** R matched `"%Y/%m/%d"` against the string, read year 14, month 03, day 20, and ignored the trailing `25`. The result is a valid `Date` in the year 14 AD, and every calculation using it will succeed.

Always pass the format:

```r
as.Date("14/03/2025", format = "%d/%m/%Y")   # "2025-03-14"
as.Date("14MAR2025",  format = "%d%b%Y")     # "2025-03-14"
```

:::mistake[`%b` depends on the machine's locale]
`%b` matches abbreviated month names — `MAR`, `mar`, `Mar` — using the **current locale**. A program that works on an English-locale laptop can fail on a French-locale server, where the expected abbreviation is `mars`.

For clinical work either set the locale explicitly, or avoid `%b` entirely by requiring ISO input. SAS's `DATE9.` informat (`14MAR2025`) has the same locale dependency and the same fix.
:::

## Worked example

Deriving study day correctly, and seeing what the naive version costs.

```r
derive_ady <- function(adt, trtsdt) {
  diff <- as.numeric(adt - trtsdt)
  if_else(adt >= trtsdt, diff + 1, diff, missing = NA_real_)
}

trtsdt <- as.Date("2025-03-14")
dates  <- as.Date(c("2025-03-12", "2025-03-13", "2025-03-14", "2025-03-15"))

data.frame(
  ADT   = dates,
  naive = as.numeric(dates - trtsdt),
  ADY   = derive_ady(dates, trtsdt)
)
```

```text
         ADT naive ADY
1 2025-03-12    -2  -2
2 2025-03-13    -1  -1
3 2025-03-14     0   1
4 2025-03-15     1   2
```

**Step 1 — `as.numeric()` on the difference.** Without it the result is a `difftime`, and `difftime + 1` works but carries the units attribute into a column that should be plain numeric.

**Step 2 — `if_else` rather than `ifelse`.** The strict version type-checks both branches, so it will not silently return something unexpected if the two branches disagree.

**Step 3 — `missing = NA_real_`.** States what happens when either date is missing, rather than letting it fall through. A subject randomized but never dosed has no `TRTSDT`, and their `ADY` must be missing rather than computed from `NA`.

:::number[Why does the pre-treatment side need no adjustment?]
Because the day before first dose is Day −1 and the naive subtraction already gives −1. The convention removes Day 0 by shifting only the non-negative side up by one.

Think of it as two half-lines meeting: −3, −2, −1, then straight to 1, 2, 3. The gap where 0 would be is the whole point, and it exists because there is no such thing as "zero days from the reference day" when the reference day is itself Day 1.
:::

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,RANDDT,TRTSDT,TRTEDT,TRTDURD,ITTFL,SAFFL" rows="8" caption="ADSL — the date variables that anchor every derivation"}

**Treatment duration** is the same "plus one" rule:

```r
adsl <- adsl |>
  mutate(
    TRTDURD_calc = as.numeric(TRTEDT - TRTSDT) + 1
  )
```

A subject dosed on 2025-03-14 and last dosed on 2025-03-14 has a treatment duration of **1 day**, not 0 — they were treated on one day. The `+ 1` is the same inclusive-counting convention as study day.

**Two subjects have no `TRTSDT`** in this dataset: randomized but never dosed. Every date derivation anchored on treatment start must produce `NA` for them rather than a number, and their `SAFFL` is `N` for exactly this reason.

```r
sum(is.na(adsl$TRTSDT))   # 2
```

:::number[Why does a missing TRTSDT have to propagate rather than default?]
Because any default would be a fabrication. A subject who was never dosed has no Day 1, so every assessment they had is neither pre- nor post-treatment in the usual sense — it is simply not on the treatment timeline at all.

R's `NA` propagation gives you this for free: `as.numeric(adt - NA)` is `NA`, and the derived study day is missing. **SAS does not.** A missing `TRTSDT` in SAS is a missing numeric, which sorts below every real number, so `adt >= trtsdt` evaluates to **true** and the subject gets a positive study day computed from a date that does not exist.

That is one of the clearest cases where R's strictness is the safer default, and where a SAS program needs an explicit `if missing(trtsdt) then ady = .;` branch that R does not.
:::

**Reading dates from the CSV** — `readr` parses complete ISO dates automatically:

```r
adsl <- readr::read_csv("data/cardio/adsl.csv", show_col_types = FALSE)
class(adsl$RANDDT)   # "Date"
class(adsl$TRTSDT)   # "Date"
```

Base `read.csv()` would leave both as character, and `TRTEDT - TRTSDT` on character columns errors — which is at least loud. The quiet failure is a character date that gets compared with `<` and sorts lexically: `"2025-10-01" < "2025-9-01"` is `TRUE` as strings, because `"1" < "9"`.

Zero-padded ISO dates happen to sort correctly as strings, which is one of the reasons the format was designed that way — but any other format does not, and relying on it is fragile.

## Code

::::tabs
:::tab[SAS]
```sas
data adsl2;
  set adam.adsl;

  /* Study day — two branches, no Day 0 */
  if missing(adt) or missing(trtsdt) then ady = .;
  else if adt >= trtsdt              then ady = adt - trtsdt + 1;
  else                                    ady = adt - trtsdt;

  /* Treatment duration, inclusive */
  if not missing(trtsdt) and not missing(trtedt)
    then trtdurd = trtedt - trtsdt + 1;

  format adt trtsdt trtedt yymmdd10.;
run;
```

:::lines
5: **The explicit missing check is essential in SAS and not in R.** A missing numeric sorts below every real number, so without this line `adt >= trtsdt` is *true* when `trtsdt` is missing, and the subject gets a study day computed from a date that does not exist.
6: The two branches implementing "no Day 0".
13: **The `FORMAT` statement is what makes the value display as a date.** Without it the column shows 23814. The stored value is correct either way — this is a display issue, and the SAS analogue of losing the `Date` class in R, except that the value survives.
:::
:::

:::tab[R]
```r
library(dplyr)

adsl <- adsl |>
  mutate(
    ADY = if_else(
      is.na(ADT) | is.na(TRTSDT),
      NA_real_,
      if_else(ADT >= TRTSDT,
              as.numeric(ADT - TRTSDT) + 1,
              as.numeric(ADT - TRTSDT))
    ),
    TRTDURD_calc = as.numeric(TRTEDT - TRTSDT) + 1
  )
```

:::lines
6: The explicit missing branch is belt-and-braces here — R's `NA` propagation would handle it — but stating it documents the rule for a reviewer rather than relying on language semantics.
9: `as.numeric()` on the difference. Without it the result is a `difftime` carrying a units attribute, which is not what a numeric analysis-day column should hold. `if_else` rather than `ifelse`: it type-checks both branches and preserves attributes, so a `Date` cannot silently become a number.
:::
:::

:::tab[Python]
```python
import pandas as pd

adsl["ADT"]    = pd.to_datetime(adsl.ADT,    format="%Y-%m-%d", errors="coerce")
adsl["TRTSDT"] = pd.to_datetime(adsl.TRTSDT, format="%Y-%m-%d", errors="coerce")

diff = (adsl.ADT - adsl.TRTSDT).dt.days
adsl["ADY"] = diff.where(adsl.ADT < adsl.TRTSDT, diff + 1)
```

:::lines
3: `format=` is required in current pandas — inferring the format is deprecated because it produced exactly the kind of silent mis-parse R's `as.Date` does. `errors="coerce"` turns unparseable values into `NaT` rather than raising, which is the right choice only when you then *check* how many became `NaT`.
6: `.dt.days` extracts the integer day count from a `Timedelta`, the pandas equivalent of `as.numeric()` on a `difftime`.
7: `Series.where(cond, other)` keeps the value where `cond` is **True** and substitutes otherwise — the opposite sense to R's `if_else`, and a reliable source of inverted logic when moving between the two.
:::
:::
::::

## Output

```text
> as.Date("14/03/2025")
[1] "14-03-20"

> as.Date("14/03/2025", format = "%d/%m/%Y")
[1] "2025-03-14"
```

:::number[How did R turn "14/03/2025" into the year 14?]
`as.Date()` with no `format` tries `"%Y-%m-%d"`, then `"%Y/%m/%d"`. The second one matched: year `14`, month `03`, day `20` — and the trailing `25` was ignored rather than treated as a failure.

The result is a genuine `Date` in the year 14 AD. It is not `NA`, nothing warns, and every subsequent calculation succeeds while being nearly two thousand years wrong.

**This is the strongest argument in the lesson for always passing `format=`.** A parser that returns `NA` on failure is recoverable; one that returns a plausible-looking wrong answer is not.
:::

## Interpretation

Nothing statistical — but the study-day convention is worth stating in words, because you will have to explain it.

**"Day 1 is the day of first dose."** Not the day after, and not the day it was prescribed. The day before is Day −1. There is no Day 0.

The consequence for anyone reading a listing: an assessment on Day 1 happened on the same calendar day as the first dose, and whether it was *before* or *after* the dose requires the time, not the date. That is exactly the case where baseline selection needs `--DTM` rather than `--DT`, and it is why pre-dose labs on Day 1 are a recurring source of baseline-flag discussion.

## Common mistakes

:::mistake[Computing study day without the two branches]
A naive subtraction gives 0 on the day of first dose and is short by one for every later assessment. Day 0 does not exist in any CDISC standard, so it is a conformance finding as well as a wrong number.
:::

:::mistake[Calling `as.Date()` without a format]
`as.Date("14/03/2025")` returns `"14-03-20"` — a valid date in the year 14, silently. Always pass `format=`.
:::

:::mistake[Parsing a partial date]
`as.Date("2025-03")` errors; a permissive parser would give `NA`. Either way the precision information is destroyed. Read `--DTC` as character and impute in ADaM with a `DTYPE` flag.
:::

:::mistake[Letting `ifelse` strip the Date class]
`ifelse(cond, some_date, NA)` returns a number, because `ifelse` drops attributes and a bare `NA` is logical. Use `dplyr::if_else`, which type-checks and preserves the class.
:::

:::mistake[Moving dates between SAS and R as numbers]
The epochs differ by 3,653 days. A numeric SAS date read as an R date is ten years out. Transfer dates as ISO 8601 text, or use `haven`, which knows about both epochs.
:::

## Knowledge check

::quiz{ids="r.dates.no-day-zero,r.dates.epoch,r.dates.silent-parse,r.dates.partial"}

## Hands-on exercise

::practice{ids="r.dates.ady-hand,r.dates.derive-ady,r.dates.duration,r.dates.teae-code" title="Practice: study day, duration and treatment-emergence"}

## Challenge exercise

::practice{ids="r.dates.class-loss,r.dates.imputation,r.dates.open" title="Challenge: class loss, partial-date imputation and cross-system transfer"}

## Industry note

**Partial-date imputation rules belong in the SAP and they are consequential.** A typical rule set: if the day is missing, impute the first of the month; if the month is missing, impute January; then compare against the reference date and, if the imputed date could be either side of it, take the conservative option. For adverse events "conservative" means **treat as treatment-emergent**, because under-counting AEs is the more dangerous error.

Every imputed value must be flagged — `DTYPE` in ADaM — so that a sensitivity analysis can be run on observed dates only.

:::standard{kind="official"}
SDTM requires `--DTC` variables to be character values in ISO 8601 format, which is what allows partial dates to be represented. The `--DY` calculation with no Day 0 is specified in SDTMIG; ADaM's `ADY` follows the same convention. Neither standard prescribes an imputation rule — that is a study-level decision for the SAP, documented in define.xml and the ADRG.
:::

**`{lubridate}` is the usual tidyverse choice** for anything beyond simple parsing: `ymd()`, `dmy()` and friends are far more forgiving than `as.Date()` and return `NA` with a warning rather than a silently wrong date. `interval()` and `%--%` handle durations properly, including the leap-year cases that trip up naive day counting for age calculations.

It is not installed in every environment, and the base-R equivalents above work everywhere — which is why this lesson uses them.

**Age at randomization has its own trap.** Subtracting birth date from randomization date and dividing by 365.25 is approximately right and occasionally off by a day near a birthday. If age is a stratification factor or an inclusion criterion, "approximately right" is not good enough, and the derivation should count completed years rather than divide.

:::interview[How do you calculate study day, and why is it not just a subtraction?]
The answer is short and the follow-up is where it gets interesting.

"Study day is the assessment date minus the reference start date, **plus one** if the assessment is on or after the reference date. The two branches exist because there is no Day 0 — the day of first dose is Day 1 and the day before is Day −1. A naive subtraction gives 0 on the reference day, which is not a value that exists in CDISC, and it is short by one for every later assessment.

The reference date matters too: for `ADY` it is usually `TRTSDT`, first dose, and for SDTM's `--DY` it is `RFSTDTC` in DM. Those can differ, and an analysis anchored on the wrong one shifts every day by the gap between randomization and first dose."

If they push further, the two things worth adding are the missing-value handling and the partial dates. "A subject randomized but never dosed has no `TRTSDT`, so their study day has to be missing rather than computed. R propagates that automatically; SAS does not — a missing numeric sorts below every real number, so `adt >= trtsdt` is *true* and you get a positive study day from a date that does not exist. That needs an explicit missing branch in SAS.

And if the assessment date is partial — month and year only — you cannot compute a study day at all until the SAP's imputation rule has been applied, and the imputed record needs a `DTYPE` flag so it can be excluded from a sensitivity analysis."
:::
