## What problem are we trying to solve?

A validation report lands on your desk the day before a delivery. One finding, repeated 30 times:

```text
SD0003  Value for SEX not found in (SEX) CDISC Controlled Terminology codelist   Severity: Error
```

You open `raw/demographics.csv` and count. Across 468 subjects, the `SEX` field arrived in **nine
distinct spellings**:

| Raw value | n | Raw value | n |
|---|---:|---|---:|
| `M` | 262 | `F` | 176 |
| `Male` | 9 | `Female` | 6 |
| `MALE` | 2 | `female` | 1 |
| `1` | 7 | `f` | 1 |
| | | `2` | 4 |

**Thirty values are not `M` or `F`.** Each is perfectly clear to a human and every one is a conformance
error, because `SEX` uses a codelist that permits exactly four values and none of them is `Male`.

That is the easy half. The hard half is the question you cannot answer by looking at the data at all:

> *Is `CBX+DOC` an allowed value for `ARMCD`?*

`Male` is wrong because a published list says so. `CBX+DOC` is right because no published list governs
`ARMCD` and the sponsor defines it. **Knowing which case you are in, for any variable, is what this
lesson is about** — and the answer is never "I think so".

## Intuition

Controlled terminology is a **published list of permitted values, attached to a named variable**. Three
facts define any codelist:

| | Example |
|---|---|
| **Short name** — how you refer to it | `OUT` |
| **C-code** — the NCI concept code, stable across versions | `C66768` |
| **Extensible** — may the sponsor add terms? | No |

The extensibility flag is the one that changes what you are allowed to do:

- **Non-extensible.** The list is closed. Any value outside it is an error. `SEX`, `NY`, `ACN`, `OUT`.
- **Extensible.** The published terms are the ones you should use if they fit, and the sponsor may add
  terms that do not. `LBTESTCD`, `UNIT`, `EPOCH`, `NRIND`.

:::why[Why are some lists closed and others open?]
Because of what the variable is for.

`AEOUT` has six possible answers and always will — an event resolved, resolved with sequelae, is
resolving, has not resolved, was fatal, or is unknown. That set is complete, so closing it makes every
study's outcome column directly comparable.

`LBTESTCD` cannot be closed. The published list has **2,505** terms and no list of laboratory tests will
ever be finished; a study measuring something new must still be able to submit it. So it is extensible,
and the sponsor extension is documented in define.xml.

The asymmetry is a design choice about where comparability matters. Closing `AEOUT` makes safety
reviews poolable. Closing `LBTESTCD` would make some studies unsubmittable.
:::

:::standard{kind="official"}
CDISC controlled terminology is developed by CDISC and **published by NCI Enterprise Vocabulary
Services (EVS)**, in quarterly packages, separately for SDTM, ADaM, CDASH, SEND and Define-XML. Each
codelist carries an NCI C-code, a short name, an extensibility flag and a set of submission values with
optional synonyms. The package version your study uses is recorded in define.xml.
:::

## Clinical context

Every codelist CBX417-301 uses, taken from the study's own metadata and checked against the SDTM CT
package that ships with this app:

| Variable(s) | Codelist | C-code | Extensible | Terms |
|---|---|---|---|---:|
| `SEX` | SEX | C66731 | **No** | 4 |
| `AGEU` | AGEU | C66781 | **No** | 5 |
| `AESER`, `DTHFL`, `AESDTH`, … (13 variables) | NY | C66742 | **No** | 4 |
| `AEACN` | ACN | C66767 | **No** | 8 |
| `AEOUT` | OUT | C66768 | **No** | 6 |
| `AEENRTPT`, `CMENRTPT`, `MHENRTPT` | STENRF | C66728 | **No** | 8 |
| `LBSTAT`, `TRSTAT` | ND | C66789 | **No** | 1 |
| `ARMNRS` | ARMNULRS | C142179 | Yes | 5 |
| `EPOCH` (15 domains) | EPOCH | C99079 | Yes | 15 |
| `LBNRIND` | NRIND | C78736 | Yes | 4 |
| `LBTESTCD` | LBTESTCD | C65047 | Yes | 2,505 |
| `VSTESTCD` | VSTESTCD | C66741 | Yes | 76 |
| `EGTESTCD` | EGTESTCD | C71153 | Yes | 115 |
| `TRTESTCD` | TRTESTCD | C96779 | Yes | 81 |
| `--ORRESU`, `--STRESU`, `EXDOSU` (6 variables) | UNIT | C71620 | Yes | 950 |
| `VSPOS` | POSITION | C71148 | Yes | 17 |
| `RSEVAL`, `TREVAL` | EVAL | C78735 | Yes | 65 |
| `EXROUTE`, `CMROUTE` | ROUTE | C66729 | Yes | 143 |
| `EXDOSFRQ`, `CMDOSFRQ` | FREQ | C71113 | Yes | 102 |
| `EXDOSFRM` | FRM | C66726 | Yes | 196 |
| `LBSPEC` | SPECTYPE | C78734 | Yes | 129 |
| `RSCAT` | CCCAT (for `ECOG`) | C118971 | Yes | 92 |
| `TSPARMCD`, `TSPARM` | TSPARMCD / TSPARM | C66738 / C67152 | Yes | 129 |

And the variables with **no codelist at all**, where the sponsor decides:

| Variable | What governs it |
|---|---|
| `ARM`, `ARMCD`, `ACTARM`, `ACTARMCD` | The sponsor, consistent with the `TA` domain |
| `AEREL` | The sponsor — this study uses `RELATED` / `NOT RELATED` |
| `AETOXGR` | CTCAE, an external grading system |
| `AEDECOD`, `AEBODSYS`, `AESOC` | MedDRA, an external dictionary |
| `CMDECOD`, `CMCLAS` | WHODrug, an external dictionary |
| `USUBJID`, `SUBJID`, `SITEID`, `--SPID`, `--REFID` | Identifiers, by definition uncontrolled |

:::mistake[Assuming every variable has a codelist]
`AEREL` does not, in SDTMIG v3.4. Sponsors commonly use `RELATED`/`NOT RELATED`, or a five-level
scale — `NOT RELATED`, `UNLIKELY RELATED`, `POSSIBLY RELATED`, `PROBABLY RELATED`, `RELATED` — and both
are conformant. CBX417-301 uses the two-level version, 1,412 `NOT RELATED` and 1,051 `RELATED`, with 3
records null. Whichever your study uses goes in define.xml as a sponsor codelist, and an analysis that
assumes another study's levels will silently mis-summarise.
:::

## Formal concept

### The three kinds of terminology, which people conflate

| | Published by | Example | Where the values live |
|---|---|---|---|
| **CDISC/NCI CT** | NCI EVS for CDISC | `AEOUT = "FATAL"` | The quarterly CT package |
| **External dictionaries** | Their own owners, licensed | `AEDECOD = "Fatigue"` (MedDRA), `CMDECOD = "CARBOPLATIN"` (WHODrug) | The dictionary, versioned separately |
| **Sponsor codelists** | You | `ARMCD = "CBX+DOC"` | define.xml |

All three appear in define.xml as codelists, which is why they get conflated. They behave completely
differently: you cannot extend the first kind when it is non-extensible, you cannot extend the second
kind at all, and you own the third.

:::standard{kind="simplification"}
CBX417-301's coded terms are **MedDRA-like and WHODrug-like**, with no dictionary codes, because both
dictionaries are licensed and cannot ship with a training dataset. Real MedDRA uses UK spelling
("Diarrhoea", not "Diarrhea") and carries numeric codes at every level; real WHODrug carries ATC codes
and drug record numbers. The study's README labels this explicitly. **In a real submission, the
dictionary version is a required piece of metadata** — MedDRA is released twice a year, and which
version coded your study determines which preferred terms exist.
:::

### Synonyms are lookup aids, not submission values

The CT package publishes synonyms alongside each submission value:

```text
OUT  [C66768]  extensible=No
   FATAL                              (synonyms: 5; FATAL; Grade 5)
   NOT RECOVERED/NOT RESOLVED
   RECOVERED/RESOLVED
   RECOVERED/RESOLVED WITH SEQUELAE
   RECOVERING/RESOLVING
   UNKNOWN                            (synonyms: U; UNK; Unknown)
```

The synonyms exist so that you can *find* the right submission value when your CRF says `Unknown` or
`UNK`. **They are not what you submit.** `AEOUT = "Unknown"` is a conformance error; `AEOUT = "UNKNOWN"`
is correct.

### The lookup workflow

The habit that keeps this from being guesswork:

```bash
python3 scripts/tools/ct_lookup.py OUT            # by codelist short name
python3 scripts/tools/ct_lookup.py --term QTCFAG  # find which codelist a value belongs to
python3 scripts/tools/ct_lookup.py --search Race  # find a codelist by name
```

Three questions, in order, for any collected field:

1. **Does a codelist govern this variable?** SDTMIG says, and the study's SDTM specification should
   repeat it.
2. **Is it extensible?** This decides whether a value outside the list is an error or a documented
   extension.
3. **Which submission value does my collected value map to?** Search the terms and the synonyms.

## Worked example

Map the adverse-event page's coded fields for CBX417-301.

**Field 1 — `AE_OUTCOME`.** Raw values and counts across 2,472 records:

| Raw | n | Codelist OUT submission value |
|---|---:|---|
| `Recovered/Resolved` | 2,127 | `RECOVERED/RESOLVED` |
| `Not recovered/Not resolved` | 297 | `NOT RECOVERED/NOT RESOLVED` |
| `Fatal` | 28 | `FATAL` |
| `Recovering/Resolving` | 16 | `RECOVERING/RESOLVING` |
| `Recovered/Resolved with sequelae` | 3 | `RECOVERED/RESOLVED WITH SEQUELAE` |
| `Unknown` | 1 | `UNKNOWN` |

A pure case-fold. Every raw value maps one-to-one, and the resulting `AEOUT` distribution across the
2,466 SDTM records is `RECOVERED/RESOLVED` 2,123, `NOT RECOVERED/NOT RESOLVED` 295, `FATAL` 28,
`RECOVERING/RESOLVING` 16, `RECOVERED/RESOLVED WITH SEQUELAE` 3, `UNKNOWN` 1.

:::number[Why the raw and SDTM counts differ by six]
Because six raw records were not mapped: five exact duplicate rows created by a double EDC export, and
one adverse event that started before the subject's informed consent date.

**Counting the codelist distribution before and after mapping is a genuine check**, not busywork. The
proportions should be identical; a shift means records were lost somewhere other than where you think.
:::

**Field 2 — `AE_ACTION_CBX`.** Codelist ACN (C66767), non-extensible, eight terms:

```text
DOSE INCREASED  DOSE NOT CHANGED  DOSE RATE REDUCED  DOSE REDUCED
DRUG INTERRUPTED  DRUG WITHDRAWN  NOT APPLICABLE  UNKNOWN
```

The study uses five of them. **Using only part of a codelist is normal and correct** — you submit the
values that occurred, not all the values that could have.

**Field 3 — `CODED_PT`, the preferred term.** Not CDISC CT at all. It is MedDRA, an external dictionary,
and the mapping is not a codelist lookup but a **clean-up of what the coding system returned**:

| Raw `CODED_PT` | Corrected |
|---|---|
| `ALOPECIA` | `Alopecia` |
| `HYPERTENSION` | `Hypertension` |
| `Constipation ` *(trailing space)* | `Constipation` |
| `general disorders and administration site conditions` | `General disorders and administration site conditions` |

Seven such records in `ae.csv`, three in `cm.csv`, three in `mh.csv` — case and whitespace variants of
dictionary terms. These are not CT errors. They are the reason **"trim, then compare" is the first line
of every coded-field mapping**, because a trailing space is invisible in every viewer you would check it
in and breaks every exact join.

**Field 4 — `AE_REL_CBX`.** No codelist. The sponsor's values, in define.xml, and nothing to look up.

## Data example

The case that looks like a terminology problem and is not.

`raw/ex_study_drug.csv` records what the site typed into the drug-name field. Across 4,131 records:

| `DRUG_NAME_ENTERED` | n |
|---|---:|
| `CBX-417/Placebo` | 2,539 |
| `CBX-417 or placebo` | 728 |
| `Study drug` | 537 |
| `CBX417/PBO` | 322 |
| `PLB` | 3 |
| `CBX-471` | 2 |

Six variants including a **misspelling of the product name** — `CBX-471` instead of `CBX-417`.

The instinct is to build a mapping table from those six strings to `EXTRT`. **That instinct is wrong,
and the reason is not about terminology at all.**

:::why[Why is the collected drug name unusable here?]
Because the study is **double-blind**. The site does not know what the subject received; the field
records what the coordinator typed, which is a description of the bottle, not its contents.

`EXTRT` is derived from the **kit number** instead: `EXREFID` holds it — 3,936 distinct kits across
4,138 CBX-417 and placebo records — and the IxRS kit list says what was in each kit. That is the only
authoritative link between a subject and their actual treatment, and it is the same link that derives
`DM.ACTARM`.

The answer key states it plainly: the misspelled and abbreviated free-text values are *"ignored for
mapping (actual treatment comes from the kit list)"*.

**The lesson generalises.** Before building a mapping table, ask whether the source field is
authoritative for what you are mapping. A blinded drug-name field, a site-entered laboratory unit when a
central laboratory reports one, a verbatim term when a coding system has already run — in each case the
tidy-looking mapping is from the wrong column.
:::

::dataset{id="oncology/sdtm/ex" cols="USUBJID,EXSEQ,EXREFID,EXTRT,EXDOSE,EXDOSU,EXDOSFRM,EXDOSFRQ,EXROUTE" rows="8" caption="EX — EXTRT comes from the kit, not from the free-text drug name"}

Note the fully controlled columns in that view: `EXDOSU = "mg"` (UNIT), `EXDOSFRM` is
`TABLET` or `INJECTION, SOLUTION, CONCENTRATE` (FRM), `EXDOSFRQ` is `QD` or `ONCE` (FREQ), `EXROUTE` is
`ORAL` or `INTRAVENOUS` (ROUTE). All four codelists are extensible, and all four values here are
published terms — **extensible does not mean "invent your own"**, it means "extend only when nothing
fits".

## Common mistakes

:::mistake[Submitting a synonym instead of the submission value]
`UNKNOWN` is the submission value; `Unknown`, `UNK` and `U` are synonyms published to help you find it.
Synonyms are lookup aids. They are not permitted values, and a non-extensible codelist will reject them.
:::

:::mistake[Extending a non-extensible codelist]
`ACN` has eight terms and is closed. If a study collects "dose delayed", it maps to `DRUG INTERRUPTED`
or it does not go in `AEACN` at all — and if the distinction genuinely matters, the extra detail goes to
`SUPPAE`. Adding a ninth term is not an option, however reasonable it looks.
:::

:::mistake[Treating MedDRA and WHODrug as CDISC terminology]
They are separate, licensed, externally versioned dictionaries. `AEDECOD` has no CDISC codelist. What
define.xml records is the **dictionary and its version**, and that version matters: MedDRA is released
twice a year and preferred terms change between releases.
:::

:::mistake[Building a mapping table from a non-authoritative field]
Six spellings of the study drug name, including a misspelling, and none of them is used — because the
study is blinded and the kit list is the authority. Ask what the source of truth is before you write the
lookup.
:::

:::mistake[Comparing coded text without trimming]
Thirteen records in this study's raw files differ from their dictionary term only by case or a trailing
space. Every exact join against them fails, silently, producing a null coded term on a record that looks
fine in the listing.
:::

:::mistake[Assuming the CT version is "the current one"]
CT is published quarterly and studies are locked against a version. A term added last quarter is not
available to a study that declared an earlier package, and a term whose submission value changed between
packages will fail validation against the wrong one. The version is in define.xml because it is part of
the answer.
:::

## Knowledge check

::quiz{ids="sdtm.ct.extensible-meaning,sdtm.ct.synonym-trap,sdtm.ct.no-codelist,sdtm.ct.meddra-not-ct"}

## Hands-on exercise

::practice{ids="sdtm.ct.map-outcome,sdtm.ct.count-sex,sdtm.ct.lookup-workflow,sdtm.ct.ct-code" title="Practice: turning collected text into submission values"}

## Challenge exercise

::practice{ids="sdtm.ct.wrong-source,sdtm.ct.closed-list-problem,sdtm.ct.open-ct-strategy" title="Challenge: when the codelist does not have what you need"}

## Industry note

**Terminology work is front-loaded and then it is maintenance.** The study's SDTM specification names a
codelist for every variable, and the mapping tables are written once. After that, the recurring job is
catching values that arrive from sites and vendors and do not map — which is why every mapping program
should **stop** on an unmapped value rather than producing a null.

**The CT version is a study-level decision made early.** It is recorded in define.xml and it constrains
everything: a term added in a later package is not available to you. Studies running for years
occasionally update the CT version mid-study, and that is a controlled change with its own impact
assessment, because a submission value that changed between packages means re-mapping existing data.

:::standard{kind="convention"}
Sponsors maintain an internal **standards library** — a global mapping from common collected values to
submission values, reused across studies — and a governance process for adding to it. This is where
"how we did it last time" is supposed to live, and it is why a new programmer's first mapping question
is usually answered by a lookup rather than by a decision. The library is a sponsor artifact, not a
CDISC one, and its quality varies enormously between companies.
:::

:::interview[A validation report says a value is not in the codelist. Walk me through what you do.]
"First I find out whether the codelist is extensible, because that decides whether this is an error or a
documentation gap.

If it's non-extensible — `SEX`, `AEOUT`, `AEACN`, `NY` — then the value is simply wrong and the question
is how it got there. Usually the collected value is a legitimate synonym that wasn't mapped: `Unknown`
instead of `UNKNOWN`, or `Male` instead of `M`. On the study I've been working with, thirty of the 468
raw `SEX` values weren't `M` or `F` — `Male`, `MALE`, `female`, and numeric codes `1` and `2`. Every one
of those is a conformance error and every one of them is obvious to a human, which is exactly why the
mapping has to be explicit and has to stop rather than produce a null.

If it's extensible — `LBTESTCD`, `UNIT`, `EPOCH` — then the question is whether a published term already
covers it. Extensible doesn't mean invent your own; it means extend when nothing fits. If nothing fits,
it becomes a sponsor extension and it has to appear in define.xml as such, and be explained in the
cSDRG.

Then I'd check whether the variable has a CDISC codelist at all. `AEREL` doesn't — sponsors use
`RELATED`/`NOT RELATED` or a five-level scale, and both are conformant. `AEDECOD` doesn't either; that's
MedDRA, an external licensed dictionary with its own version, and what define.xml records is the
dictionary version rather than a term list.

And I'd check the CT package version the study declared, because a term added after that package isn't
available to us regardless of how right it looks in today's release."
:::
