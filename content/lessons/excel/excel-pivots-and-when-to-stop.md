## What problem are we trying to solve?

Somebody keeps the Monday enrolment workbook. Every week they paste in a fresh extract, tidy a few cells, and the summary underneath updates: twelve countries, twelve `SUMIFS`, a total at the bottom.

This Monday the total at the bottom of the summary says **379**. The study has randomized **420**.

Nothing errors. Each of the twelve `SUMIFS` is individually correct — you can check them one at a time and they all agree with the rows above. The forty-one missing subjects are in the data, in the sheet, on screen, and in none of the twelve groups.

And nobody can say when it started, because the workbook has no record of what has been done to it. Four weeks of pasting and tidying have left values in cells with no trace of where they came from.

::widget{name="excel-grid" sheet="site-summary-by-hand"}

The ten tasks find both causes and close the 41 exactly. Then the rest of this lesson is about the two tools that make this particular failure impossible — and about the point at which neither of them is enough.

## Intuition

There are four rungs a piece of spreadsheet work can sit on, and each removes a class of thing that can go wrong silently.

| | What is in the cell | What is recorded | What can still go wrong invisibly |
|---|---|---|---|
| 1 | A value somebody typed | Nothing | Everything |
| 2 | A formula | How this cell was derived | The *shape* of the summary — which groups exist — is still typed |
| 3 | A PivotTable or a Power Query step list | The structure, derived from the data, and the steps in order | Whether anyone refreshed it |
| 4 | Code in version control | The whole derivation, who changed it, when, and why | What you failed to test |

**The Monday workbook is stuck on rung 2**, and that is exactly where the 41 subjects went. A formula tells you how a cell was computed. It cannot tell you that there is a thirteenth country code in the data that nobody wrote a formula for.

> A `GROUP BY` partitions the data. A PivotTable partitions the data. A column of `SUMIFS` covers whatever you remembered.

Rung 3 is the one this lesson is really about, because it is where most clinical spreadsheet work should be sitting and is not. A PivotTable derives its row labels from the distinct values actually present, so a mis-keyed country appears as its own row the first time it occurs. A Power Query keeps an ordered, editable list of every transformation, so "what was done to this file" is a question with an answer. Neither is code; both are enormously better than typing.

:::why[If a PivotTable would have caught this, why does anybody write the `SUMIFS` version?]
Because the `SUMIFS` version can be laid out to look like the report, and a pivot cannot. A pivot decides its own arrangement, and the Monday summary has a shape somebody wants — countries in a particular order, a blank row before the total, a footnote.

That is a real reason and not a good enough one. The compromise most people land on is both: **a pivot as the check, a formatted block as the deliverable**, with the pivot's grand total and the block's total in adjacent cells so any divergence is visible.
:::

## Clinical context

Grouped summaries are most of what a spreadsheet is asked for in a biometrics group:

| Asked for | The grouping |
|---|---|
| Enrolment by country, by month | Site attributes × calendar |
| Adverse events by preferred term | One row per distinct `AEDECOD` — there are 56 on this study |
| Adverse events by system organ class | 15 rows |
| Subjects with at least one event | A **distinct count**, which is not the same operation |
| Queries outstanding by site and age | Two grouping fields at once |
| Lab results outside the reference range | A grouped count with a row-level condition |

:::clinical
The fourth row is the one that separates a pivot from a report.

On CBX417-301, 202 adverse-event records code to the preferred term `Fatigue`, and those records belong to **170 subjects**. A safety table reports the subject count, as a percentage of a subject population — 416 for the safety population here — never the record count. A PivotTable with `AEDECOD` on rows and `Count of USUBJID` in the values area returns **202**.

Both numbers are correct. Only one of them belongs under a heading that reads `n (%)`.

An ordinary PivotTable has no distinct-count summary function. Getting 170 out of a pivot requires the source to be added to the **Data Model**, after which `Distinct Count` becomes available in the value field settings. Without that step, the number that appears is the event count, under whatever label you give the column.
:::

## Formal concept

### What a PivotTable actually does

Four drop zones — Rows, Columns, Values, Filters — and one behaviour that matters more than all the features:

**The row and column labels are enumerated from the distinct values in the source column.** You do not type them. A country code that appears once appears as a row. A code entered as `SPA` instead of `ESP` appears as a row called `SPA`, next to the others, the first time it occurs. A blank appears as `(blank)`.

That is the whole argument. Everything else about pivots is convenience; this is the part that changes what can go wrong.

Three behaviours worth knowing because they bite:

**The default summary is not always `Sum`.** Excel uses `Sum` when every value in the field is numeric, and `Count` when the field contains text or blanks. One imported cell holding `"12"` instead of 12 changes the heading from `Sum of Randomized` to `Count of Randomized` and the number from 420 to 42, and the only warning is the heading.

**A pivot holds a cached copy of the source.** It does not watch the data. Edit the source and the pivot keeps showing the old numbers until it is refreshed — which is why a workbook can contain a summary and the data it disagrees with, both correct as of different moments.

**Refresh does not extend a fixed range.** If the pivot's source is `Sheet1!$A$1:$E$43` and next month's extract has 47 sites, refreshing picks up changes to the first 42 rows and ignores the rest. If the source is an Excel Table, it grows. **Build pivots on Tables.**

:::mistake[Reading a pivot cell into a formula]
Click a cell inside a pivot while writing a formula and Excel does not insert `B7`. It inserts `GETPIVOTDATA("Randomized",$A$3,"Country","POL")`, which follows the value if the pivot rearranges — usually what you want, and it fails differently from a cell reference. Refresh into a month where Poland has no rows and it returns `#REF!` rather than a neighbouring country's number.

Which is the better failure. The mistake is not noticing which kind of reference you have, and then copying the formula sideways expecting it to step through the columns.
:::

### What Power Query does that formatting and pasting cannot

Power Query is reached through Data → Get Data, and what it produces is not a paste. It is a **query**: an ordered, named list of transformations applied to a source file, re-runnable on demand. Every action in its editor becomes an **applied step**, visible in a list, in order, and renameable, deletable, reorderable and editable. The whole query is also a small program in a language called M, readable in the Advanced Editor and copyable into another workbook.

Three consequences that matter in clinical work:

**Column types are set by an explicit step, not guessed at the moment of opening.** The `Changed Type` step names each column's type, so a site identifier declared as text keeps its leading zeros — every time, including on next month's file. This is the durable answer to everything in `excel-import-pitfalls`.

**Refresh re-runs every step against the current source.** Next month's extract goes through the same transformations in the same order, and nobody has to remember what they were.

**A merge step names its join kind.** Merge Queries offers Left Outer, Right Outer, Full Outer, Inner, Left Anti and Right Anti explicitly. The reconciliation from the previous lesson — two anti-joins and a value comparison — is three named steps here, rather than two lookups you have to remember to write in both directions.

:::standard{kind="convention"}
Neither tool can run in this lab's sandbox, which evaluates formulas only. Everything above describes real Excel, and the two features are worth learning from the product's own documentation rather than from a description.

One honest caveat on M: it is a case-sensitive language, so a merge on keys that differ only in case does not match, where `VLOOKUP` and `COUNTIF` would have. Moving a workbook from formulas to Power Query can change results, and on key columns that is usually a change in the right direction — but it is a change, and it should be checked rather than assumed.
:::

### When the work has stopped belonging in a spreadsheet

There is no row count at which Excel becomes wrong. The real tests are about what the output is for:

| Question | If yes |
|---|---|
| Will this be run again on new data? | Rung 3 at minimum — the steps have to exist somewhere |
| Does a number from it go into a document someone signs? | Rung 4 |
| Must someone else reproduce it independently? | Rung 4 — a reviewer cannot check a value that was typed |
| Were any values typed over rather than derived? | It is on rung 1, whatever it looks like |

And the honest other half: **plenty of real clinical work belongs in a spreadsheet and always will.** A medical monitor asks a question in a meeting and wants the answer before the meeting ends. A statistician checks one number from a table by hand, by a different route, precisely because it is a different route. Those are jobs Excel does better than a pipeline, and the defensible ones share a property: **the spreadsheet is reading, not producing.**

:::standard{kind="official"}
FDA 21 CFR Part 11 §11.10(e) requires secure, computer-generated, time-stamped audit trails that independently record operator entries and actions creating, modifying or deleting electronic records, for systems used to satisfy predicate rule requirements.

Whether a particular workbook is such a record is a sponsor determination and depends on how it is used — the regulation does not classify it for you. What is not a matter of judgement is the underlying capability: a spreadsheet in which somebody typed over a cell has no record that they did, and no amount of SOP makes one appear.
:::

## Worked example

The 42 sites, the twelve typed country codes, and a gap of 41.

**The gap.** `=SUM(C2:C43)` gives 420. `=SUM(E2:E13)` — the twelve `SUMIFS` subtotals — gives **379**.

**The first cause.** Poland has three sites on this study:

```excel
=COUNTIF(B2:B43,"POL")     → 2
=COUNTIF(B2:B43,"POL*")    → 3
=LEN(B28)                  → 4
```

Site 1027's country code is `"POL "`. Four characters where there should be three. `COUNTIF` and `SUMIFS` do not trim their criteria against the data, so the row simply falls out of the Poland subtotal:

```excel
=SUMIFS(C2:C43,B2:B43,"POL*")-SUMIFS(C2:C43,B2:B43,"POL")    → 29
```

**The second cause.** Site 1020's country code is `SPA`, which is spelled perfectly and is not one of the twelve codes anybody typed into the summary:

```excel
=COUNTIF(D2:D13,B21)              → 0      the code appears in no summary row
=SUMIFS(C2:C43,B2:B43,B21)        → 12     and 12 subjects are at that site
```

**Closing it.** $379 + 29 + 12 = 420$. A residual of zero is what tells you there is no third cause.

**Now the same data in a pivot.** Drag `Country` to Rows and `Randomized` to Values. Fourteen rows appear, not twelve: the twelve you expected, plus `POL ` sitting immediately under `POL` with 29 against it, plus `SPA`. The grand total reads 420 because a pivot's grand total is computed over the rows, not by adding the subtotals you wrote.

**Both defects are on screen before you have asked a question.** That is the difference between a tool that partitions the data and a set of formulas that filter it.

:::number[Why the two codes fail differently, and why it matters]
`SPA` and `POL ` produce the same symptom and need different fixes.

`POL ` is **malformed**, and a mechanical check finds it: `=LEN()` returns 4 where every other code returns 3. You need no knowledge of the study to spot it, and every tool that ever touches this column — a sort, a filter, a join to a country table, a `GROUP BY` in any language — will treat it as its own value.

`SPA` is **well formed and outside the code list**. Three characters, upper case, indistinguishable from a country code by any structural test. The only thing that identifies it is a comparison against the list of codes the study actually uses, and the study's other two Spanish sites use `ESP`.

A pivot shows both as extra rows and does not tell you which is which. `=LEN()` separates them in one formula: **four characters is a broken value, three characters is a value that needs checking against the terminology.**
:::

:::standard{kind="official"}
`COUNTRY` in the SDTM DM domain is specified as ISO 3166-1 alpha-3, in which Spain is `ESP`. `SPA` is not a code in that list, so this is a controlled-terminology finding rather than a matter of house style — and it is the kind of thing that a value-level check against the code list catches and a structural check never will.

Naming which of the two a finding is matters, because the owners differ: a malformed value is usually something that happened in transfer, and a wrong-but-well-formed code is usually something a person entered.
:::

## Data example

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AETERM,AEDECOD,AEBODSYS,AETOXGR,AESER" rows="8" caption="AE — 2,466 records, 195 distinct verbatim terms, 56 preferred terms, 15 system organ classes"}

This is where the argument stops being about convenience.

**A pivot on `AEDECOD` produces 56 rows.** Every preferred term that occurs, whether or not you knew it was there. The `COUNTIFS` version of the same summary requires typing 56 term names, correctly, and produces no indication at all if a fifty-seventh appears in next month's extract.

**A pivot on `AETERM` produces 195 rows** — which is not a summary, it is the reason medical coding exists. Seeing 195 rows where you expected fifty is itself the finding.

**A pivot on `AEBODSYS` produces 15.** Same data, coarser grouping, one drag.

And the one it cannot do on its own: `Count of USUBJID` against `Fatigue` returns **202**, the number of records. The number a safety table needs is **170**, the number of subjects with at least one. That requires `Distinct Count`, which requires the Data Model, which is a separate decision someone has to have made.

**So the pivot is right about the groups and can be wrong about the quantity** — the exact opposite failure from the `COUNTIFS` version, which is reliably right about the quantity it computes and silently incomplete about which groups exist.

## Code

The same grouped summary at each rung.

::::tabs
:::tab[Excel formulas]
```excel
D2:  USA
E2:  =SUMIFS($C$2:$C$43,$B$2:$B$43,D2)
E14: =SUM(E2:E13)
G2:  =SUM(C2:C43)
```

:::lines
1: **The group name is typed.** This is the whole vulnerability: the summary can only ever contain groups somebody thought of.
2: Individually correct, and correct in a way that survives the row below it being wrong.
3-4: The two totals that must agree. Put them next to each other. When they diverge, the difference is a group nobody named — 41 subjects here.
:::
:::

:::tab[PivotTable]
```text
Source:  Table1  (an Excel Table, so it grows with the data)
Rows:    Country
Values:  Sum of Randomized

Country   Sum of Randomized
AUS                     10
CAN                     38
...
POL                     38
POL                     29        ← a second row, four characters wide
SPA                     12        ← a code that is in no summary
USA                     70
Grand Total            420
```

:::lines
1: An Excel Table rather than a fixed range, so next month's extra sites are included on refresh instead of ignored.
3: `Sum` only because every value in the field is numeric. One text cell in the column silently turns this into `Count`.
9-10: The two defects, visible without being asked for, because the row labels come from the data.
13: The grand total is computed over the rows, not by adding the subtotals — so it agrees with the source even when your expectations do not.
:::
:::

:::tab[Power Query]
```text
let
    Source  = Csv.Document(File.Contents("extracts\dm_2025-03-31.csv"),
                           [Delimiter = ",", Encoding = 65001]),
    Headers = Table.PromoteHeaders(Source),
    Typed   = Table.TransformColumnTypes(Headers,
                {{"SITEID", type text}, {"USUBJID", type text}}),
    Rand    = Table.SelectRows(Typed, each [ARMCD] <> null and [ARMCD] <> ""),
    ByCtry  = Table.Group(Rand, {"COUNTRY"},
                {{"Subjects", each Table.RowCount(_), Int64.Type}})
in
    ByCtry
```

:::lines
2-3: The source is referenced, not pasted. Refresh re-reads the file.
5-6: **`SITEID` declared as text.** Leading zeros survive, every month, without anyone remembering. This one step is the answer to most of `excel-import-pitfalls`.
7: The filter that defines "randomized", written once and visible as a named step rather than living in a filter somebody applied and forgot.
9: `Table.Group` enumerates the groups from the data, exactly as a pivot does.
11: Each name above is an applied step in the editor's list. Deleting one, or reordering two, is a visible edit — which is what the Monday workbook has no way to record.
:::
:::

:::tab[SQL]
```sql
SELECT   COUNTRY, COUNT(*) AS subjects
FROM     dm
WHERE    ARMCD IS NOT NULL AND ARMCD <> ''
GROUP BY COUNTRY
ORDER BY subjects DESC;
```

:::lines
3: The population definition, stated in the query rather than assumed by whoever built the extract.
4: Twelve rows on clean data, summing to 420 — and thirteen the moment a `SPA` appears, which is the same protection a pivot gives with the same shrug.
5: Five lines, in a file, that can be diffed, reviewed and re-run by someone who was not there. That is the only thing on this page the other three cannot do.
:::
:::
::::

## Common mistakes

:::mistake[Treating a pivot as refreshed]
A PivotTable holds a cached copy of its source. Edit the data and the pivot goes on reporting the old numbers with no indication that it is doing so.

The failure looks like a disagreement between two parts of the same workbook, and the tempting response is to investigate the numbers. Refresh first.
:::

:::mistake[Building a pivot on a fixed range]
`Sheet1!$A$1:$E$43` will still be `$A$1:$E$43` when the extract has 47 sites. Refreshing updates the first 42 rows and silently ignores the rest.

Convert the source to an Excel Table before you build anything on it. The pivot then grows with the data.
:::

:::mistake[Taking a pivot's `Count` as a subject count]
`Count of USUBJID` counts records. On this study that is 202 fatigue events, not the 170 subjects a safety table reports.

Distinct count is not an ordinary pivot summary function — it needs the source added to the Data Model. If that step was not taken, the number under your `n (%)` heading is an event count.
:::

:::mistake[Typing over a cell in a query output]
A value typed into a Power Query result is destroyed by the next refresh, and until then it is the one number in the workbook with no derivation behind it.

If a value is wrong, the fix belongs in a step, or in the source. "I corrected it in the output" is the sentence that puts a rung-3 workbook back on rung 1.
:::

:::mistake[Deciding by file size]
An `.xlsx` sheet holds 1,048,576 rows, and this study's entire LB domain is 25,450. The row limit is almost never the reason to stop using Excel.

The reasons are traceability, repeatability and independent verification, and they apply at forty rows just as hard as at forty thousand.
:::

## Knowledge check

::quiz{ids="excel.pivot.groups-enumerated,excel.pivot.distinct-count,excel.pivot.refresh-cache,excel.pivot.sum-becomes-count"}

## Hands-on exercise

::practice{ids="excel.pivot.close-the-41,excel.pivot.two-defects,excel.pivot.rungs,excel.pivot.group-by" title="Practice: the groups nobody typed"}

## Challenge exercise

::practice{ids="excel.pivot.stale-summary,excel.pivot.when-to-stop,excel.pivot.open-judgement" title="Challenge: the point at which this stops being defensible"}

## Industry note

**Spreadsheet errors are ordinary, and they are found late.** The European Spreadsheet Risks Interest Group maintains a public archive of reported incidents, worth reading for one reason: almost none of them are arithmetic. They are ranges that did not extend, groups nobody typed, a paste that landed one row down, a summary that was never refreshed.

The argument this module has been building toward is not that spreadsheets are dangerous. It is narrower:

**A spreadsheet is excellent at reading data and unreliable at producing it.** Reading — look at these forty rows, group them, check this one number by a second route — is what it is uniquely good at, and no pipeline replaces it. Producing — this number goes into a document, and next month it will be produced again from a different file by somebody else — is where its defaults work against you. They are all convenience defaults: lookups take the first match, `SUM` skips text, ranges do not grow, pivots hold stale caches, and nothing records what you typed.

**The practical move is usually one rung, not four.** Most clinical spreadsheet work sits on rung 1 or 2 and would be substantially safer on rung 3, at the cost of an afternoon: a pivot on a Table instead of a block of `SUMIFS`, a Power Query import with typed columns instead of a paste, and two totals in adjacent cells so a divergence is visible on Monday rather than in month four.

**The last rung is a different decision.** Code in version control is not a better spreadsheet; it is a different set of trade-offs — slower to start, reviewable by someone who was not there, testable, diffable, re-runnable by a person who has never seen the study. You take it when the output has to be defended rather than merely produced, and knowing which of those you are doing is the judgement this module exists to build.

:::interview[At what point would you tell someone to stop using Excel?]
"I wouldn't frame it as stopping, because a lot of the work genuinely belongs there. I'd ask four questions about the output.

Will it be run again on new data? If yes, the steps have to be recorded somewhere — at minimum Power Query, where every transformation is an applied step and refresh re-runs them, rather than a paste and some tidying that nobody can reconstruct.

Does a number from it end up in something someone signs? Then I want it to be reproducible by a second person from the source, which in practice means code in version control. Not because Excel computes wrongly, but because a workbook has no diff, no review and no record of a cell somebody typed over.

Does anyone have to verify it independently? A reviewer can check a formula, but they cannot check a value that was typed, and they cannot tell the two apart by looking. That is the single property I'd weigh most heavily.

And does it need a compound key, or a key that repeats? That is where a spreadsheet stops having a native answer at all — concatenated helper columns work up to a point and then quietly stop.

Where I'd push back on the reflex to move everything into code is on exploratory work and on checking. A medical monitor asking a question in a meeting is better served in thirty seconds in Excel than in a script tomorrow. And a statistician checking one number from a table by hand should use a different tool from the one that produced it, because agreement between two routes is the point.

On the specific workbook I've been looking at, the fix was one rung, not four. Twelve typed country subtotals summing to 379 against a study total of 420 — one country code with a trailing space and one code nobody had typed into the summary. A PivotTable on the same column shows both as extra rows immediately, because it enumerates the groups from the data instead of from somebody's memory. That is an afternoon's change and it removes the entire class of failure."
:::
