## What problem are we trying to solve?

You are building the lab analysis dataset for CBX417-301. The specification's first derivation step reads:

> "Take all LB records for subjects in ADSL. Add `TRT01A`, `TRTSDT` and `SAFFL` from ADSL. Lab records of subjects who are not in ADSL (screen failures) are not included — list them for review."

Three datasets' worth of questions hide in that sentence: which records have a match, which do not, and what values the combined records carry. In SAS the everyday tool is the DATA step **MERGE** with a **BY** statement. It is concise and fast — and it has behaviours that surprise even experienced programmers: it never multiplies rows the way a SQL join does, it can let one dataset's values silently overwrite another's, and a single duplicated key can scramble a whole BY group while the observation counts look perfectly normal.

## Intuition

Picture two card piles, both sorted by subject ID: lab cards on the left, subject cards (ADSL) on the right. You walk down both piles together, one subject at a time.

- For each subject, you lay out a combined card for every lab card, copying the treatment and first-dose date from that subject's ADSL card.
- The ADSL pile has only **one** card per subject, so after the first lab card you simply **keep using the same ADSL information** for that subject's remaining lab cards. SAS does the same: it does not re-read a dataset that has run out of records in the current BY group; the values it already has stay in the PDV.
- If a subject exists in only one pile, the combined card has blanks where the other pile's information would be.
- If **both** piles have several cards for the same subject, you pair them by position — first with first, second with second — and when one pile runs out, you keep reusing its last card. You do **not** make every possible combination.

The `IN=` option attaches a small flag to each pile saying "this pile contributed to the current subject", so you can keep matched records only, or only the unmatched ones.

::widget{name="join-visualizer" engine="merge" case="one-to-many"}

## Clinical context

MERGE is how derived datasets inherit information:

| Task | Datasets | Typical relationship |
|---|---|---|
| Add treatment, reference dates and population flags to records | ADSL + LB, VS, AE, … | one-to-many (one ADSL row per subject) |
| Add first/last dose dates to DM | DM + a per-subject summary of EX | one-to-one |
| Bring supplemental qualifiers back to their parent records | AE + transposed SUPPAE | one-to-one on `USUBJID` + sequence |
| Add a baseline value to every post-baseline record | ADLB + its baseline records | many-to-one on `USUBJID PARAMCD` |
| Attach reference ranges | LB + a normal-range lookup table | many-to-one on test, sex, age band |

In every case the analyst's expectation is about **keys**: "one ADSL row per subject", "one baseline per subject and parameter". If the key is not actually unique, MERGE does not fail — it quietly produces wrong pairings. That is why experienced programmers verify keys before merging and read the merge notes in the log every time.

:::standard{kind="convention"}
Copying subject-level variables (treatment, population flags, reference dates) from ADSL onto BDS and OCCDS datasets is standard ADaM practice, because analyses need them on every record. Which ADSL variables are copied is defined in the study's ADaM specification.
:::

## Formal concept

### Syntax

```sas
data combined;
  merge lb(in=inlb) adsl(in=insl keep=USUBJID TRT01A TRTSDT SAFFL);
  by USUBJID;
  if inlb and insl;
run;
```

Requirements:

- Every dataset must be **sorted** (or indexed) by the BY variables, or the step stops with an error that the BY variables are not properly sorted.
- BY variables must have the **same type** in all datasets. Different **lengths** are allowed but draw a WARNING that multiple lengths were specified for the BY variable — fix it, because values can be truncated in the PDV and fail to match.

### What SAS does for each BY group

1. At the start of a new BY group, every variable that comes from the merged datasets is set to missing.
2. SAS then iterates as many times as the **largest** number of observations any dataset has in that BY group.
3. On each iteration it reads the next observation from **each dataset that still has one** in the group, in the order the datasets are listed. A dataset that has run out is not read, so its variables **keep the values from its last observation**.
4. A dataset with no observations in the group contributes missing values for its variables.

### Relationship types

| Relationship | Rows per BY group in the output | Typical example |
|---|---|---|
| one-to-one | 1 | DM + first/last dose per subject |
| one-to-many / many-to-one | the "many" count; the "one" values are repeated | ADSL onto LB records |
| many-to-many | the **larger** of the two counts, paired by position | almost always a key error |

A many-to-many merge produces the note

```log
NOTE: MERGE statement has more than one data set with repeats of BY values.
```

It is a NOTE, not a WARNING or ERROR, and the step completes. In clinical data it nearly always means a key is not what you believed.

### IN= flags

`IN=name` creates a temporary 0/1 variable that is 1 when the dataset has observations in the current BY group. It is not written to the output.

| Subsetting IF | Keeps | SQL analogue |
|---|---|---|
| `if inlb and insl;` | records with a match in both | inner join |
| `if inlb;` | every LB record, with ADSL values where available | left join |
| `if insl;` | every ADSL subject, with lab values where available | right join |
| *(no IF)* | everything from both | full join |
| `if inlb and not insl;` | LB records with no ADSL subject | anti-join |
| `if not (inlb and insl);` | records present in only one dataset | non-matching rows |

### Variables with the same name

If a non-BY variable exists in more than one dataset, there is only **one** slot for it in the PDV. Whichever dataset is read **last** on an iteration supplies its value. In a one-to-one merge that is the rightmost dataset in the MERGE statement. In a one-to-many merge it depends on the iteration, because the "one" dataset is read only on the first iteration of each BY group:

| `merge adlb adsl; by USUBJID;` — both contain `TRT01A` | Record 1 | Record 2 | Record 3 |
|---|---|---|---|
| Datasets read on this iteration | ADLB, then ADSL | ADLB only | ADLB only |
| `TRT01A` comes from | ADSL | ADLB | ADLB |

With `options msglevel=i;`, SAS writes an INFO line to the log whenever a variable will be overwritten by another dataset in a MERGE — a useful check. The robust fix is to make sure each non-BY variable comes from exactly one dataset, using `DROP=`, `KEEP=` or `RENAME=`.

### MERGE without BY

Without a BY statement, MERGE combines observations **by position**: the first observation of each dataset, then the second, and so on. There is no key matching at all, and by default no message warns you. Clinical programs never do this intentionally; the system option `MERGENOBY=ERROR` (or `WARN`) turns it into an error.

## Worked example

`LB` (SDTM laboratory records for ALT) and `ADSL`, both sorted by `USUBJID`. Subject 2031-0005 is a screen failure: they had screening labs but are not in ADSL. Subject 2031-0001 was randomized but never treated and has no lab records.

::::columns
:::col[LB — 8 records]
| USUBJID | VISITNUM | LBSTRESN |
|---|---:|---:|
| …1012-0001 | 1 | 22 |
| …1012-0001 | 10 | 35 |
| …1012-0001 | 20 | 41 |
| …1012-0002 | 1 | 18 |
| …1012-0002 | 10 | 19 |
| …2031-0005 | 1 | 27 |
| …3044-0001 | 1 | 30 |
| …3044-0001 | 10 | 88 |
:::
:::col[ADSL — 4 subjects]
| USUBJID | TRT01A | SAFFL |
|---|---|---|
| …1012-0001 | CBX-417 + Docetaxel | Y |
| …1012-0002 | Placebo + Docetaxel | Y |
| …2031-0001 | *(blank)* | N |
| …3044-0001 | CBX-417 + Docetaxel | Y |
:::
::::

Walking the BY groups:

| BY group | LB obs | ADSL obs | Iterations | `inlb` | `insl` | Result |
|---|---:|---:|---:|:-:|:-:|---|
| 1012-0001 | 3 | 1 | 3 | 1 | 1 | 3 matched records; ADSL values repeated on records 2 and 3 |
| 1012-0002 | 2 | 1 | 2 | 1 | 1 | 2 matched records |
| 2031-0001 | 0 | 1 | 1 | 0 | 1 | 1 record with ADSL values and missing lab values |
| 2031-0005 | 1 | 0 | 1 | 1 | 0 | 1 record with lab values and missing ADSL values |
| 3044-0001 | 2 | 1 | 2 | 1 | 1 | 2 matched records |

:::number[How many observations does the merge create, and how many survive each IF?]
Without any IF: 3 + 2 + 1 + 1 + 2 = **9** observations (the sum over BY groups of the larger count). `if inlb and insl;` keeps the 7 matched lab records. `if inlb;` keeps all 8 lab records, including the screen failure's with blank `TRT01A`. `if inlb and not insl;` isolates that 1 screen-failure record, and `if insl and not inlb;` finds the 1 ADSL subject with no labs.
:::

:::number[Why do records 2 and 3 of subject 1012-0001 carry TRT01A although ADSL was read only once?]
On iterations 2 and 3 of that BY group, ADSL has no more observations, so SAS does not read it; the PDV still holds `TRT01A`, `TRTSDT` and `SAFFL` from its one observation. This retention is exactly what makes a one-to-many merge work — and what makes a many-to-many merge go wrong.
:::

### When the key is not unique

Suppose AE and CM are merged by `USUBJID` alone. Subject 1012-0001 has 2 AE records and 3 CM records:

| Output row | AE record | CM record |
|---:|---|---|
| 1 | Nausea | Ondansetron |
| 2 | Fatigue | Dexamethasone |
| 3 | Fatigue *(retained)* | Loperamide |

Three rows, not the six a SQL join would produce, and the pairings are meaningless: nausea is not "the" AE for ondansetron because they happen to be first in their piles. The log shows the repeats-of-BY-values note. The fix is not a better merge but a better question — to relate AEs and medications you need a real key or a rule (for example, overlapping dates), usually implemented with PROC SQL.

::lesson{id="sas-proc-sql" label="See: SQL joins and the Cartesian product"}

## Data example

In the CBX417-301 analysis data, every ADLB record already carries the subject-level variables that came from ADSL:

::dataset{id="oncology/adam/adlb" cols="USUBJID,PARAMCD,AVISIT,AVAL,TRTA,SAFFL" rows="10" filter="PARAMCD=ALT" caption="ADLB — ALT records with treatment and population flag inherited from ADSL"}

Scroll to a subject whose actual treatment differs from planned treatment (the dispensing-error subjects described in the study design): every one of their lab records must show the same `TRTA`, taken from ADSL's `TRT01A`. A subject whose records disagree with each other is the fingerprint of an overwritten variable.

## Code

```sas title="lb_adsl_merge.sas"
proc sort data=lb;
  by USUBJID VISITNUM;
run;

proc sort data=adsl(keep=USUBJID TRT01A TRTSDT SAFFL) out=adsl_k;
  by USUBJID;
run;

data lb_adsl lb_only adsl_only;
  merge lb(in=inlb) adsl_k(in=insl);
  by USUBJID;
  if inlb and insl then output lb_adsl;
  else if inlb then output lb_only;
  else output adsl_only;
run;
```

:::lines
1-3: LB is sorted by subject and visit; sorting by additional variables is fine as long as `USUBJID` comes first.
5-7: Keeps only the variables the specification asks for — so no other ADSL variable can overwrite an LB variable of the same name — and sorts into a WORK copy.
9: Three output datasets: the result and two review listings.
10: `IN=` flags record which dataset has observations in the current BY group.
11: Match-merge by subject: the ADSL values are repeated for every lab record of that subject.
12: Both flags 1: a lab record of an ADSL subject — the specification's result.
13: Only `inlb`: a lab record with no ADSL subject (screen failure) — for review.
14: The remaining case is only `insl`: an ADSL subject with no lab records.
:::

## Output

Expected log:

```log
NOTE: There were 8 observations read from the data set WORK.LB.
NOTE: There were 4 observations read from the data set WORK.ADSL_K.
NOTE: The data set WORK.LB_ADSL has 7 observations and 7 variables.
NOTE: The data set WORK.LB_ONLY has 1 observations and 7 variables.
NOTE: The data set WORK.ADSL_ONLY has 1 observations and 7 variables.
```

:::number[Do the counts reconcile?]
7 + 1 = 8: every LB record went somewhere. 7 + 1 + 1 = 9: the total the merge creates. And no repeats-of-BY-values note: ADSL really has one row per subject. Each output has 7 variables — `USUBJID`, `LBTESTCD`, `VISITNUM`, `LBSTRESN` from LB and `TRT01A`, `TRTSDT`, `SAFFL` from ADSL; the IN= flags are not written.
:::

Expected listing of `WORK.LB_ADSL` (TRTSDT omitted for width):

```output
USUBJID                 LBTESTCD    VISITNUM    LBSTRESN    TRT01A                 SAFFL

CBX417-301-1012-0001    ALT             1          22       CBX-417 + Docetaxel      Y
CBX417-301-1012-0001    ALT            10          35       CBX-417 + Docetaxel      Y
CBX417-301-1012-0001    ALT            20          41       CBX-417 + Docetaxel      Y
CBX417-301-1012-0002    ALT             1          18       Placebo + Docetaxel      Y
CBX417-301-1012-0002    ALT            10          19       Placebo + Docetaxel      Y
CBX417-301-3044-0001    ALT             1          30       CBX-417 + Docetaxel      Y
CBX417-301-3044-0001    ALT            10          88       CBX-417 + Docetaxel      Y
```

## Interpretation

- **Unmatched records are information.** The screen failure's lab record is legitimately excluded from ADLB (ADSL contains randomized subjects only), and the never-treated subject's lack of lab data may be expected — but both should be *seen* and confirmed, not silently lost. That is what the review datasets are for.
- **Counts must reconcile across the merge.** Records in = records out (per dataset, per IF branch) is the first QC check after every merge; the repeats-of-BY-values note is the second.
- **A merge result is only as good as its key.** Every correct row above depends on ADSL having exactly one row per `USUBJID`. The by-group and sort lessons showed how to prove that before merging.

## Common mistakes

:::mistake[A hidden many-to-many merge]
If ADSL accidentally holds two rows for one subject (a bad append, a duplicate transfer), merging it onto AE by `USUBJID` pairs AE records with alternating ADSL rows. The output often has **the same number of rows** as AE — only the repeats-of-BY-values note reveals the problem. Treat that note as an error in any merge you expected to be one-to-many.
:::

:::mistake[Stale variables overwriting fresh ones]
ADLB built last month already contains `TRT01A`; ADSL has since been corrected. `merge adlb adsl(keep=USUBJID TRT01A); by USUBJID;` puts the corrected value on the **first** record of each subject and the stale value on all the others. Drop the variable from the dataset that should not supply it: `merge adlb(drop=TRT01A) adsl(keep=USUBJID TRT01A);`.
:::

:::mistake[Changing a variable that came from the "one" dataset]
In a one-to-many merge, assigning a new value to an ADSL variable on one record (for example `if … then SAFFL = 'N';`) changes it for the rest of that subject's records too, because ADSL is not re-read. Assign derived values to new variables.
:::

:::mistake[Merging without BY, or with unsorted data]
Without BY, records are paired by position and nothing warns you. With BY on unsorted data, the step stops with a sort error. Sort (into WORK) and always use BY.
:::

:::mistake[Filtering one dataset but not requiring a match]
`merge lb(in=inlb) adsl(where=(SAFFL = 'Y')); by USUBJID; if inlb;` still outputs lab records of non-safety subjects — with blank ADSL variables — because only ADSL was filtered. Add the other flag: `if inlb and insl;`.
:::

:::mistake[BY variables with different lengths]
If `USUBJID` is 20 characters in one dataset and 40 in another, SAS warns about multiple lengths for the BY variable. Make the lengths identical before merging (for example with a LENGTH statement in a preparatory step) so matching is unambiguous.
:::

## Knowledge check

::quiz{ids="sas.merge.inflags-mcq,sas.merge.m2m-numeric,sas.merge.joins-mapping,sas.merge.overwrite-mcq"}

## Hands-on exercise

::practice{ids="sas.merge.adsl-to-lb-code,sas.merge.full-count-numeric,sas.merge.nobby-mcq" title="Practice: bring ADSL variables onto lab records"}

## Challenge exercise

::practice{ids="sas.merge.m2m-log,sas.merge.overwrite-hotspot,sas.merge.filter-diff" title="Debug and QC: merges that look fine"}

## Industry note

- **Check keys, then merge, then reconcile counts.** Many teams wrap this in a utility macro that verifies uniqueness of the "one" side, performs the merge and reports matched/unmatched counts. Whether or not you use one, the three steps are what reviewers expect.
- **Keep every merge explicit about its variables.** `KEEP=` on the lookup dataset is the simplest protection against accidental overwriting; it also documents which variables each dataset contributes.
- **MERGE and SQL answer different questions.** MERGE pairs records by position within a key; SQL builds every combination that satisfies a condition. For true one-to-one and one-to-many relationships they give the same result; for many-to-many relationships SQL is the correct tool and MERGE is almost always wrong.
- **Treat `IN=` subsets as part of the specification.** "All randomized subjects", "subjects with at least one lab record" and "lab records of randomized subjects" are three different datasets. Name the one you built in your program header.

:::interview[What happens when you MERGE two datasets that both have repeated BY values?]
"SAS doesn't create a Cartesian product. Within each BY group it reads observations from each dataset in parallel — first with first, second with second — and when one dataset runs out it keeps that dataset's last values for the remaining iterations, so the group has as many rows as the larger of the two counts. The log shows 'MERGE statement has more than one data set with repeats of BY values'. The pairings are usually meaningless, so in clinical work I treat that note as an error: either one dataset's key isn't unique when it should be — I'd find the duplicates with FIRST./LAST. or NODUPKEY with DUPOUT — or the relationship really is many-to-many and I should use PROC SQL with a proper join condition."
:::

:::ai[If an AI assistant writes a merge for you…]
Check that both datasets are sorted by the BY variables, that the "one" side really is unique on the key, that `IN=` flags implement the subset the specification asks for, and that no non-BY variable exists in both datasets. Then run it and read the log for the repeats-of-BY-values note and the observation counts. Generated merges commonly omit `IN=` flags entirely, which silently turns an intended inner join into a full join.
:::
