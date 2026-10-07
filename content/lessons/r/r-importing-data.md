## What problem are we trying to solve?

You read the study's ADSL and start work. Three things have already gone wrong and you cannot see any of them:

```r
adsl <- read.csv("data/cardio/adsl.csv")

class(adsl$SITEID)   # "integer"   <- site "007" is now 7
class(adsl$RANDDT)   # "character" <- a date that will not subtract
class(adsl$LBSTRESN) # "character" <- because row 3,481 says "NOT DONE"
```

**Site 007 has become 7.** If any site identifier has a leading zero, it is gone, and a merge against a file that kept it as text will match nothing.

**The randomization date is a string.** `TRTSDT - RANDDT` fails, or worse, works after a silent coercion and gives nonsense.

**A numeric lab column is character** because one cell in thirty-five hundred contains text. Every `mean()` downstream returns `NA`, and the cause is invisible.

None of these produced an error. The read succeeded, the object looks fine, and the failures surface far from their cause.

**The fix is the same for all three: stop letting the reader guess.** Declaring column types on import is the single highest-value habit in clinical R, and it takes one extra argument.

## Intuition

Reading a CSV requires deciding, for every column, what type it holds. There are only two ways to decide:

**Guess from the data.** Look at the first few hundred values and infer. Fast, convenient, and wrong whenever the data has a surprise later in the file — which clinical data always does.

**Be told.** The programmer declares the types. Slower to write, and it converts a class of silent failures into loud ones.

SAS programmers already know this argument: `PROC IMPORT` guesses (with `GUESSINGROWS=` to control how hard), and a DATA step with `INFILE` and `INPUT` declares. Every experienced SAS programmer has been burned by PROC IMPORT truncating a character column because the first 20 rows were short.

R has the same split. `read.csv()` and `readr::read_csv()` guess; `col_types =` declares.

:::why[Why is guessing so much worse for clinical data than for other data?]
Because clinical data is built from things that look like one type and are not.

**Identifiers look numeric.** `SITEID`, `SUBJID` and visit numbers are digits, so a guesser makes them numeric and drops leading zeros. But they are labels — you never do arithmetic on a site number.

**Results are not always numeric.** A lab column holds `5.2`, `6.1` and `NOT DONE`, `<0.1`, `QNS`. Those non-numeric values are *meaningful clinical information*, not dirt, and SDTM has a whole variable (`--STRESC`) for keeping them.

**Dates arrive as ISO strings**, sometimes partial (`2025-03`), and a guesser either mis-parses them or leaves them as text.

In each case the guess is defensible from the data and wrong for the domain. You know things the parser does not.
:::

## Clinical context

| Column kind | Correct type | What guessing does |
|---|---|---|
| `USUBJID`, `SUBJID`, `SITEID` | **character** | Drops leading zeros, breaks joins |
| `VISITNUM`, `AVISITN` | numeric | Usually fine |
| `--STRESN` (standardised result) | numeric | Becomes character if any cell is text |
| `--STRESC` (character result) | **character** | Usually fine |
| `--DTC` (ISO 8601 date) | character or Date | Base R leaves as text; readr parses complete dates |
| Partial dates (`2025-03`) | **character** | Any date parser produces `NA` |
| `CNSR`, flags like `ITTFL` | as stored | Usually fine |

:::mistake[Letting a date parser touch a partial date]
SDTM `--DTC` variables are ISO 8601 **strings** precisely so that partial dates survive: `2025-03` means March 2025 with the day unknown, and no numeric date type can represent that.

Parsing them into `Date` converts every partial date to `NA` — silently destroying the information the string format existed to preserve. Read `--DTC` as character, and derive numeric analysis dates in ADaM after applying the SAP's imputation rule, with `DTYPE` recording that an imputation happened.
:::

## Formal concept

### The two readers

| | `utils::read.csv` | `readr::read_csv` |
|---|---|---|
| Returns | `data.frame` | `tibble` |
| Type guessing | First rows, simple rules | First 1000 rows by default |
| ISO dates | **character** | **parsed to `Date`** |
| Strings | character (since R 4.0) | character |
| Reports parse failures | No | **`problems()`** |
| Speed on large files | Slow | Much faster |

The `problems()` difference is the decisive one. Base R gives you a column that is quietly the wrong type; readr gives you a column *and a report of every value that would not parse*.

### Declaring types

```r
library(readr)

adsl <- read_csv(
  "data/cardio/adsl.csv",
  col_types = cols(
    USUBJID = col_character(),
    SUBJID  = col_character(),
    SITEID  = col_character(),   # an identifier, not a number
    AGE     = col_integer(),
    SBPBL   = col_double(),
    RANDDT  = col_date(format = "%Y-%m-%d"),
    .default = col_guess()       # everything else: infer
  )
)
```

`.default = col_guess()` lets you pin down the columns you care about without enumerating all 39. The alternative, `.default = col_character()`, reads *everything* as text and converts deliberately afterwards — heavier, and the safest possible starting point for an unfamiliar file.

The short forms are worth knowing because you will read them in other people's code: `col_types = "ccid"` assigns character, character, integer, double to the first four columns positionally.

### `problems()` — the part people skip

When a value will not parse as the declared type, readr **does not fail**. It inserts `NA`, warns once, and records the details:

```r
d <- read_csv("labs.csv", col_types = cols(LBSTRESN = col_double()))
problems(d)
```

```text
    row   col expected actual
  <int> <int> <chr>    <chr>
1     3     2 a double BAD
2     5     2 a double WORSE
```

:::number[Why does `row` say 3 and 5 when the bad values are on data rows 2 and 4?]
Because `problems()` reports the **line number in the file**, which includes the header. Data row 2 is file line 3; data row 4 is file line 5.

That is genuinely useful — it is the number you need to open the file and look at the offending line — and it is not the number you need to subset the data frame. To do that, subtract one (or however many header lines the file has).

Getting this backwards is a small but real waste of time, and the distinction is not obvious from the column name.
:::

### Proving what you read is what was written

Reading is not finished until you have checked it:

```r
# 1. Did every column get the type you expected?
spec(adsl)

# 2. Did anything fail to parse?
stopifnot(nrow(problems(adsl)) == 0)

# 3. Is the row count what the source says?
stopifnot(nrow(adsl) == 270)

# 4. Is the key unique?
stopifnot(!any(duplicated(adsl$USUBJID)))
```

`spec()` prints the full column specification readr used — including the guesses. Pasting that into your script as an explicit `col_types` is the fastest way to move from guessing to declaring.

## Worked example

Reading ADSL properly, and seeing what the careless version cost.

**Step 1 — read it the lazy way and look at the damage.**

```r
lazy <- read.csv("data/cardio/adsl.csv")

class(lazy$SUBJID)   # "character"
class(lazy$SITEID)   # "integer"      <- identifier became a number
class(lazy$RANDDT)   # "character"    <- date stayed a string
```

`SITEID` is now an integer. In this dataset the sites are 101–112, so nothing visibly broke — **which is exactly the danger**. The same code on a study with sites `007` and `012` produces 7 and 12, and a merge against the randomization file (which kept them as text) matches nothing.

**Step 2 — read it with readr's guesses and compare.**

```r
guessed <- readr::read_csv("data/cardio/adsl.csv", show_col_types = FALSE)

class(guessed$SITEID)  # "numeric"   <- same problem, different type
class(guessed$RANDDT)  # "Date"      <- parsed, because it is a complete ISO date
```

readr parsed `RANDDT` into a proper `Date` — a real improvement over base R. It still guessed `SITEID` numeric, because nothing in the data says "this is a label".

**Step 3 — declare.**

```r
adsl <- readr::read_csv(
  "data/cardio/adsl.csv",
  col_types = readr::cols(
    SITEID = readr::col_character(),
    SUBJID = readr::col_character(),
    .default = readr::col_guess()
  ),
  show_col_types = FALSE
)

class(adsl$SITEID)   # "character"
adsl$SITEID[1]       # "101"
```

Two named columns, one `.default`, and the identifier problem is gone permanently.

**Step 4 — verify.**

```r
stopifnot(
  nrow(adsl) == 270,
  !any(duplicated(adsl$USUBJID)),
  nrow(readr::problems(adsl)) == 0
)
```

Three lines. They will save you a morning at some point.

:::number[Why assert the row count against a literal 270?]
Because it turns a silent truncation into an immediate failure. If the file is re-extracted and comes back with 268 rows — a filter applied upstream, a partial transfer — every number you produce will be internally consistent and wrong.

The literal has to come from somewhere authoritative: the disposition table, the data transfer note, or the study's own facts document. Asserting against a number you got from the file you are reading proves nothing.
:::

## Data example

::dataset{id="cardio/adam/adsl" cols="USUBJID,SUBJID,SITEID,TRT01P,AGE,SEX,RANDDT,TRTSDT,ITTFL" rows="8" caption="ADSL — note SITEID and the two date columns"}

What the three readers make of the same file:

| Column | `read.csv` | `read_csv` (guessing) | `read_csv` (declared) |
|---|---|---|---|
| `USUBJID` | character | character | character |
| `SUBJID` | character | character | character |
| `SITEID` | **integer** | **numeric** | **character** |
| `AGE` | integer | numeric | integer |
| `RANDDT` | **character** | **Date** | Date |
| `TRTSDT` | **character** | **Date** | Date |

:::number[Why does `SUBJID` survive as character when `SITEID` does not?]
Because `SUBJID` in this dataset contains values that cannot be read as numbers — it carries the site prefix. `SITEID` holds only digits, so both readers take it at face value.

**The general lesson:** a column survives by accident when its contents happen to be unambiguous, and fails silently when they happen to be ambiguous. That is not a property you want your pipeline to depend on. Declare the type and the outcome stops depending on the data's luck.
:::

**A parse failure, deliberately.** Create a small file with a text value in a numeric column:

```r
tmp <- tempfile(fileext = ".csv")
writeLines(c("ID,VAL", "1,1.1", "2,BAD", "3,3.3", "4,WORSE"), tmp)

d <- readr::read_csv(tmp, col_types = readr::cols(ID = readr::col_integer(),
                                                  VAL = readr::col_double()))
problems(d)
```

```text
    row   col expected actual
1     3     2 a double BAD
2     5     2 a double WORSE
```

The read succeeded. `VAL` is a proper double with `NA` where the text was. And you have a precise list of what failed and where — which is the whole difference from base R, where the column would silently be character and you would find out three functions later.

## Code

::::tabs
:::tab[SAS]
```sas
/* Declaring the layout — the reliable way */
data adsl;
  infile "data/cardio/adsl.csv" dsd firstobs=2 truncover;
  length usubjid $ 40 subjid $ 20 siteid $ 10 trt01p $ 20 sex $ 1;
  input studyid $ usubjid $ subjid $ siteid $ country $ age
        ageu $ agegr1 $ agegr1n sex $ ;
  format randdt trtsdt yymmdd10.;
run;

/* The convenient way — and its risk */
proc import datafile="data/cardio/adsl.csv" out=adsl2 dbms=csv replace;
  getnames=yes;
  guessingrows=max;
run;
```

:::lines
3: `dsd` handles quoted fields containing commas; `firstobs=2` skips the header; `truncover` prevents a short final field from silently wrapping to the next line.
4: **`LENGTH` before `INPUT`.** Without it SAS defaults character variables to 8 bytes and truncates longer values without error — the direct SAS analogue of R's type-guessing problem, and equally silent.
5: `$` declares each variable character. Declaring `siteid $` is the same decision as `col_character()` in readr.
12: `PROC IMPORT` guesses, like `read_csv` without `col_types`.
14: **`guessingrows=max` scans the whole file** rather than the default 20 rows. It is slower and it is what you want for clinical data, where the surprising value is never in the first 20 rows.
:::
:::

:::tab[R]
```r
library(readr)

adsl <- read_csv(
  "data/cardio/adsl.csv",
  col_types = cols(
    USUBJID = col_character(),
    SUBJID  = col_character(),
    SITEID  = col_character(),
    AGE     = col_integer(),
    RANDDT  = col_date(format = "%Y-%m-%d"),
    .default = col_guess()
  )
)

stopifnot(nrow(problems(adsl)) == 0,
          nrow(adsl) == 270,
          !any(duplicated(adsl$USUBJID)))

spec(adsl)   # print the full spec, including the guesses
```

:::lines
7: Declaring identifiers as character is the single most valuable line in the block. It costs nothing and removes a whole class of join failures.
11: `col_date(format = ...)` states the expected format. Without the format argument readr tries ISO 8601, which is right for SDTM but not for a CRF export using `DDMMMYYYY`.
12: `.default = col_guess()` infers the remaining columns. Use `.default = col_character()` for an unfamiliar file and convert deliberately — heavier, and it never surprises you.
16: The assertions belong in the script, not in your head. They turn a silent truncation into an immediate, located failure.
19: `spec()` prints what readr decided. Paste its output back into your script as `col_types` to convert a guess into a declaration.
:::
:::

:::tab[Python]
```python
import pandas as pd

adsl = pd.read_csv(
    "data/cardio/adsl.csv",
    dtype={"USUBJID": "string", "SUBJID": "string", "SITEID": "string"},
    parse_dates=["RANDDT", "TRTSDT"],
)

assert len(adsl) == 270
assert adsl.USUBJID.is_unique
```

:::lines
5: `dtype=` is pandas' `col_types`. Note that pandas by default reads a column containing any text as `object` — the same silent coercion as base R.
7: `parse_dates=` handles ISO dates. It converts unparseable values to `NaT` **without reporting which ones**, so pandas has no direct `problems()` equivalent — you check with `adsl.RANDDT.isna().sum()` and compare against what you expected.
9: `assert` in a script is the pandas equivalent of `stopifnot`. In a notebook it is easy to skip; in a pipeline it should be there.
:::
:::
::::

## Output

```text
> spec(adsl)
cols(
  STUDYID = col_character(),
  USUBJID = col_character(),
  SUBJID  = col_character(),
  SITEID  = col_character(),
  COUNTRY = col_character(),
  AGE     = col_integer(),
  ...
  RANDDT  = col_date(format = ""),
  TRTSDT  = col_date(format = ""),
  ITTFL   = col_character()
)
```

:::number[Why does `col_date(format = "")` show an empty format?]
An empty format string means readr used its **default ISO 8601 parser** rather than a format you supplied. It is not an error or a missing value — it is readr telling you it recognised the standard format.

If you had passed `col_date(format = "%d%b%Y")` the spec would show that string back. This matters when handing a script to someone else: an empty format documents a dependency on the dates being ISO, which is true for SDTM and not for every CRF export.
:::

## Interpretation

Nothing statistical — but something worth stating about the code.

The declared version is longer than `read.csv(file)`. Every extra line buys a specific guarantee: identifiers stay identifiers, dates are dates, parse failures are reported, the row count is what you expected, and the key is unique.

In exploratory work the short version is fine — you will notice a problem because you are looking at the data. **In a pipeline whose output goes into a table, the short version is a liability**, because nobody is looking, and the failure appears as a wrong number rather than an error.

## Common mistakes

:::mistake[Reading an identifier as a number]
`SITEID`, `SUBJID`, visit numbers and kit numbers are labels. Reading them numerically drops leading zeros, and the damage only becomes visible when you join against a source that kept them as text — where the join silently matches nothing. Declare them `col_character()`.
:::

:::mistake[Parsing a partial date]
SDTM `--DTC` variables are strings so that `2025-03` can exist. Every date parser turns that into `NA`. Read `--DTC` as character and impute in ADaM per the SAP, flagging the imputation with `DTYPE`.
:::

:::mistake[Ignoring the parse warning]
readr warns once and continues. That warning is the only notice you get that values were discarded. Call `problems()` and assert it is empty — a pipeline that warns on every run trains you to ignore warnings, which is how the important one gets missed.
:::

:::mistake[Trusting the guess because the file looks clean]
The guess is based on the first 1000 rows. Clinical data's surprises — a `NOT DONE`, a `<0.1`, an unexpectedly long free-text value — are rarely in the first 1000 rows. In SAS the equivalent habit is leaving `GUESSINGROWS` at its default of 20.
:::

:::mistake[Asserting against a count taken from the file itself]
`stopifnot(nrow(adsl) == nrow(adsl))` proves nothing. The expected count has to come from an independent source — the disposition table, the transfer note, the study facts — or the assertion is decoration.
:::

## Knowledge check

::quiz{ids="r.import.identifier-type,r.import.problems-row,r.import.partial-date,r.import.guess-limit"}

## Hands-on exercise

::practice{ids="r.import.declare-types,r.import.find-problems,r.import.verify,r.import.read-code" title="Practice: declaring types and proving the read"}

## Challenge exercise

::practice{ids="r.import.join-failure,r.import.sas-compare,r.import.open" title="Challenge: silent join failures and transfer verification"}

## Industry note

**Data arrives as SAS transport files more often than CSV.** Regulatory submissions use **XPT** (SAS Version 5 Transport), and study data transfers frequently use `.sas7bdat`. In R:

```r
haven::read_xpt("adsl.xpt")      # SAS transport — the submission format
haven::read_sas("adsl.sas7bdat") # native SAS dataset
```

`haven` preserves SAS variable labels as an attribute on each column, which is genuinely useful — labels are required metadata in a submission and CSV loses them entirely. It maps SAS missing values to `NA` and can retain the special missings (`.A`–`.Z`) as tagged `NA`s if you ask.

:::standard{kind="official"}
XPT Version 5 is the required transport format for study data in FDA submissions, as specified in the Study Data Technical Conformance Guide. It carries real constraints that shape every dataset you build: variable names limited to 8 characters, labels to 40, and character variables to 200 bytes. Those limits are why SDTM and ADaM variable names look the way they do.
:::

**Verify a data transfer before you analyse it.** When a vendor sends a new extract, the first program should be a comparison against the previous one: row counts by dataset, subject counts, new and removed subjects, and changed values on key variables. Finding out at table-production time that the extract changed is a bad afternoon; finding out on arrival is a five-minute email.

**Encoding is a real problem with international studies.** Site names, investigator names and free-text fields from European or Asian sites carry non-ASCII characters. Read with `locale(encoding = "UTF-8")` and check for mojibake before it reaches a listing — an investigator's name mangled in a CSR is both embarrassing and, in a submission, a finding.

:::interview[A vendor sends you a new data extract. What do you do before running any analysis?]
This question is really about whether you treat incoming data as trustworthy, and the right answer is that you do not.

"First, read it with declared types rather than letting the reader guess — identifiers as character, so nothing loses a leading zero, and dates handled explicitly rather than parsed by accident. Then check that nothing failed to parse: `problems()` in readr, and assert it is empty.

Then verify the extract itself against the previous one. Row counts per dataset, distinct subject counts, which subjects are new and which have disappeared, and whether any key variable changed for an existing subject. A subject disappearing between extracts is always worth an email — it usually means a screen failure was reclassified or a consent was withdrawn, and either way it affects the populations.

Then check the grain of each dataset. ADSL should be one row per subject; if it is not, everything downstream is wrong and nothing will say so.

And I'd record the extract's date and version in the program header, because 'which data did this table come from' is a question that gets asked months later."

The detail that lands well, if they seem interested: comparing extracts is also how you catch a vendor silently re-deriving something. A value changing for a subject whose CRF did not change is a question for the vendor, not a fact to absorb.
:::
