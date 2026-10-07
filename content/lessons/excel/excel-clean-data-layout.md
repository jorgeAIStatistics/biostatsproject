## What problem are we trying to solve?

Monday morning, enrolment meeting. The study manager's tracker has one line at the bottom:

```text
Total screened to date:   256
```

The real number is **128**. The tracker is out by exactly a factor of two, and nobody in the room notices, because 256 is a plausible number for a study of this size and the formula in that cell is `=SUM(C2:C18)` — which is obviously right.

It is obviously right and it is wrong, because the range `C2:C18` contains two subtotal rows. Each of the twelve sites is counted once as a site and once again inside its country's subtotal. The formula did exactly what it was asked. The sheet asked the wrong thing.

This is not a formula lesson. Every formula in this lesson is trivial. It is a lesson about **the shape of the data those formulas run on**, because the shape is what decided the answer.

::widget{name="excel-grid" sheet="enrolment-report-layout"}

Work the first two tasks before reading on. `=SUM(C2:C18)` gives 256 and the overstatement is 128 — the entire true total, counted a second time.

## Intuition

A spreadsheet is asked to do two incompatible jobs.

**Job one is to be read by a person.** People read faster when things are grouped, when headings separate sections, when blank rows give the eye somewhere to rest, and when a subtotal sits directly under the rows it totals. Every one of those is a good decision for a reader.

**Job two is to be computed on.** A formula cannot see grouping. It cannot tell that row 12 is a different *kind* of row from row 11. It cannot read a heading and apply it to the rows underneath. All it sees is a rectangle of cells.

The report layout encodes real information — which country a site is in, which rows are detail and which are summary — in **position and appearance**. `UNITED STATES` in row 2 means "everything until the next banner is American". The two leading spaces in `"  Subtotal"` mean "this is a different kind of row". A reader decodes both instantly. A formula decodes neither.

So the question for any sheet is not "is this clear?" It is: **is every piece of information in this sheet stored as a value in a cell?** If the answer is no, then something true about the data is invisible to every tool that will ever touch it, and it will be lost at the first `SUM`.

:::why[Why does this bite so much harder in Excel than in a database?]
Because a database will not let you do it. A table has a fixed set of typed columns and no concept of a heading row, a blank row or a subtotal row living among the data. The structure is enforced before you can insert anything.

Excel enforces nothing. A cell is a cell. Text, numbers, headings, totals, notes to a colleague and a formula are all equally welcome in any position, and the grid will render all of them side by side without complaint.

That flexibility is genuinely why Excel is useful — you can start typing before you have decided on a structure. It is also why every structural mistake in this lesson is *possible*, and why none of them produces an error message.
:::

## Clinical context

Report-shaped sheets arrive in a biometrics group constantly, and usually from people whose job it was to make them readable:

| Where it comes from | The layout problem it arrives with |
|---|---|
| Enrolment tracker from clinical operations | Country banners, subtotals mixed into detail |
| Lab vendor transfer specification | Merged cells spanning the header |
| Site monitoring report | One sheet per month, same columns, twelve tabs |
| Safety review listing exported from a reporting tool | Repeated header rows every 40 lines, page footers |
| A study team's "data" workbook | Colour used to mark queried values |
| CRF or SDTM specification workbook | Multi-row headers, values split across columns |

None of these people did anything unreasonable. They built something to be *read*. The work is converting it into something that can be *computed on* — and knowing that the conversion is a real task with a real risk of silently dropping rows, not a formatting tidy-up.

:::clinical
The number in that meeting matters. An enrolment figure feeds recruitment projections, site-activation decisions, drug-supply forecasting and the enrolment-completion date in the sponsor's portfolio tracking. A tracker that overstates screening by a factor of two makes a study look on schedule when it is not.

And the error is silent in the most dangerous way: it is *proportionate*. Every country is inflated by the same mechanism, so the relative picture — which countries are ahead, which sites are slow — is unchanged and still looks sensible. Only the absolute number is wrong, and the absolute number is the one that goes into the projection.
:::

## Formal concept

### The five rules

**1. One header row, at the top, with unique names.** Row 1 is names; everything below it is data. Not two header rows, not a title in row 1 and names in row 3, not a merged cell spanning three columns above the real names.

**2. One record per row.** Every row is the same kind of thing. In the enrolment tracker a row is a site. A banner row is not a site. A subtotal row is not a site. A blank spacer is not a site. If a row is a different kind of thing, it does not belong in the rectangle.

**3. One value per cell.** `"Site 1001"` is two pieces of information — the fact that it is a site, and the number 1001 — glued together. So is `"12/210 (5.7%)"`, and so is a cell holding `"2022-07-08 08:19"` when you need the date and the time separately.

**4. No blank rows or columns inside the data.** A blank row is where Excel's own selection behaviour stops: :kbd[Ctrl]+:kbd[Shift]+:kbd[↓] halts at it, autofilter ranges end at it, and `Ctrl-T` will propose only the block above it. A sheet that looks like one table and behaves like two is worse than a sheet that looks like two.

**5. Nothing important is stored only as formatting.** Bold, colour, indentation, italics and cell borders are invisible to every formula. If "yellow means queried" is true of your sheet, then **queried** is a column you have not created yet.

### Where totals go

Totals belong **outside** the rectangle — above the header, on a separate summary sheet, or in a column to the right — never interleaved with the rows they total.

This is the single highest-value habit in the lesson, and it is free. Once no row is both a detail row and a summary row, a whole class of double-counting cannot happen, and `SUM` over the whole column is safe by construction rather than by inspection.

:::mistake[Totals at the bottom of the data, with `SUM` above them]
Putting a total row directly beneath the data looks harmless: `=SUM(C2:C19)` in `C20` does not include itself.

It stops being harmless the moment someone inserts a site. If the new row goes in at 19 the range usually grows and all is well; if it goes in at 20, directly above the total, it does not, and the total quietly excludes the newest site. Nothing errors. The number simply stops being right on the day the sheet changed.

The variant that actually caused the 256 in this lesson is worse — a total row in the *middle* of the data, where it is inside every range that spans the block.
:::

### Excel Tables

Selecting the rectangle and pressing :kbd[Ctrl]+:kbd[T] converts it into an **Excel Table**. What that buys is structural, not cosmetic:

- The table has a defined extent, so adding a row at the bottom extends every formula and every chart that references it.
- Formulas can refer to `Table1[Screened]` rather than `C2:C19`, so a reader can tell what a formula means and inserting a column does not break it.
- A Total Row can be switched on, and it lives *outside* the data range by construction — the double-counting problem is designed out.
- Every column keeps its header visible while scrolling, without needing frozen panes.

The requirement is a clean rectangle. A sheet with banner rows and blank spacers cannot be converted, which is a useful diagnostic in itself: **if `Ctrl-T` cannot make a table out of your data, the data is not yet a table.**

:::standard{kind="convention"}
The one-header-row, one-record-per-row layout is a convention rather than a rule from any standards body. It is the same shape that SDTM datasets, a database table, an R data frame and a SAS dataset all require, which is why it is the shape worth converting to: it is what everything downstream is going to demand anyway.

Structured references (`Table1[Screened]`) are an Excel feature and are not supported by the sandbox engine in this lesson, so every example here uses ordinary `A1` ranges. Use structured references in real work.
:::

## Worked example

Take the report sheet apart one broken formula at a time. Each task in the widget isolates one layout decision.

**Task 1 — `=SUM(C2:C18)` returns 256.** The two subtotal rows are inside the range. Every site is counted twice: once as itself, once inside its country's subtotal. The overstatement, 128, is exactly the true total.

**Task 3 — `=SUMIFS(D2:D18,B2:B18,"USA")` returns 0.** Column B is empty on every detail row, because the country lives in a banner. `SUMIFS` matches values in cells; there are no values to match. Note the failure mode: **not an error, a zero**. A zero in an enrolment column reads as "no subjects yet", which is a completely believable thing for a country to be.

**Task 4 — `=XLOOKUP(1011,A2:A18,D2:D18)` returns `#N/A`.** Column A holds the text `"Site 1011"`. The number `1011` and the string `"Site 1011"` are different values, and no formatting makes them equal. This one at least fails loudly.

**Task 5 — the repair.** `=VALUE(MID(A16,6,4))` recovers `1011` from `"Site 1011"` — and the hint is the real lesson. Site 1011 is on **row 16**, not row 12. The banner, the spacer and the subtotal have all shifted the rows, so every hand-written row reference in this sheet is off by an amount that depends on how many groups came before it.

:::number[Where does 256 come from, exactly?]
The nine USA sites screened 17, 17, 6, 3, 15, 8, 2, 1 and 18 subjects — 87 in total, which is what the subtotal in row 12 says. The three Canadian sites screened 9, 20 and 12 — 41, as in row 18.

$$87 + 41 = 128 \text{ subjects at twelve sites}$$

`SUM(C2:C18)` adds the twelve detail rows **and** the two subtotal rows:

$$87 + 87 + 41 + 41 = 256$$

Both subtotals are correct. The sheet is internally consistent. It is the *range* that asked for something nobody meant.

These are the first twelve sites of CBX417-301 as recorded in `oncology/sdtm/dm.csv`, where a screened subject is any subject with a DM record and a randomized subject is one with a non-missing `ARMCD`.
:::

## Data example

Here is the same information in the shape everything downstream wants — one record per subject, every attribute in its own column:

::dataset{id="oncology/sdtm/dm" cols="USUBJID,SUBJID,SITEID,COUNTRY,ARMCD,ARM" rows="8" caption="DM — one row per subject, country as a value, not a heading"}

Notice what is *not* in this dataset: no subtotals, no country banners, no blank rows, no bolding that means anything. `COUNTRY` is a column with a value on every row, repeated hundreds of times, which looks redundant to a human reader and is exactly what makes every grouped summary possible.

The enrolment tracker is this rectangle summarised, and it keeps the same discipline:

::widget{name="excel-grid" sheet="enrolment-by-site"}

One row per site. `Country` carries a value on every row. Site numbers are numbers. Nothing is bold. It is duller to read, and every one of the nine questions in that sheet has an answer.

:::why[Why repeat the country on all eighteen rows instead of writing it once?]
Because "write it once and let the position imply the rest" is precisely the choice that produced the broken report.

The repetition costs nothing — the file is a few bytes larger — and it buys the ability to filter, sort, group, pivot and `SUMIFS` on country without any of them needing to understand the layout. Sorting the sheet by `Randomized` would scramble a banner layout beyond repair; with the country on every row, sorting is safe.

The general form of the rule: **redundancy in values is cheap, and information stored in position is expensive.**
:::

## Code

The same question — subjects randomized in the USA — against the two layouts.

::::tabs
:::tab[Report layout]
```excel
=SUMIFS(D2:D18,B2:B18,"USA")
=SUM(D3:D11)
```

:::lines
1: Returns **0**. The country is a banner in column A, so column B is empty on every detail row and there is nothing for the criterion to match. It does not error; it reports zero US subjects.
2: The workaround someone writes instead: hand-pick the rows belonging to the USA block. It gives the right answer today, 70, and it is wrong the moment a thirteenth site is added or the sheet is re-sorted — because `D3:D11` means "rows 3 to 11", not "the USA".
:::
:::

:::tab[Analysable layout]
```excel
=SUMIFS(D2:D19,B2:B19,"USA")
=COUNTIF(B2:B19,"USA")
=SUM(E2:E19)
```

:::lines
1: Returns **70**. The same formula, unchanged, on a sheet where the country is a value.
2: **9** — the number of US sites. Counting sites and counting subjects are different questions, and in this layout they are different formulas over the same data rather than two different hand-picked ranges.
3: Totals the helper column `=IF(C2=D2,1,0)`, giving the **6** sites with no screen failures. A helper column is the standard answer to "`COUNTIFS` cannot compare one column against another" — and it is the better answer anyway, because a reviewer can see the per-row test and which rows it flagged.
:::
:::
::::

## Common mistakes

:::mistake[Merged cells]
A merged block behaves as a single cell whose value lives in the top-left corner and whose other cells are empty. Sorting a range containing merged cells is refused outright; filtering shows one row per merged block; a lookup down a merged column returns blanks for every row but the first.

The fix is **Center Across Selection** (Format Cells → Alignment → Horizontal), which gives the identical visual result and merges nothing. There is no case where a merged cell inside a data range is the right choice.
:::

:::mistake[Colour as data]
"Yellow means a query is open" is a real fact about the study that exists nowhere a formula can reach. It does not survive a copy-paste-values, it does not survive an export to CSV, it cannot be counted, and a colour-blind reviewer cannot read it.

If a fact is worth recording, it is worth a column. Colour it afterwards with conditional formatting driven by that column — then the colour is a *view* of the data rather than the only copy of it.
:::

:::mistake[Two things in one cell]
`"Site 1001"`, `"12/210 (5.7%)"`, `"Grade 3 - Neutropenia"`, `"2022-07-08 08:19"`. Each of these is convenient to type and has to be taken apart again by everyone downstream, with `MID` and `FIND` and a careful count of characters.

The cost is not the unpacking. It is that unpacking is done by position, and positions are exactly what changes when a site number gains a digit or a term gains a hyphen.
:::

:::mistake[One sheet per month]
Twelve tabs with identical columns is twelve tables, and every question that spans the year becomes twelve formulas plus an addition. The one-record-per-row version of "January" is a `Month` column.

This is the same error as the country banner, one level up: the information — which month a row belongs to — is stored in the *name of the sheet* rather than in the data.
:::

:::mistake[Repairing the layout by hand, every time]
Deleting the banners and subtotals by hand takes two minutes and works perfectly. Then the file is re-sent next Monday and the two minutes happen again, slightly differently, by a different person, with no record of what was removed.

If a sheet arrives in this shape repeatedly, the conversion belongs in Power Query, where the steps are recorded and re-run on the new file. That is the subject of `excel-pivots-and-when-to-stop`.
:::

## Knowledge check

::quiz{ids="excel.layout.subtotal-in-range,excel.layout.banner-country,excel.layout.merged-cells,excel.layout.colour-as-data"}

## Hands-on exercise

::practice{ids="excel.layout.overstatement,excel.layout.site-text,excel.layout.rules-classify,excel.layout.repair-order" title="Practice: taking a report-shaped sheet apart"}

## Challenge exercise

::practice{ids="excel.layout.silent-zero,excel.layout.hotspot,excel.layout.open-handover" title="Challenge: the failure that reports a number instead of an error"}

## Industry note

**Excel is a legitimate and widely used format for specifications in this industry.** SDTM and ADaM specification workbooks, TLF shells, CRF annotation trackers and define.xml source documents are routinely maintained as Excel files, and a programming team may read a spec workbook with a script to generate code. That work is far easier when the spec itself is one header row and one record per row — one row per variable, with `Dataset`, `Variable`, `Label`, `Type`, `Length`, `Origin` and `Derivation` as columns.

A spec workbook laid out for reading — merged headers, a section banner per domain, notes in a column that is sometimes a note and sometimes a derivation — cannot be read by a script, and the team writes the code by hand instead. The layout decision made by the person who built the spec determines whether downstream automation is possible at all.

**The reverse conversion is also a real skill.** Nobody wants to read a 420-row rectangle at a meeting. The analysable sheet is the *source*; the grouped, subtotalled, banner-headed version is a *view* built from it with a PivotTable — which produces exactly the readable layout everyone wanted, without anyone hand-typing a subtotal into the middle of the data.

:::interview[They hand you a workbook and ask you to "just add a column"]
The answer they are listening for is that you looked at the sheet before you touched it.

"First I'd check whether it is actually one table. I'd look for blank rows and columns inside the range, for subtotal or section rows mixed in with the detail, for merged cells, and for anything that is only true because of formatting — a colour that means something, or an indent that marks a different kind of row.

The quickest test is `Ctrl-T`: if Excel cannot make a table out of it, it is not a rectangle, and I need to know what the non-rectangular parts mean before I add anything.

Then I'd check what the existing totals are actually summing. A `SUM` over a range containing a subtotal row double-counts, and it gives a plausible number rather than an error, so it will have survived every review so far.

And I'd ask who else uses the file and how it arrives. If it comes in this shape every month, the fix is a Power Query transformation with recorded steps rather than me cleaning it by hand and creating a version nobody else has."
:::
