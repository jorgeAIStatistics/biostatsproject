## What problem are we trying to solve?

A safety physician asks how many subjects had fatigue. You have the AE listing in a sheet, so you write:

```excel
=COUNTIF(AEDECOD,"Fatigue")     → 202
```

The programmer who ran the same question against the listing in R says **170**.

Nothing is broken. `COUNTIF` counted **rows**, and 202 adverse-event records really do code to the preferred term `Fatigue`. The other count is of **subjects**, and 170 subjects have at least one such record. Both numbers are correct, both are useful, and only one of them answers the question that was asked.

:::standard{kind=convention}
Neither number is what a CSR safety table would print. That table counts subjects with at least one **treatment-emergent** event, which on this study is 166 — four fewer, because four subjects' only fatigue record falls outside the treatment-emergent window.

Rows versus subjects is the distinction this lesson is about, and it is the one that catches people first. But "subjects" is still not a complete specification: the population, the treatment-emergent rule and the analysis flag all have to be named before a count means anything. The denominator lesson in the TLF lab covers that.
:::

Then a data manager runs a second check on the same listing:

```excel
=COUNTIF(AEREL,"RELATED")        → 1051
=COUNTIF(AEREL,"NOT RELATED")    → 1412
```

$1051 + 1412 = 2463$, and the listing has **2,466** rows. Three records are in neither category.

That gap is not a formula problem either. It is three adverse events whose causality query was still open at the data cutoff, and it is the most useful thing either of these checks produced.

This lesson is the `GROUP BY` you are writing when you write `COUNTIFS` — what it counts, what it cannot count, and why the arithmetic not adding up is a feature.

::widget{name="excel-grid" sheet="enrolment-by-site"}

## Intuition

`SUMIFS(sum_range, criteria_range, criteria, …)` is one row of a `GROUP BY`.

```sql
SELECT country, SUM(randomized) FROM sites GROUP BY country;
```

gives you every country at once. `SUMIFS(D2:D19,B2:B19,"USA")` gives you one of them, and you write the rest yourself — one cell per group, with the group names typed by hand.

That difference sounds cosmetic and is the source of most of the mistakes in this lesson.

**A `GROUP BY` enumerates the groups from the data.** If a new country appears, a new row appears. If a country code is misspelled, it appears as its own group and you see it.

**`COUNTIFS` asks about the groups you thought of.** A country you did not type is not zero — it is *absent*, and absent looks the same as not existing. A code misspelled as `US` instead of `USA` does not show up anywhere; it silently falls out of every criterion you wrote.

> A `GROUP BY` partitions the data. A set of `COUNTIFS` covers whatever you remembered.

Which is exactly why the arithmetic check matters: **add your groups up and compare against the total.** If they do not agree, there is a group you did not think of, and the difference is pointing straight at it.

:::why[Why is 1051 + 1412 = 2463 the most valuable number in the whole check?]
Because it is the only one that could have surprised anybody.

The data manager expected causality to be a two-value field. The total says it is not: three of the 2,466 records are neither related nor not related. They are adverse events whose causality query was still unresolved when the database was cut, so `AEREL` is null in SDTM.

The SAP has a rule for that — impute as `RELATED`, the conservative direction — and the rule is applied in ADaM, not in SDTM. So the number of related events differs between the two datasets by exactly three, on purpose, and a QC programmer comparing them needs to know why.

None of that is visible from either `COUNTIF`. It is visible from the fact that they do not sum to the total.
:::

## Clinical context

Conditional aggregation is how a spreadsheet produces the numbers that eventually appear in a table:

| Question | Formula family |
|---|---|
| Subjects randomized in the USA | `SUMIFS` |
| Sites that randomized 10 or more | `COUNTIF` with a comparison criterion |
| Events of grade 3 or above | `COUNTIFS` |
| Largest enrolment at any US site | `MAXIFS` |
| Mean enrolment per US site | `AVERAGEIFS` |
| Subjects with at least one fatigue event | **None of them** — see below |

The last row is the one that matters. **`COUNTIFS` counts rows, and a safety table counts subjects.** Every percentage in an AE table has a subject count on top and a population count underneath, and `COUNTIFS` can produce neither of them directly.

:::clinical
On CBX417-301, the difference between the two ways of counting is not small:

| | Events | Subjects |
|---|---:|---:|
| Fatigue | 202 | 170 |
| Nausea | 162 | 130 |
| Grade ≥ 3 | 502 | 298 |
| Serious | 150 | 137 |

A standard AE overview table reports **subjects** with at least one event, as a percentage of the safety population — 416 subjects here. So grade 3 or above is 298/416 = **71.6%**, not 502 of anything.

Report the event count as though it were a subject count and percentages can exceed 100%, which at least gets noticed. Report it where the numbers happen to stay below the denominator and nothing gets noticed at all.
:::

## Formal concept

### Criteria syntax

A criterion is a value, or a text string containing an operator:

```excel
=COUNTIF(B2:B19,"USA")           literal text, case-insensitive
=COUNTIF(D2:D19,">=10")          comparison, written as a text string
=COUNTIF(D2:D19,">="&F1)         comparison against a cell, joined with &
=COUNTIF(C2:C19,"<>0")           not equal
=COUNTIF(B2:B19,"US*")           wildcard: * any run of characters
=COUNTIF(B2:B19,"US?")           wildcard: ? exactly one character
=COUNTIF(B2:B19,"")              empty cells
```

The comparison forms are the ones people get wrong, because `">=10"` looks like it should be `>=10`. It cannot be: a criterion is a single argument, and `>=10` is not a valid expression on its own. Against a cell you have to build the string: `">="&F1`.

:::mistake[`SUMIF` and `SUMIFS` take their arguments in opposite orders]
```excel
=SUMIF(B2:B19,"USA",D2:D19)      criteria range, criteria, sum range
=SUMIFS(D2:D19,B2:B19,"USA")     sum range FIRST, then criteria
```

`SUMIFS` has to put the sum range first because it accepts any number of criteria pairs after it. The result is two functions with almost the same name and reversed signatures.

Getting it backwards usually gives an error or an obviously wrong number — but not always. If the two ranges are the same width and both hold numbers, you can get a plausible total from the wrong column. **Use `SUMIFS` everywhere, even for one condition**, and the question never arises.
:::

### Criteria coerce; comparison operators do not

This is the one genuinely confusing rule in the family, and it cannot be reasoned out — it has to be known.

**Excel's comparison operators are type-aware.** `="16"=16` is `FALSE`. The ordering is number, then text, then boolean, and a number is never equal to a text string however identical they look.

**Criteria arguments are not.** `COUNTIF(range,"16")` matches a cell holding the *number* 16.

So a formula and a criterion, written with the same characters, can disagree:

```excel
=C2="1001"                    → FALSE   (C2 holds the number 1001)
=COUNTIF(C2:C7,"1001")        → 1       (the same cell matches)
```

Both behaviours are correct and documented. They are simply two different rules, and knowing which one applies is the difference between diagnosing a failed lookup in one minute or twenty.

### Empty sets

What each function returns when **nothing** matches is worth memorising, because two of them return numbers:

| Function | No matches |
|---|---|
| `COUNTIF`, `COUNTIFS` | `0` — correct and unambiguous |
| `SUMIF`, `SUMIFS` | `0` — correct |
| `MAXIFS`, `MINIFS` | **`0`** — and 0 may be a plausible value |
| `AVERAGEIF`, `AVERAGEIFS` | `#DIV/0!` — loud, and the most useful of the four |

`MAXIFS` returning 0 for an empty set is the trap. Ask for the largest enrolment at a country you have misspelled and you get 0, which reads as a real site that enrolled nobody.

`AVERAGEIFS` is the opposite: it cannot average nothing, so it errors, and the error tells you the criterion matched no rows. **When you are unsure whether a criterion matches anything, `AVERAGEIFS` is the honest one.**

### What it cannot do

**`COUNTIFS` cannot compare one column against another.** There is no criterion that means "where column C equals column D". The answer is a helper column:

```excel
E2:  =IF(C2=D2,1,0)
F10: =SUM(E2:E19)         → 6 sites with no screen failures
```

**`COUNTIFS` cannot count distinct subjects.** The answer is again a helper column:

```excel
=IF(COUNTIF($A$2:A2,A2)=1,1,0)
```

:::standard{kind="convention"}
Helper columns have a reputation as a workaround. In a sheet somebody else has to check, they are the better answer, not the fallback.

A per-row test in a visible column can be read, spot-checked and filtered: a reviewer can see *which* six sites were flagged, not just that six were. A single dense formula returning 6 shows nothing and has to be trusted or re-derived.

The tools that do this in one step — `SUMPRODUCT`, and the dynamic-array functions in current Excel — are real and useful, and are not available in this lab's sandbox. Where they are available they still lose the reviewability, which is a trade worth making deliberately rather than by habit.
:::

## Worked example

The enrolment tracker holds the first 18 sites of CBX417-301: one row per site, country as a value, counts as numbers.

**The straightforward ones.**

```excel
=SUM(C2:C19)                      → 203    subjects screened
=SUMIFS(D2:D19,B2:B19,"USA")      → 70     randomized in the USA
=COUNTIF(B2:B19,"USA")            → 9      US sites
=COUNTIF(D2:D19,">=10")           → 11     sites randomizing 10 or more
=MAXIFS(D2:D19,B2:B19,"USA")      → 15     largest US site
```

Note how `SUMIFS` and `COUNTIF` differ in what they answer over the same column: 70 subjects across 9 sites. **Counting rows and summing a column are different questions**, and in a grouped summary the difference is the difference between "subjects" and "sites".

**The one with a trap in it.** The screen-failure rate across the 18 sites:

```excel
=ROUND(100*(SUM(C2:C19)-SUM(D2:D19))/SUM(C2:C19),2)     → 12.81
```

Work from the totals. The tempting alternative — compute a rate per site, then average the rates — gives **14.77%** on this data, almost two percentage points higher.

:::number[Why do 12.81% and 14.77% differ, and which is right?]
Across the 18 sites, 203 subjects were screened and 177 randomized, so 26 screen-failed:

$$\frac{26}{203} = 12.81\%$$

That is the screen-failure rate: the proportion of screened subjects who failed screening.

Averaging the 18 per-site rates gives 14.77%, and it is a different quantity — the *mean of the sites' rates*, in which a site that screened 1 subject counts as much as a site that screened 20. Site 1004 screened 3 and randomized 1, a 66.7% failure rate, and it pulls the unweighted mean up hard.

**Neither is wrong; they answer different questions.** If you want to know how likely a screened subject is to fail, use 12.81%. If you want to know how the typical site is performing, the unweighted mean is arguably what you want — and it needs to be labelled as such, because nobody reading "screen failure rate 14.8%" will understand that a three-subject site had the same weight as a twenty-subject one.

The general form of the trap: **a mean of ratios is not the ratio of the means.** It appears every time a rate is computed per site, per visit or per batch and then averaged.
:::

**The one `COUNTIFS` cannot do.** How many sites had no screen failures at all — every subject they screened was randomized? There is no criterion for "column C equals column D", so column E carries `=IF(C2=D2,1,0)` and `=SUM(E2:E19)` gives **6**.

## Data example

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AETERM,AEDECOD,AETOXGR,AESER,AEREL" rows="8" caption="AE — 2,466 rows, and every count in a safety table is a conditional aggregation over them"}

**Counting on the verbatim term does not work, and the numbers show exactly why.** Sites typed fatigue six different ways:

| `AETERM` as typed | n |
|---|---:|
| `fatigue` | 30 |
| `Fatigue` | 39 |
| `FATIGUE` | 31 |
| `Feeling tired` | 35 |
| `tiredness` | 29 |
| `Tiredness` | 38 |

```excel
=COUNTIF(AETERM,"fatigue")      → 100     case-insensitive: catches all three spellings
=COUNTIF(AETERM,"*tired*")      → 102     wildcard: catches the other three
=COUNTIF(AEDECOD,"Fatigue")     → 202     the coded term: one criterion, all six
```

$100 + 102 = 202$. The two verbatim criteria happen to partition the same set the coded term identifies — and that is luck, checked after the fact, not a method. Nothing told you in advance that `*tired*` was the missing half, and nothing would tell you if a seventh spelling appeared next month.

:::mistake[Building a table on the verbatim term because it is the column you were sent]
`COUNTIF` matches text case-insensitively, so `fatigue`, `Fatigue` and `FATIGUE` fall out for free. That is enough to make the approach look like it works.

It cannot know that `Tiredness` is the same event. **Medical coding exists precisely to solve this**, and a safety table built on `AETERM` is a table built on how 42 sites happened to type.

If the listing you were sent has no coded column, that is the finding. Ask for it.
:::

**The check that finds what you did not think of.** Adverse-event severity:

```excel
=COUNTIF(AETOXGR,1) → 1175      =COUNTIF(AETOXGR,4) →   96
=COUNTIF(AETOXGR,2) →  789      =COUNTIF(AETOXGR,5) →   28
=COUNTIF(AETOXGR,3) →  378
```

$1175 + 789 + 378 + 96 + 28 = 2466$, and the listing has 2,466 rows. The partition is complete: every record has a grade.

Causality does not behave the same way. 1,051 related plus 1,412 not related is 2,463 — **three short**. Those three are adverse events whose causality query was unresolved at the data cutoff, so `AEREL` is null in SDTM and the SAP's conservative rule imputes `RELATED` in ADaM.

**That is why the totals check is worth running every time.** It cost one `SUM`, and it found a real, documented, cross-dataset difference that neither individual count could show.

## Code

The same grouped summary in four places.

::::tabs
:::tab[Excel]
```excel
=COUNTIFS(AEDECOD,"Fatigue")                      → 202
=COUNTIFS(AEDECOD,"Fatigue",AETOXGR,">=3")        → events, grade 3+
=SUM(helper)                                      → 170 subjects
```

:::lines
1: Events. One cell per term, with the term names typed by hand.
2: Criteria pairs are combined with **AND**. There is no OR in `COUNTIFS`; two criteria needing OR means adding two `COUNTIFS` together and subtracting the overlap.
3: Subjects, via a helper column marking each subject's first qualifying row. There is no direct form.
:::
:::

:::tab[SQL]
```sql
SELECT aedecod,
       COUNT(*)                  AS events,
       COUNT(DISTINCT usubjid)   AS subjects
FROM   ae
GROUP BY aedecod
ORDER BY subjects DESC;
```

:::lines
2-3: Both quantities side by side, from one pass, with no chance of confusing them. This is the single biggest practical advantage over a spreadsheet.
5: Every term that exists appears, including any you had not thought of. Nothing has to be typed by hand and nothing can be silently omitted.
:::
:::

:::tab[R]
```r
ae |>
  dplyr::count(AEDECOD, name = "events") |>
  dplyr::left_join(
    dplyr::summarise(dplyr::group_by(ae, AEDECOD),
                     subjects = dplyr::n_distinct(USUBJID)),
    by = "AEDECOD"
  )
```

:::lines
2: `count()` gives events per term.
5: `n_distinct(USUBJID)` gives subjects. The two are separate verbs, which keeps the distinction explicit in the code rather than in a column heading.
:::
:::

:::tab[SAS]
```sas
proc sql;
  create table ae_sum as
  select aedecod,
         count(*)                as events,
         count(distinct usubjid) as subjects
  from ae
  group by aedecod;
quit;
```

:::lines
4-5: `PROC SQL` with `COUNT(DISTINCT …)`. `PROC FREQ` counts rows, so a distinct-subject count there needs a de-duplicated dataset first — the same helper-column idea, one step earlier.
:::
:::
::::

## Common mistakes

:::mistake[Reporting an event count where a subject count belongs]
202 fatigue events, 170 subjects. Put 202 into a safety table whose denominator is 416 subjects and the percentage is meaningless, even though it stays below 100 and looks fine.

The heading `n (%)` in an AE table means subjects with at least one event. Always check which quantity a number is before it acquires a percentage.
:::

:::mistake[Assuming your criteria partition the data]
A set of `COUNTIFS` covers what you thought of. Sum them and compare against the total, every time. The gap is where the misspelled code, the blank field or the category nobody mentioned is hiding — and on this study it is three unresolved causality queries.
:::

:::mistake[Averaging a rate that was computed per group]
A mean of per-site rates is not the overall rate. On these 18 sites the two differ by nearly two percentage points, because a site that screened three subjects gets the same weight as one that screened twenty.

Compute rates from totals unless you specifically want the unweighted mean — and if you do, label it as one.
:::

:::mistake[Trusting `MAXIFS` when the criterion might match nothing]
`MAXIFS` returns **0** when no rows match. In an enrolment column, 0 is a plausible value. Misspell a country and you get a confident zero rather than an error.

Guard it with a `COUNTIFS` on the same criteria, or check the criterion with `AVERAGEIFS` first, which errors on an empty set instead of inventing a number.
:::

:::mistake[Typing the group names by hand]
`COUNTIFS` requires you to name each group. A country that appears later, or a code entered as `US` instead of `USA`, is not zero — it is absent, and absent is invisible.

The totals check catches it. So does building the summary as a PivotTable, which enumerates the groups from the data the way a `GROUP BY` does.
:::

## Knowledge check

::quiz{ids="excel.agg.events-vs-subjects,excel.agg.criteria-coercion,excel.agg.empty-set,excel.agg.sumifs-order"}

## Hands-on exercise

::practice{ids="excel.agg.totals-check,excel.agg.rate-of-rates,excel.agg.verbatim-coded,excel.agg.helper-column" title="Practice: counting the right thing"}

## Challenge exercise

::practice{ids="excel.agg.missing-category,excel.agg.hotspot,excel.agg.open-denominator" title="Challenge: the three records in neither column"}

## Industry note

**Conditional aggregation is where a spreadsheet stops being a viewer and starts being an analysis**, and that is the point at which it needs to be treated like one. A `COUNTIFS` whose result goes into a slide, a data-review listing or a safety monitoring report is producing a study number, and study numbers get checked.

What makes a spreadsheet summary checkable is almost entirely structural: helper columns instead of hidden cleverness, criteria in cells rather than typed into formulas — so a reader can see `">="&F1` pointing at a threshold of 10 rather than decoding `">=10"` buried in twenty cells — and a totals row that reconciles the parts against the whole.

**Denominators are the recurring argument, not the formulas.** And the numerator has to agree with the denominator you choose.

Treatment-emergent fatigue affects **166** subjects. Against the safety population of 416 that is **39.9%**; against the 420 randomized it is **39.5%**. An AE table uses the safety population, because a subject who was never dosed could not have had a treatment-emergent adverse event and the denominator has to be the population that was at risk.

Note what happens if you pair the numerator and denominator carelessly: 170 subjects — *every* subject with a fatigue record, emergent or not — over 416 gives 40.9%. It is a plausible-looking number, it is one decimal away from the right one, and it is wrong, because the numerator counts events the denominator's justification excludes. **A rate is only defensible when its numerator and denominator answer the same question.**

:::standard{kind="convention"}
Reporting subject counts rather than event counts in an adverse-event summary table, with the safety population as the denominator, is standard industry practice and is specified in the SAP for each study rather than mandated by a single document. ICH E3, which describes the structure of a clinical study report, expects adverse events to be summarised by subject; the specific populations and the handling of missing causality are SAP decisions.

On this study the SAP's rule for an unresolved causality query is to impute `RELATED` in ADaM — the conservative direction — while SDTM keeps `AEREL` null. That is a sponsor decision, not a CDISC rule, and it is exactly the kind of difference a QC programmer must be told about rather than discover.
:::

:::interview[Your COUNTIFS by category do not add up to the total]
"I'd treat that as the check working rather than as a problem with the formulas.

`COUNTIFS` only ever counts the groups you named, so the gap is a group I did not think of. Usually it is one of three things: a blank — the field really is empty on some rows; a value I did not anticipate, like a code entered as `US` instead of `USA`; or a row being caught by two criteria and double-counted, in which case the sum comes out *above* the total instead of below.

I'd find which by counting the complement — `COUNTIFS` with `<>` for each category I did write, or just `COUNTIF(range,\"\")` for blanks — and then look at the actual rows.

On the study I've been working with, the causality field gives 1,051 related and 1,412 not related against 2,466 records. The three missing are adverse events whose causality query was still open at the data cutoff. `AEREL` is null in SDTM, and the SAP imputes `RELATED` in ADaM, so the two datasets legitimately disagree by three. That is a real finding and the only way to see it from a spreadsheet is the totals check.

I'd also say that the version of this check I actually trust is a PivotTable or a `GROUP BY`, because those enumerate the groups from the data instead of from my memory. `COUNTIFS` plus a totals reconciliation is how you get most of that safety back when a pivot is not appropriate."
:::
