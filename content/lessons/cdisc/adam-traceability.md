## What problem are we trying to solve?

Six months after submission, a reviewer sends one sentence:

> In Table 14.3.4.1 the mean change from baseline in ALT at Cycle 4 Day 1 is 5.34 U/L in the CBX-417 arm. Please identify the subjects contributing to this value and provide the source records.

You have two ways to answer.

**The reconstruction.** Open the table program, read the `WHERE` clause, re-run it, get 147 subjects, then open ADLB, then open the ADaM specification to remember how `CHG` was built, then open `LB`, then work out which `LB` record each `CHG` came from by re-applying the baseline rule and the windowing rule. Three days if nothing surprises you. And your answer is *your reconstruction of the logic*, not a record of what the program actually did — if the two differ, you will not find out.

**The lookup.** Filter ADLB with the same flags the table used. Every one of the 147 records carries `SRCDOM = "LB"`, `SRCVAR = "LBSTRESN"` and a `SRCSEQ`. Join on `USUBJID` and `LBSEQ`. You have the 147 source records in one statement, in an afternoon, and the answer is not an inference — it is a pointer that the derivation program wrote down when it made the record.

Traceability is the difference between those two afternoons. It is not documentation added afterwards. It is a set of variables the derivation program populates *while* it derives, and if they are not there, no amount of writing can put them back.

:::number[Where the 5.34 comes from]
Computed from `data/oncology/adam/adlb.csv`: records with `PARAMCD = "ALT"`, `AVISIT = "CYCLE 4 DAY 1"`, `ANL01FL = "Y"`, `SAFFL = "Y"` and non-missing `CHG`, grouped by `TRTA`. CBX-417 + docetaxel: n = 147, mean `CHG` = 5.340136. Placebo + docetaxel: n = 145, mean `CHG` = 3.020690.
:::

## Intuition

ADaM distinguishes two kinds of traceability, and confusing them is why people think their datasets are traceable when they are not.

**Metadata traceability** says, at the *variable* level: this variable came from that source, by this rule. It lives in define.xml and the ADaM specification. `ADLB.AVAL` has origin "Predecessor" and source `LB.LBSTRESN`. `ADSL.BMIBL` is derived as weight over height squared. A reviewer reading the metadata knows how the variable was built.

**Data-point traceability** says, at the *record* level: this value in this row came from that specific source row. It lives in the data itself — `SRCDOM`, `SRCVAR`, `SRCSEQ` on the record. A reviewer with the data can follow it without reading anything.

:::why[Why isn't metadata traceability enough?]
Because metadata describes a rule and data-point traceability records a result, and the whole risk sits in the gap between them.

The metadata says `ABLFL = "Y"` on the last non-missing record on or before first dose. That tells you the rule. It does not tell you *which* record the program picked for subject 1002-0001, and on a study with ties, time components and never-dosed subjects, the rule can be implemented correctly and still be ambiguous.

More sharply: a reviewer who only has the rule has to trust that the program implements it. A reviewer who has the pointer can check. That difference is the entire purpose.

**Both are required.** Metadata alone cannot tell you which record; a pointer alone cannot tell you why that record was chosen. Traceable data means both.
:::

## Clinical context

The variables that carry data-point traceability in a BDS dataset:

| Variable | What it holds | In CBX417-301's ADLB |
|---|---|---|
| `SRCDOM` | Source dataset / domain | `"LB"` on all 25,443 records |
| `SRCVAR` | Source variable that produced `AVAL` | `"LBSTRESN"` |
| `SRCSEQ` | Source record's sequence number | the `LB.LBSEQ` value |

:::standard{kind=official}
ADaMIG v1.3 defines `SRCDOM` (Source Data), `SRCVAR` (Source Variable) and `SRCSEQ` (Source Sequence Number) as the variables that identify the source record for an analysis value, and defines `DTYPE` (Derivation Type) as the variable that must be populated on any record whose value is **not** a direct copy of a single source observation — an imputed value, an average of replicates, a LOCF record, a derived parameter.

ADaMIG v1.3 also defines the **Predecessor** origin for variables copied unchanged from SDTM, which is how metadata traceability is recorded in define.xml.
:::

:::standard{kind=convention}
`SRCDOM`/`SRCVAR`/`SRCSEQ` are *permissible*, not required, in ADaMIG v1.3. Populating them on every BDS record is sponsor practice — a very widespread one, and the one this study follows — rather than a conformance requirement. When they are absent, the same information has to be reconstructible from the metadata, which is why the reviewer's question becomes a three-day job instead of an afternoon.
:::

## Formal concept

### `DTYPE` — the variable that says "this row is not an observation"

Every record in a BDS dataset is one of two things:

- **An observation**, whose `AVAL` is a copy of one source value. `DTYPE` is null and `SRCSEQ` points at the source.
- **A derived record**, whose `AVAL` was computed rather than observed. `DTYPE` says how.

Typical `DTYPE` values are `LOCF` (last observation carried forward), `AVERAGE` (mean of replicates), `MAXIMUM`, `MINIMUM`, `PHANTOM` (a placeholder row added so that a summary has a row to sit on).

:::note[This study has no `DTYPE` — and that is a statement, not an omission]
None of CBX417-301's ADaM datasets contains a `DTYPE` column. Every analysis value is a copy of a single SDTM value, so `SRCSEQ` resolves on every record and there is nothing for `DTYPE` to label.

That is a consequence of the SAP: no imputation of laboratory or vital-sign values, no LOCF, no averaging of replicates, and worst-post-baseline summaries computed at reporting time rather than stored as records. A study that imputed missing visits would need `DTYPE`, and the ADRG would have to explain how many records carry it.

"`DTYPE` is empty" and "`DTYPE` is absent" mean different things to a reviewer. The second one is worth a sentence in the ADRG.
:::

### What a pointer does and does not cover

`SRCSEQ` identifies the source of `AVAL`. It does not identify the source of every other variable on the record, and this catches people:

| Variable on an ADLB record | Traced how |
|---|---|
| `AVAL` | `SRCDOM` + `SRCSEQ` → the `LB` record |
| `ADT` | The same `LB` record's `LBDTC` |
| `BASE` | The `AVAL` of the record where `ABLFL = "Y"` for the same subject and parameter — a *different* row of ADLB, which has its own `SRCSEQ` |
| `CHG` | Arithmetic on `AVAL` and `BASE` — no source record of its own |
| `TRTA`, `SAFFL` | Copied from `ADSL` — subject-level, traced through ADSL's metadata |
| `AVISIT`, `ANL01FL` | Derived from the windowing rule — metadata traceability only, by construction |

So tracing a change from baseline is always a **two-hop** walk: one hop for the post-baseline value and one for the baseline value. A reviewer asking "where did this change come from" is asking for two source records, not one.

## Worked example

Follow one value all the way down. Subject `CBX417-301-1002-0001`, ALT, Cycle 4 Day 1 — one of the 147 records behind the 5.34.

**Level 1 — the table cell.** Mean change from baseline in ALT at Cycle 4 Day 1, CBX-417 + docetaxel: **5.34 U/L**, n = 147.

**Level 2 — the analysis records.** The 147 records selected by `PARAMCD = "ALT"`, `AVISIT = "CYCLE 4 DAY 1"`, `ANL01FL = "Y"`, `SAFFL = "Y"`, `CHG` not missing. One of them:

```text
USUBJID  CBX417-301-1002-0001   PARAMCD ALT     AVISIT CYCLE 4 DAY 1
ADT      2022-07-25             ADY     64      AVAL   16
BASE     15                     CHG     1       PCHG   6.67
ANRLO    10   ANRHI  50   ANRIND NORMAL   ATOXGR 0
ABLFL    (null)  ANL01FL Y   ONTRTFL Y
SRCDOM   LB   SRCVAR LBSTRESN   SRCSEQ 4
```

**Level 3 — the SDTM record.** `SRCDOM = "LB"` and `SRCSEQ = 4`, so look up `LB` where `USUBJID = "CBX417-301-1002-0001"` and `LBSEQ = 4`:

```text
LBSEQ    4              LBTESTCD ALT        LBTEST Alanine Aminotransferase
LBORRES  16             LBORRESU U/L        LBORNRLO 10   LBORNRHI 50
LBSTRESN 16             LBSTRESU U/L        LBNRIND  NORMAL
LBNAM    CENTRAL LAB    LBSPEC   SERUM      LBREFID  CL95528044
VISIT    CYCLE 4 DAY 1  VISITNUM 40         EPOCH    TREATMENT
LBDTC    2022-07-25T07:51                   LBDY     64
```

`AVAL = 16` is `LBSTRESN = 16`. `ADT = 2022-07-25` is the date part of `LBDTC`. `ANRLO`/`ANRHI` are `LBSTNRLO`/`LBSTNRHI`. The pointer resolved and every value matches.

**Level 4 — the raw record.** The lineage file that ships with this synthetic study maps `LB` sequence 4 for this subject to `labs.csv` record `LB-000751`:

```text
RECORD_ID  LB-000751       SITE_ID 1002     SUBJECT_ID 1002-0001
VISIT_NAME C4D1            COLLECTION_DATE 2022-07-25   COLLECTION_TIME 07:51
VENDOR_TEST_CODE CH010     TEST_NAME "ALT (SGPT)"       RESULT 16   UNIT U/L
REF_LOW 10   REF_HIGH 50   LAB_SOURCE CENTRAL           ACCESSION_NO CL95528044
```

`ACCESSION_NO` and `LBREFID` are the same string — `CL95528044` — which is how the SDTM mapping recorded which physical specimen the result belongs to.

:::number[Where does the chain actually end?]
Not at a CRF page. **Central laboratory results arrive as a vendor transfer, not through the CRF**, so the annotated CRF has no field to point at for `LBORRES`; the define.xml origin for these records is the vendor transfer, and the accession number is what ties a value to a specimen.

That matters for how you answer the reviewer. For an adverse event the chain really does end on a CRF page and the annotated CRF names the field. For a central laboratory value it ends at the vendor file. Saying "trace it back to the CRF" as a blanket statement is wrong for most of a study's data volume.
:::

**And the second hop.** `BASE = 15` is not on this record's source. It is the `AVAL` of the same subject's ALT record where `ABLFL = "Y"` — the Baseline visit record at `ADY = 1`, `ADT = 2022-05-23`, whose own `SRCSEQ` is `2`. So `CHG = 1` requires `LBSEQ = 4` **and** `LBSEQ = 2`.

::widget{name="trace-value"}

## Data example

Derived records are where traceability gets interesting, because there is no single source value to point at. CBX417-301's `ADRS` handles it in a way worth studying.

`ADRS` holds three parameters per subject: `OVRLRESP` (the response at each visit), `BOR` (best overall response, unconfirmed) and `CBOR` (confirmed best overall response). `BOR` and `CBOR` are one record per subject and are **derived from the whole sequence** of `OVRLRESP` records.

```text
USUBJID              PARAMCD   AVISIT   ADT         ADY  AVALC  AVAL  SRCSEQ
CBX417-301-1002-0001 OVRLRESP  WEEK 6   2022-06-29   38   SD     3      1
CBX417-301-1002-0001 OVRLRESP  WEEK 12  2022-08-11   81   PR     2      2
CBX417-301-1002-0001 OVRLRESP  WEEK 18  2022-09-22  123   PR     2      3
CBX417-301-1002-0001 OVRLRESP  WEEK 24  2022-11-04  166   PR     2      4
CBX417-301-1002-0001 OVRLRESP  WEEK 30  2022-12-15  207   PR     2      5
CBX417-301-1002-0001 OVRLRESP  WEEK 36  2023-01-27  250   PD     4      6
CBX417-301-1002-0001 BOR       (null)   2022-08-11   81   PR     2      2
CBX417-301-1002-0001 CBOR      (null)   2022-08-11   81   PR     2      2
```

The `BOR` record's `SRCSEQ = 2` points at the `RS` record for the Week 12 assessment — **the assessment that determined the best response**. Not the first assessment, not the last: the one the derivation picked.

:::why[Why is this better than leaving `SRCSEQ` null on a derived record?]
Because it answers the question a reviewer will actually ask.

"Why is this subject's best overall response PR?" has the answer "because of the Week 12 scan, and here it is." A null `SRCSEQ` would force the reviewer to re-run the selection over all six `OVRLRESP` records to find out which one won.

It is also the cheapest possible QC check. If `BOR.AVALC` did not equal the `AVALC` of the `OVRLRESP` record its `SRCSEQ` points to, the derivation has a bug, and that is a one-line check across all 420 subjects.

**The limit of the technique:** the pointer says which record supplied the value, not why the others lost. Verified: 406 of the 420 `BOR` records carry `SRCDOM = "RS"`; the other 14 are the subjects whose `AVALC` is `"NE"` — 11 with no response assessment at all and 3 whose assessments were all excluded by the SAP's rules — and `SRCDOM` is correctly null on them, because the derivation used no assessment.
:::

::dataset{id="oncology/adam/adrs" cols="USUBJID,PARAMCD,AVISIT,ADT,ADY,AVALC,AVAL,ANL01FL,SRCDOM,SRCVAR,SRCSEQ" rows="10" caption="ADRS — OVRLRESP records and the derived BOR/CBOR records that point back into them"}

## Code

::::tabs
:::tab[SAS]
```sas
proc sql;
  create table trace as
  select a.usubjid, a.paramcd, a.avisit, a.aval, a.base, a.chg,
         a.srcdom, a.srcseq,
         b.lbseq, b.lborres, b.lborresu, b.lbdtc, b.lbnam, b.lbrefid
  from   adam.adlb as a
         left join sdtm.lb as b
         on  a.usubjid = b.usubjid
         and a.srcseq  = b.lbseq
  where  a.paramcd = 'ALT'
    and  a.avisit  = 'CYCLE 4 DAY 1'
    and  a.anl01fl = 'Y'
    and  a.saffl   = 'Y'
    and  not missing(a.chg);
quit;

proc sql;
  select count(*) as unresolved
  from   trace
  where  missing(lbseq);
quit;
```

:::lines
5: The source columns are carried into the output so the reviewer sees the original result, its unit, its collection datetime and the specimen reference next to the analysis value.
8-9: The join key is `USUBJID` **and** `SRCSEQ` matched to `LBSEQ`. `--SEQ` is unique only within a subject and domain, so joining on `SRCSEQ` alone would fan out across hundreds of subjects.
10-14: The same filter the table program used. If the row count here does not match the table's n, stop — you are tracing a different set of records than the ones that produced the number.
17-21: The check that matters. **An unresolved pointer is a defect**, and it is silent: a `LEFT JOIN` produces a row with null source columns rather than an error. Counting them is one query and belongs in the ADaM QC program. In a dataset that draws on several source domains — ADTTE points at `RS`, `DS`, `EX` and `SS` — the join has to branch on `SRCDOM` first.
:::
:::

:::tab[R]
```r
library(dplyr)

trace <- adlb |>
  filter(PARAMCD == "ALT", AVISIT == "CYCLE 4 DAY 1",
         ANL01FL == "Y", SAFFL == "Y", !is.na(CHG)) |>
  left_join(
    lb |> select(USUBJID, LBSEQ, LBORRES, LBORRESU, LBDTC, LBNAM, LBREFID),
    by = c("USUBJID" = "USUBJID", "SRCSEQ" = "LBSEQ")
  )

stopifnot(
  nrow(trace) == 292,
  all(!is.na(trace$LBORRES)),
  all(trace$AVAL == as.numeric(trace$LBORRES))
)
```

:::lines
6-9: The same two-column join. Naming both sides explicitly avoids the silent fan-out that a single-column key would produce.
11-15: Three assertions, each catching a different failure. The row count catches a join that fanned out; the non-missing check catches unresolved pointers; the value comparison catches a pointer that resolves to the *wrong* record — which a pointer check alone would pass.
12: 292 records, not 147: the filter covers both arms, and 147 of them are in the CBX-417 column. Asserting the number you expect is how you find out that your trace and your table are not looking at the same rows.
:::
:::
::::

## Output

Running the value comparison across the whole of ADLB:

```text
> adlb |>
+   left_join(lb |> select(USUBJID, LBSEQ, LBSTRESN),
+             by = c("USUBJID" = "USUBJID", "SRCSEQ" = "LBSEQ")) |>
+   summarise(records = n(),
+             unresolved = sum(is.na(LBSTRESN)),
+             mismatched = sum(AVAL != LBSTRESN, na.rm = TRUE))

  records unresolved mismatched
1   25443          0          0
```

All 25,443 ADLB records resolve to an `LB` record, and every `AVAL` equals its source `LBSTRESN`. That is what a traceable BDS dataset looks like when you test it rather than assert it.

:::why[Should `AVAL` always equal the source value?]
Only when the variable's origin is Predecessor, which is the case here — `AVAL` is `LBSTRESN` copied.

It would **not** hold if `AVAL` were unit-converted, rounded to a different precision, or derived as a ratio. In those cases the right check is a recomputation from the source rather than an equality, and the define.xml origin would say "Derived" rather than "Predecessor".

So the test is not universal — it is a test you can only write once you have read the metadata. Which is the point about the two kinds of traceability working together.
:::

## Common mistakes

:::mistake[Believing the ADRG makes data traceable]
The ADRG explains the derivations; it does not carry pointers. A dataset with a beautiful reviewer's guide and no `SRCSEQ` still forces reconstruction. The guide is where metadata traceability lives — it is the complement of data-point traceability, not a substitute for it.
:::

:::mistake[Joining on `SRCSEQ` without `USUBJID`]
`--SEQ` is unique within a subject and domain, not within a dataset. `LBSEQ = 4` exists for hundreds of subjects. A single-column join silently fans out into a table far larger than either input, and the mean you compute from it is meaningless.
:::

:::mistake[Assuming `SRCSEQ` traces every variable on the record]
It traces `AVAL`. `BASE` traces through the `ABLFL = "Y"` record of the same subject and parameter — a different row with a different `SRCSEQ`. `CHG` has no source record at all. Answering a reviewer's question about a change means producing two source records.
:::

:::mistake[Leaving `DTYPE` null on a record that was not observed]
An LOCF record, an average of triplicate blood pressures, a phantom row for a missing visit — all of these are values that no single source record contains. Without `DTYPE` they are indistinguishable from observations, and a reviewer counting "number of subjects with a Week 12 measurement" gets the wrong answer.
:::

:::mistake[Treating an unresolved pointer as cosmetic]
A `LEFT JOIN` on a broken pointer gives you nulls, not an error. Nobody notices until a reviewer does. Counting unresolved pointers costs one query and belongs in every BDS QC program.
:::

## Knowledge check

::quiz{ids="adam.trace.two-kinds,adam.trace.srcseq-scope,adam.trace.dtype,adam.trace.join-key"}

## Hands-on exercise

::practice{ids="adam.trace.walk-the-chain,adam.trace.resolve-code,adam.trace.two-hop,adam.trace.derived-pointer" title="Practice: follow a value to its source"}

## Challenge exercise

::practice{ids="adam.trace.broken-pointer,adam.trace.origin-audit,adam.trace.open-reviewer" title="Challenge: a pointer that resolves to the wrong record"}

## Industry note

**Traceability is a property of the programs, not of the documentation.** A derivation program that selects a record and does not write down which one has destroyed information that cannot be recovered afterwards. This is why `SRCSEQ` is populated during derivation rather than back-filled: back-filling means re-running the selection logic, which means the pointer proves nothing.

**The reviewer's question is the design specification.** "Which subjects contribute to this number and what are the source records" is the question the whole chain exists to answer. Every design decision — populating `SRCSEQ`, pointing a `BOR` record at the assessment that determined it, flagging imputed dates with `ASTDTF` — is a decision about how quickly that question can be answered.

:::standard{kind=official}
ADaMIG v1.3 discusses traceability as a fundamental requirement and describes both metadata traceability (through define.xml, using origins including Predecessor) and data-point traceability (through variables such as `SRCDOM`, `SRCVAR`, `SRCSEQ` and `DTYPE`). The Analysis Data Reviewer's Guide is a community-developed sponsor deliverable that accompanies a submission and complements define.xml; it is not itself a CDISC standard for data structure.
:::

**A real submission's chain is shorter than this one.** The lineage file mapping SDTM records to raw rows ships with this synthetic study for teaching; a submission normally ends at SDTM plus the annotated CRF and the vendor transfer specifications. Within a sponsor, though, the raw-to-SDTM mapping exists and is exactly what a data-management query relies on.

:::interview[A reviewer asks which subjects contribute to a number in one of your tables. Walk me through what you do.]
"I'd answer it as a lookup rather than a reconstruction, and the difference is whether the datasets carry pointers.

First I reproduce the cell. The table program's `WHERE` clause becomes a filter on the analysis dataset — for a lab change table that's parameter, analysis visit, `ANL01FL = 'Y'`, the population flag and a non-missing change. That gives me the exact records the number was computed from, and I'd check the n matches the table before going further.

Then I follow each record down. Every BDS record carries `SRCDOM`, `SRCVAR` and `SRCSEQ`, so I join on subject and source sequence into the SDTM domain — and the join key has to be both, because `--SEQ` is only unique within a subject.

The thing I'd be careful to say is that a change from baseline is a **two-hop** trace. `SRCSEQ` on the record points at the source of `AVAL`. `BASE` came from a different row — the one with `ABLFL = 'Y'` for the same subject and parameter — which has its own `SRCSEQ`. So a reviewer asking about a change is asking for two source records, and I'd provide both.

Then it depends on the domain where the chain ends. For an adverse event it ends on a CRF page and the annotated CRF names the field. For a central laboratory value there is no CRF page — the results came in as a vendor transfer — so it ends at the transfer, and the accession number ties the value to a specimen. Saying 'trace it back to the CRF' as a blanket answer would be wrong for most of the data.

And I'd mention the checks I'd have already run, because they're what makes me confident the pointers are real: no unresolved `SRCSEQ` anywhere in the dataset, and `AVAL` equal to its source value wherever the origin is Predecessor. On the study I've worked with that's 25,443 records, zero unresolved, zero mismatched. Those are one query each and they belong in the ADaM QC program, not in the response to the reviewer."
:::
