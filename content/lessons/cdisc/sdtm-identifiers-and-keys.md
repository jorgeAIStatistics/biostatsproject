## What problem are we trying to solve?

Your study is two weeks from database lock. A listing programmer sends you this:

> *"Subject 1019-0001 has two different ages and two different sexes. 64/F on one row, 74/M on another.
> Which one is right?"*

You open `raw/demographics.csv` and both rows are there:

```csv
RECORD_ID,SITE_ID,SUBJECT_ID,BIRTH_YEAR,AGE,SEX,...
DEM-000204,1019,1019-0001,1958,64,F,...
DEM-000211,1020,1019-0001,1949,74,M,...
```

**Two different people, one subject identifier.** Site 1020 keyed another site's prefix when they
registered their first subject. The answer key confirms it: four raw records across `demographics.csv`,
`enrollment.csv`, `baseline_disease.csv` and `vitals.csv` carry `1019-0001` when the subject is a screen
failure at **site 1020**, and the corrected identifier is `1020-0001`. The central laboratory's file
already had it right, which is how it was caught.

If that had reached SDTM, one subject's demographics would have overwritten another's on every join in
the study, and every count would have been off by one in a direction nobody could reconstruct.

**Identifiers are the only thing in SDTM that, when wrong, corrupt data you did not touch.** A wrong lab
value is one wrong cell. A wrong `USUBJID` silently merges or splits people.

## Intuition

SDTM identifiers answer four questions, in order of scope:

| Question | Variable | In CBX417-301 |
|---|---|---|
| Which study? | `STUDYID` | `CBX417-301` on all 468 DM rows and every other domain |
| Which domain? | `DOMAIN` | `DM`, `AE`, `LB`, … — redundant with the file name, and that is the point |
| Which person, across the whole submission? | `USUBJID` | `CBX417-301-1001-0002` |
| Which record, within this person and domain? | `--SEQ` | `AESEQ = 3` |

Plus three optional ones that carry external identity:

| Variable | What it holds | In CBX417-301 |
|---|---|---|
| `--SPID` | The sponsor's own identifier — usually the CRF line number | `AESPID` = AE line, 1 to 17 |
| `--REFID` | An identifier from an external system | `LBREFID` = laboratory accession number; `EXREFID` = IxRS kit number |
| `--GRPID` | Groups records that belong together within a subject | not used in this study |

:::why[Why does every row repeat STUDYID and DOMAIN when the file already says both?]
Because the rows do not stay in the file. Datasets get concatenated for pooled analyses, loaded into
warehouses, split across a submission with several studies, and stacked by reviewer tools. `STUDYID` on
every row means a pooled AE dataset from eight studies is still unambiguous without a filename column.

`DOMAIN` matters most in `SUPPQUAL` and `RELREC`, where a row points at another domain and `RDOMAIN` has
to name it.
:::

## Clinical context

### USUBJID: unique across the *submission*, not just the study

```text
USUBJID = STUDYID || "-" || SUBJID
        = "CBX417-301" || "-" || "1001-0002"
        = "CBX417-301-1001-0002"
```

`SUBJID` in this study is itself `SITEID-NNNN`, so the site is embedded: all 468 `SUBJID` values start
with their own `SITEID`, verified row by row.

:::standard{kind="official"}
SDTMIG v3.4 requires `USUBJID` to be **unique across all studies in a submission**. `SUBJID` need only be
unique within the study. This is why study and site are conventionally folded into `USUBJID`: a sponsor
submitting three studies will otherwise have three subjects called `0001` and no way to tell them apart
in a pooled dataset.
:::

:::mistake[Parsing USUBJID by splitting on the hyphen]
```r
strsplit("CBX417-301-1001-0002", "-")[[1]]
# [1] "CBX417" "301"    "1001"   "0002"
```

**Four pieces, not three** — because `STUDYID` itself contains a hyphen. A program that takes the second
element as the site gets `"301"` for every subject in the study.

`USUBJID` is an **opaque key**. Its internal structure is a sponsor convention, it is documented in
define.xml, and nothing in SDTM guarantees it. When you need the site, read `SITEID`; when you need the
subject number, read `SUBJID`. Both are columns.
:::

### --SEQ: a surrogate key, and what it is not

`--SEQ` exists for one job: **to give every record in a subject-and-domain a handle that other datasets
can point at.** `SUPPAE` points at an AE record with `IDVAR = "AESEQ"` and `IDVARVAL = "3"`. `RELREC`
relates records across domains the same way. `ADAE.SRCSEQ` traces an analysis record back to its SDTM
origin.

:::number[--SEQ integrity across CBX417-301]
Checked in every domain that has one:

| Domain | Records | Duplicate `USUBJID`+`--SEQ` | Max within a subject |
|---|---:|---:|---:|
| `AE` | 2,466 | 0 | 17 |
| `CM` | 3,540 | 0 | 15 |
| `EX` | 7,070 | 0 | 101 |
| `LB` | 25,450 | 0 | 192 |
| `VS` | 17,385 | 0 | 136 |
| `RS` | 5,003 | 0 | 46 |
| `DS` | 1,696 | 0 | 4 |

And in every one of them, `--SEQ` starts at 1 for every subject and runs contiguously to that subject's
count. The contiguity is **not** a CDISC requirement — uniqueness is — but it is what almost every
sponsor does and what most checking programs assume.
:::

:::standard{kind="official"}
`--SEQ` is **Required** in every general observation class domain in SDTMIG v3.4 and must be unique
within `USUBJID` for that domain. The IG does not require it to start at 1, to be contiguous, or to
follow any particular sort order: those are sponsor conventions.
:::

:::mistake[Treating --SEQ as stable across data cuts]
`--SEQ` is assigned when the domain is built, by sorting and numbering. A subject who gains a new adverse
event in a later data cut can have every subsequent `AESEQ` shift by one. Anything that stored an
`AESEQ` from the previous cut — a saved query list, a manual reconciliation spreadsheet, an external
tracker — now points at the wrong event.

This is why `--SEQ` is a **surrogate** key and not a natural one. It identifies a row; it does not
identify the thing the row is about.
:::

### Natural keys versus surrogate keys

| | Natural key | Surrogate key |
|---|---|---|
| What it is | The columns that make a record unique *by meaning* | An assigned number |
| Example in `AE` | `USUBJID` + `AEDECOD` + `AESTDTC` | `USUBJID` + `AESEQ` |
| Stable across data cuts | Yes | No |
| Guaranteed unique | No | Yes |
| Used for | Reconciling two versions of the data | Pointing at a row from another dataset |

**You need both, for different jobs.** Reconciling this week's AE extract against last week's must be
done on the natural key, because the surrogate key moves. Linking `SUPPAE` to `AE` must be done on the
surrogate key, because the natural key is not guaranteed unique — a subject genuinely can have two
records of the same preferred term starting on the same day.

## Formal concept

### --SPID and --REFID: identity that comes from outside

`--SEQ` is yours. `--SPID` and `--REFID` are not.

::dataset{id="oncology/sdtm/ae" cols="USUBJID,AESEQ,AESPID,AETERM,AEDECOD,AESTDTC" rows="8" caption="AE — AESEQ is assigned, AESPID is the line number the site filled in"}

:::number[AESEQ equals AESPID for 2,446 of 2,466 records — and the 20 exceptions are the interesting ones]
They differ for **20 records across 7 subjects**, and there are two causes.

**Cause 1 — a raw record was not mapped.** Subject `CBX417-301-1027-0019` has seven AE records in SDTM
and eight lines on the CRF. Raw line 1, *"Chronic lower back pain"*, started before informed consent and
was excluded. Every remaining record therefore has `AESPID` exactly one higher than its `AESEQ`:

| `AESEQ` | `AESPID` | `AEDECOD` | `AESTDTC` |
|---:|---:|---|---|
| 1 | 2 | Diarrhea | 2023-05-22 |
| 2 | 3 | Arthralgia | 2023-06-02 |
| 3 | 4 | Leukopenia | 2023-06-08 |

**Cause 2 — partial start dates.** The other six subjects each have at least one adverse event with a
partial `AESTDTC` (`2023-09`, `2024`), and those records end up in a different position in the sequence
from their CRF line order.

**Which is why you never reconcile on `AESPID`.** It is the site's line number, it has gaps whenever a
record is excluded, and it is not guaranteed unique in every EDC. In this study it happens to be unique
within subject, which makes the assumption survive — right up to the study where it does not.
:::

`--REFID` is the other direction: an identifier that came *in* with the data.

::dataset{id="oncology/sdtm/lb" cols="USUBJID,LBSEQ,LBREFID,LBTESTCD,LBORRES,LBORRESU,VISIT,LBDTC" rows="8" caption="LB — LBREFID is the laboratory's accession number, shared by every test from one draw"}

:::number[What LBREFID buys you]
`LB` has 25,450 records and **3,995 distinct `LBREFID` values** — a mean of 6.4 records per accession,
with a median of 7. Seven is the size of this study's panel: ALT, AST, bilirubin, creatinine,
haemoglobin, neutrophils, platelets.

So `LBREFID` reconstructs **the blood draw**: which results came from one specimen at one moment. That is
the unit the laboratory queries on, and a query that says "accession CL97026619 was haemolysed" is
resolved by finding all its records at once. `LBSEQ` cannot do that; it numbers records, not specimens.

`EX` uses `EXREFID` for the same purpose with a different external system: **3,936 distinct kit numbers**,
populated on all 4,138 CBX-417 and placebo records and null on all 2,932 docetaxel infusions, which are
open-label supply with no kit.
:::

## Worked example

**Prove uniqueness before someone else finds a duplicate.** Three checks, in the order that finds the
most problems soonest.

**Check 1 — the subject identifier.**

```r
library(dplyr)
dm <- readr::read_csv("data/oncology/sdtm/dm.csv", show_col_types = FALSE)

stopifnot(!any(duplicated(dm$USUBJID)))
stopifnot(!any(is.na(dm$USUBJID)))
stopifnot(all(startsWith(dm$SUBJID, dm$SITEID)))
```

All three pass on CBX417-301: 468 rows, 468 distinct `USUBJID`, and every `SUBJID` begins with its own
`SITEID`. That last check is what would have caught `1019-0001` at site 1020 — the identifier said 1019
and the site column said 1020.

**Check 2 — the surrogate key in every domain.**

```r
check_seq <- function(path, seqvar) {
  d <- readr::read_csv(path, show_col_types = FALSE)
  dups <- sum(duplicated(paste(d$USUBJID, d[[seqvar]])))
  c(rows = nrow(d), dup = dups, missing = sum(is.na(d[[seqvar]])))
}
check_seq("data/oncology/sdtm/ae.csv", "AESEQ")
```

```text
   rows     dup missing
   2466       0       0
```

**Check 3 — the natural key, which is allowed to have duplicates but should not surprise you.**

```r
ae |>
  count(USUBJID, AEDECOD, AESTDTC) |>
  filter(n > 1)
```

:::why[If the natural key has duplicates, is that a data error?]
Not necessarily, and this is a judgement a data manager makes rather than a program.

A subject can genuinely have two separate episodes of the same preferred term starting on the same day —
two distinct rashes in different locations, recorded on two CRF lines. That is real, and collapsing them
would undercount events.

A subject can also have the **same** event entered twice, because the site filled in a new line rather
than editing an existing one. CBX417-301's raw files contain exactly this: the answer key documents 17
exact duplicate rows created by a double EDC export, 5 of them in `ae.csv`, which were deleted before
mapping. That is why `raw/ae.csv` has 2,472 rows and `sdtm/ae.csv` has 2,466.

The check's job is not to decide. It is to **produce the short list** that a human reads, with enough
context — verbatim term, end date, seriousness, action taken — to tell the two cases apart.

On the delivered `AE` domain the list is empty: **zero** groups share a `USUBJID`, `AEDECOD` and
`AESTDTC`. That is a clean result, and it is clean because the duplicates were removed upstream, not
because the check was unnecessary.
:::

## Data example

The identifier chain across the whole study, one subject, one adverse event:

```text
DM       USUBJID = CBX417-301-1001-0002
  |
AE       USUBJID = CBX417-301-1001-0002   AESEQ = 1   AESPID = 1   AETERM = "Diarrhea"
  |
SUPPAE   USUBJID = CBX417-301-1001-0002   RDOMAIN = "AE"
         IDVAR = "AESEQ"   IDVARVAL = "1"   QNAM = "AERELDOC"   QVAL = "NOT RELATED"
  |
ADAE     USUBJID = CBX417-301-1001-0002   AESEQ = 1   (carried through as the traceability key)
```

::dataset{id="oncology/sdtm/suppae" cols="USUBJID,RDOMAIN,IDVAR,IDVARVAL,QNAM,QLABEL,QVAL,QORIG,QEVAL" rows="6" caption="SUPPAE — IDVAR names the key variable, IDVARVAL holds its value"}

Note what `SUPPAE` does **not** do: it does not repeat `AETERM` or `AESTDTC`. It stores the *name* of the
key variable and its value, and the reader is expected to join. That indirection is why `IDVARVAL` is
character even though `AESEQ` is numeric — one column has to hold key values from different variables
with different types.

::widget{name="sdtm-explorer"}

## Common mistakes

:::mistake[Deriving the site by splitting USUBJID]
`"CBX417-301-1001-0002"` splits into four pieces because `STUDYID` contains a hyphen. Read `SITEID`.
The composition of `USUBJID` is a documented sponsor convention, not a parseable structure.
:::

:::mistake[Reconciling two data cuts on --SEQ]
`--SEQ` is assigned at build time. One new adverse event early in a subject's record shifts every
subsequent `AESEQ`. Reconcile on the natural key — `USUBJID`, `AEDECOD`, `AESTDTC` — and use `--SEQ` only
for joining within a single build.
:::

:::mistake[Assuming --SPID equals --SEQ because it does today]
In CBX417-301 they agree on 2,446 of 2,466 AE records, which is exactly enough agreement for the
assumption to survive testing and fail in production. Twenty records differ, because one raw record was
excluded and six subjects have partial start dates.
:::

:::mistake[Using --SEQ to identify a specimen or an administration]
Seven `LB` records share one blood draw, and `LBSEQ` cannot express that. `LBREFID` — the accession
number — can. Similarly `EXREFID` identifies the kit, which is what links a blinded subject to their
actual treatment.
:::

:::mistake[Checking uniqueness only in DM]
`USUBJID` being unique in `DM` says nothing about whether every `USUBJID` in `AE` exists in `DM`. The
orphan check — records whose subject is not in `DM` — is a separate check, and it is the one that catches
a mistyped identifier in a single domain.
:::

## Knowledge check

::quiz{ids="sdtm.key.usubjid-scope,sdtm.key.seq-stability,sdtm.key.natural-vs-surrogate,sdtm.key.refid-purpose"}

## Hands-on exercise

::practice{ids="sdtm.key.split-trap,sdtm.key.lbrefid-count,sdtm.key.uniqueness-code,sdtm.key.spid-seq-gap" title="Practice: proving the keys hold"}

## Challenge exercise

::practice{ids="sdtm.key.duplicate-subject,sdtm.key.orphan-check,sdtm.key.open-reconcile" title="Challenge: the duplicate nobody noticed"}

## Industry note

**Identifier checks run before anything else, every time.** A standard pre-delivery battery is:
`USUBJID` unique in DM; no null `USUBJID` anywhere; every domain's `USUBJID` present in DM; `--SEQ`
unique and non-null within `USUBJID`; `SUBJID` consistent with `SITEID`. Five checks, and they catch the
class of defect that is cheapest to fix now and most expensive to fix later.

**The duplicate-subject-identifier problem is common and has an operational fix**, which is that the
EDC pre-fills the site prefix rather than letting the coordinator type it. When it does happen, the
resolution is a data-management decision with a paper trail — which subject keeps the identifier, what
the other becomes, and who was notified — because changing an identifier after data has been collected
under it touches every downstream system.

:::standard{kind="convention"}
`USUBJID = STUDYID-SITEID-SUBJID` is the most common pattern and is not required. Some sponsors use the
randomization number, some use an opaque sequence. What SDTMIG requires is uniqueness across the
submission; the composition is a sponsor decision that belongs in define.xml. Assuming another sponsor's
`USUBJID` has the same shape as yours is a reliable way to break a pooled analysis.
:::

:::interview[How would you convince yourself that a domain's keys are sound?]
"Four checks, and I'd run them in this order because each one makes the next interpretable.

First, `USUBJID` in DM: unique, non-null, and consistent with `SITEID` and `SUBJID`. That last one sounds
pedantic until you meet the case I did — a site that keyed another site's prefix, so the identifier said
site 1019 and the site column said 1020. Two different people, 64/F and 74/M, sharing one identifier
across four raw files. Nothing else would have caught it except the central lab, which happened to have
it right.

Second, referential integrity: every `USUBJID` in every domain exists in DM. Unique-in-DM tells you
nothing about orphans in AE.

Third, `--SEQ`: unique within `USUBJID` and domain, and non-null. That's the Required condition in the
IG. I'd also look at whether it's contiguous from 1, which isn't required but is what everyone does, so a
gap usually means something was dropped after numbering.

Fourth, the natural key — `USUBJID` plus preferred term plus start date for AE. That one's allowed to
have duplicates, so the check produces a list for a human rather than a pass or fail. Two rashes on the
same day can be real; the same rash entered twice is not, and the raw data in the study I've been working
with had seventeen exact duplicate rows from a double export.

The distinction I'd want to land is that `--SEQ` is a surrogate key. It identifies a row within one
build. It moves when the data changes, so reconciling two data cuts on it gives you nonsense, and
anything that stored a `--SEQ` last month is now pointing somewhere else."
:::
