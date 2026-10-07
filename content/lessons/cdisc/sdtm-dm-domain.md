## What problem are we trying to solve?

You are the first programmer on CBX417-301 and you have been told to start with DM. It sounds like the
easy one: one row per subject, age, sex, race, arm. A morning's work.

Then you write `RFSTDTC = min(EXSTDTC)` and 52 subjects come out null. Four of them were randomized.
Your `ARM` and `ACTARM` disagree for one subject and you cannot tell whether that is a bug or a fact. And
48 rows have no arm at all, which the safety programmer downstream is about to interpret as missing data.

**DM is the first domain you program because every other domain depends on it, and it is the domain with
the most decisions per column of any in the study.** Every `--DY` in every other domain is computed
against a date that lives here. Every population flag in ADaM starts from `ARM` and `ACTARM`. If DM is
wrong, everything downstream is wrong in a way that is extremely hard to trace.

::dataset{id="oncology/sdtm/dm" cols="USUBJID,SUBJID,SITEID,RFICDTC,RFSTDTC,RFXSTDTC,RFXENDTC,RFENDTC,ARMCD,ACTARMCD,ARMNRS,AGE,SEX,COUNTRY" rows="8" caption="DM — 468 rows, one per screened subject"}

Look at the first row. No `RFSTDTC`, no arm, `ARMNRS = "SCREEN FAILURE"`. That row is not incomplete.
It is correct, and knowing why is most of this lesson.

## Intuition

DM answers one question per subject: **who are they, what were they supposed to get, what did they
actually get, and when did their study start and stop?**

The structure follows from one decision: **who is in it.**

CBX417-301 has 468 rows because 468 people signed informed consent. Not 420 (the randomized) and not
416 (the treated). A subject who consents, is screened, fails screening and goes home still has a DM
record — because they were a trial subject, they were exposed to trial procedures, and the reviewer will
want to know how many there were and why they failed.

That single decision generates most of the domain's difficulty, because **48 of the 468 have no arm, no
reference start date and no exposure**, and every one of those nulls has to be explained rather than
just left empty.

:::why[Why not just exclude screen failures and ship 420 rows?]
Because a reviewer's first question about any trial is the subject-disposition flow: how many were
screened, how many failed, why, and how many were randomized. CONSORT diagrams are built from exactly
that. If the screen failures are not in the data, the sponsor has to assert the numbers in prose and the
reviewer has to take their word for it.

There is a second, harder reason. **Screen-failure data is where selection bias hides.** If one site
screen-failed 40% of its candidates and another 5%, that is worth knowing, and it is invisible unless
those subjects exist as rows.

CBX417-301 also does something common and worth flagging: it submits DM and DS for screen failures but
**not their other domains**. Subject `1001-0001` has a DM record and a screening vital-signs measurement
in `raw/vitals.csv`, and no `VS` records at all — the `VS` domain contains 3,393 mapped visit rows out of
3,441 raw ones, and the 48 missing are exactly those screening visits. That is a sponsor convention, and
the cSDRG has to state it.
:::

## Clinical context

The three date families in DM are constantly confused. They answer different questions.

| Variable | Question | In CBX417-301 |
|---|---|---|
| `RFICDTC` | When did they consent? | Populated for all 468 |
| `RFSTDTC` | **Subject reference start date** — the anchor for every `--DY` | 420 populated, 48 null |
| `RFXSTDTC` | When did they first get study treatment? | **416** populated, 52 null |
| `RFXENDTC` | When did they last get study treatment? | 416 populated |
| `RFENDTC` | When did their participation end? | 420 populated |
| `RFPENDTC` | End of participation | 420, identical to `RFENDTC` here |

:::number[Why RFSTDTC has 420 values but RFXSTDTC has only 416]
`RFXSTDTC` is a fact: the datetime of the first dose. Four randomized subjects were never dosed, so they
have no first dose and `RFXSTDTC` is correctly null.

`RFSTDTC` is a **sponsor decision**. SDTMIG defines it as the subject reference start date and leaves the
definition to the study. CBX417-301 defines it as the first dose — and, for the four randomized-but-never-treated
subjects, as the **randomization date**:

| `USUBJID` | `RFSTDTC` | `RFXSTDTC` | `ARMNRS` |
|---|---|---|---|
| `CBX417-301-1014-0015` | `2023-10-09` | *(null)* | ASSIGNED, NOT TREATED |
| `CBX417-301-1016-0010` | `2023-01-10` | *(null)* | ASSIGNED, NOT TREATED |
| `CBX417-301-1025-0012` | `2023-06-30` | *(null)* | ASSIGNED, NOT TREATED |
| `CBX417-301-1036-0009` | `2023-06-27` | *(null)* | ASSIGNED, NOT TREATED |

Each of those `RFSTDTC` values equals the subject's `RAND_DATE` in `raw/randomization.csv`, verified row
by row.

**The visible tell:** `RFSTDTC` for these four is 10 characters (`2023-10-09`) while for the other 416 it
is 16 (`2022-07-08T10:41`), because a first dose has a time and a randomization date does not.

Without that convention, those four subjects would have no anchor and **every `--DY` in every domain
would be null for them**. With it, their adverse events still get study days — measured from
randomization rather than from a dose they never received, which the cSDRG must say out loud.
:::

:::standard{kind="official"}
`RFSTDTC` is **Subject Reference Start Date/Time** in SDTMIG v3.4 and is the reference point for `--DY`
calculations. The IG does not fix its definition: the sponsor chooses, and the choice must be documented.
`RFXSTDTC` and `RFXENDTC` are separately defined as the datetimes of **first and last study treatment**,
and those are not sponsor choices.
:::

:::standard{kind="convention"}
Anchoring `RFSTDTC` on randomization for randomized-but-never-treated subjects is a common sponsor
convention, not a CDISC rule. Other studies leave `RFSTDTC` null for them (accepting null study days
throughout) or anchor it on informed consent. All three are defensible; only one can be true in your
study, and it belongs in the SDTM specification and the cSDRG.
:::

## Formal concept

### ARM, ACTARM and the reason a null is not missing

Four variables carry the treatment assignment, and they answer two different questions:

| | Planned | Actual |
|---|---|---|
| Code | `ARMCD` | `ACTARMCD` |
| Description | `ARM` | `ACTARM` |

`ARM` is what the randomization system assigned. `ACTARM` is what the subject actually received. In a
perfectly executed trial they are identical for everyone. CBX417-301 is not perfectly executed, and
neither is any real trial.

::dataset{id="oncology/sdtm/dm" cols="USUBJID,ARMCD,ARM,ACTARMCD,ACTARM,ARMNRS,ACTARMUD" filter="ARMNRS=UNPLANNED TREATMENT" rows="3" caption="Two subjects whose ACTARM cannot be a planned arm"}

:::number[The four populations of DM, counted]
```text
468  DM records        (informed consent)
 48  ARMNRS = SCREEN FAILURE           ARM null, ACTARM null, RFSTDTC null
420  randomized        (ARM populated: 210 CBX+DOC / 210 PBO+DOC)
  4  ARMNRS = ASSIGNED, NOT TREATED    ARM populated, ACTARM null
  2  ARMNRS = UNPLANNED TREATMENT      ARM populated, ACTARM null, ACTARMUD populated
414  ARM and ACTARM both populated
  1  of those 414 has ARM != ACTARM    (planned CBX+DOC, actual PBO+DOC)
```

`ACTARM` is therefore populated for **414** subjects, not 416, even though 416 were treated. The two
missing ones received a mixture that corresponds to no planned arm, so `ACTARM` is null by design and
`ACTARMUD` carries the description:

> *"Placebo + Docetaxel 75 mg/m2; CBX-417 200 mg kits dispensed in error for Cycles 3-4"*

The single `ARM != ACTARM` subject is different: subject `CBX417-301-1025-0011` was randomized to
CBX-417 and received placebo throughout. That *does* correspond to a planned arm, so `ACTARM` is
populated with it and `ARMNRS` stays null.
:::

:::standard{kind="official"}
`ARMNRS` — "Reason Arm and/or Actual Arm is Null" — is populated **only when `ARM` or `ACTARM` is null**,
and its values come from the NCI/CDISC codelist **ARMNULRS (C142179)**, which is **extensible** and
publishes five terms: `ASSIGNED, NOT TREATED`, `NOT ASSIGNED`, `SCREEN FAILURE`, `SCREENING NOT COMPLETED`
and `UNPLANNED TREATMENT`. CBX417-301 uses three of them. `ACTARMUD` — "Description of Unplanned Actual
Arm" — exists precisely for the `UNPLANNED TREATMENT` case.
:::

:::mistake[Populating ARMNRS for everybody]
`ARMNRS` is null for the 414 subjects whose `ARM` and `ACTARM` are both populated. Writing
`ARMNRS = "N/A"` or `"NONE"` on those rows is a conformance finding and makes the variable useless for
its one purpose: telling a reviewer that a null was deliberate.
:::

### Age, birth date and the privacy trade

```text
BRTHDTC = "1957"   AGE = 64   AGEU = "YEARS"
```

Every one of CBX417-301's 468 `BRTHDTC` values is **four characters** — the year only. That is not a
data-entry failure; it is a deliberate partial date.

:::why[Why would you deliberately throw away the birth month and day?]
Because a full date of birth combined with a site, a country and an enrolment date is close to
identifying, and many data-protection frameworks treat it as such. Collecting only the birth year and
deriving `AGE` from it at consent is a standard privacy measure, and ISO 8601 lets you say "year only"
precisely rather than guessing a month.

The cost is that `AGE` can no longer be recomputed exactly from `BRTHDTC` and `RFICDTC` — it is off by
up to a year depending on whether the birthday had passed. So `AGE` is **collected** in this study, not
derived, and the manifest records it that way: *"Age in years at informed consent, as collected on the
demographics form."*

This is a genuine trade, and it shows up downstream: an age subgroup analysis at a 65-year cut-off
depends on a number nobody can rederive. That is fine as long as everybody knows it, which is why origin
metadata exists.
:::

CBX417-301's ages run from **34 to 84**, median **63**, mean **62.3**.

## Worked example

Build `SEX`, `RACE` and `ETHNIC` from the raw demographics page. This is where DM stops being easy.

**The raw page:**

::dataset{id="oncology/raw/demographics" cols="SITE_ID,SUBJECT_ID,BIRTH_YEAR,AGE,SEX,RACE_WHITE,RACE_ASIAN,RACE_BLACK,RACE_AMIND,RACE_NHPI,RACE_OTHER,RACE_OTHER_SP,RACE_NOT_REPORTED,ETHNICITY,COUNTRY" rows="6" caption="Raw EDC demographics — SEX as free-ish text, RACE as seven checkboxes"}

**Problem 1 — `SEX` arrives in nine spellings.** Counted across the 468 raw rows:

| Raw value | n | Raw value | n |
|---|---:|---|---:|
| `M` | 262 | `F` | 176 |
| `Male` | 9 | `Female` | 6 |
| `MALE` | 2 | `female` | 1 |
| `1` | 7 | `f` | 1 |
| | | `2` | 4 |

**Thirty of the 468 values are not already `M` or `F`.** After trimming, case-folding and mapping the
numeric codes, DM has `M = 280` and `F = 188`, which is what the study reports.

:::standard{kind="official"}
`SEX` is governed by the non-extensible NCI/CDISC codelist **SEX (C66731)**. Non-extensible means you may
not add a value: `Male` is not a permitted submission value, and neither is `1`. The mapping is not
cosmetic tidying — it is the difference between a conformant domain and one that fails validation on
every row a site typed carelessly.
:::

**Problem 2 — `RACE` is seven checkboxes and one variable.** Counted from the raw page:

```text
444 subjects  exactly one race checkbox ticked
  8 subjects  two ticked
 16 subjects  RACE_NOT_REPORTED ticked
---
468
```

The mapping rule, as this study's specification states it:

| Raw situation | `DM.RACE` | Also |
|---|---|---|
| Exactly one ticked | that category | — |
| More than one ticked | `MULTIPLE` | each selection to `SUPPDM.QVAL`, `QNAM = "RACE1"`, `"RACE2"` |
| `RACE_OTHER` with free text | `OTHER` | free text to `SUPPDM`, `QNAM = "RACEOTH"` |
| None ticked / not reported | `NOT REPORTED` | — |

Which produces:

| `RACE` | n |
|---|---:|
| `WHITE` | 303 |
| `ASIAN` | 116 |
| `BLACK OR AFRICAN AMERICAN` | 20 |
| `NOT REPORTED` | 16 |
| `MULTIPLE` | 8 |
| `AMERICAN INDIAN OR ALASKA NATIVE` | 3 |
| `NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER` | 1 |
| `OTHER` | 1 |

And `SUPPDM` gains **8 `RACE1` records, 8 `RACE2` records and 1 `RACEOTH` record** — the arithmetic check
that nothing was lost when eight multi-race subjects were collapsed into one word.

:::standard{kind="simplification"}
This lesson presents race as a clean checkbox-to-codelist mapping. Race and ethnicity terminology has
changed across CT releases, and the CT package this project ships publishes the collected-race codelist
as **RACEC ("Race As Collected", C128689)** and collected ethnicity as **ETHNICC ("Ethnicity As
Collected", C128690)** — in which `MULTIPLE` is not a submission value. CBX417-301 uses the values that
appear in SDTMIG's own `DM` examples. **Check the codelist and CT version named in your study's
define.xml rather than copying another study's mapping**; this is one of the places where "how we did it
last time" ages badly.
:::

**Problem 3 — `COUNTRY`.** Raw holds `United States`, `Australia`, `Japan`; DM holds `USA`, `AUS`, `JPN`.
ISO 3166-1 alpha-3, 12 countries across 42 sites.

## Data example

The last DM variable, and the one that catches people: `DMDY`.

::dataset{id="oncology/sdtm/dm" cols="USUBJID,RFICDTC,RFSTDTC,DMDTC,DMDY,ARMNRS" rows="8" caption="DM — DMDTC is when the form was completed; DMDY is its study day"}

`DMDY` ranges from **-31 to -1** across the 420 randomized subjects and is **null for the 48 screen
failures**, because they have no `RFSTDTC` to count from.

:::number[There is exactly one DMDY of -1, and no DMDY of 0]
```text
DMDY = DMDTC − RFSTDTC + 1   when DMDTC >= RFSTDTC
DMDY = DMDTC − RFSTDTC       when DMDTC <  RFSTDTC
```

Subject `CBX417-301-1001-0004` completed the demographics form on `2022-11-06` and first dosed on
`2022-11-07`. The day before day 1 is **day −1**, not day 0.

Verified across all 420 subjects with both dates: every `DMDY` matches the two-branch formula, and none
is 0. Only one subject has `DMDY = -1`; the rest completed demographics earlier in screening, with a
median of −15.
:::

## Common mistakes

:::mistake[Setting RFSTDTC = RFXSTDTC and stopping]
They are equal for the 416 treated subjects and that is why the shortcut survives. It leaves the four
randomized-but-never-treated subjects with no anchor, which nulls every `--DY` they have, in every
domain. Whatever your study's convention is, the never-treated subjects are the case that tests it.
:::

:::mistake[Treating a null ARM as missing data]
Forty-eight subjects have no `ARM` because they were never randomized, and two have no `ACTARM` because
what they received corresponds to no planned arm. `ARMNRS` is how the standard distinguishes "deliberately
null" from "we lost it". A downstream program that filters `ARM ne ''` without understanding why gets the
right answer by accident; one that reports "48 missing arms" as a data issue wastes a data manager's week.
:::

:::mistake[Deriving ACTARM from ARM]
`ACTARM` comes from what was dispensed, not from what was assigned. In CBX417-301 it is derived from the
kit content recorded in `EX`, and the result is that one subject's `ACTARM` differs from their `ARM` and
two subjects have no `ACTARM` at all. If your `ACTARM` never disagrees with `ARM`, you have not derived
it — you have copied it, and the safety population will be wrong.
:::

:::mistake[Assuming AGE can be recomputed from BRTHDTC]
`BRTHDTC` is year-only in this study, deliberately. `AGE` is collected, not derived, and the two cannot be
reconciled to the day. Writing a QC check that recomputes age from the birth year will flag roughly half
the study.
:::

:::mistake[Letting raw SEX values through]
Thirty of 468 raw values are not `M` or `F` — `Male`, `MALE`, `female`, `1`, `2`. `SEX` uses a
non-extensible codelist; every unmapped value is a conformance error, and `1`/`2` will silently sort and
summarise as something other than sex in every downstream table.
:::

## Knowledge check

::quiz{ids="sdtm.dm.rfstdtc-vs-rfxstdtc,sdtm.dm.armnrs-when,sdtm.dm.actarm-source,sdtm.dm.dm-rowcount"}

## Hands-on exercise

::practice{ids="sdtm.dm.count-populations,sdtm.dm.race-mapping,sdtm.dm.sex-code,sdtm.dm.dmdy-calc" title="Practice: building DM from the raw pages"}

## Challenge exercise

::practice{ids="sdtm.dm.never-treated-trace,sdtm.dm.unplanned-arm,sdtm.dm.open-first-domain" title="Challenge: the subjects who break the easy rules"}

## Industry note

**DM is programmed first and finished last.** It is programmed first because everything else needs
`RFSTDTC` and `USUBJID`; it is finished last because `RFXSTDTC` comes from `EX`, `RFENDTC` comes from
`DS`, `DTHDTC` comes from the death form, and `ACTARM` comes from dispensing records. The usual pattern
is a skeleton DM early, then a rebuild once the contributing domains are stable, then a re-run of every
`--DY` in the study.

**The circularity is real and it bites.** `EX.EXSTDY` needs `DM.RFSTDTC`, and `DM.RFXSTDTC` needs
`EX.EXSTDTC`. Studies handle it with a two-pass build: derive the reference dates from `EX` first,
finalise `DM`, then compute every `--DY` including `EX`'s. Getting the passes in the wrong order produces
a domain that looks fine and has study days computed against a stale anchor.

::widget{name="trace-value" tlf="demog"}

:::standard{kind="convention"}
Submitting DM (and DS) for screen failures while omitting their other domains is a widespread sponsor
convention rather than a CDISC requirement. Regulators have at times asked for more screen-failure data,
and some sponsors submit all of it. The decision belongs in the SDTM specification and must be stated in
the cSDRG; what is not acceptable is doing it silently, because a reviewer counting `VS` records per
subject will otherwise find 48 subjects with none.
:::

:::interview[Walk me through building DM for a study with screen failures and dosing errors.]
"DM is one row per subject, and the first decision is which subjects — I'd include everyone who signed
informed consent, so on the study I've been working with that's 468 rows, not the 420 randomized or the
416 treated. Screen failures get a row with `ARMNRS = 'SCREEN FAILURE'` and null arm and reference dates.

The reference dates are where the thinking is. `RFXSTDTC` and `RFXENDTC` are facts — first and last dose
from EX — so they're null for anyone never dosed. `RFSTDTC` is a sponsor decision, and it matters because
every `--DY` in every domain is computed from it. That study defines it as first dose, and for the four
randomized-but-never-treated subjects it falls back to the randomization date, so those subjects still
get study days. You can see it in the data: their `RFSTDTC` is ten characters because a randomization
date has no time, where everyone else's is sixteen.

Then the arms. `ARM` is from IxRS, `ACTARM` is derived from what was actually dispensed — in that study,
from the kit content in EX. They disagree for one subject who was randomized to active and received
placebo throughout; `ACTARM` is populated with the placebo arm because that's still a planned arm. Two
other subjects received a mixture that matches no planned arm, so their `ACTARM` is null with
`ARMNRS = 'UNPLANNED TREATMENT'` and the description in `ACTARMUD`. So `ACTARM` is populated for 414
subjects even though 416 were treated.

The mechanical part that still costs a day is controlled terminology on the collected fields. Raw `SEX`
came in nine different spellings — `M`, `Male`, `MALE`, `1`, `2` — and `SEX` is a non-extensible
codelist, so every one of those has to map to `M` or `F`. Race is seven checkboxes collapsing into one
variable, with the multi-select subjects going to `MULTIPLE` and their individual selections preserved
in SUPPDM."
:::
