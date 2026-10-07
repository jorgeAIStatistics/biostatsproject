## What problem are we trying to solve?

You need to check one batch date. The file is `batch_export_2023Q3_upgraded.csv`, it is sitting in a shared folder, and you double-click it.

Excel opens it. Nothing happens — no dialog, no warning, no message bar. You find your date, close the file, and Excel asks whether to keep the CSV format. You click yes, because of course you want to keep the CSV format.

Here is what happened in between.

That file writes dates as **DD/MM/YYYY**. Your machine reads them as **MM/DD/YYYY**. Of the first ten rows:

- Five dates were silently converted to a **different, valid, wrong date**. Batch `HBX14-2023-043` started on 4 July 2023; the cell now holds 7 April 2023.
- Five could not be read as `MM/DD` at all — there is no fifteenth month — so they were left as text. The column is now half dates and half strings.
- Saving rewrote the file with whatever each cell displays.

No formula errored. No row was lost. The file still opens, still looks like a batch export, and is now wrong in a way that no amount of re-opening will reveal.

::widget{name="excel-grid" sheet="import-damage"}

Work the first two tasks. `COUNT` over the imported column gives **5**, not 10 — and the five missing ones are the five you can still repair.

## Intuition

Excel has no idea what your file is. A CSV carries no types: every field is a string of characters, and something has to decide whether `1001` is a count, a site number or a label, and whether `04/07/2023` is in July or April.

The decision procedure is simple and it is the source of everything in this lesson:

> **A value that can be read as a number will be read as a number. A value that can be read as a date will be read as a date. Otherwise it stays text.**

"Can be read as" is evaluated against the machine's regional settings, not against the file. The same file, opened by two colleagues in two countries, produces two different sets of values, and neither colleague sees anything unusual.

Notice what this rule is not: it is not a bug, and it is not fixable by being careful. It is Excel doing the thing that makes it pleasant to use — you type `3/4` and get a date, you type `007` and get 7 — applied to a file whose author had no say in the matter.

:::why[Why does this feel worse than an error?]
Because the outputs are all *valid*. 7 April 2023 is a real date. 7 is a real number. There is no state the cell ends up in that looks broken.

A tool that refused the file would cost you ten minutes. A tool that quietly produces plausible values costs you the assumption that opening a file is a read-only act — and that assumption is the reason nobody re-checks a file they only looked at.
:::

## Clinical context

The values at risk in clinical data are almost entirely **identifiers and dates**, which is to say the two things every other dataset joins on.

| Value | What a default open does |
|---|---|
| `1001-0002` (subject id) | Survives — cannot be read as a number |
| `CL97026619` (lab accession) | Survives — starts with letters |
| `1001` (site number) | Becomes the **number** 1001, and stops matching the text `"1001"` |
| `007` (site number in another study) | Becomes 7 |
| `2.0` (ICF version) | Becomes 2 |
| `2022-05-17` | Becomes a date — correctly, because ISO 8601 is unambiguous |
| `04/07/2023` | Becomes a date — possibly the wrong one |
| `15/07/2023` | Stays text on a US-locale machine |
| A 16-digit specimen barcode | Loses its sixteenth digit permanently |

::widget{name="excel-grid" sheet="identifier-damage"}

:::clinical
Two of these have consequences that reach beyond the spreadsheet.

**A shifted date changes a derived study day.** An adverse event that Excel moved from 4 July to 7 April does not just have a wrong date; it has a wrong study day, possibly a negative one, and it may cross the boundary between a pre-treatment and a treatment-emergent event. The TEAE flag is derived from the date, so the safety table changes.

**A broken identifier breaks a join.** A subject whose id lost a leading zero does not appear in a merge against a file where the zero survived. They do not error — they are simply absent from the merged dataset, and the count goes down by one in a table nobody is checking against the randomization list.
:::

## Formal concept

### Reversible, recoverable and gone

Not all damage is equal, and the distinction decides what you do next.

**Reversible — it is only a format.** Scientific notation on screen (`1.00E+15`) is a *display* choice for a General-format cell that is too narrow or too large. The stored number is intact; widening the column or changing the format restores it. This one causes far more alarm than it deserves.

**Recoverable, if you know what was lost.** A stripped leading zero can be rebuilt: `=RIGHT("0000"&C2,4)` turns 107 back into `"0107"`. But only because you know the id is four characters. Nothing in the cell records that, and if two studies in the same file have three- and four-digit sites, nothing tells you which is which.

**Gone.** Two cases, and both are worth knowing precisely:

- **Past 15 significant digits.** Excel stores numbers as IEEE 754 doubles and keeps 15 significant decimal digits. A 16-digit barcode `4519026317480935` becomes `4519026317480930`. The digit is not hidden; it does not exist any more.
- **Text converted to a date, then saved.** Once `04/07/2023` has become the serial number for 7 April and the file has been written back, the only record of what the author meant is the author.

:::number[Why 15 digits, and why does a date come out as a number at all?]
Both follow from one decision: Excel stores every number as a 64-bit IEEE 754 double. That gives about 15–17 significant decimal digits, and Excel truncates at 15 for consistency of display.

Dates are stored in the same numeric type — **whole days since 1899-12-30**, so `2022-07-08` is the number **44750**. The date-ness is a number format, not a type. That is why a date can be subtracted, why a number can be made to look like a date, and why a partial date like `2023-01` cannot be stored as a date at all.

`excel-dates-and-study-day` takes that apart properly, including why the epoch is 1899-12-30 rather than 1899-12-31.
:::

### Importing without any of it

Double-clicking a CSV applies every conversion. **Data → Get Data → From Text/CSV** does not — it opens a preview with a `Data Type Detection` dropdown, and choosing **Do not detect data types** loads every column as text, exactly as written in the file.

From there, you convert deliberately:

- Set each column's type yourself in the Power Query editor, so identifiers stay text and only real numbers become numbers.
- For a date column in a known regional format, use **Change Type → Using Locale** and name the locale. That is the correct fix for `04/07/2023` — you tell Power Query the column is a date in English (United Kingdom), and all ten rows convert correctly, including the five that a default open left as text.
- Every step is recorded in the Applied Steps list and re-runs on next quarter's file.

Recent versions of Excel for Windows also have **File → Options → Data → Automatic Data Conversion**, with individual switches for removing leading zeros, truncating numeric data to 15 digits, converting digits around an `E` to scientific notation, and converting letter-and-digit combinations to dates. It is per-user, not per-file, so it protects you and not the colleague you send the file to.

:::standard{kind="convention"}
Nothing here is a regulatory requirement. Using Power Query with explicit column types rather than double-clicking a CSV is a working practice, and a good one, because the conversions it prevents are silent and the steps it records are the only audit trail an Excel import has.

The genuinely safe option is not to open the file in Excel at all — read it in R, Python or SAS with every column forced to character, and convert deliberately. That is what a programming group does with a vendor transfer, and it is why vendor transfers are specified in a transfer agreement rather than emailed as spreadsheets.
:::

## Worked example

Three questions against the batch-export sheet.

**How much of the column is real?** `=COUNT(C2:C11)` gives 5, `=COUNTA(C2:C11)-COUNT(C2:C11)` gives 5. A column that is half numbers and half text will sort into two blocks, will not compare correctly against a date, and is invisible to `MIN` and `MAX` for the text half.

**What is row 2 now?** `=TEXT(C2,"yyyy-mm-dd")` gives `2023-04-07`. The true date is 2023-07-04. `=C2-DATE(2023,7,4)` gives **−88**: the batch moved back nearly three months, into the previous quarter.

**Can it be repaired?** For the text rows, yes, because the original characters are still there:

```excel
=TEXT(DATE(VALUE(MID(B5,7,4)),VALUE(MID(B5,4,2)),VALUE(MID(B5,1,2))),"yyyy-mm-dd")
```

giving `2023-07-15`. The same formula on row 2 gives `2023-07-04` — **but only because column B still holds the original text.** Open the CSV directly and column B does not exist. There is one column, it holds 7 April, and nothing in the workbook knows that is wrong.

:::mistake[Checking a sample of rows and concluding the import is fine]
Spot-check five rows of this file and you may well check five of the fourteen unambiguous ones, see text that matches the file exactly, and conclude nothing was converted.

**A mixed column is the normal outcome, not the exception.** In the full quarter file, 14 of 22 dates have a day above 12 and stay text; 8 have both parts below 13 and convert. The proportion depends entirely on which days of the month the batches happened to start on.

The check that works is `COUNT` against `COUNTA` on the whole column: if a date column is not entirely numbers, stop.
:::

## Data example

The manufacturing raw folder is twelve quarterly exports of the same 240 batches, and it is a fair sample of what arrives in real life:

```text
batch_export_2023Q1_historian.csv     ISO dates, UPPER_SNAKE headers
batch_export_2023Q3_upgraded.csv      3 preamble lines, Title Case headers, DD/MM/YYYY
batch_export_2023Q4_fahrenheit.csv    temperatures in °F
batch_export_2024Q1_snake.tsv         tab-separated, lower_snake headers
batch_export_2024Q3_lims.csv          3 preamble lines, CamelCase headers, MM/DD/YYYY
```

**Two of these files use slash dates and they disagree with each other.** In the Q3 2023 file, `04/07/2023` is the fourth of July; in the Q3 2024 file, `07/03/2024` is the third of July. Both are real files in the same folder, both look identical in Excel, and the only evidence for which is which is that the batches have to fall inside the quarter the file is named after.

```text
batch_export_2023Q3_upgraded.csv   04/07/2023 →  2023-07-04   (DD/MM)
batch_export_2024Q3_lims.csv       07/03/2024 →  2024-07-03   (MM/DD)
```

::dataset{id="oncology/sdtm/dm" cols="USUBJID,SUBJID,SITEID,RFICDTC,RFSTDTC,BRTHDTC" rows="6" caption="DM — ISO 8601 dates and a hyphenated subject id, both of which survive an import intact"}

The clinical datasets in this project are safer than the manufacturing exports, and it is worth being precise about why rather than relaxing. `RFSTDTC` is ISO 8601, which has no ambiguous reading. `SUBJID` contains a hyphen between digits, which stops it being a number. `SITEID` is four digits with no leading zero, so stripping zeros has nothing to strip.

**None of that is a property of clinical data. It is a property of these particular conventions**, and the study that numbers its sites `007` or its visits `01` has none of the protection.

## Code

The same file, read four ways.

::::tabs
:::tab[Power Query]
```text
Data → Get Data → From Text/CSV → batch_export_2023Q3_upgraded.csv

  Data Type Detection:  Do not detect data types
  Transform Data
    Remove Top Rows                 3        (the report preamble)
    Use First Row as Headers
    Change Type → Using Locale
       Start Date  →  Date  →  English (United Kingdom)
  Close & Load
```

:::lines
3: Everything arrives as text. Nothing has been converted yet, so nothing has been lost yet.
5: The preamble lines are removed as a recorded step, not by deleting rows by hand. Next quarter's file gets the same treatment automatically.
7-8: **The one line that matters.** Naming the locale converts all 22 dates correctly — including the fourteen a default open would have left as text — because Power Query is told the format instead of guessing it.
9: Applied Steps is the audit trail. Someone else can read what was done to the file without asking you, and next quarter's file gets the same treatment on a refresh.
:::
:::

:::tab[R]
```r
raw <- readr::read_csv(
  "batch_export_2023Q3_upgraded.csv",
  skip = 3,
  col_types = readr::cols(.default = readr::col_character())
)

raw$START_DATE <- as.Date(raw$`Start Date`, format = "%d/%m/%Y")
```

:::lines
3: Every column as character. The conversion decisions are then yours, explicitly, in code someone can review.
7: `%d/%m/%Y` states the format. `as.Date` with an explicit format returns `NA` rather than a wrong date if the file is not what you said it was — a failure you can test for.
:::
:::

:::tab[Python]
```python
import pandas as pd

raw = pd.read_csv(
    "batch_export_2023Q3_upgraded.csv",
    skiprows=3, dtype=str, keep_default_na=False,
)

raw["START_DATE"] = pd.to_datetime(raw["Start Date"], format="%d/%m/%Y")
```

:::lines
5: `dtype=str` forces every column to text; `keep_default_na=False` stops strings like `NA` and `NULL` becoming missing values, which matters when a coded value legitimately reads `NA`.
8: An explicit `format` raises on anything that does not match, instead of falling back to a guess per row.
:::
:::
::::

Three different tools, one shared idea: **read everything as text, then convert on purpose.**

## Common mistakes

:::mistake[Opening a CSV to "just look at it"]
Opening applies every conversion. Saving writes the converted values back over the file — and for dates, Excel writes what the cell *displays*, so an ISO column can come back as `5/17/2022`.

If you only want to look, open a copy, or use a text editor, or `head` the file at a terminal. If you press :kbd[Ctrl]+:kbd[S] out of habit you have edited a source file with no record of the edit.
:::

:::mistake[Fixing scientific notation by changing the number format]
Sometimes right, sometimes a false comfort. If the value is `1.00E+15` because the column is narrow, widening it restores the digits. If the value had more than 15 significant digits when it was parsed, the format change reveals a number ending in zeros — and those zeros are what is stored.

Compare against the file, not against the screen.
:::

:::mistake[Assuming ISO dates are safe in every direction]
`2022-05-17` imports correctly. It does not necessarily *export* correctly: if the cell is displayed as `17/05/2022`, that is what a CSV save writes, and the next system to read the file inherits the ambiguity you were protected from.

Force the display format back to `yyyy-mm-dd` before saving anything that another system will read.
:::

:::mistake[Trusting a colleague's copy of the same file]
The conversions depend on regional settings, so two colleagues can open the identical file and end up with different values — one with dates, one with text, and neither with any indication of it.

"It works on my machine" is a literal statement here, not a joke. Compare against the file.
:::

:::mistake[Repairing the import by hand each time]
The fix that ends the problem is a recorded import — Power Query steps, or a script — because the file arrives again next quarter. Hand-repairing is not wrong; it is just not finished, and the second person to do it will not do it the same way.
:::

## Knowledge check

::quiz{ids="excel.import.mixed-column,excel.import.reversible,excel.import.numeric-rule,excel.import.locale-direction"}

## Hands-on exercise

::practice{ids="excel.import.days-wrong,excel.import.map-damage,excel.import.safe-order,excel.import.barcode" title="Practice: measuring and repairing the damage"}

## Challenge exercise

::practice{ids="excel.import.two-files,excel.import.hotspot,excel.import.open-transfer" title="Challenge: two files, two date formats, one folder"}

## Industry note

**This is a documented, industry-scale problem, not a personal carelessness problem.** In 2020 the HUGO Gene Nomenclature Committee renamed a set of human gene symbols — `SEPT1`, `MARCH1` and others — because Excel kept converting them to dates and the converted values were propagating into published supplementary data. The standards body changed the identifiers rather than expect every spreadsheet user in genomics to remember. That is a reasonable read of where the leverage is.

**In clinical work the analogous decision is made in the transfer specification.** A lab or imaging vendor transfer agreement names the file format, the delimiter, the date format — ISO 8601, normally, precisely because it has one reading — the character encoding, and the identifier format. It exists so that neither side is guessing, and so that a discrepancy is a contractual failure rather than a mystery.

**Where Excel is genuinely the right tool** is looking at a file, not processing it: checking a handful of values, showing a column to a colleague, sanity-checking a count. The rule that keeps that safe is that the workbook is a **dead end** — nothing is saved back, and no file downstream was produced from it.

:::interview[A vendor sends a CSV and asks you to confirm the subject count]
"I wouldn't open it in Excel first. Opening a CSV applies every conversion Excel is capable of — leading zeros stripped, long identifiers truncated at 15 significant digits, anything that parses as a date converted using my machine's regional settings — and none of it warns.

For a count, I'd read it with every column forced to character: `read_csv` with `col_types = cols(.default = col_character())`, or `dtype=str` in pandas. Then I'd count distinct subject ids and compare against what the vendor said, and separately check for ids that differ only by whitespace or case, because those inflate a distinct count silently.

If I did need it in Excel — say to show someone — I'd use Data → From Text/CSV with data type detection off, so identifiers stay text and I decide what becomes a date.

And I'd check the transfer specification for the date format. This project's manufacturing folder has two files in it that both use slash dates, one DD/MM and one MM/DD, and the only way to tell them apart is that the batches have to fall inside the quarter the file is named after. If the spec doesn't state the format, that's the finding, and it's worth more than the count."
:::
