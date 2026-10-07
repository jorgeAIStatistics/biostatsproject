## What problem are we trying to solve?

You know the DATA step. You can write a BY-group summary in your sleep. Now the team wants a QC program in R, and your first attempt produces this:

```text
> adsl$AGEGR1N
[1] 2 1 2 1 1 2 1 ...
```

You asked for age group codes. `AGEGR1N` holds 1 and 2 in the CSV. R is showing you 2, 1, 2 — the right *kind* of thing, in the wrong order, and you cannot see why.

Then your treatment comparison silently drops eleven subjects. Then a date becomes the number 20089. Then `if (age > 65)` throws a warning about "the condition has length > 1".

**None of these are bugs in your logic.** They are places where R's model of data differs from SAS's, and each one has a specific cause you can learn once.

This lesson is not "R for beginners". It is R for someone who already thinks in the PDV — a map of where the two languages disagree, so the disagreements stop being surprises.

## Intuition

The single deepest difference, from which most others follow:

**SAS processes one observation at a time. R operates on whole vectors at once.**

The DATA step is a loop. It reads an observation into the program data vector, runs your statements top to bottom on that one row, writes it out, and goes back for the next. Your code describes what happens to *one* row.

R has no loop. `adsl$AGE > 65` is a single operation on all 270 ages, producing 270 logical values. Your code describes what happens to *the whole column*.

:::why[Why does this cause the "condition has length > 1" error?]
Because `if` in R takes **one** logical value and decides which branch to run. Writing `if (adsl$AGE > 65)` hands it 270 values, and R does not know which one you meant. (Until R 4.2 it silently used the first and warned; now it is an error.)

The vectorised equivalent — the one that corresponds to what the DATA step does per row — is `ifelse()` or `dplyr::if_else()`, which return a value for *every* element.

The rule: **`if` is for control flow (should this block of code run at all?); `if_else` is for data (what value does each row get?).** SAS's `IF` does both jobs, which is why the distinction is invisible until you leave it.
:::

The second difference follows from the first. SAS datasets live on disk and you process them in passes. R objects live in memory and you transform them by creating new ones. `x <- y` does not create a link — modify `y` afterwards and `x` is unchanged, because R copies on modification.

## Clinical context

Where you will actually meet R in a biometrics group:

| Use | Typical situation |
|---|---|
| **QC / double programming** | Production in SAS, independent check in R — the most common entry point |
| Exploratory analysis | Faster to iterate than SAS for a question nobody has specified yet |
| Figures | `ggplot2` produces publication figures with less effort than SGPLOT |
| Simulation | Sample size under non-standard designs, operating characteristics |
| Submissions | Growing — the R Consortium's pilot submissions to FDA have been accepted |

:::standard{kind="convention"}
SAS remains dominant in clinical reporting because of validated installations, established macro libraries and reviewer familiarity — not because of any regulatory requirement that analysis be done in SAS. No FDA or EMA guidance mandates a particular language; what is required is that the analysis be reproducible and adequately documented. R submissions have been accepted, and the R Consortium's Submission Working Group publishes the pilot materials.
:::

The practical consequence for you: **learning R does not replace SAS, it makes you the person who can check SAS.** A QC programmer who can reproduce a production table in a different language, and diagnose the differences, is more useful than one who runs the same macro twice.

## Formal concept

### Everything is a vector

There is no scalar in R. `x <- 5` creates a numeric vector of length 1.

```r
length(5)        # 1
is.vector(5)     # TRUE
```

The six atomic types you will meet: `logical`, `integer`, `double` (what R calls "numeric"), `character`, and — rarely in clinical work — `complex` and `raw`.

**A vector holds one type only.** Combining types forces the whole vector to the most general one, silently:

```r
c(1, 2, "3")     # "1" "2" "3"  — all character
c(TRUE, 1L, 2.5) # 1.0 1.0 2.5  — all double
```

:::mistake[Reading a numeric column that contains one text value]
If a CSV column holds `5.2`, `6.1` and `NOT DONE`, R reads the whole column as character. Every subsequent `mean()` fails or returns `NA`, and the cause is one cell several thousand rows down.

This is the R equivalent of the SAS problem where PROC IMPORT guesses a column's type from the first 20 rows — except R's coercion is silent rather than truncating. The fix in both cases is to **declare** the types on import rather than let them be inferred, which the next lesson covers.
:::

### NA, NULL, NaN — three different nothings

| | Meaning | Length | SAS analogue |
|---|---|---|---|
| `NA` | A value exists but is unknown | 1 | `.` or `''` |
| `NULL` | There is no value at all | 0 | no direct analogue |
| `NaN` | Not a number (`0/0`) | 1 | `.` after an invalid operation |

`NA` is typed: `NA_integer_`, `NA_character_`, `NA_real_`. A bare `NA` is logical, which matters when it meets a type-strict function.

:::why[Why does `NA > 3` give `NA` rather than `FALSE`?]
Because the comparison is honest: if you do not know the value, you do not know whether it exceeds 3. R propagates the uncertainty rather than resolving it.

**SAS resolves it.** A missing numeric in SAS sorts below every real number, so `if age > 65` is *false* for a missing age and the record falls into the `else` branch — silently counted as "not elderly" rather than "unknown".

Neither is wrong, and the difference decides how many subjects land in a table cell. It is the single most consequential semantic difference between the two languages, and the reason a SAS-versus-R count discrepancy is so often exactly the number of subjects with missing data.
:::

The practical consequences of NA propagation:

```r
mean(c(1, 2, NA))              # NA
mean(c(1, 2, NA), na.rm = TRUE) # 1.5

x <- c(1, NA, 5)
x == NA        # NA NA NA  — never use this
is.na(x)       # FALSE TRUE FALSE  — use this
```

### Factors: the format that bites back

A factor is R's categorical type. It stores **integer codes** plus a `levels` attribute holding the labels — conceptually similar to a SAS format, but with one critical difference: the codes are a property of the factor, not of the data.

```r
f <- factor(c("Placebo", "Drug", "Placebo"))
levels(f)       # "Drug" "Placebo"   <- ALPHABETICAL by default
as.integer(f)   # 2 1 2
```

:::number[Why is "Drug" level 1 when "Placebo" appeared first in the data?]
Because `factor()` sorts the levels alphabetically unless you tell it otherwise. `"Drug"` sorts before `"Placebo"`, so it becomes level 1.

**This is not cosmetic.** The first level is the reference level in every model, the first column in every `table()`, and the first row in every plot legend. A treatment variable left as a character column becomes a factor in alphabetical order the moment it enters `lm()`, and your treatment coefficients silently describe comparisons against whichever arm happens to sort first.

Always set it deliberately:

```r
adsl$TRT01P <- factor(adsl$TRT01P,
                      levels = c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg"))
```
:::

:::mistake[Converting a factor of numbers back to numbers]
```r
g <- factor(c("10", "2", "30"))
as.integer(g)                    # 1 2 3   <- the CODES, not the values
as.numeric(as.character(g))      # 10 2 30  <- correct
```

`as.integer()` on a factor returns the internal level codes. On a factor of numeric-looking strings that produces plausible small integers, which is why the error survives inspection. Always go via `as.character()`.

This is also why `stringsAsFactors = FALSE` became the default in R 4.0 — the automatic conversion caused more of these than it prevented.
:::

### Indexing: `[` versus `[[`

```r
x <- c(a = 1, b = 2, c = 3)
x[1]        # a named vector of length 1:  a
            #                              1
x[[1]]      # the bare value:              1
```

`[` **keeps the container**; `[[` **extracts the contents**. For a data frame:

```r
adsl["AGE"]    # a data frame with one column
adsl[["AGE"]]  # the column itself, as a vector
adsl$AGE       # same as [[ ]]
```

This matters when a function expects a vector and receives a one-column data frame — the error message is usually about an unexpected type several calls later.

### Copy-on-modify

```r
v  <- c(1, 2, 3)
v2 <- v
v2[1] <- 99
v[1]        # still 1
```

Assignment does not alias. R copies when a modification would otherwise be visible elsewhere. This is why R has no equivalent of SAS's `MODIFY` statement and why you build pipelines that return new objects rather than editing in place.

### Data frames and tibbles

A data frame is a list of equal-length vectors. A **tibble** is a data frame with three behaviours changed, all of which are improvements for clinical work:

| | `data.frame` | `tibble` |
|---|---|---|
| Printing | All rows — 270 lines in your console | First 10 rows plus column types |
| `df[, "AGE"]` | Returns a **vector** (drops to a lower dimension) | Returns a **tibble** |
| Partial column matching | `df$AG` matches `AGE` silently | Warns |
| Strings | Character since R 4.0 | Character |

The second row is the important one: `data.frame` silently changes what type it returns depending on how many columns you selected, which breaks functions that expected a data frame.

## Worked example

Reading ADSL and building a treatment summary, with every difference from the DATA step called out.

```r
library(dplyr)

adsl <- read.csv("data/cardio/adsl.csv")

# 1. Set the factor level order DELIBERATELY
adsl$TRT01P <- factor(adsl$TRT01P,
                      levels = c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg"))

# 2. Derive a flag — vectorised, not row-by-row
adsl$ELDERLY <- if_else(adsl$AGE >= 65, "Y", "N", missing = NA_character_)

# 3. Summarise by arm
adsl |>
  filter(ITTFL == "Y") |>
  summarise(
    n        = dplyr::n(),
    mean_age = mean(AGE, na.rm = TRUE),
    n_elderly = sum(ELDERLY == "Y", na.rm = TRUE),
    .by = TRT01P
  )
```

**Step 1 — the factor.** Without setting `levels`, the arms sort alphabetically: `Placebo`, `VTX-221 10 mg`, `VTX-221 20 mg`. Here that happens to be the order we want, which makes it *more* dangerous, not less — the code works by accident and would break if an arm were renamed.

**Step 2 — `if_else`, not `ifelse`.** The strict version type-checks both branches and preserves attributes. The `missing =` argument handles `NA` explicitly instead of letting it propagate silently.

:::number[Why `sum(ELDERLY == "Y", na.rm = TRUE)` rather than `sum(ELDERLY == "Y")`?]
Because `ELDERLY` can be `NA`, and `NA == "Y"` is `NA`, and `sum()` of anything containing `NA` is `NA`. Without `na.rm` the whole cell comes back missing.

The SAS equivalent would have counted those subjects as not elderly, silently. **Neither language is doing the wrong thing; they are doing different things**, and only one of them tells you.
:::

**Step 3 — the pipe and `.by`.** `|>` is base R's pipe: `x |> f()` is `f(x)`. The `.by` argument (dplyr 1.1+) groups for this one operation and returns an ungrouped result — unlike `group_by()`, which leaves the result grouped and surprises you two pipes later.

### The output

```text
         TRT01P  n mean_age n_elderly
1 VTX-221 20 mg 89 55.49438        18
2       Placebo 91 56.72527        19
3 VTX-221 10 mg 90 54.90000        18
```

The counts and means match the study's R-computed facts: 91 / 90 / 89 subjects, mean ages 56.7 / 54.9 / 55.5, and 19 / 18 / 18 subjects aged ≥ 65.

:::number[Why are the rows in that order? The factor levels say Placebo first.]
Because `.by` returns groups in the order they are **first encountered in the data**, not in factor-level order. `group_by()` sorts by the grouping variable; `.by` deliberately does not.

That is a real trap for table programming: your factor levels control the reference level in a model and the column order in `table()`, but they do **not** control the row order of a `.by` summary. Add an explicit `arrange(TRT01P)` whenever the order matters — which, for anything going into an output, it always does.
:::

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,TRT01P,AGE,AGEGR1,AGEGR1N,SEX,BMIBL,SBPBL,ITTFL" rows="8" caption="ADSL — the dataset used throughout this lab"}

Four things to try on this data, each demonstrating one difference:

**1. The type of every column.**

```r
str(adsl, list.len = 12)
sapply(adsl, class)
```

`SITEID` will have been read as an **integer**, losing any leading zeros. Site and subject identifiers should always be character — which is why the next lesson declares column types explicitly rather than relying on inference.

**2. What `[` returns.**

```r
class(adsl[, "AGE"])      # "integer"     — dropped to a vector
class(adsl[, c("AGE", "SEX")])  # "data.frame"  — stayed a data frame
```

The same syntax returns different types depending on how many columns you named. Tibbles fix this; base data frames do not.

**3. Missing values in a comparison.**

```r
sum(adsl$BMIBL > 30)                 # NA if any BMIBL is missing
sum(adsl$BMIBL > 30, na.rm = TRUE)   # the count you wanted
sum(is.na(adsl$BMIBL))               # how many were excluded — always check
```

The third line is the habit worth building. `na.rm = TRUE` silences the problem; counting the NAs tells you how big it was.

**4. Factor ordering in a table.**

```r
table(adsl$TRT01P)   # before setting levels: alphabetical
```

Run it before and after the `factor()` call in the worked example and watch the column order change. Then imagine that table is a CSR output.

## Code

::::tabs
:::tab[SAS]
```sas
/* The same summary, DATA step + PROC style */
data adsl2;
  set adam.adsl;
  if missing(age)   then elderly = '';
  else if age >= 65 then elderly = 'Y';
  else                   elderly = 'N';
run;

proc means data=adsl2 n mean maxdec=4;
  where ittfl = 'Y';
  class trt01p;
  var age;
run;

proc freq data=adsl2;
  where ittfl = 'Y';
  tables trt01p * elderly / nocol nopercent;
run;
```

:::lines
3: The explicit `missing()` branch is what SAS programmers learn to write and what R's `NA` propagation gives you for free. Without it, a missing age would fall into the `else` on line 6 and be counted as not elderly.
5: `age >= 65` evaluates **false** for a missing age, because a SAS missing numeric sorts below every real number.
11: `class trt01p` orders the output by the formatted value — alphabetically unless a format with an explicit order is applied. The same ordering problem as R's factor levels, in different clothes.
:::
:::

:::tab[R]
```r
library(dplyr)

adsl <- read.csv("data/cardio/adsl.csv")

adsl$TRT01P <- factor(adsl$TRT01P,
                      levels = c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg"))

adsl <- adsl |>
  mutate(ELDERLY = case_when(
    is.na(AGE) ~ NA_character_,
    AGE >= 65  ~ "Y",
    .default   = "N"
  ))

adsl |>
  filter(ITTFL == "Y") |>
  summarise(n = dplyr::n(),
            mean_age = mean(AGE, na.rm = TRUE),
            n_elderly = sum(ELDERLY == "Y", na.rm = TRUE),
            .by = TRT01P)
```

:::lines
5: Setting factor levels explicitly. Skipping this line works here by alphabetical coincidence and is the most common cause of reversed treatment columns.
9: `case_when()` is the multi-branch conditional. The `NA_character_` is required — a bare `NA` is logical and will not combine with the character branches.
12: `.default` replaced the old `TRUE ~` idiom in dplyr 1.1. Older code you inherit will use `TRUE ~ "N"`.
18: `mean(AGE, na.rm = TRUE)` — without `na.rm` a single missing age returns `NA` for the whole group, which is the opposite of SAS's default behaviour in PROC MEANS.
20: `.by` groups for this operation only and returns an ungrouped result. `group_by()` would leave the result grouped, which silently changes what later verbs do.
:::
:::

:::tab[Python]
```python
import pandas as pd

adsl = pd.read_csv("data/cardio/adsl.csv")

adsl["TRT01P"] = pd.Categorical(
    adsl.TRT01P,
    categories=["Placebo", "VTX-221 10 mg", "VTX-221 20 mg"],
    ordered=True,
)

adsl["ELDERLY"] = adsl.AGE.apply(
    lambda a: None if pd.isna(a) else ("Y" if a >= 65 else "N")
)

(adsl.query("ITTFL == 'Y'")
     .groupby("TRT01P", observed=True)
     .agg(n=("USUBJID", "count"),
          mean_age=("AGE", "mean"),
          n_elderly=("ELDERLY", lambda s: (s == "Y").sum())))
```

:::lines
5: `pd.Categorical` with explicit `categories` is pandas' equivalent of setting factor levels.
16: `observed=True` matters for categoricals — without it, `groupby` returns a row for every declared category even when no subject has it, which produces spurious empty rows in a summary.
19: pandas `.mean()` skips NaN **by default** (`skipna=True`), the opposite of R's default. Three languages, three defaults for the same decision.
:::
:::
::::

## Output

```text
# A tibble: 3 × 4
  TRT01P            n mean_age n_elderly
  <fct>         <int>    <dbl>     <int>
1 Placebo          91     56.7        19
2 VTX-221 10 mg    90     54.9        18
3 VTX-221 20 mg    89     55.5        18
```

:::number[What are the `<fct>`, `<int>` and `<dbl>` labels?]
Tibble prints the type of every column under its name. `<fct>` is a factor, `<int>` an integer, `<dbl>` a double.

This is a genuine advantage over both `data.frame` and SAS output, because **type surprises are the most common source of R bugs for a SAS programmer** — an identifier silently read as an integer, a numeric column read as character because of one text cell, a factor where you expected text. Having the types in front of you on every print catches them immediately.
:::

## Interpretation

Nothing to interpret statistically here — but there is something to interpret about the code.

The R version is longer than the SAS version, and almost all of the extra length is **explicitness that SAS supplies by default**: the factor ordering, the `na.rm`, the `NA_character_`. SAS makes those decisions for you (missing sorts low, PROC MEANS drops missing, formats control ordering); R makes you state them.

That is the trade. SAS's defaults are sensible and invisible; R's are strict and visible. Neither is better in the abstract — but for **QC work the visibility is the point**, because a reviewer can read your decisions off the code.

## Common mistakes

:::mistake[Leaving a treatment variable as a character column]
It becomes a factor in alphabetical order the moment it reaches `lm()`, `table()` or `ggplot()`, and your reference level is whatever sorts first. Set `factor(levels = ...)` explicitly, once, immediately after reading the data.
:::

:::mistake[Using `==` to test for missing]
`x == NA` returns `NA` for every element, never `TRUE`. Use `is.na(x)`. The same applies to `%in%` — `NA %in% c(1,2)` is `FALSE`, which is *usually* what you want and occasionally not.
:::

:::mistake[`as.integer()` on a factor of numbers]
Returns the internal level codes, not the values. `as.numeric(as.character(f))` is the safe idiom. The codes are plausible small integers, so the error is invisible in output.
:::

:::mistake[Forgetting `na.rm` and getting NA for a whole summary]
One missing value turns `mean()`, `sum()`, `min()` and `max()` into `NA` for the entire vector. Add `na.rm = TRUE` — and, separately, count how many were removed, because a summary over a shrinking denominator is a different statistic.
:::

:::mistake[Using `if` where `if_else` is needed]
`if (x > 5)` with a vector `x` is an error in current R. `if` is for control flow; `if_else` and `case_when` are for data. SAS's `IF` does both jobs, which is why the distinction feels arbitrary at first.
:::

## Knowledge check

::quiz{ids="r.basics.na-comparison,r.basics.factor-levels,r.basics.factor-to-number,r.basics.bracket-types"}

## Hands-on exercise

::practice{ids="r.basics.coercion,r.basics.na-count,r.basics.set-levels,r.basics.summary-code" title="Practice: types, missing values and factors"}

## Challenge exercise

::practice{ids="r.basics.silent-drop,r.basics.sas-translation,r.basics.types-open" title="Challenge: silent failures and translating a DATA step"}

## Industry note

**Where R fits in a SAS shop.** The realistic entry point is QC. Production tables are written in SAS by the production programmer; you write an independent check in R from the same specification. That arrangement is genuinely valuable — two languages with different defaults catch specification ambiguities that two SAS programs would not, because both SAS programs would inherit the same defaults.

Every cross-language discrepancy in this app's QC exercises comes from that: quantile definitions, `var.equal`, Yates' correction, missing-value handling. None of them is a bug; all of them are under-specified analyses.

**The tidyverse is a dialect, and you will meet both.** Base R (`adsl[adsl$ITTFL == "Y", ]`) and dplyr (`filter(adsl, ITTFL == "Y")`) do the same job. Most new clinical R code is tidyverse; plenty of existing code is base. Being able to read both is not optional, and code review across the two is easier if you do not treat it as a matter of taste.

:::standard{kind="convention"}
`{pharmaverse}` is the collection of open-source R packages built for clinical reporting — `admiral` for ADaM derivation, `rtables` and `tfrmt` for table generation, `pharmaversesdtm` for example data. It is community-maintained and widely used, not a standard or a requirement. The final lesson in this lab covers it in detail.
:::

**Do not translate SAS idioms literally.** A DATA step with `RETAIN` and `FIRST.`/`LAST.` translates to a `group_by()` and a window function, not to a `for` loop over rows. Writing loops in R because the DATA step looped is the most common way a SAS programmer produces R code that is both slow and hard to review. The vectorised version is usually shorter and always clearer.

:::interview[You are a SAS programmer. What is the biggest adjustment moving to R?]
The strongest answer names a *semantic* difference rather than a syntactic one, because syntax is a week's work and semantics is where the bugs live.

"Vectorisation. In SAS I describe what happens to one observation and the DATA step loops; in R I describe what happens to a whole column. That changes how you write everything — a `RETAIN` and `FIRST.` pattern becomes a grouped window function rather than a loop, and writing the loop anyway produces R that is slow and hard to review.

The one that has cost me the most time, though, is missing-value handling. SAS treats a missing numeric as smaller than every number, so `if x > 3` is false for a missing value and the record lands in the `else`. R returns `NA` and propagates it. So the same conditional puts a subject in different table cells in the two languages, and neither warns you. When a QC comparison differs by exactly the number of subjects with missing data, that is almost always the cause.

After that it is factors — the level order determines your reference level in every model, and it is alphabetical unless you set it."

If asked what you like about R, the honest answer for a QC context is that its strictness is a feature: it refuses to guess where SAS quietly decides, and in a double-programming setup that is exactly what you want from the second implementation.
:::
