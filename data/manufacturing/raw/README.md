# Messy instrument exports

These are the inputs for **capstone 7, step 1**. They are the same 240 batches as
`../process/batches.csv`, split into 12 quarterly files and mangled the way real
exports are — different header spellings, delimiters, units, date formats and missing-value markers,
because the historian was upgraded, a vendor changed, and someone opened a file in Excel.

**Every file reconciles to `../process/batches.csv` once parsed correctly.** That is the point: you can
check your own pipeline against a known answer rather than hoping. If your parsed table does not match on
all 240 batches, your pipeline is wrong — and finding out which file broke it is the
exercise.

```r
# The reconciliation your pipeline has to pass
truth  <- readr::read_csv("../process/batches.csv")
parsed <- your_pipeline("./")

stopifnot(nrow(parsed) == nrow(truth))              # duplicates removed
stopifnot(setequal(parsed$BATCHID, truth$BATCHID))  # nothing dropped or invented

j <- dplyr::inner_join(parsed, truth, by = "BATCHID", suffix = c(".p", ".t"))
stopifnot(all(j$START_DATE.p == j$START_DATE.t))    # every date format resolved
stopifnot(max(abs(j$POTENCY_PCT.p - j$POTENCY_PCT.t)) < 1e-9)
stopifnot(max(abs(j$TEMP_MEAN.p  - j$TEMP_MEAN.t))  < 0.003)   # see the note below
```

### Why temperature gets a tolerance and nothing else does

Ten of the twelve numeric columns come back **bit-exact**. Temperature does not, and the reason is worth
understanding rather than working around.

Two of these files report temperature in °F, rounded to two decimals. Converting back to °C cannot
recover what was rounded away: two decimals in °F is a half-width of 0.005 °F, which is
$0.005 / 1.8 = 0.00278$ °C. That is exactly the largest disagreement you will see — **0.00278 °C on
`TEMP_MEAN` and 0.0000222 °C on `TEMP_SD`**, and only on the two °F files.

**Unit conversion in an export is lossy, permanently.** No pipeline recovers those digits. The lesson is
not that your code is wrong; it is that a reconciliation needs a *stated tolerance* derived from the
precision of the source, and that "it doesn't match exactly" is a question to answer rather than a
threshold to loosen until it passes.

## Files

| File | Rows written |
|---|---:|
| `batch_export_2023Q1_historian.csv` | 20 batches |
| `batch_export_2023Q2_historian.csv` | 22 batches |
| `batch_export_2023Q3_upgraded.csv` | 21 batches |
| `batch_export_2023Q4_fahrenheit.csv` | 21 batches |
| `batch_export_2024Q1_snake.tsv` | 20 batches |
| `batch_export_2024Q2_snake.tsv` | 22 batches |
| `batch_export_2024Q3_lims.csv` | 20 batches |
| `batch_export_2024Q4_lims.csv` | 21 batches |
| `batch_export_2025Q1_historian.csv` | 19 batches |
| `batch_export_2025Q2_historian.csv` | 21 batches |
| `batch_export_2025Q3_upgraded.csv` | 20 batches |
| `batch_export_2025Q4_fahrenheit.csv` | 13 batches |

Total data rows written, including duplicates: **250** for 240 distinct
batches.

## What is wrong with them

This list is here so the dataset is honest about what it contains. **Read it after you have written your
pipeline, not before** — finding these yourself is the skill being practised.

<details>
<summary>Spoilers: every anomaly planted in these files</summary>

- 2023Q2: 3 metadata lines before the header
- 2023Q2: missing written as "NULL"
- 2023Q2: semicolon-separated
- 2023Q3: 3 metadata lines before the header
- 2023Q3: UTF-8 BOM at the start of the file
- 2023Q3: batch HBX14-2023-062 appears twice (export re-run and appended)
- 2023Q3: dates day-first (DD/MM/YYYY)
- 2023Q3: missing written as "N/A"
- 2023Q4: 3 metadata lines before the header
- 2023Q4: UTF-8 BOM at the start of the file
- 2023Q4: batch HBX14-2023-068 appears twice (export re-run and appended)
- 2023Q4: dates day-first (DD/MM/YYYY)
- 2023Q4: missing written as "N/A"
- 2023Q4: temperature in °F, not °C
- 2024Q1: batch HBX14-2024-100 appears twice (export re-run and appended)
- 2024Q1: missing written as "NA"
- 2024Q1: tab-separated
- 2024Q2: batch HBX14-2024-116 appears twice (export re-run and appended)
- 2024Q2: dates as Excel 1900 serial numbers
- 2024Q2: missing written as "NA"
- 2024Q2: tab-separated
- 2024Q3: 3 metadata lines before the header
- 2024Q3: batch HBX14-2024-136 appears twice (export re-run and appended)
- 2024Q3: categorical values upper-cased
- 2024Q3: dates month-first (MM/DD/YYYY) — indistinguishable from day-first before the 13th
- 2024Q3: missing written as "-"
- 2024Q3: titer labelled mg/mL (numerically identical to g/L — check, do not assume)
- 2024Q4: 3 metadata lines before the header
- 2024Q4: batch HBX14-2024-157 appears twice (export re-run and appended)
- 2024Q4: categorical values upper-cased
- 2024Q4: dates day-first (DD-MM-YYYY)
- 2024Q4: missing written as "-"
- 2024Q4: titer labelled mg/mL (numerically identical to g/L — check, do not assume)
- 2025Q1: batch HBX14-2025-176 appears twice (export re-run and appended)
- 2025Q2: 3 metadata lines before the header
- 2025Q2: batch HBX14-2025-194 appears twice (export re-run and appended)
- 2025Q2: missing written as "NULL"
- 2025Q2: semicolon-separated
- 2025Q3: 3 metadata lines before the header
- 2025Q3: UTF-8 BOM at the start of the file
- 2025Q3: batch HBX14-2025-209 appears twice (export re-run and appended)
- 2025Q3: dates day-first (DD/MM/YYYY)
- 2025Q3: missing written as "N/A"
- 2025Q4: 3 metadata lines before the header
- 2025Q4: UTF-8 BOM at the start of the file
- 2025Q4: batch HBX14-2025-233 appears twice (export re-run and appended)
- 2025Q4: dates day-first (DD/MM/YYYY)
- 2025Q4: missing written as "N/A"
- 2025Q4: temperature in °F, not °C

Note the two that cannot be resolved by looking at a single file:

- **`MM/DD/YYYY` versus `DD/MM/YYYY`** is ambiguous for any day before the 13th. You can only settle it
  by checking a date where one reading is impossible, or by reconciling against a file whose format you
  already trust. A pipeline that guesses silently is the failure mode.
- **`mg/mL` versus `g/L`** are numerically equal for this quantity, so the values look fine either way.
  The label changed; the numbers did not. Assuming a conversion is needed is as wrong as assuming one is
  not — you have to check what the quantity actually is.

</details>

## Simplifications

These files are messy in the ways that are teachable. Real exports are also messy in ways that are only
tedious: truncated final rows, embedded newlines inside quoted fields, mixed encodings within one file,
and columns that change meaning halfway through a year. None of those are here.
