# Answer key — stop and read this

`data_issues.csv` lists **every problem that was deliberately injected into `raw/`**, how a data manager
resolved it, and the value the SDTM layer uses. It is the answer sheet.

**Do not open it before you have tried to find the problems yourself.** Profiling the raw files —
duplicates, impossible dates, out-of-range values, inconsistent coding, orphan keys, partial dates,
unit mismatches — is the exercise. Reading the answers first removes it.

When you do check your work:

- `RECORD_ID` points at the row in the named raw file. `MULTIPLE` means the entry documents a pattern
  (with `N_RECORDS` telling you how many rows it covers) rather than one row; `(missing)` means the problem
  is that a row is *absent* from the export.
- `PROBLEM_NO` maps to the numbered list in `docs/specs/oncology-study-spec.md` §3.
- Entries whose `ISSUE_TYPE` starts with **TRUE FINDING** or **GENUINE EXTREME VALUE** are *not* errors:
  dispensing errors, stratification errors, source-verified extreme laboratory values and the four
  randomized-but-never-treated subjects are real events. Cleaning them away is a mistake.

| Issue type | Entries | Raw records covered |
|---|---|---|
| AE START BEFORE INFORMED CONSENT | 1 | 1 |
| AE START DATE BEFORE INFORMED CONSENT | 3 | 3 |
| DUPLICATE SUBJECT ID (SAME ID AT TWO SITES) | 4 | 4 |
| END DATE BEFORE START DATE | 7 | 7 |
| EXACT DUPLICATE ROW | 17 | 17 |
| GENUINE EXTREME VALUE (RETAIN) | 5 | 5 |
| IMPOSSIBLE DATE | 8 | 8 |
| INCONSISTENT CODING | 33 | 33 |
| KIT NUMBER NOT IN KIT LIST | 4 | 4 |
| MISSING BASELINE ASSESSMENT | 9 | 9 |
| MISSING UNIT | 10 | 10 |
| NON-STANDARD UNIT (LOCAL LAB) | 13 | 122 |
| NON-STANDARD UNIT (TEMPERATURE IN F) | 12 | 12 |
| NON-STANDARD UNIT (WEIGHT IN LB) | 10 | 10 |
| OUTLIER (DATA ERROR) | 3 | 3 |
| PARTIAL DATE | 20 | 1,337 |
| RANDOMIZED WITHOUT TREATMENT RECORDS | 2 | 2 |
| TRANSPOSED SUBJECT ID | 3 | 3 |
| TREATED WITHOUT RANDOMIZATION RECORD | 2 | 2 |
| TRUE FINDING (NOT AN ERROR): DISPENSING ERROR | 3 | 3 |
| TRUE FINDING (NOT AN ERROR): RANDOMIZED, NEVER TREATED | 4 | 4 |
| TRUE FINDING (NOT AN ERROR): STRATIFICATION ERROR | 8 | 8 |
| TRUE FINDING: MISSING CAUSALITY | 3 | 3 |
| UNIT MISLABELED | 3 | 3 |
| UNKNOWN/MISSPELLED TREATMENT TEXT | 5 | 5 |
| VISIT LABEL INCONSISTENT WITH DATE | 8 | 8 |
| WHITESPACE/CASE VARIANT IN CODED TEXT | 13 | 13 |

Total entries: 213.
