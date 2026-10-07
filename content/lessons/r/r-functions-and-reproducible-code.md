## What problem are we trying to solve?

Your fourth copy-paste of the same derivation has a typo, so you decide to write a function:

```r
count_at_visit <- function(d, AVISITN) {
  d |> filter(AVISITN == AVISITN) |> nrow()
}

count_at_visit(advs, 12)
#> 3082
```

There are **476** Week 12 records in ADVS. The function returned **3,082** — every row in the dataset.

No error. No warning. The argument was never used.

Inside `filter()`, dplyr looks in the **data** before it looks in the function's arguments, so `AVISITN` on both sides of the `==` resolves to the column. `AVISITN == AVISITN` is `TRUE` for every row, and the 12 you passed in was quietly ignored.

Rename the argument and the function works:

```r
count_at_visit <- function(d, visit) {
  d |> filter(AVISITN == visit) |> nrow()
}

count_at_visit(advs, 12)
#> 476
```

**This is the shape of every problem in this lesson.** Writing a function is how you stop repeating yourself, and a function is also a new place for a silent wrong answer to hide — one that now affects every call site at once. The discipline that makes functions safe is the same discipline that makes an analysis reproducible: state your assumptions in code, and make the program stop when they are false.

## Intuition

Reproducibility has three levels, and people usually mean the first when the project needs the third.

| Level | Question | What it takes |
|---|---|---|
| **Rerunnable** | Do I get the same answer if I run it again? | No hand edits, no global state, a seed |
| **Portable** | Does *someone else* get the same answer? | Pinned package versions, declared inputs, a fixed working directory convention |
| **Re-derivable** | Does someone who never read my code get the same answer? | An independent implementation from the specification |

The third is the one the industry actually tests, and it is the only one that catches a *specification* misreading rather than a coding error. A program can be perfectly rerunnable and portable and still compute the wrong thing.

:::why[If the QC programmer re-derives everything anyway, why bother with functions and assertions?]
Because they find the disagreement, not the reason for it.

When two independent implementations differ on 40 subjects, someone has to work out which one is right. That reconciliation is the expensive part of QC, and the thing that makes it cheap is **code that says what it assumed**. A `stopifnot()` documenting that every safety subject should have a row per parameter turns "our numbers differ" into "your program expected 2,912 rows and mine produced 2,872, and here is the line that says why".

Functions do the same work at a different scale. Four copy-pasted derivations are four things to reconcile; one function called four times is one.

And there is a selfish reason. **You are the most frequent user of your own assertions.** Most of the time the failure is caught by the person who wrote the code, a minute after they wrote it, which is when it is cheapest to fix.
:::

## Clinical context

A production analysis directory is not a folder of scripts. The structure most sponsors converge on:

```text
study/
  data/            raw and read-only; never written to by analysis code
  adam/            derived analysis datasets
  programs/
    derive/        one program per ADaM dataset
    tlf/           one program per table, listing or figure
    macros/        shared functions, sourced not copied
  qc/              independent programs, written from the spec
  output/          generated; safe to delete and regenerate
  logs/
  renv.lock        pinned package versions
```

**Two properties matter more than the exact layout.** First, `output/` can be deleted and rebuilt from `programs/` — if anything in it was produced by hand, the study is not reproducible. Second, `qc/` is written from the specification, not from `programs/`, by someone who has not read `programs/`.

| Practice | What it buys you |
|---|---|
| Functions in `programs/macros/`, sourced | One definition, one place to fix it |
| `stopifnot()` on grain and levels | A silent wrong answer becomes an error |
| `set.seed()` **and** a recorded `RNGkind()` | The same random numbers next year |
| `renv.lock` | The same package versions on the reviewer's machine |
| `sessionInfo()` written to the log | Evidence of what actually ran |
| Independent QC programs | The only check on the specification itself |

:::standard{kind="convention"}
This directory layout is **industry convention**, not a standard. No ICH guideline or FDA guidance prescribes a folder structure. What regulatory expectations do address is that analyses be documented and traceable — for example ICH E9 section 5.8 on the need for documented, verifiable statistical analyses, and the general GxP expectation that records be attributable and reconstructable. The structure above is one common way to satisfy that; sponsors differ in the details, and following the sponsor's own SOP outranks any general advice.
:::

## Formal concept

### Argument names, and where R looks for a name

Inside a dplyr verb, names are resolved in the **data mask first**, then the calling environment. That is what makes `filter(AVISITN == 12)` work without `advs$`, and it is what broke the opening example.

Three ways to be unambiguous:

```r
# 1. Do not use column names as argument names.  (Best.)
count_at_visit <- function(d, visit) d |> filter(AVISITN == visit)

# 2. Force the environment lookup.
count_at_visit <- function(d, AVISITN) d |> filter(AVISITN == .env$AVISITN)

# 3. Pass the COLUMN as an argument — this needs embracing.
count_by <- function(d, var) d |> summarise(n = n_distinct(USUBJID), .by = {{ var }})
```

**Option 3 is a different problem.** Without the braces, `.by = var` looks for a column literally named `var`:

```r
count_by(advs, TRTP)
#> Error: object 'TRTP' not found
```

`{{ }}` ("embracing") tells dplyr to substitute the expression the caller supplied instead of evaluating it. This one at least errors; the shadowing problem does not.

**A rule that avoids most of it:** name arguments after their *role* (`visit`, `param`, `pop`), not after the column they will be compared to.

### `stopifnot()` is the cheapest tool in the language

```r
stopifnot(
  nrow(out) == length(pop_ids) * length(params),
  !any(is.infinite(out$WTOXGR)),
  all(out$WTOXGR[!is.na(out$WTOXGR)] %in% 0:4)
)
```

Three lines, three assumptions made explicit. Each one names a specific failure someone has actually shipped: a missing subject–parameter combination, an `-Inf` from an empty `max()`, and a grade outside the CTCAE 0–4 range.

**Assert the things you would check by eye if you had time**: row counts, one-row-per-key, the set of distinct values in a categorical, the absence of `NA` where none should exist.

:::mistake[`max()` on a group where everything is missing]
```r
max(c(NA, NA), na.rm = TRUE)
#> [1] -Inf
#> Warning message: no non-missing arguments to max; returning -Inf
```

`-Inf` is a number. It flows into a shift table, sorts below grade 0, and renders as `-Inf` in a cell or, worse, gets silently bucketed by a `case_when` whose lowest branch is `<= 0`.

Deriving a worst post-baseline toxicity grade on the oncology ADLB produces **406** of these, because creatinine in this study has no CTCAE grade derived — every `ATOXGR` for `PARAMCD == "CREAT"` is missing. dplyr reports it as `There were 406 warnings in summarise()` and carries on.

**The fix is to decide what "no gradeable record" means and write it down:**

```r
WTOXGR = if (any(!is.na(ATOXGR))) max(ATOXGR, na.rm = TRUE) else NA_integer_
```

Then assert `!any(is.infinite(WTOXGR))` so the decision cannot silently stop being true.
:::

### A seed is necessary and not sufficient

```r
set.seed(20250331)
```

Same seed, same answer — on the same R version. **R 3.6.0 changed the default algorithm `sample()` uses**, and the two give different results from the same seed:

| `RNGkind()` sampler | Bootstrap 95% CI for the median change |
|---|---|
| `"Rejection"` (R ≥ 3.6 default) | −15.50 to −9.70 |
| `"Rounding"` (pre-3.6 default) | −15.00 to −9.70 |

Same data, same seed, same code, 0.5 mmHg apart. **What makes a stochastic analysis reproducible is the seed plus the environment**, which is what `sessionInfo()` and `renv.lock` record. If an SAP specifies a bootstrap, it should specify the seed; the environment is the lockfile's job.

## Worked example

**Deriving the worst post-baseline toxicity grade per subject and parameter**, which feeds every laboratory shift table. This is a derivation whose naive version runs, produces plausible output, and is wrong in two independent ways.

The naive version:

```r
worst <- adlb |>
  filter(ONTRTFL == "Y") |>
  summarise(WTOXGR = max(ATOXGR, na.rm = TRUE), .by = c(USUBJID, PARAMCD))

nrow(worst)                    # 2872
sum(is.infinite(worst$WTOXGR)) # 406
```

```text
Warning message:
There were 406 warnings in `summarise()`.
The first warning was:
ℹ In argument: `WTOXGR = max(ATOXGR, na.rm = TRUE)`.
ℹ In group 4: `USUBJID = "CBX417-301-1001-0002"`, `PARAMCD = "CREAT"`.
Caused by warning in `max()`:
! no non-missing arguments to max; returning -Inf
```

**Two defects, and only one of them warns.**

The defensive version:

```r
derive_worst_grade <- function(adlb, adsl, pop = "SAFFL") {
  stopifnot(
    is.data.frame(adlb), is.data.frame(adsl),
    pop %in% names(adsl),
    all(c("USUBJID", "PARAMCD", "ATOXGR", "ONTRTFL") %in% names(adlb)),
    !any(duplicated(adsl$USUBJID))
  )

  pop_ids <- adsl$USUBJID[adsl[[pop]] == "Y"]
  params  <- sort(unique(adlb$PARAMCD))

  obs <- adlb |>
    filter(ONTRTFL == "Y", USUBJID %in% pop_ids) |>
    summarise(n_rec  = n(),
              n_grd  = sum(!is.na(ATOXGR)),
              WTOXGR = if (any(!is.na(ATOXGR))) max(ATOXGR, na.rm = TRUE)
                       else NA_integer_,
              .by = c(USUBJID, PARAMCD))

  out <- expand.grid(USUBJID = pop_ids, PARAMCD = params,
                     stringsAsFactors = FALSE) |>
    left_join(obs, by = c("USUBJID", "PARAMCD")) |>
    mutate(n_rec = coalesce(n_rec, 0L), n_grd = coalesce(n_grd, 0L))

  stopifnot(
    nrow(out) == length(pop_ids) * length(params),
    !any(is.infinite(out$WTOXGR)),
    all(out$WTOXGR[!is.na(out$WTOXGR)] %in% 0:4),
    all(is.na(out$WTOXGR) == (out$n_grd == 0))
  )
  out
}
```

**The population comes from ADSL, not from the lab data.** `pop_ids` is the 416 subjects with `SAFFL == "Y"`. A denominator taken from whoever appears in ADLB excludes anyone with no laboratory records, and every percentage in the shift table comes out too high.

**`expand.grid()` builds the full subject × parameter frame first**, then the observations are joined onto it. That turns "this combination is absent" from a missing row into a row with `n_rec = 0`, which is a fact you can count and a reviewer can see.

**The `if (any(!is.na(...)))` guard** replaces `-Inf` with `NA_integer_` — an explicit "not derivable" rather than a number that sorts below grade 0.

**`NA_integer_`, not `NA`.** A bare `NA` is logical, and mixing it with integers in a grouped summarise is exactly the type coercion that produces a column of the wrong class three steps later.

**The four assertions** each correspond to one of the ways this derivation is known to fail.

### Output

```text
> wg <- derive_worst_grade(adlb, adsl)
> nrow(wg)
[1] 2912

  PARAMCD subjects no_record record_no_grade graded
1     ALT      416        10               0    406
2     AST      416        10               0    406
3    BILI      416        10               0    406
4   CREAT      416        10             406      0
5     HGB      416         0               0    416
6    NEUT      416         0               0    416
7    PLAT      416         0               0    416

> table(wg$WTOXGR, useNA = "ifany")
   0    1    2    3    4 <NA>
1754  443  119   86   64  446
```

:::number[Where do 2,912 and 446 come from, and what did the naive version lose?]
$$416 \text{ safety subjects} \times 7 \text{ parameters} = 2{,}912 \text{ rows}$$

The 446 missing grades split into two entirely different situations:

| | Rows | What it means |
|---|---:|---|
| No on-treatment record at all | **40** | 10 subjects have no post-baseline chemistry; $10 \times 4 = 40$ |
| Records exist, none gradeable | **406** | Creatinine has no CTCAE grade derived in this study |

$40 + 406 = 446$.

**The naive version returned 2,872 rows** — it never created the 40 absent combinations, so those subjects are simply not in the output. A shift table built on it has a chemistry denominator of 406 rather than 416, which is a **2.4% overstatement of every percentage** in the chemistry section and is invisible unless someone reconciles the denominator against the disposition table.

And its 406 creatinine values were `-Inf` rather than `NA`, which is the more obvious defect and therefore the one that gets caught.

**Two bugs, opposite visibility.** The loud one costs an afternoon. The quiet one reaches the CSR.
:::

## Data example

::dataset{id="oncology/adam/adlb" cols="USUBJID,PARAMCD,AVISIT,AVAL,BASE,CHG,ATOXGR,BTOXGR,ONTRTFL" rows="8" caption="ADLB — note that ATOXGR is missing on every creatinine record"}

The sanity check that would have found both defects in one line, before any function was written:

```r
adlb |>
  filter(ONTRTFL == "Y") |>
  summarise(rows = n(), graded = sum(!is.na(ATOXGR)), .by = PARAMCD)
```

```text
  PARAMCD rows graded
1     ALT 2428   2428
2     AST 2428   2428
3    BILI 2428   2428
4   CREAT 2428      0
5     HGB 2956   2956
6    NEUT 2956   2956
7    PLAT 2956   2956
```

**Creatinine: 2,428 records, 0 graded.** Look at the data before you write the derivation, and the derivation writes itself differently.

::widget{name="trace-value" tlf="lab-chg"}

### Testing, with and without a framework

`testthat` is the standard R testing framework and what a validated package would use. A test file looks like:

```r
# tests/testthat/test-worst-grade.R
test_that("every safety subject gets a row per parameter", {
  wg <- derive_worst_grade(adlb, adsl)
  expect_equal(nrow(wg), 416 * 7)
  expect_false(any(is.infinite(wg$WTOXGR)))
  expect_true(all(wg$WTOXGR[!is.na(wg$WTOXGR)] %in% 0:4))
})

test_that("an ungradeable parameter yields NA, not -Inf", {
  creat <- subset(derive_worst_grade(adlb, adsl), PARAMCD == "CREAT")
  expect_true(all(is.na(creat$WTOXGR)))
})
```

If `testthat` is not available in your environment — and on a locked-down validated installation it often is not — the same tests in base R lose the reporting and keep all of the value:

```r
check_worst_grade <- function(adlb, adsl) {
  wg <- derive_worst_grade(adlb, adsl)
  stopifnot(
    nrow(wg) == 416 * 7,
    !any(is.infinite(wg$WTOXGR)),
    all(wg$WTOXGR[!is.na(wg$WTOXGR)] %in% 0:4),
    all(is.na(subset(wg, PARAMCD == "CREAT")$WTOXGR))
  )
  invisible(TRUE)
}
```

**The distinction that matters is not the framework.** It is whether the check runs every time the program runs, or only when someone remembers to run it. A `stopifnot()` inside the derivation function always runs.

## Code

::::tabs
:::tab[SAS]
```sas
%macro worst_grade(adlb=, adsl=, pop=saffl, out=);
  %if %length(&adlb) = 0 or %length(&out) = 0 %then %do;
    %put ERROR: ADLB= and OUT= are required.;
    %return;
  %end;

  proc sql;
    create table _grid as
    select a.usubjid, b.paramcd
    from  (select usubjid from &adsl where &pop = 'Y') a,
          (select distinct paramcd from &adlb) b;

    create table _obs as
    select usubjid, paramcd,
           count(*)                        as n_rec,
           sum(not missing(atoxgr))        as n_grd,
           max(atoxgr)                     as wtoxgr
    from   &adlb where ontrtfl = 'Y'
    group  by usubjid, paramcd;
  quit;

  data &out;
    merge _grid (in=g) _obs;
    by usubjid paramcd;
    if g;
    if missing(n_rec) then n_rec = 0;
    if missing(n_grd) then n_grd = 0;
  run;
%mend;
```

:::lines
2-5: Argument checking in a macro. SAS will happily resolve an empty macro variable into nothing and produce a syntactically valid step that does the wrong thing, so an explicit `%IF … %PUT ERROR` at the top is the macro equivalent of `stopifnot()`.
8-12: The cross join builds the full subject-by-parameter grid, the same job `expand.grid()` does in R and for the same reason: a missing combination must become a visible row rather than an absent one.
17: **`MAX()` in PROC SQL ignores missing values and returns missing when everything is missing** — it does not return `-Inf`, because SAS has no infinity. The R defect does not exist here; the SAS version has the opposite problem, in that a missing result is indistinguishable from "no record", which is why `n_rec` and `n_grd` are carried out separately.
23: `MERGE` requires both datasets sorted by the BY variables; PROC SQL output is sorted by the GROUP BY, and `_grid` by the join order, so a real program would sort both explicitly rather than rely on that.
25: `if g;` makes it a left join from the grid. Omitting it would silently turn this into a full join and add back subjects the population filter excluded.
:::
:::

:::tab[R]
```r
derive_worst_grade <- function(adlb, adsl, pop = "SAFFL") {
  stopifnot(pop %in% names(adsl), !any(duplicated(adsl$USUBJID)))

  pop_ids <- adsl$USUBJID[adsl[[pop]] == "Y"]
  params  <- sort(unique(adlb$PARAMCD))

  obs <- adlb |>
    filter(ONTRTFL == "Y", USUBJID %in% pop_ids) |>
    summarise(n_rec  = n(),
              n_grd  = sum(!is.na(ATOXGR)),
              WTOXGR = if (any(!is.na(ATOXGR))) max(ATOXGR, na.rm = TRUE)
                       else NA_integer_,
              .by = c(USUBJID, PARAMCD))

  out <- expand.grid(USUBJID = pop_ids, PARAMCD = params,
                     stringsAsFactors = FALSE) |>
    left_join(obs, by = c("USUBJID", "PARAMCD")) |>
    mutate(n_rec = coalesce(n_rec, 0L), n_grd = coalesce(n_grd, 0L))

  stopifnot(nrow(out) == length(pop_ids) * length(params),
            !any(is.infinite(out$WTOXGR)))
  out
}
```

:::lines
2: Argument checks first, before any work. `!any(duplicated(adsl$USUBJID))` is the one that stops a duplicated ADSL row from quietly doubling the grid.
4: The population comes from ADSL. Taking it from ADLB would drop subjects with no laboratory records and inflate every percentage downstream.
11-12: The guard that turns an empty `max()` into `NA_integer_` instead of `-Inf`. `NA_integer_` rather than bare `NA`, so the column keeps its type.
15: `expand.grid()` makes an absent combination into a visible row. Forty of them exist here.
18: `coalesce(n_rec, 0L)` — after the left join, an unmatched row has `NA` counts, and zero is the honest value.
20-21: The assertions restate the two failures this function exists to prevent.
:::
:::

:::tab[Python]
```python
import pandas as pd

def derive_worst_grade(adlb, adsl, pop="SAFFL"):
    assert not adsl.USUBJID.duplicated().any()

    pop_ids = adsl.loc[adsl[pop] == "Y", "USUBJID"]
    params  = sorted(adlb.PARAMCD.unique())

    obs = (adlb.query("ONTRTFL == 'Y'")
               .loc[lambda d: d.USUBJID.isin(pop_ids)]
               .groupby(["USUBJID", "PARAMCD"], as_index=False)
               .agg(n_rec=("ATOXGR", "size"),
                    n_grd=("ATOXGR", "count"),
                    WTOXGR=("ATOXGR", "max")))

    grid = pd.MultiIndex.from_product([pop_ids, params],
                                      names=["USUBJID", "PARAMCD"]).to_frame(index=False)
    out = grid.merge(obs, on=["USUBJID", "PARAMCD"], how="left", validate="one_to_one")
    out[["n_rec", "n_grd"]] = out[["n_rec", "n_grd"]].fillna(0).astype(int)

    assert len(out) == len(pop_ids) * len(params)
    return out
```

:::lines
12-13: `("ATOXGR", "size")` counts all rows; `("ATOXGR", "count")` counts non-null ones. The pair is the pandas equivalent of `n()` and `sum(!is.na(...))`, and confusing them is the pandas version of the `n()`-versus-`n_distinct()` mistake.
14: **pandas `.max()` on an all-NaN group returns `NaN`, not `-inf`** — so the R defect does not occur here either. The absent-combination defect does, which is why the grid merge is still necessary.
18: `validate="one_to_one"` is pandas' equivalent of dplyr's `relationship=` argument and raises if the merge would duplicate rows. There is no reason not to pass it.
:::
:::
::::

## Output

```text
> sessionInfo()
R version 4.6.1 (2026-06-24)
Platform: aarch64-apple-darwin23
Running under: macOS Sonoma 14.5

attached base packages:
[1] stats     graphics  grDevices utils     datasets  methods   base

other attached packages:
[1] survival_3.8-9 dplyr_1.2.1

loaded via a namespace (and not attached):
 [1] R6_2.6.1         Matrix_1.7-6     tidyselect_1.2.1 lattice_0.22-9
 [5] magrittr_2.0.5   splines_4.6.1    glue_1.8.1       tibble_3.3.1
```

:::number[Why does `sessionInfo()` list packages you never loaded?]
Because "loaded via a namespace" are the **dependencies**, and they affect your results just as much as the packages you named.

`dplyr` does its non-standard evaluation through `rlang` and its column selection through `tidyselect`. A change in either can change what your `summarise()` does without `dplyr`'s own version number moving. That is exactly the failure a lockfile prevents and a `library()` call cannot.

**This is the argument for `renv`.** `renv::init()` creates a project library and an `renv.lock` recording every package and its version; `renv::snapshot()` updates it; `renv::restore()` rebuilds the same library elsewhere. The lockfile is a text file that belongs in version control beside the programs.

`sessionInfo()` is the weaker but always-available complement: it records what *did* run, after the fact, and costs one line at the end of every program. A study that writes it into every log has evidence of its environment even without a lockfile.
:::

## Interpretation

> The worst post-baseline NCI-CTCAE grade was derived for **416 safety-population subjects across 7 laboratory parameters (2,912 subject–parameter combinations)**. A grade was derivable for 2,466; of the remaining 446, **40** had no post-baseline record for that parameter (10 subjects with no post-baseline chemistry) and **406** had records for which no CTCAE grade is defined in this study (creatinine).

:::clinical
Separating those two reasons is not pedantry — they mean different things and belong in different footnotes.

**"No post-baseline record"** is missing data. Ten subjects discontinued or were never sampled, and if they were discontinuing because they were unwell, the missingness is informative and the shift table's denominator decision matters.

**"No grade defined"** is not missing data at all. The creatinine values exist; they simply are not being graded on the CTCAE scale in this study. A shift table for creatinine would use a different classification — normal/high/low against the reference range — and reporting it as "grade missing" would misrepresent a complete dataset as an incomplete one.

A single `NA` column collapses those two into one, which is why the derivation carries `n_rec` and `n_grd` out alongside the grade. **The reader of your dataset needs to be able to tell them apart without rerunning anything.**
:::

## Common mistakes

:::mistake[Naming a function argument after a column]
Inside a dplyr verb, names resolve in the data first. `function(d, AVISITN) filter(d, AVISITN == AVISITN)` compares the column with itself and returns everything, silently. Name arguments after their role — `visit`, `param`, `pop`.
:::

:::mistake[Passing a bare column name without `{{ }}`]
`function(d, var) summarise(d, n = n(), .by = var)` looks for a column literally called `var` and errors with `object 'TRTP' not found`. Embrace it: `.by = {{ var }}`. This one at least fails loudly.
:::

:::mistake[`max()` or `min()` on a possibly all-missing group]
Returns `-Inf` or `Inf` with a warning that dplyr summarises as a count. The value is numeric, sorts below every real grade, and flows into the output. Guard it and assert `!any(is.infinite(x))`.
:::

:::mistake[Taking the population from the analysis data]
The denominator belongs to ADSL. Building it from whoever appears in ADLB drops subjects with no records and inflates every percentage — 406 instead of 416 here, a 2.4% overstatement that nothing in the output reveals.
:::

:::mistake[Treating a seed as sufficient for reproducibility]
The same seed gives different results under a different `RNGkind()`, and R changed the default sampler in 3.6.0. Record the environment — `sessionInfo()` at minimum, a lockfile properly — as well as the seed.
:::

:::mistake[Writing the QC program by reading the production program]
It will reproduce the production program's misreading of the specification. Independent re-derivation means from the spec, by someone who has not read the code.
:::

## Knowledge check

::quiz{ids="r.fun.argument-shadow,r.fun.empty-max,r.fun.seed-not-enough,r.fun.denominator-source"}

## Hands-on exercise

::practice{ids="r.fun.grid-rows,r.fun.embrace,r.fun.assertions,r.fun.worst-grade-code" title="Practice: a defensive derivation function"}

## Challenge exercise

::practice{ids="r.fun.silent-denominator,r.fun.derivation-diff,r.fun.open" title="Challenge: the derivation that lost ten subjects"}

## Industry note

**Double programming is the industry's reproducibility test, and it is a test of the specification.** For a primary endpoint, two programmers implement the same SAP section independently and the outputs are compared cell by cell. The point is not that one of them mistyped something — it is that two people reading the same specification produced different numbers, which means the specification was ambiguous. Those findings go to the study statistician, not to a programmer.

**Most QC findings are specification gaps rather than bugs.** A days-to-months divisor the SAP did not state; a quartile definition that differs between SAS and R; a tie-handling default. Nobody wrote wrong code, and the document needs a sentence.

**Assertions belong in production code, not in a separate test suite.** A check that only runs when someone remembers to run it is a check that stops running. `stopifnot()` inside the derivation function runs on every execution, including the one at 11pm before a delivery.

:::standard{kind="official"}
ICH E9 (*Statistical Principles for Clinical Trials*) section 5.8 addresses the integrity of data and computer software validity, requiring that data management and statistical procedures be documented so that analyses can be verified. It does **not** prescribe a language, a testing framework, a folder structure or a package manager. The concrete practices in this lesson are ways of satisfying that expectation, not requirements in themselves.
:::

**`renv` is the usual answer to package versions, and it is not the only one.** Some organisations use a validated central library that is frozen and versioned by IT, in which case `renv` is redundant and possibly prohibited; some use containers. What all three have in common is that the set of package versions is a **declared input to the analysis**, recorded somewhere a reviewer can read, rather than whatever happened to be installed.

**Quarto and R Markdown are for the narrative, not for the deliverable.** A `.qmd` that reads the ADaM data, runs the analysis and renders the numbers into prose is an excellent QC document, an excellent internal report and an excellent way to stop a figure drifting from the text beside it. CSR tables are usually generated as RTF or as datasets and assembled by a document system, so the rendered notebook is normally supporting evidence rather than the thing you ship.

:::interview[Your QC programmer's numbers differ from yours on 40 subjects. What do you do?]
"First, I'd resist the urge to look for my bug, because the assumption that the difference is a coding error is what makes these take three days.

I'd get the **40 subjects** and look at what they have in common. A difference that lands on a clean, structured subset — all in one arm, all at one site, all missing the same variable — is a specification difference. A difference scattered randomly across subjects is more likely to be arithmetic.

In the derivation I've been working on, 10 subjects had no post-baseline chemistry records, which makes 40 subject–parameter combinations. One implementation summarised the observed records and got 2,872 rows; the other built the full subject-by-parameter grid from ADSL first and got 2,912, with 40 rows marked as having no record. **Both programs did exactly what their author intended**, and the specification did not say which one it wanted. That is a finding against the SAP, and it goes to the statistician.

Second, I'd check the denominators against the disposition table, because that is where this kind of difference becomes visible in an output. 406 versus 416 is a 2.4% shift in every percentage in the chemistry section — small enough to survive a casual look and large enough to matter.

Third, I'd look for the small set of things where two languages or two defaults disagree with neither being wrong — quantile definitions, rounding, tie handling in a Cox model, a days-to-months divisor. Those show up as tiny differences in a lot of cells rather than large differences in a few.

And I'd want the comparison to be automated and rerun on every data refresh, not done once by eye. A cell-by-cell comparison program is a couple of hours and it runs for the life of the study."
:::
