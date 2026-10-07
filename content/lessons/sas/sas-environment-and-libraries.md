## What problem are we trying to solve?

It is your first morning on the CBX417-301 programming team. Your lead sends a message:

> "The SDTM datasets are in `/studies/cbx417-301/sdtm`. Tell me how many subjects are in DM and how many of them were randomized, and send me the first rows so I can see the layout. Save anything you create in your own area — never write into the SDTM folder."

Before you can derive a single variable, you need answers to four practical questions:

1. **Where does SAS look for data**, and how do you point it at a folder?
2. **What do dataset names mean** — why does one program say `sdtm.dm` and another just `dm`?
3. **How do you look inside a dataset** (its variables, types, lengths, number of rows) without opening it in a spreadsheet?
4. **How do you know the program did what you think it did?**

The answer to the fourth question is the same for every program you will ever write in SAS: **you read the log**. This lesson sets up the habits the rest of the SAS lab assumes.

## Intuition

Think of a SAS session as a workspace with a few labelled drawers.

- A **library** is a label stuck on a folder. The statement `libname sdtm "/studies/cbx417-301/sdtm";` means: "from now on, when I say `sdtm`, I mean that folder." The label (`sdtm`) is called a **libref**.
- A **dataset** is a file inside that folder. `sdtm.dm` means "the dataset `dm` in the folder I labelled `sdtm`" — on disk, a file called `dm.sas7bdat`.
- **WORK** is a scratch drawer that SAS creates when the session starts and **empties when the session ends**. If you give a dataset a one-part name such as `dm`, SAS puts it in (or reads it from) WORK.
- The **log** is SAS's receipt: it echoes the code it received, then reports what it read, what it wrote, and anything it had to guess, convert or refuse.

So `data dm; set sdtm.dm; run;` reads the permanent SDTM dataset and writes a *temporary copy* called `WORK.DM`. Nothing in the SDTM folder changes — and the copy disappears when you log off.

:::tip[Say the libref out loud]
When you read someone else's program, translate every dataset name into "library dot member": `set adsl;` is "set WORK dot ADSL". Half of all "my dataset is empty / missing / old" problems are a dataset read from the wrong library.
:::

## Clinical context

On a clinical study, data lives in a controlled folder structure. Names vary by company, but the shape is almost always similar:

| Folder | Contents | Typical access for a programmer |
|---|---|---|
| `raw/` | EDC and vendor exports (e.g., `ae.csv`, `labs.csv`) | read-only |
| `sdtm/` | SDTM domains (`dm`, `ae`, `lb`, …) | read-only for ADaM/TLF programmers |
| `adam/` | ADaM datasets (`adsl`, `adae`, `adlb`, …) | written only by the ADaM programs |
| `programs/` | production programs, one per dataset or output | version-controlled |
| `output/` | tables, listings, figures (TLFs) and their logs | written by production runs |
| `qc/` | independent validation programs, datasets and comparison reports | written by the QC programmer |

A study-level **setup program** (often run automatically at the start of every session or batch job) assigns the librefs, so every program refers to `sdtm.dm` or `adam.adsl` and nobody hard-codes paths to a personal folder. When a reviewer re-runs your program six months later on a different server, only the setup program changes.

:::standard{kind="convention"}
Folder names, read-only rules, setup programs and "clean log" requirements are company conventions written into SOPs and programming guidelines, not CDISC or FDA rules. The principle behind them is universal, though: a result must be reproducible from controlled inputs by rerunning the program.
:::

Logs matter for the same reason. In regulated work the log is evidence: a table produced by a program whose log contains an unexplained `ERROR`, `WARNING` or suspicious `NOTE` is not considered validated at most companies, and many teams store the final log next to each output.

## Formal concept

### The LIBNAME statement

```sas
libname sdtm "/studies/cbx417-301/sdtm" access=readonly;
libname mywork "/home/u12345678/cbx417";
```

:::lines
1: Assigns the libref `SDTM` to a folder. `ACCESS=READONLY` makes SAS refuse any attempt to write, replace or delete datasets through this libref — a cheap safety net for source data.
2: A second libref for your own permanent output. The path format depends on the operating system: forward slashes on Linux/Unix servers (including SAS OnDemand for Academics), a drive letter and backslashes on Windows.
:::

Rules for librefs:

- 1 to 8 characters;
- start with a letter or an underscore;
- then letters, digits or underscores only (no hyphens, no spaces).

A libref stays assigned until the session ends or you clear it with `libname sdtm clear;`. The default engine (`V9`) reads and writes `.sas7bdat` files; other engines read other formats — for example `libname xin xport "/path/dm.xpt";` reads a SAS version 5 transport file, the format FDA expects for submitted datasets.

### Dataset names: one level or two

| You write | SAS reads/writes | Lifetime |
|---|---|---|
| `sdtm.dm` | member `DM` in the folder assigned to libref `SDTM` | permanent (it is a file in that folder) |
| `work.dm` | member `DM` in the session's WORK folder | deleted when the session ends |
| `dm` | same as `work.dm` | deleted when the session ends |

Dataset (member) names can be up to 32 characters in SAS, but CDISC datasets use short names such as `DM` or `ADSL`: the version 5 transport format used for submissions allows only 8-character names.

:::deeper[Is a one-level name always WORK?]
Almost always. The exception is the `USER` libref (or the `USER=` system option): if a libref called `USER` is assigned, one-level names go there instead of WORK. Clinical programs rarely use it, precisely because it makes `data dm;` silently permanent. If a program you inherit behaves as if WORK datasets survive between sessions, check for `libname user` or `options user=` in the setup program.
:::

Other libraries you will see: `SASHELP` (read-only sample data and metadata views such as `sashelp.class` and `sashelp.vcolumn`) and `SASUSER` (per-user settings).

### Looking inside a dataset

A SAS dataset has two parts: the **descriptor portion** (metadata: variable names, types, lengths, formats, labels, number of observations, sort information) and the **data portion** (the values). Two procedures show them:

- `PROC CONTENTS` shows the descriptor. Add `VARNUM` to list variables in the order they are stored (creation order) instead of alphabetically. `proc contents data=sdtm._all_ nods; run;` lists every member of a library.
- `PROC PRINT` shows the data. Use the `OBS=` data set option to limit rows, `VAR` to choose columns, `NOOBS` to hide the row-number column and `LABEL` to show labels as headers.

### Reading a CSV file

Raw exports usually arrive as CSV. The quickest route is `PROC IMPORT`:

```sas
proc import datafile="/studies/cbx417-301/raw/ae.csv"
            out=work.raw_ae dbms=csv replace;
  guessingrows=max;
run;
```

:::lines
1-2: Reads the CSV into `WORK.RAW_AE`, replacing it if it already exists.
3: `PROC IMPORT` decides each column's type and length by scanning rows. By default it scans only the first 20 data rows, so a verbatim term that is longer further down the file is truncated to the length it guessed. `GUESSINGROWS=MAX` scans every row. For production programs, many teams prefer a DATA step with `INFILE` and explicit `LENGTH`/`INFORMAT` statements so that types and lengths are controlled by the specification, not guessed.
:::

### Where to run SAS while you learn

SAS is commercial software, but **SAS OnDemand for Academics** gives learners free access to SAS Studio in a web browser after registering a SAS profile. Your files live on SAS's server under a home folder with a path such as `/home/u12345678/`; you upload data (for example the CBX417-301 CSV files from this app) through the *Server Files and Folders* pane, then point a libref or `PROC IMPORT` at that path. Right-click a folder in that pane to copy its exact path — typing it by hand is the most common cause of a failed LIBNAME on day one.

Everything in this lab is plain Base SAS and runs there. Remember that your session (and WORK) ends when you log off or the session times out — permanent results belong in a library that points to your home folder.

### Anatomy of the log

The log interleaves three kinds of lines:

1. **Your code**, echoed with line numbers (`12   data dm;`).
2. **Messages**, each starting with a severity:
   - `ERROR:` — SAS could not do what you asked. The step usually stops; any output may be missing or incomplete.
   - `WARNING:` — SAS did something, but possibly not what you intended (truncation, an incomplete dataset, an unresolved macro reference).
   - `NOTE:` — information. Most notes are routine (datasets created, observations read, time used); some are the most important lines in the log.
3. **Data dumps** — when a data error occurs, SAS prints the values of the variables for that observation.

Messages that deserve attention even though they are only NOTEs:

| Note (key words) | Usually means |
|---|---|
| `Variable … is uninitialized.` | You used a variable that does not exist — typically a typo or a dropped variable. |
| `Missing values were generated as a result of performing an operation on missing values.` | Arithmetic on missing values produced missing results — expected or a bug; you must know which. |
| `Character values have been converted to numeric values` (or numeric to character) | SAS converted a type for you. Make the conversion explicit with `INPUT()`/`PUT()`. |
| `Invalid data for …` / `Invalid numeric data` | A value could not be read as a number or date. |
| `MERGE statement has more than one data set with repeats of BY values.` | A many-to-many merge — almost always a bug in clinical data. |
| `W.D format was too small` | A printed number did not fit the format you gave it. |

:::standard{kind="convention"}
"Clean log" usually means: no `ERROR`, no `WARNING`, and none of the notes above unless each one is explained and documented. The exact list is defined by each company's programming standards.
:::

## Worked example

To make the example fully reproducible, we will build a six-subject DM-like dataset from in-stream data, store it permanently in our own library, and answer the lead's questions.

| USUBJID | SITEID | ARMCD | AGE | SEX | COUNTRY |
|---|---|---|---:|---|---|
| CBX417-301-1012-0001 | 1012 | CBX+DOC | 64 | M | USA |
| CBX417-301-1012-0002 | 1012 | PBO+DOC | 71 | F | USA |
| CBX417-301-1012-0003 | 1012 | *(blank)* | 58 | M | USA |
| CBX417-301-2031-0001 | 2031 | PBO+DOC | 66 | M | DEU |
| CBX417-301-2031-0002 | 2031 | CBX+DOC | 49 | F | DEU |
| CBX417-301-3044-0001 | 3044 | CBX+DOC | 77 | F | JPN |

Subject `CBX417-301-1012-0003` is a **screen failure**: SDTM DM contains every subject who signed consent, and screen failures have no planned arm, so `ARMCD` is blank.

**Question 1 — how many subjects are in DM?** One row per subject, so the number of observations: **6**. You can read it from the log line written when the dataset is created, or from `PROC CONTENTS` (the *Observations* field).

**Question 2 — how many were randomized?** Randomized subjects have a planned arm. Counting the values of `ARMCD`, including blanks, gives 3 `CBX+DOC`, 2 `PBO+DOC` and 1 blank, so **5 randomized** subjects.

:::number[Why count blanks explicitly?]
`PROC FREQ` leaves missing values out of the table unless you ask for them (the `MISSING` option). Without it you would see 3 + 2 = 5 rows' worth of counts and a footnote *Frequency Missing = 1* — easy to overlook. Showing the blank level makes the arithmetic visible: 1 + 3 + 2 = 6, which matches the number of observations. When counts from two routes agree, you can trust both.
:::

**Question 3 — the first rows.** `PROC PRINT` with `OBS=10` (here all 6 rows exist).

**Question 4 — did it work?** Read the log: every step reports what it read and what it wrote, and the counts must match the answers above.

## Code

```sas title="first_session.sas"
libname cbxlib "/home/u12345678/cbx417";

data cbxlib.dm;
  infile datalines dlm='|' dsd truncover;
  input USUBJID :$20. SITEID :$4. ARMCD :$8. AGE SEX :$1. COUNTRY :$3.;
  datalines;
CBX417-301-1012-0001|1012|CBX+DOC|64|M|USA
CBX417-301-1012-0002|1012|PBO+DOC|71|F|USA
CBX417-301-1012-0003|1012||58|M|USA
CBX417-301-2031-0001|2031|PBO+DOC|66|M|DEU
CBX417-301-2031-0002|2031|CBX+DOC|49|F|DEU
CBX417-301-3044-0001|3044|CBX+DOC|77|F|JPN
;
run;

proc contents data=cbxlib.dm varnum;
run;

proc freq data=cbxlib.dm;
  tables ARMCD / missing;
run;

proc print data=cbxlib.dm(obs=10) noobs;
  where COUNTRY = 'USA';
run;
```

:::lines
1: Points the libref `CBXLIB` at a folder you own. In SAS OnDemand for Academics, replace the path with your own home folder (copy it from the Server Files and Folders pane).
3: A two-level name, so the dataset is written to disk as `dm.sas7bdat` in that folder and survives the session.
4: Reads the in-stream lines as pipe-delimited. `DSD` treats two consecutive delimiters (`||`) as a missing value — that is how the screen failure's blank `ARMCD` is read. `TRUNCOVER` stops SAS from jumping to the next line if a line is short.
5: The `:` modifier with an informat (`:$20.`) reads up to the next delimiter and gives the variable the informat's length — 20 characters for `USUBJID`, which is exactly the length of `CBX417-301-1012-0001`.
6-13: The data lines, ended by the semicolon on line 13.
16-17: Describes the dataset. `VARNUM` lists variables in creation order.
19-21: One-way frequency table of `ARMCD`. `MISSING` shows the blank value as its own row and includes it in the percentages.
23-25: Prints at most 10 rows, without the Obs column, restricted to US subjects by the `WHERE` statement.
:::

## Output

Expected `PROC CONTENTS` output (abridged — the full listing also shows engine, creation dates, encoding and host details):

```output
Data Set Name        CBXLIB.DM                Observations          6
Member Type          DATA                     Variables             6

                  Variables in Creation Order

             #    Variable    Type    Len
             1    USUBJID     Char     20
             2    SITEID      Char      4
             3    ARMCD       Char      8
             4    AGE         Num       8
             5    SEX         Char      1
             6    COUNTRY     Char      3
```

:::number[Where do the lengths come from?]
Each character length comes from the informat on the `INPUT` statement: `:$20.` gives 20, `:$4.` gives 4, and so on. `AGE` is numeric and read without an informat, so it gets the default numeric length of 8 bytes. The next lessons show why lengths are decided the first time SAS sees a variable — and what goes wrong when they are too short.
:::

Expected `PROC FREQ` output:

```output
                                      Cumulative    Cumulative
ARMCD      Frequency     Percent       Frequency       Percent
----------------------------------------------------------------
                  1        16.67               1         16.67
CBX+DOC           3        50.00               4         66.67
PBO+DOC           2        33.33               6        100.00
```

:::number[Where do 16.67, 50.00 and 33.33 come from?]
Each percentage is the count divided by all 6 observations: 1/6 = 16.67%, 3/6 = 50.00%, 2/6 = 33.33%. The blank level sorts first because missing (blank) character values sort before any other value.
:::

Expected `PROC PRINT` output:

```output
USUBJID                 SITEID    ARMCD      AGE    SEX    COUNTRY

CBX417-301-1012-0001    1012      CBX+DOC     64    M      USA
CBX417-301-1012-0002    1012      PBO+DOC     71    F      USA
CBX417-301-1012-0003    1012                  58    M      USA
```

And the key log lines to check (expected log; your line numbers, paths and timings will differ):

```log
1    libname cbxlib "/home/u12345678/cbx417";
NOTE: Libref CBXLIB was successfully assigned as follows:
      Engine:        V9
      Physical Name: /home/u12345678/cbx417
NOTE: The data set CBXLIB.DM has 6 observations and 6 variables.
NOTE: There were 6 observations read from the data set CBXLIB.DM.
NOTE: There were 3 observations read from the data set CBXLIB.DM.
      WHERE COUNTRY='USA';
```

:::number[Why does one note say 6 observations read and another say 3?]
`PROC FREQ` read all 6 observations. `PROC PRINT` had a `WHERE` statement, so SAS read only the 3 observations that satisfy `COUNTRY='USA'` and prints the condition under the note. That echoed `WHERE` line is how a reviewer confirms, from the log alone, which subset a table was built on.
:::

## Interpretation

- **"6 subjects in DM" is not "6 patients in the trial".** DM holds every consented subject, including screen failures; the randomized count (5) is what the lead most likely needs for context. Always say which population a count refers to.
- **A clean log does not prove a correct result.** It proves SAS did not complain. The log tells you *how many* rows went in and out; you still have to know how many *should* have.
- **Permanent versus temporary is a decision.** `CBXLIB.DM` survives the session because it has a two-level name pointing at a real folder; any one-level dataset you created along the way is gone tomorrow. That is usually what you want: intermediate datasets in WORK, deliverables in a controlled library.

## Common mistakes

:::mistake[Writing to a one-level name and expecting it tomorrow]
`data adsl; … run;` creates `WORK.ADSL`. It works perfectly today and has vanished after you log off (or after an idle timeout in SAS OnDemand). If a result must persist, give it a two-level name in a library that points to a real folder — or, better, make sure the program that creates it can be rerun from scratch.
:::

:::mistake[Reading the wrong copy of a dataset]
After `libname adam "…";`, the statement `set adsl;` still reads `WORK.ADSL`, not `ADAM.ADSL`. If an old WORK copy exists from earlier in the session, the program "works" on stale data. Use two-level names for every input.
:::

:::mistake[Overwriting source data]
`data sdtm.dm; set sdtm.dm; … run;` replaces the SDTM dataset. Assign input libraries with `ACCESS=READONLY` so SAS refuses, and write derived data to your own library.
:::

:::mistake[Invalid librefs and mistyped paths]
A libref longer than 8 characters (`cbx417sdtm`) or containing a hyphen fails, and so does a path with a typo or the wrong case on a Linux server (`/Home/…` is not `/home/…`). The log tells you — which is one more reason to read it after *every* submission, not only when something looks wrong.
:::

:::mistake[Trusting PROC IMPORT's guesses]
`PROC IMPORT` guesses column types and lengths from the first rows it scans. A long adverse-event verbatim term further down the file gets truncated, and a lab result column whose first rows are numbers but which later contains `<0.5` gets read as numeric with missing values. Use `GUESSINGROWS=MAX` at minimum, and check the result with `PROC CONTENTS`.
:::

:::mistake[Reading only the end of the log]
The last lines may look fine while an ERROR scrolled past 200 lines earlier. Read (or search) the whole log from the top, and fix the **first** error first — later errors are often consequences of it.
:::

## Knowledge check

::quiz{ids="sas.environment-and-libraries.one-level-mcq,sas.environment-and-libraries.libref-rules-multi,sas.environment-and-libraries.work-lifetime-mcq,sas.environment-and-libraries.contents-numeric"}

## Hands-on exercise

::practice{ids="sas.environment-and-libraries.first-program-code,sas.environment-and-libraries.log-lines-classify,sas.environment-and-libraries.import-truncation-mcq" title="Practice: point SAS at data and inspect it"}

## Challenge exercise

::practice{ids="sas.environment-and-libraries.lost-dataset-hotspot,sas.environment-and-libraries.missing-file-log" title="Debug: where did my dataset go?"}

## Industry note

- **Nobody hard-codes paths in production programs.** A setup program (or a company macro) assigns the study librefs; your program only uses `sdtm.`, `adam.`, `tlf.` and so on. In an interview, saying "I'd read inputs through a read-only libref assigned in the study setup program" signals that you have worked in a controlled environment.
- **Log review is a deliverable.** Validation checklists commonly include "log reviewed: no errors, warnings or unexpected notes." Some teams scan logs automatically for the patterns in the table above. Build the habit now: after every submission, search the log for `ERROR`, `WARNING`, `uninitialized`, `Missing values`, `converted`, `Invalid` and `repeats of BY`.
- **Check counts against something independent.** Here, 1 + 3 + 2 from `PROC FREQ` matched the 6 observations in `PROC CONTENTS`. On real studies you check subject counts against the disposition summary or the randomization list.
- **SAS is not the only tool, but it is the one in the job ads.** R and Python read the same data (`haven::read_sas()`, `pandas.read_sas()`) and the ideas in this lab — library paths, metadata, logs — have equivalents there. Statistical programming roles still overwhelmingly expect fluent Base SAS.

:::interview[What do you check in the log before you hand over an output?]
"I search the whole log, top to bottom, for ERROR and WARNING first, and then for the notes that signal silent problems: uninitialized variables, missing values generated, character/numeric conversions, invalid data, and repeats of BY values in merges. Then I check the observation counts at each step against what I expect — number of subjects, number of records per subject — because a program can run cleanly and still drop or duplicate records. Anything unexpected I either fix or document with a reason."
:::

:::ai[If an AI assistant writes the setup code for you…]
Check the librefs (8 characters maximum, no hyphens), that input libraries are read-only, that every dataset reference is two-level where it should be, and that paths match your environment exactly. Generated code often uses Windows-style paths or invented folder names; the log's LIBNAME note tells you in one line whether the folder really exists.
:::
