## What problem are we trying to solve?

A medical monitor asks what adverse events subject 1001-0002 had. You have the AE listing in a sheet, so you write the obvious thing:

```excel
=XLOOKUP("1001-0002",A2:A2467,B2:B2467)
```

`Diarrhea`.

The subject had **five** adverse events: diarrhea, two episodes of stomatitis, tiredness and nausea. The formula returned the first one and said nothing about the other four. It did not error, it did not warn, and there is nothing in the cell to suggest the answer is incomplete.

The formula was right. The question was wrong — and the reason this is worth a lesson is that the question is wrong in a way the tool actively conceals.

::widget{name="excel-grid" sheet="ae-lookup"}

Run the first two tasks. `XLOOKUP` gives `Diarrhea`; `=COUNTIF(A2:A11,"1001-0002")` gives **5**. Running the second one beside every lookup you write is the cheapest guard in this lesson.

## Intuition

A lookup is a **left join**, written one cell at a time.

`XLOOKUP(key, key_column, value_column)` is `LEFT JOIN … ON key` with the result restricted to one column and one row. Everything a join does, a lookup does — except for the two things a join makes you confront and a lookup lets you skip.

**A join fans out; a lookup does not.** Joining CBX417-301's DM against AE produces **2,520 rows** from DM's 468 subjects, because 2,466 AE records spread across 414 subjects and 54 subjects contribute a single row with nothing in it. The row count changing is impossible to miss. A lookup produces exactly 468 rows no matter what — one per subject, because that is how many cells you filled down — so the duplicate keys never announce themselves.

**A join tells you what did not match; a lookup hands you `#N/A` and waits.** In SQL an unmatched left-hand row arrives with `NULL` columns and you can count them. In Excel the equivalent is 54 cells reading `#N/A`, which most people wrap in `IFNA` within about a minute, at which point the information is gone.

> A lookup gives you the shape you asked for. A join gives you the shape the data has.

:::why[If a lookup is a join, why does everyone say joins are harder?]
Because a join asks its questions up front and a lookup asks them never.

Writing a join, you have to decide what to do about duplicate keys — that is what `relationship = "one-to-many"` in dplyr, or a `MERGE` without a unique `BY`, is forcing you to think about. You have to decide whether unmatched rows are kept, dropped or an error. Those decisions feel like overhead.

They are not overhead. They are the analysis. A lookup does not remove the decisions; it makes them silently, always the same way — first match, `#N/A` for no match — and does not tell you which case you were in.
:::

## Clinical context

Nearly every question a biometrics group asks of two datasets is a join:

| Question | The join |
|---|---|
| What arm is this subject on? | AE → DM, one-to-one on `USUBJID` |
| What is each subject's first dose date? | AE → DM on `USUBJID`, for `AESTDY` |
| Is this lab value above the upper limit of normal? | LB → reference ranges on test and sex |
| Did every randomized subject get study drug? | DM → EX, and the **unmatched** rows are the finding |
| Does the vendor file contain every subject EDC has? | EDC → vendor, and again the unmatched rows are the finding |

Notice the last two. **In a QC context the unmatched rows are not a nuisance, they are the result.** A reconciliation that suppresses `#N/A` has suppressed its own output.

:::clinical
"Did every randomized subject get study drug?" is a real question with a real answer on this study: 420 subjects were randomized and 416 were treated. Four randomized subjects have no exposure record.

Run it as a lookup with `IFNA(…,"")` and the answer is a column with four blanks in it, which looks like a formatting quirk. Run it as a join and it is four rows in an exceptions listing with subject ids on them, which is what the data manager needs in order to query the sites.

Same data, same key, same comparison. The difference is entirely in what happens to the rows that do not match.
:::

## Formal concept

### The three forms

```excel
=XLOOKUP(key, key_range, return_range, [if_not_found])
=INDEX(return_range, MATCH(key, key_range, 0))
=VLOOKUP(key, table, column_number, FALSE)
```

All three do the same thing. They differ in how easy they are to get wrong.

| | `XLOOKUP` | `INDEX`/`MATCH` | `VLOOKUP` |
|---|---|---|---|
| Default match type | **Exact** | `MATCH` needs `0` for exact | **Approximate** if the 4th argument is omitted |
| Return column identified by | A range | A range | A **position number** |
| Survives a column being inserted | Yes | Yes | **No** |
| Can return a column left of the key | Yes | Yes | No |
| Built-in not-found handling | `if_not_found` | No | No |

**`VLOOKUP`'s fourth argument is the single most consequential default in Excel.** Omit it and you get *approximate* match, which assumes the key column is sorted ascending and returns the largest value less than or equal to your key. On unsorted data it returns something arbitrary — a real value, from the wrong row, with no error.

`XLOOKUP` defaults to exact match. That is the main reason to prefer it, ahead of every convenience it adds.

:::mistake[`=VLOOKUP(key, table, 7, TRUE)` on unsorted data]
The `7` is a count of columns from the left of the table, so inserting a column anywhere in the first seven silently changes which column is returned. Nothing errors; the values simply come from a neighbouring column, and if both columns are numeric nothing looks wrong.

The `TRUE` — or an omitted fourth argument, which means the same thing — is worse. It is a binary search over a column assumed to be sorted. On unsorted data the result is not "the nearest match"; it is whatever the search happens to land on.

Both failures produce plausible values. If you inherit a workbook full of `VLOOKUP`, checking the fourth argument of every one of them is a reasonable first afternoon.
:::

### Duplicate keys

A key that repeats is not an error. In clinical data it is the normal case — AE, LB, VS, EX and CM all have many rows per subject, and only DM and ADSL have one.

The problem is that the lookup gives the same answer whether the key is unique or not:

```excel
=XLOOKUP("1001-0002",A2:A11,B2:B11)     → Diarrhea
=COUNTIF(A2:A11,"1001-0002")            → 5
```

**Write the second one.** It is one extra column, it takes no thought, and it converts an invisible assumption into a visible number. A lookup whose `COUNTIF` is above 1 is answering "one of the matches", and you now know it.

:::number[Where do 2,520 rows come from?]
`oncology/sdtm/dm.csv` has **468** rows — one per subject, including the 48 screen failures. `oncology/sdtm/ae.csv` has **2,466** rows across **414** subjects.

A left join from DM to AE keeps every DM row and multiplies it by its number of AE matches:

$$2466 + \underbrace{54}_{\text{subjects with no AE}} = 2520$$

The 54 are 48 screen failures, who were never dosed, plus **6 randomized subjects who genuinely had no adverse event recorded** — which is a fact about the study, not a data problem, and one you would never see from a lookup.

Filling an `XLOOKUP` down beside DM gives 468 rows whatever the AE table contains. The row count carries no information, which is exactly why nothing looks wrong.
:::

### Unmatched rows, and what `IFNA` costs

`#N/A` means *this key is not in the other table*. That is a finding, and in a reconciliation it is the finding.

```excel
=IFNA(XLOOKUP(A2,vendor_ids,vendor_alt),"Missing")
```

This is the right formula — but only because it writes `Missing` rather than `""`. A visible marker can be counted with `COUNTIF(range,"Missing")`; an empty string looks like a cell nobody filled in.

And notice what neither version tells you: whether the subject is **absent from this table** or **absent from the study**. Those are different findings with different owners — the first goes to the vendor, the second to the site — and distinguishing them needs a second lookup in the other direction.

:::standard{kind="simplification"}
This lesson treats a lookup as a left join and stops there, because that covers almost everything a spreadsheet is asked to do.

What is left out: inner joins (drop the unmatched rows), full outer joins (keep both sides' unmatched rows — which is what a proper two-way reconciliation needs, and takes two lookups in Excel), and multi-column keys, which have no native form here. The usual spreadsheet workaround for a compound key is a helper column concatenating the parts with a separator, `=A2&"|"&B2`, and the separator matters: without one, `12`&`34` and `1`&`234` are the same key.
:::

## Worked example

The `ae-lookup` sheet is ten AE rows for three subjects — 1001-0002 with five, 1001-0003 with one, 1001-0004 with four. The key is `Subject` and it is not unique, which is the point.

**The lookup and its guard.** `=XLOOKUP("1001-0002",A2:A11,B2:B11)` returns `Diarrhea`; `=COUNTIF(A2:A11,"1001-0002")` returns `5`.

**The same thing with `INDEX`/`MATCH`.** `=INDEX(B2:B11,MATCH("1001-0004",A2:A11,0))` returns `Back pain`. `MATCH` finds the position — 7 — and `INDEX` turns the position into a value. Seeing it in two steps makes it obvious that the position is the *first* position and there was never anything to indicate a second.

**The row that is not there.** Subject 1001-0001 is a screen failure: in the study, never dosed, no adverse events.

```excel
=IFNA(XLOOKUP("1001-0001",A2:A11,B2:B11),"No AE recorded")   → No AE recorded
=COUNTIF(A2:A11,"1001-0001")                                 → 0
```

`No AE recorded` is a fair description here, and it would be a false one if the subject were missing from the file by mistake. The formula cannot tell the two apart. Only knowing that the subject exists in DM can.

**Counting subjects instead of rows.** Column E carries `=IF(COUNTIF($A$2:A2,A2)=1,1,0)`, which is 1 on a subject's first row and 0 afterwards, and `=SUM(E2:E11)` gives **3**. Ten rows, three subjects.

That helper is the standard spreadsheet answer to a distinct count, and it is worth understanding rather than memorising: the range `$A$2:A2` is anchored at the top and open at the bottom, so as the formula fills down it looks at *everything above and including this row*. A subject appearing for the first time has a count of 1.

**The lookup run backwards.** `=XLOOKUP("Nausea",C2:C11,A2:A11)` returns `1001-0002`, and `=COUNTIF(C2:C11,"Nausea")` returns 2. The same trap, in the direction people trust more, because "which subject had X" feels like a question with one answer.

:::mistake[Coded term and verbatim term are not interchangeable]
In these ten rows, `=COUNTIF(C2:C11,"Fatigue")` gives **2** and `=COUNTIF(B2:B11,"Fatigue")` gives **1**.

Column C is the MedDRA preferred term; column B is what the site typed. Two different verbatim terms — `Tiredness` and `fatigue` — code to the same preferred term, and `COUNTIF` on the verbatim column can only match the spelling it was given.

Across the whole study the gap is much wider: 202 AE records code to the preferred term `Fatigue`, and the sites typed them as `fatigue`, `Fatigue`, `FATIGUE`, `Feeling tired`, `tiredness` and `Tiredness`. **This is what coding is for**, and it is why every safety table is built on the coded term.
:::

## Data example

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AETERM,AEDECOD,AESTDTC,AETOXGR,AESER" rows="8" caption="AE — many rows per subject, so USUBJID alone is not a key"}

`USUBJID` is not unique in AE. The key is `USUBJID` plus `AESEQ`, and the same is true of every findings and events domain. Only DM and ADSL have one row per subject, which is precisely why they are the datasets everything else looks *up against* rather than *from*.

The direction matters and is easy to get backwards:

- **AE → DM is safe.** Every AE row has exactly one subject, so a lookup of `ARM` onto the AE listing gives one right answer per row.
- **DM → AE is not.** Every subject has zero, one or many AE rows, and a lookup collapses that to one silently.

**The test is mechanical: `COUNTIF` the key in the table you are looking *into*.** If the maximum is 1, the lookup is a complete answer. If it is above 1, the lookup is one of several answers and you need an aggregation — `COUNTIFS`, `SUMIFS`, `MAXIFS` — rather than a lookup at all. That is the next lesson.

::widget{name="excel-grid" sheet="enrolment-by-site"}

The enrolment tracker is the safe direction: one row per site, so `=XLOOKUP(1011,A2:A19,B2:B19)` returning `CAN` is a complete answer. Note the lookup key is the **number** 1011 and it works because the site column holds numbers. Against the report-shaped sheet from the layout lesson, where sites are stored as `"Site 1011"`, the identical formula returns `#N/A`.

## Code

The same left join, four ways, with attention to what each does about duplicates.

::::tabs
:::tab[Excel]
```excel
=XLOOKUP(A2,ae_subject,ae_term,"No AE recorded")
=COUNTIF(ae_subject,A2)
```

:::lines
1: Returns the first matching AE term, or a visible marker when there is none. Filling this down beside DM gives 468 rows regardless of what AE contains.
2: The guard. Without it, nothing distinguishes a subject with one AE from a subject with seventeen. In this study the maximum is **17**.
:::
:::

:::tab[SQL]
```sql
SELECT dm.usubjid, ae.aeterm
FROM   dm
LEFT JOIN ae ON ae.usubjid = dm.usubjid;
```

:::lines
3: Produces **2,520** rows from DM's 468 — the fan-out is unmissable. Unmatched subjects arrive with `aeterm` as `NULL`, and `COUNT(*) WHERE aeterm IS NULL` gives the 54.
:::
:::

:::tab[R]
```r
j <- dplyr::left_join(dm, ae, by = "USUBJID",
                      relationship = "one-to-many")

stopifnot(nrow(j) == 2520)
sum(is.na(j$AETERM))     # 54
```

:::lines
1-2: `relationship` makes the expectation explicit and errors if the data disagrees — for example if `dm` turned out to have duplicate subjects. Stating it is how you find out that your mental model of the keys is wrong.
4: Assert the row count. A join is a place where rows appear, and asserting the count is the cheapest way to notice.
:::
:::

:::tab[SAS]
```sas
proc sort data=dm;  by usubjid;  run;
proc sort data=ae;  by usubjid;  run;

data dm_ae;
  merge dm(in=a) ae(in=b);
  by usubjid;
  if a;
  no_ae = not b;
run;
```

:::lines
6: `MERGE` with `IN=` flags. `IF A` keeps every DM row, which is the left join.
8: `NO_AE` flags the 54 subjects with no AE record. **`IN=` flags are how you avoid the silent version of this in SAS** — without them, unmatched rows are kept and look identical to matched ones with missing values.
:::
:::
::::

Every non-Excel version makes the fan-out visible in the row count and the non-matches countable. The Excel version makes both invisible unless you add the second formula yourself.

## Common mistakes

:::mistake[The key is a number on one side and text on the other]
The most common lookup failure in clinical work, and it produces `#N/A` on every row, which people read as "the data is missing".

Excel's comparison operators are type-aware: `1011` is never equal to `"1011"`, and no number format changes that. It happens whenever one file was opened in Excel and the other was not, or whenever one sheet stores sites as `"Site 1011"`.

Diagnose it with `=ISNUMBER(A2)` on both sides. Fix it by converting one side with `VALUE` or `TEXT` — and then ask why the two files disagree, because that is usually an import problem upstream.
:::

:::mistake[Wrapping every lookup in `IFERROR`]
`IFERROR` catches `#N/A` *and* `#REF!`, `#VALUE!`, `#DIV/0!` and everything else. A lookup pointing at a deleted range returns `#REF!`, and `IFERROR` turns it into your not-found text — so a structurally broken formula reports the same thing as a legitimately absent subject.

Use `IFNA`. It catches only `#N/A`, which is the only error a working lookup should ever produce.
:::

:::mistake[`IFNA(…, "")` in a reconciliation]
An empty string is indistinguishable from a cell nobody filled in. `COUNTIF(range,"")` will not give you a clean count of unmatched rows, and the exceptions cannot be filtered out for a listing.

Write a marker — `"Missing"`, `"Not in vendor file"` — so the unmatched rows stay countable and nameable.
:::

:::mistake[Looking up on a name instead of an id]
Site names, investigator names, treatment labels and verbatim AE terms all vary by whitespace, case, punctuation and spelling. `"Northvale Media"` and `"NORTHVALE MEDIA"` are the same supplier in two of this project's manufacturing exports.

`COUNTIF` and `XLOOKUP` both match text case-insensitively, so case alone will not break them — but a trailing space, a double space or a hyphen will, and none of those are visible. Look up on the id.
:::

:::mistake[Copying a lookup down without absolute references]
`=XLOOKUP(A2,G2:G500,H2:H500)` filled down becomes `G3:G501` on the next row, so the search range walks off the bottom of the data and rows near the end stop finding matches.

Anchor the ranges — `$G$2:$G$500` — or use an Excel Table, where a column reference does not shift at all.
:::

## Knowledge check

::quiz{ids="excel.lookup.first-match,excel.lookup.vlookup-default,excel.lookup.ifna-vs-iferror,excel.lookup.direction"}

## Hands-on exercise

::practice{ids="excel.lookup.fanout,excel.lookup.guard,excel.lookup.compare-forms,excel.lookup.distinct-helper" title="Practice: the lookup and the guard beside it"}

## Challenge exercise

::practice{ids="excel.lookup.silent-first,excel.lookup.hotspot,excel.lookup.open-join" title="Challenge: when the lookup answered a different question"}

## Industry note

**The shape of your data decides which tool is honest.** A spreadsheet is fine for a one-to-one lookup — attaching arm and sex to a listing from DM, attaching a reference range to a lab result. It stops being honest the moment the key repeats, because the tool's default behaviour is to hide that and its output has a fixed row count that tells you nothing.

That is not an argument against Excel. It is an argument for knowing which case you are in, and `COUNTIF` on the key answers it in one formula.

**In a QC or reconciliation context the unmatched rows are the deliverable.** A discrepancy report lists what is in EDC and not the vendor file, and what is in the vendor file and not EDC — two lookups in opposite directions, both of which have to *keep* their `#N/A` rather than suppress them. A reconciliation built out of `IFNA(…,"")` cannot produce that report at all, and will look like it succeeded.

**Where a lookup is genuinely better than a join** is exploratory work: one subject, one value, right now, without writing a query. That is a real use and the reason lookups are so heavily used. The failure mode is when it stops being one value and becomes a column filled down 468 rows, feeding a number that goes into a document — at which point it is a join, and it should be checked like one.

:::interview[Your lookup returns a value, and the number in the table is still wrong]
"I'd check three things, in order, because they fail differently.

First, whether the key is unique in the table I'm looking into. `COUNTIF` on the key column — if the maximum is above 1, the lookup returned the first of several matches and did not mention it. In clinical data that is the normal case: AE, LB and EX all have many rows per subject, and only DM and ADSL have one. If the key repeats, I don't want a lookup at all, I want `SUMIFS` or `COUNTIFS`.

Second, whether the `#N/A` rows were suppressed. If the formula is wrapped in `IFNA` with an empty string, unmatched subjects look like empty cells and get read as zero or as nothing. I'd count them explicitly. And I'd use `IFNA` rather than `IFERROR`, because `IFERROR` would also swallow a `#REF!` from a broken range and report it as a missing subject.

Third, the types on both sides. If one file came through Excel and the other didn't, one key may be the number 1011 and the other the text `\"1011\"`, and those never compare equal. `ISNUMBER` on both sides tells me in one formula.

And if it is `VLOOKUP`, I'd check the fourth argument before anything else. Omitted means approximate match, which on unsorted data returns a real value from an arbitrary row with no error at all."
:::
