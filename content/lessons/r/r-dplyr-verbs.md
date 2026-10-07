## What problem are we trying to solve?

You write a two-stage summary — subjects per visit, then visits per subject — and the second stage returns something you did not ask for:

```r
advs |>
  group_by(USUBJID, AVISITN) |>
  summarise(n = n()) |>
  summarise(mean_n = mean(n))     # expecting one number
```

You get one row **per subject**, not one row overall.

Nothing errored. The data is right. `summarise()` silently kept one level of grouping and the second `summarise()` operated inside it.

That is the characteristic dplyr failure: **the verbs are easy and the grouping state is invisible.** A DATA step tells you what it is doing to which rows because you wrote the `BY` statement on the line above. A dplyr pipeline carries grouping along as a hidden attribute, and a verb three steps later behaves differently because of it.

This lesson covers the six verbs you will use constantly, and — more usefully — the four places where their behaviour is not what a SAS programmer expects: grouping persistence, `filter()` dropping missing values, `mutate()` versus `summarise()`, and the type strictness of `case_when()`.

## Intuition

Every dplyr verb takes a data frame and returns a data frame. That is the whole design, and it is why they compose:

| Verb | What it changes | SAS analogue |
|---|---|---|
| `filter()` | Which **rows** | `WHERE` / subsetting `IF` |
| `select()` | Which **columns** | `KEEP` / `DROP` |
| `mutate()` | Adds or changes columns, **same row count** | assignment in a DATA step |
| `summarise()` | Collapses to **one row per group** | `PROC MEANS` with `CLASS` |
| `arrange()` | Row order | `PROC SORT` |
| `group_by()` / `.by` | Which rows count as a group | `BY` statement |

The distinction that matters most is **`mutate()` versus `summarise()`**:

- `mutate()` gives every row a value. 3,082 rows in, 3,082 rows out.
- `summarise()` collapses each group to one row. 3,082 rows in, one row per group out.

A DATA step does both jobs depending on where you put the `OUTPUT`. dplyr makes you choose, which is clearer once you internalise it and confusing on day one.

:::why[Why does `mean(x)` inside `mutate()` work at all? It returns one value for many rows.]
Because R **recycles** a length-1 value across the whole group. `mutate(m = mean(AVAL))` assigns the group's mean to every row of that group — which is exactly the `RETAIN`-plus-merge pattern you would write in SAS to put a group summary back on each record.

That is genuinely useful: computing a change from a group mean, flagging values above a subject's own average, or attaching a denominator to every row. In SAS it takes two passes; in dplyr it is one line.

The trap is that recycling only works for length 1 or for the full group length. `mutate(x = c(1, 2))` in a group of five errors — and the error message is about recycling, not about what you meant.
:::

## Clinical context

| Task | Verbs |
|---|---|
| Restrict to an analysis population | `filter(ITTFL == "Y")` |
| Restrict to one parameter and visit | `filter(PARAMCD == "SYSBP", AVISITN == 12)` |
| Derive a flag or category | `mutate(case_when(...))` |
| Count subjects per arm for a table header | `summarise(n = n_distinct(USUBJID), .by = TRT01P)` |
| Attach a subject-level value to every record | `mutate(base = AVAL[ABLFL == "Y"], .by = USUBJID)` |
| Select the analysis record per subject | `slice_max()` / `filter(row_number() == 1)` |

**The single most important habit:** know the grain of your data at every step. Before any `summarise()`, you should be able to say what one row represents, and after it, what one row represents now.

:::mistake[Counting records where you meant subjects]
`n()` counts **rows**. In a BDS dataset with four visits per subject, `n()` gives four times the subject count.

```r
advs |> summarise(n = n(), .by = TRT01P)             # records
advs |> summarise(n = n_distinct(USUBJID), .by = TRT01P)  # subjects
```

In an adverse-event table this is the difference between an event count and a subject count — and a percentage above 100% is the symptom when you get it wrong. The subtler version is a percentage that is merely too high.
:::

## Formal concept

### `filter()` drops missing values

```r
d <- data.frame(x = c(1, NA, 5))

filter(d, x > 3)        # 1 row  — the NA row is DROPPED
ifelse(d$x > 3, "Y", "N")  # "N" NA "Y"  — the NA is KEPT as NA
```

`filter()` keeps only rows where the condition is `TRUE`. `NA` is not `TRUE`, so those rows disappear.

:::why[Is that the same as SAS?]
No, and the difference compounds. In SAS, `where x > 3` is **false** for a missing `x` (missing sorts below every number), so the row is also excluded — the same outcome, for a different reason.

But `if x > 3 then flag = 'Y'; else flag = 'N';` in SAS assigns `'N'`, keeping the row with a definite value. R's `ifelse` assigns `NA`, keeping the row with an unknown value. So:

| | Row kept? | Value assigned |
|---|---|---|
| SAS `where` | No | — |
| dplyr `filter` | No | — |
| SAS `if/else` | Yes | `'N'` |
| R `ifelse` | Yes | `NA` |

The filters agree; the derivations do not. That is why a count discrepancy between a SAS and an R program is so often exactly the number of subjects with a missing value in the derivation variable.

**To keep missing rows explicitly:** `filter(x > 3 | is.na(x))`.
:::

### Grouping persists — sometimes

This is the behaviour that produces the opening example:

```r
advs |> group_by(USUBJID) |> summarise(n = n())
# result is UNGROUPED — one grouping variable, all consumed

advs |> group_by(USUBJID, AVISITN) |> summarise(n = n())
# result is STILL GROUPED by USUBJID — and warns about it
```

**`summarise()` removes the last grouping variable only.** With one grouping variable the result is ungrouped; with two it stays grouped by the first. dplyr warns, and the warning is easy to lose in a long script.

:::number[What actually happens in the opening example?]
`group_by(USUBJID, AVISITN) |> summarise(n = n())` returns one row per subject per visit, **still grouped by `USUBJID`**. The second `summarise(mean_n = mean(n))` then operates within each subject, giving one row per subject rather than one row overall.

Three ways to avoid it:

```r
# 1. Drop grouping explicitly
group_by(USUBJID, AVISITN) |> summarise(n = n(), .groups = "drop")

# 2. Ungroup as a separate step
group_by(USUBJID, AVISITN) |> summarise(n = n()) |> ungroup()

# 3. Use .by, which never leaves the result grouped
summarise(n = n(), .by = c(USUBJID, AVISITN))
```

**`.by` (dplyr 1.1+) is the best default** for exactly this reason: it groups for one operation and returns an ungrouped result, so grouping cannot leak into a later verb. `group_by()` remains useful when several consecutive verbs share the same grouping.
:::

### `case_when()` is first-match and type-strict

```r
case_when(
  AGE < 18  ~ "child",
  AGE < 65  ~ "adult",
  .default  = "elderly"
)
```

**Order matters — the first matching condition wins.** Writing the broadest condition first makes every later branch unreachable:

```r
v <- c(5, 15, 25)
case_when(v < 20 ~ "low", v < 10 ~ "verylow", .default = "high")
#> "low"  "low"  "high"     <- "verylow" is never reached
```

No error, no warning: a category that silently never appears. The SAS equivalent — a chain of `else if` in the wrong order — has exactly the same behaviour, which at least makes the habit transferable.

**Type strictness** is the other half. Every right-hand side must be the same type:

```r
case_when(AGE < 65 ~ "N", .default = NA)              # ERROR
case_when(AGE < 65 ~ "N", .default = NA_character_)   # correct
```

A bare `NA` is logical. Older dplyr coerced silently; current dplyr errors — which is better, because the silent version produced a column of the wrong type that failed somewhere else.

### `across()` — one operation over many columns

```r
adsl |>
  summarise(across(c(AGE, BMIBL, SBPBL), ~ mean(.x, na.rm = TRUE)),
            .by = TRT01P)
```

`.x` is the placeholder for each column in turn; `~` introduces an anonymous function. This replaces the SAS idiom of listing several variables on a `VAR` statement, and it takes selection helpers (`starts_with("SBP")`, `where(is.numeric)`) so you can express "every numeric column" without enumerating.

## Worked example

Building a Week 12 analysis dataset from ADVS, with every decision visible.

```r
library(dplyr)

w12 <- advs |>
  # 1. Restrict to the analysis records
  filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12) |>

  # 2. Assert the grain BEFORE summarising anything
  (\(d) { stopifnot(nrow(d) == n_distinct(d$USUBJID)); d })() |>

  # 3. Derive a responder flag
  mutate(RESP = case_when(
    is.na(AVAL) ~ NA_character_,
    AVAL < 140  ~ "Y",
    .default    = "N"
  )) |>

  # 4. Summarise by arm
  summarise(
    n          = n(),
    mean_chg   = mean(CHG, na.rm = TRUE),
    sd_chg     = sd(CHG, na.rm = TRUE),
    n_resp     = sum(RESP == "Y", na.rm = TRUE),
    pct_resp   = 100 * sum(RESP == "Y", na.rm = TRUE) / n(),
    .by = TRTP
  ) |>
  arrange(TRTP)
```

**Step 1 — the filter is the population definition.** Three conditions, each doing different work: the parameter, the analysis flag (which the SAP defines), and the visit. Written as separate arguments to one `filter()`, they are combined with AND.

**Step 2 — assert the grain.** After filtering to one visit and one parameter there should be exactly one row per subject. The awkward lambda syntax is the price of asserting mid-pipeline; many people break the pipe instead, which is fine and arguably clearer.

:::number[Why assert here rather than trusting the filter?]
Because an unscheduled assessment windowed into Week 12, or a repeat measurement, would produce two rows for a subject — and every count downstream would be inflated by one, with nothing looking wrong.

`ANL01FL` exists precisely to prevent this: it marks the single record the analysis uses. But the flag is derived by someone, and asserting is how you find out when the derivation is wrong. **One line, and it converts a silent inflation into an immediate failure.**
:::

**Step 3 — the three-branch `case_when`.** The explicit `is.na()` branch states what happens to a missing value rather than letting it fall through. The `NA_character_` is required by the type check.

**Step 4 — `n()` is correct here** because step 2 proved one row per subject. Without that proof, `n_distinct(USUBJID)` would be the safe choice.

### Output

```text
           TRTP  n  mean_chg   sd_chg n_resp pct_resp
1       Placebo 77  -3.300000 11.60998     20 25.97403
2 VTX-221 10 mg 81  -8.828395 11.48418     37 45.67901
3 VTX-221 20 mg 80 -12.276250 11.49666     43 53.75000
```

These match the study's R-computed facts: 77 / 81 / 80 subjects, mean changes −3.30 / −8.83 / −12.28, and controlled-BP rates of 26.0% / 45.7% / 53.8%.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVISITN,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — one row per subject, parameter and visit"}

**The grain, demonstrated.** ADVS has 3,082 rows from 270 subjects:

```r
advs |> summarise(rows = n(), subjects = n_distinct(USUBJID))
#>   rows subjects
#> 1 3082      270
```

**Visits per subject vary.** Not everyone has the same number of records:

```r
advs |>
  filter(PARAMCD == "SYSBP") |>
  mutate(n_visits = n(), .by = USUBJID) |>
  distinct(USUBJID, n_visits) |>
  count(n_visits)
```

Subjects have between **2 and 7** systolic records. That range is itself informative — subjects who discontinued early have fewer, and subjects with unscheduled visits have more.

:::number[Why does `mutate(n_visits = n(), .by = USUBJID)` work when `n()` returns one value?]
Because the single value is recycled across every row of that subject's group. Each of a subject's rows gets the same `n_visits`.

Then `distinct(USUBJID, n_visits)` collapses to one row per subject — using `distinct()` rather than `summarise()` because the value is already constant within subject and there is nothing to aggregate.

The `summarise()` version is equally correct:

```r
advs |> filter(PARAMCD == "SYSBP") |> summarise(n_visits = n(), .by = USUBJID)
```

Use `mutate()` when you need the value attached to every row for a later comparison; `summarise()` when you want one row per group.
:::

## Code

::::tabs
:::tab[SAS]
```sas
/* Restrict, derive, summarise */
data w12;
  set adam.advs;
  where paramcd = 'SYSBP' and anl01fl = 'Y' and avisitn = 12;
  if missing(aval)   then resp = '';
  else if aval < 140 then resp = 'Y';
  else                    resp = 'N';
run;

proc means data=w12 n mean std maxdec=5;
  class trtp;
  var chg;
run;

proc freq data=w12;
  tables trtp * resp / nocol nopercent;
run;
```

:::lines
4: `WHERE` rather than a subsetting `IF`. In a plain DATA step they behave the same, but `WHERE` is applied as the observation is read, which matters the moment a `BY` statement is present — a subsetting `IF` runs *after* `FIRST.`/`LAST.` are computed and silently corrupts them.
5: The explicit missing branch. Without it a missing `AVAL` gets `'N'` on line 7, because `aval < 140` is *true* for a SAS missing value — missing sorts below every number, so it is below 140. **That is the opposite direction from the elderly example**, where the comparison was `>=`, and it is why the explicit branch is not optional.
10: `PROC MEANS` with `CLASS` is the summarise step. It drops missing values from each statistic by default, which is what R needs `na.rm = TRUE` for.
:::
:::

:::tab[R]
```r
library(dplyr)

w12 <- advs |>
  filter(PARAMCD == "SYSBP", ANL01FL == "Y", AVISITN == 12) |>
  mutate(RESP = case_when(
    is.na(AVAL) ~ NA_character_,
    AVAL < 140  ~ "Y",
    .default    = "N"
  ))

stopifnot(nrow(w12) == n_distinct(w12$USUBJID))

w12 |>
  summarise(n        = n(),
            mean_chg = mean(CHG, na.rm = TRUE),
            sd_chg   = sd(CHG, na.rm = TRUE),
            n_resp   = sum(RESP == "Y", na.rm = TRUE),
            .by      = TRTP) |>
  arrange(TRTP)
```

:::lines
4: Multiple conditions in one `filter()` are combined with AND. Writing them as separate arguments rather than with `&` makes each condition individually readable and individually removable.
5: `case_when` evaluates top to bottom and the first match wins. Putting `AVAL < 140` before the `is.na()` branch would still give `NA` for missing values here — because `NA < 140` is `NA`, not `TRUE` — but relying on that is fragile. State the missing case.
11: The assertion belongs in the script. It is the only thing standing between an unexpected duplicate record and a silently inflated count.
19: `.by` returns an ungrouped result, so nothing leaks into `arrange()` or anything after it. `arrange(TRTP)` sorts by factor level if `TRTP` is a factor, alphabetically if it is character. `.by` does not sort, so this line is what fixes the row order.
:::
:::

:::tab[Python]
```python
w12 = advs.query("PARAMCD == 'SYSBP' and ANL01FL == 'Y' and AVISITN == 12").copy()

w12["RESP"] = w12.AVAL.apply(
    lambda a: None if pd.isna(a) else ("Y" if a < 140 else "N")
)

assert len(w12) == w12.USUBJID.nunique()

(w12.groupby("TRTP", observed=True)
    .agg(n=("USUBJID", "count"),
         mean_chg=("CHG", "mean"),
         sd_chg=("CHG", "std"),
         n_resp=("RESP", lambda s: (s == "Y").sum()))
    .reset_index())
```

:::lines
1: `.copy()` after `query()` avoids the `SettingWithCopyWarning` when you assign a new column — pandas cannot always tell whether the result is a view or a copy.
12: `.std()` in pandas uses `ddof=1` by default, matching R's `sd()`. NumPy's `np.std()` uses `ddof=0`, so the two disagree.
13: pandas `.mean()` skips NaN by default, which is the opposite of R needing `na.rm = TRUE` and the same as SAS's PROC MEANS.
:::
:::
::::

## Output

```text
# A tibble: 3 × 5
  TRTP              n mean_chg sd_chg n_resp
  <chr>         <int>    <dbl>  <dbl>  <int>
1 Placebo          77    -3.30   11.6     20
2 VTX-221 10 mg    81    -8.83   11.5     37
3 VTX-221 20 mg    80   -12.3    11.5     43
```

:::number[Why does the 20 mg mean print as −12.3 rather than −12.28?]
Tibble prints with **significant figures**, not fixed decimals — three by default. −12.27625 has three significant figures as −12.3, while −3.30 needs the same three to show two decimals.

This is a display convention, not a loss of precision: the stored value is unchanged, and `print(n = Inf, width = Inf)` or `as.data.frame()` shows more. But it means **you cannot read a tibble print as a table** — rounding for output is a deliberate step at the end of a pipeline, not something to eyeball from the console.
:::

## Interpretation

Not a statistical result, but the pipeline says something worth reading.

**The responder rates rise monotonically with dose** — 26.0%, 45.7%, 53.8% — as do the mean reductions. Two different summaries of the same data pointing the same way is a reassuring pattern, and a divergence between them would be worth investigating rather than reporting.

**The denominators are 77, 81 and 80**, not the 91/90/89 randomized. That gap is the 32 subjects without a Week 12 record, and whether the table should use the smaller or larger denominator is a SAP decision about missing data — not something a `filter()` should settle silently.

## Common mistakes

:::mistake[Letting grouping leak out of `summarise()`]
`summarise()` drops only the last grouping variable. With two, the result stays grouped and the next verb behaves unexpectedly. Use `.by`, or `.groups = "drop"`, or an explicit `ungroup()`.
:::

:::mistake[Using `n()` when you mean subjects]
`n()` counts rows. In BDS data that is records, not subjects. Use `n_distinct(USUBJID)` unless you have asserted that the grain is one row per subject.
:::

:::mistake[Ordering `case_when` branches carelessly]
First match wins, so a broad condition placed early makes later branches unreachable — silently. Write the most specific conditions first, and handle `is.na()` explicitly rather than relying on how `NA` behaves in the comparison.
:::

:::mistake[Assuming `filter()` keeps missing rows]
It keeps only rows where the condition is `TRUE`. `NA` rows disappear. To keep them: `filter(x > 3 | is.na(x))`. This is the most common cause of a quietly shrinking denominator.
:::

:::mistake[Reading a tibble print as a table]
Tibble prints three significant figures and truncates to ten rows. Rounding for output is a deliberate final step; what you see in the console is a preview, not a result.
:::

## Knowledge check

::quiz{ids="r.dplyr.grouping-leak,r.dplyr.filter-na,r.dplyr.mutate-vs-summarise,r.dplyr.case-when-order"}

## Hands-on exercise

::practice{ids="r.dplyr.count-subjects,r.dplyr.derive-flag,r.dplyr.assert-grain,r.dplyr.pipeline-code" title="Practice: filtering, deriving and summarising"}

## Challenge exercise

::practice{ids="r.dplyr.silent-regroup,r.dplyr.sas-where-if,r.dplyr.open" title="Challenge: grouping state and translating a DATA step"}

## Industry note

**Write pipelines a reviewer can read without running.** The habits that matter in clinical code are the ones that make intent visible: each `filter()` condition on its own line so a reviewer can check it against the SAP; `.by` rather than `group_by()` so grouping state is local; assertions after any step whose grain you rely on.

Clever one-liners are the wrong optimisation. Your code will be read by a QC programmer who is comparing it against a specification, not against your SAS program.

**`.by` is recent and worth adopting deliberately.** It arrived in dplyr 1.1 (2023). Older code — including much of what you will inherit — uses `group_by()` and `ungroup()`. Both are correct; mixing them within one file for no reason is what makes a review tedious. Pick one per program and say which in the header.

:::standard{kind="convention"}
`{admiral}` is the pharmaverse package for ADaM derivations in R, providing functions such as `derive_vars_merged()` and `derive_var_base()` that implement common CDISC patterns on top of dplyr. It is widely used and community-maintained — a convention rather than a standard, and no regulator requires or endorses any particular package.
:::

**Performance is rarely your problem, and when it is, it is the join.** A 3,000-row clinical dataset is small; dplyr will not be the bottleneck. If a pipeline is slow, it is almost always an accidental many-to-many join multiplying rows, and the fix is to assert the grain rather than to reach for `data.table`.

:::interview[When would you use `group_by()` instead of `.by`?]
The answer that shows real usage rather than a memorised rule:

"`.by` for a single operation — it groups for that verb and returns an ungrouped result, so grouping cannot leak into a later step. That is my default, because a leaked grouping is a silent failure rather than an error.

`group_by()` when several consecutive verbs share the same grouping and repeating `.by` on each would be noise — a `mutate`, then a `filter`, then a `summarise`, all by subject. Then I'd `ungroup()` explicitly at the end rather than relying on `summarise()` to do it, because `summarise()` only drops the *last* grouping variable and that is exactly the behaviour that surprises people.

The related thing worth knowing is that `summarise()` warns when it leaves a result grouped, and that warning is easy to lose in a long script — which is the practical argument for `.by` being the default."

If they follow up on why it matters, the concrete example is a two-stage summary: grouping by subject and visit, summarising, then summarising again expecting one row and getting one row per subject.
:::
