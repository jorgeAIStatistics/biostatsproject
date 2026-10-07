## What problem are we trying to solve?

The central laboratory sends a monthly extract. You already hold the same baseline ALT results in EDC, so you put the two side by side — fourteen subjects, one value each — and total both columns.

```excel
=SUM(B2:B15)     → 304      EDC
=SUM(D2:D15)     → 236.6    vendor
```

A difference of 67.4 U/L. Then, to be sure, you add the vendor column up by hand:

$$25+22+9+21+16+32+7+4.6+15+12+28+18+19+24 = 252.6$$

Three numbers out of two columns of fourteen cells: 304, 252.6, and 236.6. The middle one is what the vendor's data says. The last one is what Excel says about the vendor's data, and the 16 U/L between them is not a discrepancy with the lab at all — it is a cell that looks like a number and is not one.

**A reconciliation is finished when every unit of the difference has a name.** Not when the numbers are close, not when the remaining gap is small relative to the total. This lesson builds one that closes exactly, on a file with four things wrong with it.

::widget{name="excel-grid" sheet="lab-reconciliation"}

Work the ten tasks in order. They end on 236.6, reached from 304 by four named findings, and the point of the exercise is that the arithmetic lands on the last decimal.

## Intuition

A reconciliation is a **full outer join followed by a comparison**, and it has exactly three outputs:

| Output | What it means | Who it goes to |
|---|---|---|
| Rows only on the left | EDC has a subject the vendor did not send | The lab, or the transfer |
| Rows only on the right | The vendor sent a subject EDC does not have | The site, or the lab |
| Rows on both sides, values differ | A genuine data discrepancy | A query to whoever owns the field |

Excel cannot do a full outer join. `XLOOKUP` is a left join, so a reconciliation in a spreadsheet is **two lookups in opposite directions** plus a value comparison on the rows that matched. If you only write one of them, you have found half the findings and will report zero for the other half.

> A one-directional lookup cannot report what it never looked for.

And then the category nobody plans for, which is where most of a working day goes. **Rows that are the same and do not match:** subject `1001-0004` is in both files with the same value, and `COUNTIF` says it appears zero times, because one of the two ids has a trailing space. **Values that are the same and do not compare equal:** `B6` and `D6` both display `16`, and `=D6=B6` is `FALSE`, because one is the number 16 and the other is the text `"16"`.

Neither is a discrepancy with the laboratory. They are defects in your own comparison, and they will be reported as data problems if you do not separate them out first.

:::why[Why insist that the reconciliation close exactly, rather than to within a decimal?]
Because "explained to within a decimal" and "explained" are different states, and only one of them is checkable.

If 67.4 U/L decomposes into 34 + 24 + 41.4 + 16 with nothing left over, the list of findings is complete: there is no room in the arithmetic for a fifth thing you have not noticed. If it decomposes into 67.0 with 0.4 left over, the 0.4 is either a rounding artefact or a fifth finding, and the residual alone cannot tell you which.

A reconciliation that stops at "close enough" has thrown away the one number that would have told it whether it was finished.
:::

## Clinical context

A biometrics group runs the same operation against a dozen different pairs of files:

| Reconciliation | Left | Right | The finding that matters |
|---|---|---|---|
| Central lab | EDC lab page | Vendor extract | Results the vendor sent for a subject the study does not have |
| Randomization | EDC | IRT/IVRS export | A subject randomized in one system and not the other |
| Safety | Clinical database | Pharmacovigilance database | An SAE in one and not the other |
| Exposure | EDC drug accountability | IRT dispensing | Kit numbers that do not agree |
| Database versions | Last extract | This extract | Values that changed after the last review |

:::clinical
The lab case has a feature the others do not: **the vendor's file is usually the source of truth for the value, and EDC is usually the source of truth for whether the subject exists.**

So the two directions mean different things. A subject in EDC and not in the vendor file is a missing sample or a failed transfer, and the lab has to be asked. A subject in the vendor file and not in EDC is more serious: the lab has run a sample for someone the study does not know about — a mis-keyed id at accessioning, or a sample from a different study.

Reporting both as "unmatched" loses that. The discrepancy log needs the direction in it.
:::

:::standard{kind="convention"}
Reconciling the clinical database against the safety (pharmacovigilance) database for serious adverse events is standard sponsor practice, normally described in the Data Management Plan with an agreed frequency and a defined set of compared fields. It is a sponsor process rather than a single CDISC or ICH requirement, and so are the lab and IRT reconciliations above. What is common to all of them is the deliverable: a discrepancy log with one row per finding, naming the subject, the field, both values and the owner.
:::

## Formal concept

### Reconcile the key before you reconcile anything else

Every step below assumes the two sides agree on what a subject is called. They frequently do not, and the ways they disagree are invisible: a trailing or leading space; a non-breaking space, which arrives whenever data has passed through a web page or a PDF; case; a site prefix on one side only, `1001-0004` against `CBX417-301-1001-0004`; one side numeric and the other text.

The defence is a **normalised key in a helper column on each side**, with the raw key kept beside it. `TRIM` removes leading and trailing spaces and collapses internal runs to a single space; `CLEAN` removes the non-printing control characters. Neither removes a non-breaking space — that one needs `SUBSTITUTE` against the character itself, and in practice you find it by discovering that `TRIM` did not work.

**Keep the raw column.** The normalised key is for matching; the raw key is what you quote in the query, because "your file has a trailing space on subject 1001-0004" is the actual finding.

### Three comparisons that are not the same comparison

| | Case | Spaces | Type |
|---|---|---|---|
| `=A2=C2` | Insensitive | **Sensitive** | Type-aware: a number never equals text |
| `=EXACT(A2,C2)` | **Sensitive** | **Sensitive** | Text comparison |
| `=COUNTIF(range,A2)` | Insensitive | **Sensitive** | Criteria coerce: `"16"` matches the number 16 |

Read the last column carefully, because the two rules genuinely conflict and neither can be derived from the other. **Excel's comparison operators do not coerce across types**: `="16"=16` is `FALSE`, the ordering is number, then text, then boolean, and no number format changes it. **`COUNTIF` and `SUMIFS` criteria do coerce**: `COUNTIF(range,"16")` matches a cell holding the number 16.

So on the same pair of cells, `=D6=B6` can say the values differ while a `COUNTIF` says they match — and on the same pair of keys, `COUNTIF` can say the key is absent while the two strings look identical on screen. Both are documented behaviour, and knowing which rule is in play is the difference between five minutes and an afternoon.

`EXACT` is the right tool for **keys**, where case and spaces matter and the content is text. It is the wrong tool for values: it converts numbers to text before comparing, so what it actually tests is whether two numbers print the same way.

### Compare values with a tolerance, and choose the tolerance deliberately

```excel
=IF(ABS(B2-D2)<=0.001,"OK","DIFF")
```

Binary floating point cannot represent most decimal fractions exactly, so two numbers computed by different routes can differ in the last bits while representing the same quantity. A direct `=B2=D2` on computed values is a test you did not intend to write.

**The tolerance is a clinical decision, not a numerical one.** The central laboratory reports ALT as whole units per litre, so here any non-zero difference is real and the tolerance exists only to absorb floating-point noise. On derived values — a percentage change, a mean — the tolerance is set by the precision that will be reported, and stating it is part of the reconciliation's output.

### The two directions, and the totals check that closes them

```excel
H2:  =IFNA(XLOOKUP($F2,$G$2:$G$15,$D$2:$D$15),"Not in vendor file")
I2:  =IF(COUNTIF($F$2:$F$15,$G2)=0,"Not in EDC","Matched")
```

Column H is EDC looking into the vendor file. Column I is the vendor file looking back. **Both are needed and neither implies the other.** Both fallbacks are visible markers rather than `""`, so the unmatched rows can be counted with `COUNTIF` and filtered into a listing.

Then the arithmetic:

$$\text{left total} \;-\; \sum \text{left-only} \;+\; \sum \text{right-only} \;\pm\; \sum \text{differences} \;=\; \text{right total}$$

If that identity holds, the finding list is complete. If it does not, the residual is a finding you have not written down.

:::standard{kind="simplification"}
This lesson reconciles one value per subject, which is the tractable case. Real lab reconciliations are keyed on subject **and** visit **and** test, and a spreadsheet has no native compound key. The usual workaround is a concatenated helper column, `=A2&"|"&B2&"|"&C2`, and the separator is not optional: without it, `1001` + `0002` and `100` + `10002` are the same key.

Also left out: the case where the key repeats on one side — a repeat sample for the same subject and visit. That turns the value comparison into a many-to-many problem, and it is the point at which a spreadsheet has stopped being the right tool. The next lesson is about recognising that point.
:::

## Worked example

Fourteen EDC subjects, fourteen vendor rows, both sorted by subject. **Both sides being sorted is what makes this dangerous**: the rows look aligned, and from row 12 onward they are not.

**The totals.** `=SUM(B2:B15)` gives 304. `=SUM(D2:D15)` gives 236.6. Adding the vendor column by hand gives 252.6.

**Finding 1 — a cell that is not a number.** `=COUNT(D2:D15)` gives **13**, and `=COUNTA(D2:D15)` gives 14. `SUM` silently skips cells containing text, so one cell contributed nothing. `=ISTEXT(D6)` confirms it: the vendor ALT for subject 1001-0006 is the text `"16"`, not the number 16.

And `=D6=B6` is **`FALSE`**, even though both cells display `16`. That is the type-aware comparison rule, and it is why "the values look the same but my check says they differ" is such a common complaint.

This finding accounts for 16 U/L of the gap and it is **not a discrepancy with the laboratory**. The lab reported 16 and EDC holds 16. What differs is Excel's arithmetic over a cell whose type was changed somewhere in the transfer.

**Finding 2 — a key that does not match.** `=COUNTIF(C2:C15,A4)` gives **0** for subject 1001-0004, which is visibly present in both columns with the same value of 9.

```excel
=EXACT(A4,C4)          → FALSE
=EXACT(A4,TRIM(C4))    → TRUE
```

`C4` is `"1001-0004 "`. `COUNTIF` does not trim, so the match fails silently; `TRIM` on the vendor key restores it. This finding contributes **nothing** to the numeric gap — the values agree — and would have been reported as a missing subject by any reconciliation that skipped the key-normalisation step.

**Finding 3 — a decimal point.** Subject 1001-0011 is 46 in EDC and 4.6 in the vendor file.

```excel
=ROUND(ABS(B9-D9),2)   → 41.4
```

This is the only genuine data discrepancy of the four, and it is the one that would also have been caught by a completely different check: 4.6 U/L is below that subject's own lower limit of normal of 10 U/L, and below the lowest ALT value recorded anywhere in this study, which is 6.

**Finding 4 — one subject on each side.** Subject 1001-0016 is in EDC at 34 U/L and absent from the vendor file:

```excel
=IFNA(XLOOKUP(A12,C2:C15,D2:D15),"Missing")    → Missing
```

Looking the other way, `1002-0007` at 24 U/L is in the vendor file and not in EDC. **Two findings, two directions, two different owners** — and the second one is only visible if you wrote the second lookup.

**Closing it.**

$$304 - 34 + 24 - 41.4 - 16 = 236.6$$

Note the order the quantities arrive in. After the three data findings the running total is **252.6**, which is exactly what the vendor column adds to by hand. The final 16 is the text cell: not a difference between the two files, but a difference between the vendor file and what `SUM` reports about it.

**A reconciliation report that does not separate those two kinds of finding sends the laboratory a query about a value they reported correctly.**

## Data example

::dataset{id="oncology/sdtm/lb" cols="USUBJID,LBTESTCD,LBORRES,LBORRESU,LBORNRLO,LBORNRHI,LBNRIND,LBNAM,VISIT" rows="8" caption="LB — 25,450 rows for 420 subjects across 7 tests, the real version of the file in the sheet"}

At full size the same reconciliation is keyed on subject, visit and test, and the sheet's fourteen rows become 25,450. Two things about the real file are worth carrying back.

**The reference range is not constant.** ALT on this study is reported against 7–35 U/L for some subjects and 10–50 for others, and 130 of the results come from three sites' local laboratories with their own ranges again. A range check has to use the range on the row, not one typed once at the top of the sheet.

**The anti-join is a real number.** 468 subjects are in DM; 420 appear in LB; the 48 with no laboratory record at all are exactly the 48 screen failures. Checking that the answer *is* the expected one is the whole value of running it — the same query returning 51 would be a finding.

:::number[Where the 48 comes from]
```sql
SELECT COUNT(*) FROM dm
LEFT JOIN lb ON lb.USUBJID = dm.USUBJID
WHERE lb.USUBJID IS NULL;              -- 48
```

and every one of them has `ARMNRS = 'SCREEN FAILURE'` in DM. This is what a reconciliation looks like when it passes: a number you predicted, reached by a route that could have contradicted you. A check that could not have failed has told you nothing.
:::

## Code

The same reconciliation in four places. Watch what each one does about the trailing space.

::::tabs
:::tab[Excel]
```excel
F2: =TRIM(A2)
G2: =TRIM(C2)
H2: =IFNA(XLOOKUP($F2,$G$2:$G$15,$D$2:$D$15),"Not in vendor file")
I2: =IF(COUNTIF($F$2:$F$15,$G2)=0,"Not in EDC","Matched")
J2: =IFS(H2="Not in vendor file","EDC ONLY", ABS(H2-B2)<=0.001,"OK", TRUE,"DIFF")
```

:::lines
1-2: Normalised keys, raw keys kept. Everything downstream matches on `F` and `G`; everything reported quotes `A` and `C`.
4: The second direction. Without this column, subject 1002-0007 is never looked for.
5: Three outcomes, not two. `"EDC ONLY"` and `"DIFF"` go to different people.
:::
:::

:::tab[SQL]
```sql
SELECT COALESCE(e.subjid, v.subjid) AS subjid,
       e.alt AS edc_alt, v.alt AS vendor_alt,
       CASE WHEN v.subjid IS NULL         THEN 'EDC only'
            WHEN e.subjid IS NULL         THEN 'Vendor only'
            WHEN e.alt <> v.alt           THEN 'Value differs'
            ELSE 'Match' END AS finding
FROM       edc e
FULL OUTER JOIN vendor v ON TRIM(v.subjid) = TRIM(e.subjid);
```

:::lines
4-6: All three findings fall out of one `CASE`, in a fixed order, so a row can only be counted once.
8: **`FULL OUTER JOIN` is the operation a reconciliation actually is.** Excel has no equivalent, which is why the spreadsheet version needs two lookups in opposite directions — and why forgetting one is the commonest way a reconciliation reports a clean result.
:::
:::

:::tab[R]
```r
edc <- dplyr::mutate(edc, key = trimws(subjid))
vnd <- dplyr::mutate(vnd, key = trimws(subjid))

dplyr::anti_join(edc, vnd, by = "key")     # in EDC only
dplyr::anti_join(vnd, edc, by = "key")     # in vendor only

dplyr::inner_join(edc, vnd, by = "key", suffix = c("_edc", "_vnd")) |>
  dplyr::filter(abs(alt_edc - alt_vnd) > 0.001)
```

:::lines
4-5: Two `anti_join`s, written out, so neither direction can be forgotten by accident. They are separate objects with separate row counts, and the row counts are the report.
8: The value comparison runs only on rows that matched, with an explicit tolerance. `diffdf` and `arsenal::comparedf` package all three steps if you would rather not hand-roll it.
:::
:::

:::tab[SAS]
```sas
proc sort data=edc;    by key; run;
proc sort data=vendor; by key; run;

data recon;
  merge edc(in=a) vendor(in=b);
  by key;
  if      not b then finding = 'EDC only     ';
  else if not a then finding = 'Vendor only  ';
  else if abs(alt_edc - alt_vnd) > 0.001 then finding = 'Value differs';
  else finding = 'Match        ';
run;
```

:::lines
5: `IN=` flags on both datasets give both directions from one `MERGE`. Without them the unmatched rows are still in the output and look exactly like matched ones.
6: **The trailing space in this lesson would not exist in SAS.** Character comparison pads the shorter value with blanks, so `'1001-0004'` and `'1001-0004 '` are equal — convenient here, and its own trap elsewhere, because a *leading* space still breaks the match.
:::

`PROC COMPARE` does the whole job in one step — observations in one dataset and not the other, variables on one side only, and value differences against a numeric `CRITERION`.
:::
::::

## Common mistakes

:::mistake[Writing one lookup and calling it a reconciliation]
`XLOOKUP` is a left join. It answers "what does the vendor have for each EDC subject" and is structurally incapable of noticing a subject the vendor sent that EDC does not have.

On this sheet that omission loses subject 1002-0007 and 24 U/L of the difference — and the reconciliation would still have looked like it ran.
:::

:::mistake[Comparing keys without normalising them]
`COUNTIF` does not trim. A single trailing space makes a present subject absent, with no error, no colour and nothing on screen.

Normalise into a helper column with `TRIM`, keep the raw column for the query text, and treat "absent from the other file" as provisional until you have checked it with `EXACT(A2,TRIM(C2))`.
:::

:::mistake[Reporting a type problem as a data problem]
A cell holding `"16"` instead of 16 makes `SUM` short by 16 and `=D6=B6` return `FALSE`. Neither is a disagreement with the laboratory.

Separate the two categories before the log goes out: **findings about the data** get queried; **findings about the file** get fixed in the import, and are a comment about the transfer specification.
:::

:::mistake[Suppressing `#N/A` with an empty string]
`IFNA(…,"")` turns every unmatched subject into a blank cell — uncountable, unfilterable, indistinguishable from a cell nobody filled in.

Use a visible marker. And use `IFNA` rather than `IFERROR`, because `IFERROR` also swallows the `#REF!` you get from a deleted range and reports a broken workbook as a failed data transfer.
:::

:::mistake[Trusting aligned rows]
Both extracts sorted by subject is exactly what makes a row-by-row comparison look reasonable. On this sheet the rows align for ten rows and then do not: one missing subject on the left shifts everything below it by one, and every subsequent comparison is between two different people.

Match on the key. Never on the row number.
:::

:::mistake[Stopping at "close enough"]
67.4 U/L over a total of 304 is 22%, which nobody would call close. But 0.4 over 304 is 0.1%, and it is the same kind of number: either a rounding artefact you can name, or a fifth finding you have not found. The residual is the only part of the output that can tell you which.
:::

## Knowledge check

::quiz{ids="excel.recon.sum-skips-text,excel.recon.trailing-space,excel.recon.three-comparisons,excel.recon.one-direction"}

## Hands-on exercise

::practice{ids="excel.recon.close-the-gap,excel.recon.classify-findings,excel.recon.anti-join,excel.recon.step-order" title="Practice: naming every unit of the difference"}

## Challenge exercise

::practice{ids="excel.recon.hotspot,excel.recon.clean-result,excel.recon.open-reconciliation" title="Challenge: the reconciliation that reported nothing"}

## Industry note

**The output of a reconciliation is a document, not a number.** What the data manager needs is a discrepancy log: one row per finding, with the subject id exactly as it appears in each file, the field, both values, the direction, the category and the owner. A cell reading `67.4` is not that, and neither is a sheet coloured red where the values differ — conditional formatting is a reading aid; it cannot be counted, filtered or sent. That is why every technique here produces a **visible, countable marker**: `"Not in vendor file"`, `"DIFF"`, `"EDC ONLY"`. They exist so the last step — filter, copy, paste into the log — is mechanical.

**The categories matter more than the count.** Four findings on this file decompose into one real data discrepancy (the decimal point), two transfer findings (a subject on each side), and one file-format artefact (the text cell) that is not a discrepancy at all. Sent as "four discrepancies", that report generates two unnecessary queries to a laboratory that did nothing wrong, and buries the one value that needs looking at.

**Reconciliations get re-run.** The same two files arrive next month, larger. One built by sorting both sheets, eyeballing the rows and typing findings into an email cannot be re-run and, more to the point, cannot be *checked*, because nothing records what was compared. One built from normalised keys, two lookups and a flag column can be pointed at next month's extract in a minute. That is the argument the next lesson generalises.

:::standard{kind="official"}
Where a reconciliation's output forms part of the record supporting a regulatory submission, the expectations on electronic records apply to it. FDA 21 CFR Part 11 §11.10(e) requires secure, computer-generated, time-stamped audit trails recording operator entries and actions that create, modify or delete electronic records, for systems used to satisfy predicate rule requirements.

Whether a given reconciliation workbook is such a record depends on how it is used, and that is a sponsor determination. What is not a sponsor determination is the underlying capability: a spreadsheet in which somebody typed over a cell has no record that they did.
:::

:::interview[You are given two extracts that should agree and do not. Walk me through it.]
"Before comparing any values I'd reconcile the key, because almost everything that looks like a missing subject is a key that did not match: trailing spaces, a non-breaking space from something that passed through a PDF, case, a site prefix on one side only, or one side numeric and the other text. I'd build a normalised key with `TRIM` in a helper column on each side, keeping the raw key beside it, because the raw value is what goes in the query. Then I'd check the key is unique on each side with `COUNTIF` — if it repeats, a lookup is returning the first of several and the comparison is meaningless.

Then two directions. `XLOOKUP` is a left join, so one formula tells me what the vendor has for each EDC subject and nothing at all about subjects the vendor sent that EDC does not have. Those are usually the more serious finding — a lab running a sample for someone the study does not know about is a mis-keyed accession or a sample from another study. So: two lookups, both keeping their non-matches as a visible marker rather than an empty string, so they stay countable. On the rows that matched I'd compare numerically with an explicit tolerance rather than with `=`, and state the tolerance in the report.

Then the part I'd insist on: reconcile the totals. Left total, minus what is only on the left, plus what is only on the right, plus the value differences, should equal the right total exactly. On the file I've been working with, 304 minus 34 plus 24 minus 41.4 minus 16 is 236.6 to the last decimal, and that is what tells me the list of findings is complete rather than merely long.

One of those four is worth separating out. The 16 is a cell holding text instead of a number — `SUM` skips it, and `=D6=B6` is `FALSE` even though both cells display 16. That is not a disagreement with the laboratory, it is a defect in the file or in how it was opened, and reporting it as a data discrepancy sends a query to someone who reported the value correctly.

And I'd deliver it as a log rather than a number: subject, field, both values as they appear in each file, direction, category, owner."
:::
