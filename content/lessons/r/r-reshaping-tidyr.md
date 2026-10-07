## What problem are we trying to solve?

Clinical analysis data is **long**. BDS gives you one row per subject, per parameter, per visit — which is the right structure for modelling and the wrong structure for most listings and shift tables.

So you reshape:

```r
w12 |>
  select(USUBJID, PARAMCD, AVAL) |>
  pivot_wider(names_from = PARAMCD, values_from = AVAL)
```

And sometimes you get this:

```text
# A tibble: 2 × 3
     id A         B
  <dbl> <list>    <list>
1     1 <dbl [2]> <NULL>
2     2 <NULL>    <dbl [1]>
```

**`<list>` columns.** Not numbers — lists of numbers. Every function downstream fails with a message about an unexpected type, several steps away from the reshape that caused it.

No error. No warning about what actually went wrong. The cause is one subject having **two rows** where the reshape expected one, and `pivot_wider()` decided the honest thing to do was keep both.

This lesson is about that: the two reshape directions, and — more usefully — the fact that **the three languages handle the ambiguous case in three completely different ways**, from erroring loudly to silently averaging your data.

## Intuition

Reshaping moves information between **rows** and **columns**.

**Long → wide** takes a column of labels and turns each distinct label into its own column:

```text
LONG                          WIDE
id  param  value              id  SYSBP  DIABP
1   SYSBP  142          →     1   142    88
1   DIABP  88                 2   151    94
2   SYSBP  151
2   DIABP  94
```

**Wide → long** does the reverse.

The operation only makes sense if, for each combination of the columns you are keeping, each label appears **exactly once**. Two `SYSBP` rows for subject 1 and the reshape has no single value to put in the cell.

:::why[What should a reshape do when it finds two values for one cell?]
There are only three honest options, and each language picked a different one:

**Refuse.** SAS `PROC TRANSPOSE` errors: `The ID value "SYSBP" occurs twice in the same BY group`. Loud, unmissable, and you fix the data.

**Keep both.** tidyr's `pivot_wider()` puts a list of both values in the cell. Technically lossless, silent, and breaks everything downstream in a confusing way.

**Combine them.** pandas' `pivot_table()` averages them, because `aggfunc="mean"` is its default.

The third is the dangerous one. Two blood-pressure readings become their average, no warning is issued, and the output looks entirely normal. **You cannot tell from the result that it happened.**
:::

In clinical data a duplicate at this point always means something real: an unscheduled visit windowed into a scheduled one, a repeated measurement, or a merge that went wrong upstream. **The reshape should never be the thing that resolves it.**

## Clinical context

| Task | Direction |
|---|---|
| Listing with one column per parameter | long → wide |
| Shift table (baseline category × post-baseline category) | long → wide |
| Correlation matrix across parameters | long → wide |
| Lab data arriving one column per test | wide → long, to make it BDS |
| Preparing data for MMRM or any model | usually stays **long** |
| A figure with one line per parameter | stays long — ggplot2 wants long data |

**Analysis stays long; presentation goes wide.** That is the general rule, and it is why BDS is specified the way it is — one row per measurement makes modelling and plotting natural, and the widening happens at the very end, in the table program.

:::mistake[Reshaping before checking the grain]
If an earlier merge duplicated records, a `pivot_wider()` will either produce list columns (tidyr), average them (pandas) or error (SAS). Only one of those tells you the truth.

**Check first, always:**

```r
d |> count(USUBJID, PARAMCD) |> filter(n > 1)
```

Zero rows means the reshape is unambiguous. Anything else is a question to answer before reshaping, not after.
:::

## Formal concept

### `pivot_wider()`

```r
pivot_wider(
  data,
  id_cols     = ,   # columns identifying a row (default: everything else)
  names_from  = ,   # column whose VALUES become new column names
  values_from = ,   # column whose values fill the cells
  values_fn   = ,   # how to combine duplicates (default: keep both in a list)
  names_prefix = 
)
```

**`id_cols` defaults to "every column not named in `names_from` or `values_from`"**, and that default is the source of most surprises. If your data carries `AVISIT` and `ADT` and `ANL01FL` alongside the columns you care about, every one of them becomes part of the row identity, and rows you expected to combine stay separate.

The fix is to `select()` down to what you need before pivoting, or to name `id_cols` explicitly.

### `pivot_longer()`

```r
pivot_longer(
  data,
  cols      = ,   # which columns to stack
  names_to  = ,   # new column holding the old column names
  values_to =     # new column holding the values
)
```

`cols` uses tidyselect, so `-USUBJID`, `starts_with("VIS")` and `where(is.numeric)` all work.

:::number[Why does the wide form have 238 rows when the long form had 476?]
Because each subject contributed **two** rows to the long form — one `SYSBP`, one `DIABP` — and they collapse into one row with two columns.

$$476 \text{ rows} \div 2 \text{ parameters} = 238 \text{ subjects}$$

That division is the check worth doing before you reshape: **long rows ÷ distinct labels should equal the expected wide row count**, and if it does not, some subject has a different number of parameters than the rest — which is exactly the duplicate case.
:::

### The duplicate case, concretely

```r
dup <- data.frame(id = c(1, 1, 2), p = c("A", "A", "B"), v = c(10, 20, 30))
pivot_wider(dup, names_from = p, values_from = v)
```

```text
# A tibble: 2 × 3
     id A         B
  <dbl> <list>    <list>
1     1 <dbl [2]> <NULL>
2     2 <NULL>    <dbl [1]>
```

Subject 1 has two `A` values, so cell `A` holds a length-2 list. And because *any* list column forces the whole column to be a list, subject 2's single value is wrapped too — even though it was never ambiguous.

**The diagnostic:** pass `values_fn = length` to count rather than combine.

```r
pivot_wider(dup, names_from = p, values_from = v, values_fn = length)
```

```text
     id     A     B
  <dbl> <int> <int>
1     1     2    NA
2     2    NA     1
```

Now the problem is visible: subject 1 has 2 values for A. That one line turns a confusing downstream type error into an immediate answer.

:::why[Why is `values_fn = mean` usually the wrong fix?]
Because it resolves the ambiguity by inventing a value, and it hides the fact that there was ever a question.

Sometimes averaging is genuinely correct — triplicate ECG readings at one timepoint are *designed* to be averaged, and the SAP will say so. But then the averaging belongs in the **derivation**, where it is documented and where `DTYPE` records that it happened, not as an argument to a presentation-layer reshape.

If you find yourself reaching for `values_fn` to make an error go away, the duplicate is telling you something about the data and you have just stopped listening.
:::

## Worked example

Building a wide listing of Week 12 blood pressure, with the check first.

```r
library(dplyr); library(tidyr)

long <- advs |>
  filter(AVISITN == 12) |>
  select(USUBJID, PARAMCD, AVAL)

# 1. CHECK before reshaping
dups <- long |> count(USUBJID, PARAMCD) |> filter(n > 1)
stopifnot(nrow(dups) == 0)

# 2. Now it is safe
wide <- long |>
  pivot_wider(names_from = PARAMCD, values_from = AVAL)
```

**Step 1 — the check is three lines and prevents the whole class of problem.** It costs nothing and it converts a downstream type error into a statement about the data.

**Step 2 — the `select()` matters.** Without it, `id_cols` would default to every remaining column — `TRTP`, `AVISIT`, `ADT`, `BASE`, `CHG`, `ANL01FL` — and each would become part of the row identity. Since `BASE` and `CHG` differ between `SYSBP` and `DIABP` rows, the two parameters would never combine into one row and you would get 476 rows with half the cells empty.

### Output

```text
> nrow(long); nrow(wide); names(wide)
[1] 476
[1] 238
[1] "USUBJID" "SYSBP"   "DIABP"
```

476 long rows from 238 subjects × 2 parameters, collapsing to 238 wide rows. The arithmetic checks out, which is itself confirmation that no subject had a duplicate.

**Round-tripping back:**

```r
back <- wide |>
  pivot_longer(cols = -USUBJID, names_to = "PARAMCD", values_to = "AVAL")

nrow(back)   # 476 — exactly the original
```

A clean round trip is a useful sanity check when you are unsure whether a reshape lost anything.

## Data example

::dataset{id="cardio/adam/advs" cols="USUBJID,TRTP,PARAMCD,AVISIT,AVISITN,AVAL,BASE,CHG,ANL01FL" rows="8" caption="ADVS — long format, one row per subject per parameter per visit"}

**A shift table** is the clinical case where reshaping is genuinely necessary. It cross-tabulates each subject's baseline category against their post-baseline category:

```r
shift <- advs |>
  filter(PARAMCD == "SYSBP", AVISITN %in% c(0, 12)) |>
  mutate(CAT = if_else(AVAL < 140, "Normal", "High")) |>
  select(USUBJID, TRTP, AVISITN, CAT) |>
  pivot_wider(names_from = AVISITN, values_from = CAT,
              names_prefix = "V") |>
  count(TRTP, V0, V12)
```

The `pivot_wider()` is what puts baseline and Week 12 side by side so they can be cross-tabulated. In long form each subject's two categories are on different rows and cannot be compared without a self-join.

:::number[Why `names_prefix = "V"`?]
Because `AVISITN` holds **numbers**, and a column named `0` or `12` is legal in R but awkward: you must write `` `12` `` with backticks everywhere, and some functions mangle it.

`names_prefix` produces `V0` and `V12` instead — syntactic names that behave normally. The same problem appears whenever you pivot on a numeric column, and it is worth handling at the reshape rather than renaming afterwards.
:::

**What happens without the `select()`:**

```r
advs |>
  filter(AVISITN == 12) |>
  pivot_wider(names_from = PARAMCD, values_from = AVAL)
```

This returns **476 rows**, not 238 — because `BASE`, `CHG`, `ADT` and the rest all became part of the row identity, and those differ between the `SYSBP` and `DIABP` rows for the same subject. The two parameters never meet.

The output looks like a successful reshape. It has the right columns. It is simply twice as tall as it should be, with half of every column missing.

## Code

::::tabs
:::tab[SAS]
```sas
/* Long to wide */
proc sort data=advs out=long;
  where avisitn = 12;
  by usubjid paramcd;
run;

proc transpose data=long out=wide (drop=_name_);
  by usubjid;
  id paramcd;          /* values become column names */
  var aval;
run;

/* Wide to long */
proc transpose data=wide out=long2 (rename=(_name_=paramcd col1=aval));
  by usubjid;
  var sysbp diabp;
run;
```

:::lines
8: `BY usubjid` defines what stays as a row; `ID paramcd` supplies the new column names; `VAR aval` the values. The three statements map exactly onto `id_cols`, `names_from` and `values_from`.
9: **The `ID` value must be unique within each `BY` group.** If it is not, PROC TRANSPOSE writes `ERROR: The ID value "SYSBP" occurs twice in the same BY group` and stops. That error is a feature — it is the loudest of the three languages' responses to the ambiguous case.
7: `_NAME_` holds the name of the transposed variable and is almost always dropped on the way out.
14: Going back, `_NAME_` becomes the parameter column and `COL1` the value — SAS's default naming, which is why the `RENAME=` is nearly always present.
:::
:::

:::tab[R]
```r
library(tidyr); library(dplyr)

long <- advs |>
  filter(AVISITN == 12) |>
  select(USUBJID, PARAMCD, AVAL)

# Check before reshaping
stopifnot(nrow(count(long, USUBJID, PARAMCD) |> filter(n > 1)) == 0)

wide <- long |>
  pivot_wider(names_from = PARAMCD, values_from = AVAL)

back <- wide |>
  pivot_longer(cols = -USUBJID, names_to = "PARAMCD", values_to = "AVAL")
```

:::lines
5: `select()` down to the columns that matter. Without it, `id_cols` silently includes every other column and rows that should combine stay separate.
8: The duplicate check. Three seconds to write, and it prevents list columns entirely.
11: `pivot_wider()` **does not error on duplicates** — it produces list columns. Use `values_fn = length` to diagnose, never `values_fn = mean` to paper over.
14: `cols = -USUBJID` means "everything except USUBJID". tidyselect helpers work here: `starts_with("V")`, `where(is.numeric)`.
:::
:::

:::tab[Python]
```python
# pivot_table SILENTLY AVERAGES duplicates — aggfunc defaults to "mean"
wide = long.pivot_table(index="USUBJID", columns="PARAMCD", values="AVAL")

# pivot() RAISES on duplicates — safer when you expect none
wide = long.pivot(index="USUBJID", columns="PARAMCD", values="AVAL")

# Back to long
back = wide.reset_index().melt(
    id_vars="USUBJID", var_name="PARAMCD", value_name="AVAL"
)
```

:::lines
2: **The most dangerous default in this lesson.** `pivot_table`'s `aggfunc` is `"mean"`, so two readings silently become their average. Nothing in the output indicates it happened.
5: `df.pivot()` — no `_table` — raises `ValueError: Index contains duplicate entries` instead. When you expect no duplicates, this is the right function, and the naming is unfortunate because `pivot_table` sounds like the more general tool.
8: `melt()` is pandas' `pivot_longer`. `id_vars` are the columns to keep as-is.
:::
:::
::::

## Output

```text
> pivot_wider(dup, names_from = p, values_from = v)
# A tibble: 2 × 3
     id A         B
  <dbl> <list>    <list>
1     1 <dbl [2]> <NULL>
2     2 <NULL>    <dbl [1]>
```

:::number[Why is subject 2's single value also a list, when it was never ambiguous?]
Because a column holds one type. Once *any* cell in column `B` needs to be a list, the whole column becomes a list — so subject 2's unambiguous single value is wrapped too.

That is why the symptom is so confusing: the error you eventually hit may be on a subject who had no duplicate at all. The `<dbl [2]>` marking the real culprit is easy to miss among the `<NULL>`s.

**The `<NULL>` entries are worth noting too.** They mean "no value for this combination", which is different from `NA` meaning "a value that is missing". Subject 1 has no `B` row at all; subject 2 has no `A` row. A list column represents that distinction faithfully and nothing downstream handles it.
:::

## Interpretation

Nothing statistical — but the shift table above is worth reading as an analysis rather than a reshape.

A shift table answers "how did subjects move between categories?", which a pair of summary percentages cannot. Knowing that 26% were controlled at baseline and 54% at Week 12 does not tell you whether the same subjects improved or whether some improved while others deteriorated. **The cross-tabulation shows the movement**, and the off-diagonal cells — subjects who got worse — are often the clinically interesting ones.

That is why shift tables exist in safety reporting for laboratory data: a normal-to-high shift in liver enzymes is a signal that a summary of means would hide entirely.

## Common mistakes

:::mistake[Reshaping without checking for duplicates first]
`count(id_cols, names_from) |> filter(n > 1)` takes one line. tidyr gives list columns, pandas silently averages, SAS errors — only one of those tells you the truth, and it is not the one you are using.
:::

:::mistake[Using `pivot_table` in pandas when you expect no duplicates]
Its `aggfunc` defaults to `"mean"`. Use `df.pivot()`, which raises instead. The naming is backwards from what you would guess.
:::

:::mistake[Letting `id_cols` default]
Every column not named in `names_from` or `values_from` becomes part of the row identity. Extra columns that vary between the rows you are trying to combine will keep them apart, silently producing a taller result than expected. `select()` first.
:::

:::mistake[Using `values_fn = mean` to silence an error]
If averaging is correct, it belongs in the derivation with a `DTYPE` flag, not in a presentation reshape. Reaching for `values_fn` to make a message go away is how a real duplicate stops being investigated.
:::

:::mistake[Pivoting on a numeric column without a prefix]
Column names like `0` and `12` are legal but require backticks everywhere and break some functions. `names_prefix = "V"` at the reshape is cheaper than renaming afterwards.
:::

## Knowledge check

::quiz{ids="r.tidyr.duplicate-behaviour,r.tidyr.id-cols,r.tidyr.pandas-default,r.tidyr.row-arithmetic"}

## Hands-on exercise

::practice{ids="r.tidyr.check-first,r.tidyr.wide-listing,r.tidyr.shift-table,r.tidyr.roundtrip" title="Practice: reshaping safely in both directions"}

## Challenge exercise

::practice{ids="r.tidyr.list-column-debug,r.tidyr.sas-transpose,r.tidyr.open" title="Challenge: list columns, PROC TRANSPOSE and when to stay long"}

## Industry note

**Keep analysis data long.** Every model you will fit — MMRM, ANCOVA, Cox, logistic — expects long data, and ggplot2 does too. Widening is a presentation step that belongs in the table program, after all the analysis is done. A pipeline that widens early has to narrow again to fit a model, and every reshape is an opportunity to lose a row.

This is why BDS is specified as it is. One row per measurement is not an arbitrary choice; it is the structure that makes analysis natural and forces presentation decisions to happen where they can be reviewed.

**Shift tables are where reshaping earns its place** in clinical reporting. Laboratory shift tables — normal/abnormal at baseline against normal/abnormal at worst post-baseline — are standard in the safety section of a CSR, and they require exactly this pivot. The categories come from the reference-range indicator (`LBNRIND`) or from CTCAE grades.

:::standard{kind="convention"}
Shift tables presenting baseline against worst post-baseline category are a widely used convention for laboratory safety reporting, and ICH E3 §12.4 expects individual laboratory changes to be presented in the CSR. The specific format — which categories, which post-baseline summary — is a sponsor and SAP decision rather than a prescribed layout.
:::

**`{rtables}` and `{tfrmt}` handle the last mile.** The pharmaverse table-generation packages take long data and produce the wide, nested, multi-header structures a CSR table needs — including the row labels, indentation and footnotes. If you find yourself reshaping repeatedly to build a complex table layout, that is the signal to reach for a table package rather than more `pivot_wider()`.

:::interview[When would you reshape clinical data from long to wide?]
The short answer is presentation, and the useful answer names the exception.

"Almost always for presentation rather than analysis. Models want long data — MMRM, ANCOVA, Cox all take one row per observation — and so does ggplot2. So the reshape happens at the end, in the table program.

The clinical case where widening is genuinely necessary is a **shift table**: you need each subject's baseline category and post-baseline category side by side to cross-tabulate them, and in long form they are on different rows. Listings are the other common case — a reviewer reading a subject's data wants one column per parameter.

The thing I'd check before any reshape is duplicates: `count()` the id columns and the names column and confirm no combination appears twice. That matters because the three languages disagree about what to do when it does — SAS `PROC TRANSPOSE` errors, tidyr silently gives you list columns, and pandas `pivot_table` silently *averages*. Only one of those tells you there was a problem, and it isn't the one most people are using.

And a duplicate at that point always means something real — an unscheduled visit windowed into a scheduled one, a repeat measurement, or a bad merge upstream. The reshape shouldn't be what resolves it."
:::
