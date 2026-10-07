## What problem are we trying to solve?

You are re-implementing a SAS response derivation in R. The SAP says a partial response is at least a 30% reduction in the sum of target lesion diameters. The SAS is one line:

```sas
if pchg <= -30 then resp = 'PR';
else                 resp = 'NON-PR';
```

You translate it faithfully:

```r
mutate(RESP = if_else(PCHG <= -30, "PR", "NON-PR"))
```

Every character matches. On the 1,914 post-baseline `SUMDIAM` records of CBX417-301:

| | `PR` | `NON-PR` | `NA` |
|---|---:|---:|---:|
| R | **620** | 1,280 | 14 |
| SAS | **634** | 1,280 | — |

Fourteen records, two subjects, one extra responder in each arm's numerator.

**Neither program has a bug.** In SAS a missing numeric value compares as **smaller than every number**, so `. <= -30` is *true* and those records land in the `PR` branch. In R, `NA <= -30` is `NA`, which is neither branch.

The fourteen records are the ones where `BASE` is missing — **two subjects with no baseline tumour assessment**. SAS classified them as partial responders. That is not a rounding difference; it is the analysis reaching the opposite conclusion about the two subjects the SAP most specifically wants to handle.

This lesson is the set of places where a faithful-looking translation is wrong. Not syntax — syntax you can look up. **Semantics**, where the same statement means something different.

## Intuition

A translation is wrong in one of three ways, and they need different defences.

| Kind | Example | How you find it |
|---|---|---|
| **Syntax** | `substr()` is 1-based in both, but `scan()` and `strsplit()` are nothing alike | It errors |
| **Different default** | `coxph` uses Efron ties, `PROC PHREG` uses Breslow | A small difference in many cells |
| **Different meaning** | `. <= -30` is true in SAS, `NA <= -30` is `NA` in R | A *different set of subjects* |

The first costs an hour. The second costs a QC cycle. **The third changes the answer**, and it does so without either program complaining.

:::why[Why does SAS treat a missing number as small rather than as unknown?]
Because SAS represents a missing numeric as an actual value in the floating-point space, below every representable number — and the ordering was designed to be total, so that every comparison and every sort has a definite answer.

That is a defensible design. It means `PROC SORT` never has to decide where to put a missing value, and it means `if x > 3` always takes a branch. The cost is that **"unknown" silently becomes "small"**, and a derivation written without a `missing()` branch quietly answers a question you did not ask.

R chose the opposite: `NA` propagates, because the honest answer to "is an unknown value less than −30?" is "unknown". The cost is that `NA` leaks into results and every `sum()` and `filter()` has to decide what to do with it.

**Neither is the safe one.** SAS gives a definite wrong answer; R gives a missing value that a later `filter()` will silently drop. What makes a derivation safe is writing the missing branch explicitly in either language:

```sas
if missing(pchg)      then resp = '';
else if pchg <= -30   then resp = 'PR';
else                       resp = 'NON-PR';
```

```r
RESP = case_when(is.na(PCHG) ~ NA_character_,
                 PCHG <= -30 ~ "PR",
                 .default    = "NON-PR")
```

Now both languages say the same thing, and both say it in a form a reviewer can check against the SAP.
:::

::crosswalk{id="xw-missing-comparison"}

## Clinical context

The situations where you translate for real:

| Situation | What it means |
|---|---|
| **Double programming** | Production in SAS, QC in R (or the reverse). The outputs must match to the last printed digit. |
| **Migration** | An existing SAS study or macro library being reimplemented. The old outputs are the acceptance criterion. |
| **Reading someone's SAS** | You maintain R, the specification is a legacy SAS program, and you must extract intent from code. |

**All three share one rule: the specification is the target, not the other program.** When two implementations disagree, at least one of them is answering a question the SAP did not ask. Reconciling to make the numbers match without establishing which is right is how a misreading gets ratified.

:::mistake[Translating the code instead of the specification]
The fastest way to produce a wrong QC program is to open the production program and port it line by line. You will faithfully reproduce its misreading of the SAP, the numbers will match, and the double programming will have tested nothing.

**Independent re-derivation means from the specification, by someone who has not read the other program.** When your numbers differ, that is the process working.
:::

## Formal concept

### Seven places a naive translation changes the answer

| # | SAS | R | Consequence |
|---|---|---|---|
| 1 | `. < x` is **true** | `NA < x` is `NA` | Different *subjects* in a cell |
| 2 | `PROC MEANS` drops missing per statistic | `mean()` returns `NA` | Loud in R, silent in SAS |
| 3 | `CLASS` drops missing levels | `.by` keeps an `NA` group | Different number of rows |
| 4 | `QNTLDEF=5` quartiles | `type = 7` quartiles | Q1/Q3 differ; medians never do |
| 5 | `ROUND()` half away from zero | `round()` half to even | A handful of last-digit differences |
| 6 | `PROC PHREG` ties = Breslow | `coxph` ties = Efron | Third-decimal HR difference |
| 7 | `PROC LOGISTIC` models the **lower** level | `glm` models the **second** level | The odds ratio comes out inverted |

Numbers 4, 5 and 6 are documented in the crosswalk and in the survival lesson. The rest are below.

### `PROC MEANS` and `summarise()` disagree about missing in two places

```r
adsl |> summarise(mean_norm = mean(TRTDURD), .by = TRT01P)
```

```text
               TRT01P mean_norm
1 CBX-417 + Docetaxel        NA
2 Placebo + Docetaxel        NA
```

Two subjects per arm were randomized but never treated, so `TRTDURD` is missing and the arm mean is `NA`. **`PROC MEANS` would have printed a number**, because it drops missing values from each statistic by default and reports the non-missing count in `N`.

The faithful translation carries both counts:

```r
adsl |>
  summarise(n      = sum(!is.na(TRTDURD)),   # PROC MEANS "N"
            nmiss  = sum(is.na(TRTDURD)),    # PROC MEANS "NMISS"
            mean   = mean(TRTDURD, na.rm = TRUE),
            sd     = sd(TRTDURD,  na.rm = TRUE),
            .by    = TRT01P)
```

```text
               TRT01P   n nmiss     mean       sd
1 CBX-417 + Docetaxel 208     2 220.1250 216.7833
2 Placebo + Docetaxel 208     2 166.4712 160.0869
```

**`n()` is not `N`.** `n()` counts rows — 210 per arm. `PROC MEANS`'s `N` counts non-missing values of the analysis variable — 208. If the shell says `N` and you print `n()`, the denominator is wrong for every subject with a missing value.

:::number[Which number goes in the table: 208 or 210?]
It depends on the shell, and the answer is different for different rows of the same table.

For **"Treatment duration (days), mean (SD)"** the denominator is 208 — the subjects who have a value. That is what `PROC MEANS` reports as `N` and what `sum(!is.na(x))` reproduces.

For **"Randomized, n"** it is 210, because every randomized subject counts.

**Both numbers belong in the output.** A demographics shell that shows a mean without its `N` forces the reader to assume the column header's denominator, which is wrong whenever anything is missing. Printing `N` per statistic is how `PROC MEANS` handles it and it is a good habit in R too.

The two never-treated subjects per arm are not an error — they are the gap between the ITT population (210 per arm) and the safety population (208 and 208, totalling 416 of 420 randomized).
:::

### Missing group levels: `CLASS` versus `.by`

```r
adsl |> summarise(n = n(), .by = DCSREAS)
```

```text
                DCSREAS   n
1                 DEATH 356
2                  <NA>  53
3 WITHDRAWAL BY SUBJECT   9
4     LOST TO FOLLOW-UP   2
```

`356 + 53 + 9 + 2 = 420`, the whole study. The 53 subjects still in follow-up at the cut-off have no discontinuation reason, and R gives them a group.

(That requires the blanks to have been read as `NA` in the first place — `readr::read_csv()` does that by default, base `read.csv()` needs `na.strings = c("", "NA")`. A character column full of empty strings is its own translation trap, covered in the import lesson.)

`PROC FREQ` and `PROC MEANS` **exclude** observations with a missing `CLASS` or `TABLES` variable unless you write `/ MISSING`. So the SAS version of this table has three rows totalling 367, and the percentages have a denominator of 367 rather than 420.

Base R's `table()` behaves like SAS:

```r
sum(table(adsl$DCSREAS))
#> [1] 367
```

**Three functions, three answers, from the same column.** Whichever you use, print the total and compare it with the population count. A frequency table whose rows do not sum to the population is telling you where the missing values went.

### `_N_` is not a row number

`_N_` counts **iterations of the DATA step**, which equals the output row number only when nothing subsets, merges or outputs more than once.

| DATA step contains | `_N_` on the first output row |
|---|---|
| `SET` only | 1 |
| `WHERE` (applied as the observation is read) | 1 — non-matching rows never start an iteration |
| **subsetting `IF`** (runs inside the iteration) | the position of the first row that passes |
| `MERGE … BY` | the BY-group iteration counter, which is neither input's row count |

So `_N_` in a program with a subsetting `IF` is a number about the *input*, and `row_number()` in R is a number about the *current data frame* — which is the output of everything that came before it in the pipeline.

```r
# Position in the current frame
s |> filter(PARAMCD == "SYSBP") |> mutate(rn = row_number())

# Position within subject — the FIRST./RETAIN counter idiom
s |> arrange(USUBJID, AVISITN) |> mutate(seq = row_number(), .by = USUBJID)
```

**The rule for translating `_N_`: work out what it was being used for.** A record counter within a BY group becomes `row_number()` with `.by`. A "first iteration only" guard (`if _N_ = 1 then …`) is usually setting something up once and becomes code outside the pipeline entirely. A genuine input-row identifier should not have been `_N_` in the first place — it should have been a sequence variable in the data.

### `PROC LOGISTIC` models the other direction

Given a 0/1 response, **`PROC LOGISTIC` models the probability of the lower ordered value** — that is, `P(RESP = 0)` — unless you override it with `DESCENDING` or `(EVENT = '1')`. R's `glm` models the probability of the second factor level, which for a 0/1 numeric is `P(RESP = 1)`.

On CBX417-301's confirmed overall response:

```r
cbor <- adrs |>
  filter(PARAMCD == "CBOR") |>
  mutate(RESP = as.integer(AVALC %in% c("CR", "PR")),
         TRTP = relevel(factor(TRTP), ref = "Placebo + Docetaxel"))

exp(coef(glm(RESP ~ TRTP, data = cbor, family = binomial)))[2]
#> 2.2033
```

| Modelled event | Odds ratio, CBX-417 vs placebo |
|---|---:|
| `P(response)` — R's `glm` on 0/1 | **2.2033** (95% Wald CI 1.3543 to 3.5847) |
| `P(non-response)` — `PROC LOGISTIC` default | **0.4539** |

They are exact reciprocals, and **both are above and below 1 respectively**, so the sign of the conclusion flips. The confirmed response rates are 58/210 on CBX-417 and 31/210 on placebo, so 2.20 is the number that belongs in the table.

:::mistake[Assuming the odds ratio came out the right way round]
Two independent things can invert an odds ratio: which **outcome level** is modelled, and which **treatment level** is the reference. Getting both wrong gives you the right answer for the wrong reason.

**Check the direction against a quantity you computed separately.** Here that is the response rates: 27.6% versus 14.8%, so the experimental arm must have an odds ratio above 1. A model output that contradicts a simple cross-tabulation should stop you.

```sas
proc logistic data=cbor;
  class trtp (ref='Placebo + Docetaxel') / param=ref;
  model resp(event='1') = trtp / clodds=wald;
run;
```

`event='1'` and `ref=` make both decisions explicit rather than relying on either language's sort order.
:::

## Worked example

**The response derivation from the opening, done properly in both languages**, with every decision that differs made explicit.

::::tabs
:::tab[SAS]
```sas
proc sort data=adam.adtr out=tr;
  where paramcd = 'SUMDIAM' and (ablfl ne 'Y');
  by usubjid adt;
run;

data tr_resp;
  set tr;
  by usubjid;
  length resp $6;
  if missing(pchg)      then resp = '';        /* not evaluable */
  else if pchg <= -30   then resp = 'PR';
  else                       resp = 'NON-PR';
run;

proc sql;
  create table subj_best as
  select usubjid, trtp,
         min(pchg)              as best_pchg,
         sum(resp = 'PR') > 0   as any_pr
  from   tr_resp
  group  by usubjid, trtp;
quit;
```

:::lines
2: `WHERE` rather than a subsetting `IF`, so the excluded records never start a DATA step iteration and `FIRST.`/`LAST.` stay correct — the same distinction that makes `_N_` unreliable after a subsetting `IF`. And `ablfl ne 'Y'` removes the 418 baseline records, where a percentage change from baseline is undefined by construction.
10: **The explicit `missing()` branch is the whole point.** Without it, the 14 records with a missing `PCHG` fall into `pchg <= -30`, because a SAS missing numeric compares as smaller than every number, and are classified as partial responses.
11: `'PR'` requires at least a 30% reduction, so the comparison is `<=` on a negative number. The direction is what makes the missing-value behaviour damaging here rather than merely wrong.
18: `MIN(pchg)` in PROC SQL **ignores missing values**, unlike the DATA step comparison above. SAS is not internally consistent about this, which is why the missing branch has to be written even in a program that also uses SQL.
:::
:::

:::tab[R]
```r
library(dplyr)

tr <- adtr |>
  filter(PARAMCD == "SUMDIAM", is.na(ABLFL) | ABLFL != "Y") |>
  arrange(USUBJID, ADT) |>
  mutate(RESP = case_when(
    is.na(PCHG) ~ NA_character_,     # not evaluable
    PCHG <= -30 ~ "PR",
    .default    = "NON-PR"
  ))

stopifnot(nrow(tr) == 1914)

subj_best <- tr |>
  summarise(
    best_pchg = if (any(!is.na(PCHG))) min(PCHG, na.rm = TRUE) else NA_real_,
    any_pr    = any(RESP == "PR", na.rm = TRUE),
    .by = c(USUBJID, TRTP)
  )
```

:::lines
4: `is.na(ABLFL) | ABLFL != "Y"` — in R a bare `ABLFL != "Y"` would **drop** the rows where `ABLFL` is missing, because `filter()` keeps only rows where the condition is `TRUE`. SAS's `ne` on a missing character value is true, so the two are not equivalent and the R version has to say so.
6-10: `case_when` with the missing branch first. `NA_character_`, not a bare `NA`, which is logical and would fail the type check.
12: The row-count assertion. It is how you find out that the filter above changed meaning when the data changed.
16: `min()` guarded, because `min(numeric(0))` is `Inf` — the same trap as `max()` returning `-Inf`, in the other direction.
17: `na.rm = TRUE` inside `any()`, so a subject with some evaluable records and some missing ones is judged on the evaluable ones. That is a SAP decision and it should be written down, not inherited from a default.
:::
:::

:::tab[Python]
```python
import numpy as np

tr = (adtr.query("PARAMCD == 'SUMDIAM'")
          .loc[lambda d: d.ABLFL.ne("Y") | d.ABLFL.isna()]
          .sort_values(["USUBJID", "ADT"])
          .assign(RESP=lambda d: np.where(
              d.PCHG.isna(), None,
              np.where(d.PCHG <= -30, "PR", "NON-PR"))))

assert len(tr) == 1914
```

:::lines
4: pandas' `.ne("Y")` returns `True` for NaN, so unlike dplyr's `!=` it keeps the missing rows — closer to SAS here than to R. The explicit `| d.ABLFL.isna()` is redundant in pandas and required in dplyr, which is exactly the kind of difference that makes a three-language port error-prone.
8: **`np.where(d.PCHG <= -30, ...)` alone would send NaN to the `NON-PR` branch**, because `NaN <= -30` is `False` in pandas — the opposite of SAS's outcome and different again from R's. Three languages, three destinations for the same record.
:::
:::
::::

### Output

```text
> table(tr$RESP, useNA = "ifany")

NON-PR     PR   <NA>
  1280    620     14
```

:::number[Why does the missing-value branch matter here specifically?]
Because of the **direction of the comparison**.

A partial response is a *reduction*, so the test is `PCHG <= -30` — a threshold below zero. A SAS missing value sorts below every number, therefore below −30, therefore into the `PR` branch.

| Test | Where a SAS missing lands | Effect |
|---|---|---|
| `if pchg <= -30 then 'PR'` | `PR` | **Inflates** the response rate |
| `if pchg >= 20 then 'PD'` | not `PD` | Understates progression |
| `if aval > uln then 'HIGH'` | not `HIGH` | Understates abnormalities |

The commonly-cited version of this rule — "a missing value falls into the `else` branch" — is only true for `>` and `>=`. For `<` and `<=` it falls into the **then** branch, and that is the case where the error inflates the numerator.

Here it is 14 records belonging to **2 subjects**, and they are exactly the subjects with no baseline tumour assessment. At the subject level, 112 subjects have a best percentage change of at most −30; the SAS version without the missing branch would give 114.
:::

## Data example

::dataset{id="oncology/adam/adtr" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVAL,BASE,CHG,PCHG,ABLFL" rows="8" caption="ADTR — PCHG is missing wherever BASE is"}

The discrepancy in a form you can hand to a statistician:

| Level | R (explicit missing branch) | SAS (no missing branch) | Difference |
|---|---:|---:|---:|
| Records classified `PR` | 620 | 634 | 14 |
| Subjects with best `PCHG` ≤ −30 | 112 | 114 | 2 |
| Subjects with no evaluable `PCHG` | 2 | 0 | 2 |

**Two subjects is not a rounding difference.** It is two subjects with no baseline scan being counted as responders, and the SAP has a rule for exactly those subjects — CBX417-301's ADTTE uses censoring code 2, "no baseline or adequate post-baseline assessment", for the same situation in the time-to-event analysis.

### The quartile and tie differences, briefly

Two more discrepancies that show up in every double-programmed study, both fully covered elsewhere.

**Quartiles.** SAS's default `QNTLDEF=5` and R's default `type = 7` disagree. On the VTX221-201 baseline BMI:

| | Q1 | Median | Q3 |
|---|---:|---:|---:|
| R `type = 2` (matches SAS default) | 27.60 | 30.60 | **33.60** |
| R `type = 7` (R default) | 27.60 | 30.60 | **33.55** |

The **median is identical under every definition**, which is exactly why this is discovered late: a QC comparison shows N, mean, SD, median, min and max matching and only Q3 differing, in only some cells.

::crosswalk{id="xw-quantiles"}

**Cox tie handling.** On the CBX417-301 stratified PFS model:

$$\text{Efron (R default): } \widehat{\text{HR}} = 0.6806 \qquad \text{Breslow (SAS default): } \widehat{\text{HR}} = 0.6846$$

A difference of 0.004 — invisible rounded to two decimals, enough to fail a four-decimal comparison.

::lesson{id="r-survival-package" label="Covered in full: ties, strata() and the two meanings of STRATA"}

**And `STRATA` means two different things in the two survival procedures you use in the same program.** In `PROC LIFETEST` it means "compare these groups"; in `PROC PHREG` it means "give each stratum its own baseline hazard". R has one meaning — `strata()` stratifies — and the group comparison is the right-hand side of the formula. A translation that moves the variable from one procedure to the other without changing its role produces a different hypothesis with different degrees of freedom.

::crosswalk{id="xw-rounding"}

### Reshaping, merging and by-group processing

These three have their own lessons, and the translation notes are short.

| SAS | R | The difference that matters |
|---|---|---|
| `PROC TRANSPOSE` | `pivot_wider()` | TRANSPOSE **errors** on a duplicate `ID` within a `BY` group; `pivot_wider()` silently makes list-columns |
| `MERGE … BY` | `left_join()` | MERGE requires sorted input and is silent on many-to-many; dplyr needs no sort and warns |
| `FIRST.` / `LAST.` | `slice_head()` / `slice_tail()` with `.by` | Both depend entirely on the sort; `slice_max()` returns *all* ties, which makes an inadequate tie-breaker visible |
| `PROC SORT NODUPKEY` | `distinct(.keep_all = TRUE)` | NODUPKEY dedupes on the `BY` variables; bare `distinct()` dedupes on **every** column |

:::mistake[Translating `NODUPKEY` as `distinct()`]
```r
distinct(s, USUBJID)                  # 270 rows, 1 column
distinct(s, USUBJID, .keep_all = TRUE)  # 270 rows, all 21 columns  <- NODUPKEY
distinct(s)                           # 1541 rows — nothing removed
```

`PROC SORT … BY usubjid; NODUPKEY;` keeps one whole record per subject. Bare `distinct(s)` compares every column and removes only exact duplicate rows, which in this dataset is none. The row counts look plausible in both cases, and only one of them is the translation.

Both also depend on the sort deciding which record survives, and `PROC SORT` does not guarantee that tied records keep their input order unless `EQUALS` is in force. Sort by enough keys that ties are impossible.
:::

## Output

```text
> adsl |> summarise(n = n(), .by = DCSREAS)
                DCSREAS   n
1                 DEATH 356
2                  <NA>  53
3 WITHDRAWAL BY SUBJECT   9
4     LOST TO FOLLOW-UP   2

> sum(table(adsl$DCSREAS))
[1] 367
```

:::number[Why do these two disagree by 53?]
Because `table()` drops `NA` and `summarise(.by = )` does not.

The 53 subjects are those still in follow-up at the 31 March 2025 data cut-off: they have not discontinued, so they have no discontinuation reason, and the missing value is correct.

| | Rows | Total |
|---|---|---|
| `summarise(.by = DCSREAS)` | 4, including `<NA>` | **420** |
| `table()` | 3 | 367 |
| `PROC FREQ` (no `/ MISSING`) | 3 | 367 |
| `PROC FREQ / MISSING` | 4 | 420 |

**The check is to add up the rows.** A disposition table whose reasons total 367 out of a study of 420 has hidden 53 subjects, and the percentages have the wrong denominator throughout. Whichever tool you use, print the total and reconcile it against the population.
:::

## Interpretation

> Re-implementing the CBX417-301 response derivation in R produced **112 subjects** with a best percentage change in sum of diameters of at most −30%, against **114** from the original SAS program. The two additional subjects in the SAS output have no baseline tumour assessment, so their percentage change is missing; the SAS comparison `pchg <= -30` evaluates as true for a missing numeric value and classified them as partial responders.

:::clinical
This is what a QC finding looks like when it is done well: a count, a named cause, and the mechanism.

**It is a specification finding, not a programming finding.** Both programs did exactly what their author wrote. What the SAP did not say is what happens to a subject with no baseline assessment — and RECIST 1.1 is clear that a response cannot be assessed without one, so the correct treatment is "not evaluable", which is the R behaviour here only by accident of R's missing-value semantics rather than by design.

**Two subjects out of 409 is 0.5 percentage points on the response rate.** Whether that matters depends on the endpoint's role. On an exploratory endpoint it is a footnote. On a primary endpoint supporting an accelerated approval, a response rate is the approval basis and two subjects can move a confidence interval across a pre-specified bound.

**The direction is the part to notice.** The error added responders. Errors that flatter the drug are the ones that have to be found before submission rather than after, and the fact that this one arises from a language default rather than from anyone's intention is precisely why double programming across languages catches things that double programming within one language does not.
:::

## Common mistakes

:::mistake[Translating a comparison without a missing branch]
`if pchg <= -30` is true for a SAS missing value and `NA` in R. With `>` and `>=` the missing lands in the `else` branch; with `<` and `<=` it lands in the **then** branch, which is the case that inflates a numerator. Write `missing()` / `is.na()` explicitly in both languages.
:::

:::mistake[Using `n()` where the shell says `N`]
`PROC MEANS`'s `N` is the count of non-missing values of the analysis variable; `n()` is the number of rows. They differ for every subject with a missing value — 208 versus 210 per arm here.
:::

:::mistake[Forgetting that `CLASS` and `TABLES` drop missing levels]
`PROC FREQ` and `PROC MEANS` exclude observations with a missing classification variable unless `/ MISSING` is given, and base R's `table()` does the same. dplyr's `.by` keeps them. Add up the rows and reconcile against the population.
:::

:::mistake[Treating `_N_` as a row number]
`_N_` counts DATA step iterations. A `WHERE` changes it; a subsetting `IF` does not; a `MERGE` makes it a BY-group counter. Translate what it was *used for*, not the variable.
:::

:::mistake[Letting each language pick the modelled event and the reference level]
`PROC LOGISTIC` models the lower response level by default, `glm` models the second factor level; `PROC PHREG` takes the last class level as reference, `coxph` the first. Set `event=` / `ref=` and `relevel()` explicitly, and check the direction against a cross-tabulation you computed separately.
:::

:::mistake[Reconciling to make the numbers match]
When two implementations disagree, the question is which one the SAP asked for. Changing one program until it matches the other ratifies whichever misreading was in the program you did not change.
:::

## Knowledge check

::quiz{ids="r.sas2r.missing-direction,r.sas2r.proc-means-n,r.sas2r.class-missing,r.sas2r.logistic-event"}

## Hands-on exercise

::practice{ids="r.sas2r.response-count,r.sas2r.n-underscore,r.sas2r.nodupkey,r.sas2r.derive-code" title="Practice: translating a derivation faithfully"}

## Challenge exercise

::practice{ids="r.sas2r.two-subjects,r.sas2r.qc-triage,r.sas2r.open" title="Challenge: reconciling a cross-language discrepancy"}

## Industry note

**The checklist that catches most of it.** Before comparing outputs, compare these:

1. **Populations and denominators** — do both programs count 420, 416, 411?
2. **Missing-value handling in every derivation** — every comparison against a possibly-missing value, in both directions.
3. **Missing levels in classification variables** — do the rows sum to the population?
4. **Quantile definition** — if medians match and quartiles do not, this is it.
5. **Rounding** — differences of one in the last digit, clustered in particular columns.
6. **Reference levels and modelled events** — check the direction against a cross-tabulation.
7. **Tie handling and other procedure defaults** — small differences across many cells.

Items 1 to 3 change *which subjects* are counted. Items 4 to 7 change a *value*. Diagnose which kind you have before you start reading code: a difference in counts and a difference in decimals have almost disjoint causes.

**The shape of the difference is the fastest diagnostic.** A discrepancy that lands on a clean subset — one arm, one site, everyone missing the same variable — is a specification or missing-value difference. A discrepancy scattered across many cells in the last digit is a default. A discrepancy in exactly one cell is usually a typo.

:::standard{kind="convention"}
Double programming — two independent implementations of the same specification, compared cell by cell — is **standard industry practice for primary and key secondary endpoints**, not a regulatory requirement. ICH E9 section 5.8 addresses the integrity of data and the validity of computer software and requires that analyses be verifiable; it does not prescribe double programming, a language, or a tool. Sponsors' own SOPs define which outputs get independent programming and which get a lighter review.
:::

**No regulator requires SAS, and none endorses R.** What is required is that the results are reproducible and that the process is documented. Studies have been submitted with R-based analyses; studies are submitted with SAS-based analyses every day. The choice is a sponsor decision about tooling, validation and staffing, and anyone who tells you one language is "accepted" and the other is not is describing their organisation's SOP rather than a rule.

**Where you will actually spend your time** is not the statistical procedures. It is the derivations — the same handful of patterns, done carefully: baseline selection, change from baseline, treatment-emergence, worst grade, analysis flags. The models are three lines at the end and they usually agree.

:::interview[Production is SAS, QC is R, and the outputs differ. Walk me through it.]
"First I'd classify the difference before reading either program, because the two kinds have almost disjoint causes.

**Do the counts differ, or do the values?** A different N means a different set of subjects reached the calculation — a population filter, a missing-value comparison, a classification variable with missing levels, a join that dropped or duplicated rows. A different decimal on the same N means a default: quantile definition, rounding, tie handling, a degrees-of-freedom method.

**Then I'd look at the shape of the difference.** If it lands on a clean subset — everyone at one site, everyone missing the same variable, one whole panel of parameters — that is a specification difference and it goes to the statistician. If it is scattered in the last digit across many cells, that is a default and it is usually mine or theirs to set explicitly.

**For a count difference, missing values are the first thing I check**, because that is where SAS and R genuinely disagree rather than merely defaulting differently. A SAS missing numeric compares as smaller than every number, so `if pchg <= -30` is true for a missing value; in R `NA <= -30` is `NA` and the record falls in neither branch. On the study I've worked with, that was 14 records and 2 subjects — and those two subjects had no baseline tumour assessment, so SAS classified them as partial responders. The direction matters: with `>` the missing falls in the `else` branch and understates; with `<=` it falls in the `then` branch and inflates.

**I'd also check the denominators against the disposition table**, because `PROC FREQ` and `PROC MEANS` drop observations with a missing classification variable unless you write `/ MISSING`, and dplyr's `.by` keeps them as a group. Rows that do not sum to the population are the tell.

**And I would not reconcile by changing my program until it matches theirs.** The specification is the target, not the other program. If I ported their logic to make the numbers agree, I would have reproduced their reading of the SAP and the double programming would have tested nothing. When we differ, one of us is answering a question the SAP did not ask, and working out which is the actual deliverable of QC.

Most of what I'd expect to find is specification gaps, not bugs — the SAP not saying what happens to a subject with no baseline assessment, or not naming a quartile definition. Those are findings, and they go to the study statistician."
:::
