## What problem are we trying to solve?

A statistician asks for mean systolic blood pressure at Cycle 4 Day 1 by treatment arm. You open the
vital-signs page in the EDC export and it looks like a spreadsheet somebody would actually keep:

```csv
RECORD_ID,SITE_ID,SUBJECT_ID,VISIT_NAME,VS_DATE,VS_TIME,SYSBP,DIABP,PULSE,TEMP,TEMP_UNIT,WEIGHT,WEIGHT_UNIT,HEIGHT,HEIGHT_UNIT,ECOG
VS-000002,1001,1001-0002,Screening,17 JUN 2022,09:03:00,105,92,77,36.8,C,65.3,kg,171,cm,1
```

One row per subject per visit. 3,441 of them. Six measurements side by side, each in its own column.

CBX417-301's `VS` domain has **17,385 rows**, and not one of them has a column called `SYSBP`.

::dataset{id="oncology/sdtm/vs" cols="USUBJID,VSSEQ,VSTESTCD,VSTEST,VSPOS,VSORRES,VSORRESU,VSSTRESC,VSSTRESN,VSSTRESU,VSLOBXFL,VISITNUM,VISIT,VSDTC,VSDY" rows="8" caption="VS — 17,385 rows, one per measurement, and the test code is data rather than a column name"}

Two things happened between the CRF and the domain, and both are the lesson.

**The page was rotated.** Six columns became six rows, and the column *name* became a value in
`VSTESTCD`. That is what "Findings are long" means in practice, and it is the single transformation that
turns almost every CRF page into a Findings domain.

**One column left the page entirely.** `ECOG` is collected on the vital-signs form and does not appear
in `VS` at all. It is in `RS`, 3,075 records of it, alongside the RECIST response assessments — because
a performance status is a clinical classification and not a vital sign, and SDTM places data by what it
*is*, not by which page it arrived on.

## Intuition

`VS` and `EG` are the same domain twice. Both are Findings; both have a topic variable ending in
`--TESTCD`; both carry an original result, a standardized result, a unit, timing and a baseline flag.
Learn one and you can read the other, and then `LB`, `PC`, `PE`, `QS` and everything else in the class.

The whole structure follows from one decision: **the thing being measured is data, not metadata.**

```text
Wide (the CRF)                 Long (SDTM)
VISIT     SYSBP DIABP PULSE    VISIT      VSTESTCD  VSORRES
SCREENING   105    92    77    SCREENING  SYSBP         105
                               SCREENING  DIABP          92
                               SCREENING  PULSE          77
```

Adding a measurement to the wide table means adding a column, which changes the table. Adding one to the
long table means adding rows.

:::why[Why does SDTM insist on long, when wide is easier to read?]
Because a reviewer's tool has to work on every study, and column names are not comparable across
studies. One sponsor writes `SYSBP`, another `SBP`, another `BP_SYS`. If the measurement is a column
name, then reading the data requires knowing the sponsor's column names — which is the exact problem
standards exist to remove.

Put the measurement in a **controlled-terminology value** and it is comparable: every study's systolic
blood pressure is `VSTESTCD = "SYSBP"`, and a tool can find it without being told.

The cost is real and worth naming: **long data is harder to read by eye and harder to compute a ratio
from.** Computing body mass index means putting weight and height back side by side. That is a genuine
inconvenience, it is paid in ADaM rather than SDTM, and it is the price of the comparability.
:::

## Clinical context

CBX417-301 measures six things on the vital-signs page and three on the ECG:

::::tabs
:::tab[VS — 17,385 records]
| `VSTESTCD` | `VSTEST` | Records | `VSSTRESU` | `VSPOS` |
|---|---|---:|---|---|
| `SYSBP` | Systolic Blood Pressure | 3,393 | mmHg | `SITTING` |
| `DIABP` | Diastolic Blood Pressure | 3,393 | mmHg | `SITTING` |
| `PULSE` | Pulse Rate | 3,393 | beats/min | `SITTING` |
| `TEMP` | Temperature | 3,393 | C | *(null)* |
| `WEIGHT` | Weight | 3,393 | kg | *(null)* |
| `HEIGHT` | Height | **420** | cm | *(null)* |

Height is collected **once**, at screening. Everything else is collected at every visit.
:::

:::tab[EG — 5,601 records]
| `EGTESTCD` | `EGTEST` | Records | `EGSTRESU` | `EGSTRESN` |
|---|---|---:|---|---|
| `QTCFAG` | QTcF Interval, Aggregate | 1,867 | ms | populated |
| `EGHRMN` | ECG Mean Heart Rate | 1,867 | beats/min | populated |
| `INTP` | Interpretation | 1,867 | *(null)* | **null on all 1,867** |

1,867 ECGs × 3 tests. Every ECG produces all three records, so the arithmetic is exact.
:::
::::

:::standard{kind="official"}
`VSTESTCD` uses the NCI/CDISC codelist **VSTESTCD (C66741)**, extensible, with 76 published terms;
`VSTEST` uses **VSTEST (C67153)**. All six of this study's test codes are published terms, and the test
names are the published names that pair with them. `EGTESTCD` uses **EGTESTCD (C71153)**, extensible,
115 terms, and `EGTEST` uses **EGTEST (C71152)**; `QTCFAG`, `EGHRMN` and `INTP` are all published.

Note that `--TESTCD` and `--TEST` are a *pair*: the submission value in one determines the submission
value in the other, and mixing a code from the codelist with a name you invented is a conformance
finding.
:::

### Where the ECOG went

`ECOG` sits between `HEIGHT_UNIT` and the end of the vital-signs row in the raw export. It is not a
vital sign. It becomes an `RS` record:

```text
RS.RSTESTCD = "ECOG101"
RS.RSCAT    = "ECOG"
RS.RSTEST   = "ECOG1-Performance Status"
RS.RSORRES  = "Restricted in physically strenuous activity but ambulatory and able to
               carry out work of a light or sedentary nature, e.g., light house work,
               office work"
RS.RSSTRESC = "1"
RS.RSEVAL   = "INVESTIGATOR"
```

:::standard{kind="official"}
`ECOG101` is the single published term in **ECOG1TC (C101815)**, non-extensible, with the test name
`ECOG1-Performance Status` in **ECOG1TN (C101816)**. Its results have their own two codelists:
**ECOG101OR (C179943)**, non-extensible, six terms, holds the long descriptive strings that go in
`RSORRES`, and **ECOG101STR (C179944)**, non-extensible, holds `0` through `5` for `RSSTRESC`. The
verbose string above is the exact published submission value — the scale's own wording, reproduced
rather than abbreviated, because the string *is* the definition and `1` on its own is ambiguous across
scales. It is the same `--ORRES`/`--STRESC` logic as a laboratory result in different clothing.
:::

:::standard{kind="convention"}
`RSCAT = "ECOG"` is a **sponsor value**. The published codelist for categories of oncology response
assessment, **ONCRSCAT (C124298)**, is extensible and includes `RECIST 1.1` — which this study uses for
its response records — but does not publish `ECOG`. Putting performance status in `RS` with a sponsor
category is a common arrangement and has to be recorded in define.xml as a sponsor extension. Other
studies place ECOG in a Findings domain of their own. Neither is wrong; only one can be true in your
study.
:::

## Formal concept

### The units trap

Every value on the vital-signs page arrives with the unit the site used, and two sites did not use the
study's units:

| `VSTESTCD` | Original unit | Records | Standard unit | Conversion |
|---|---|---:|---|---|
| `TEMP` | `C` | 3,381 | `C` | none |
| `TEMP` | **`F`** | **12** | `C` | $(F - 32) \times 5/9$ |
| `WEIGHT` | `kg` | 3,383 | `kg` | none |
| `WEIGHT` | **`LB`** | **10** | `kg` | $\times\ 0.45359237$ |
| `SYSBP`, `DIABP` | `mmHg` | 3,393 each | `mmHg` | none |
| `PULSE` | `beats/min` | 3,393 | `beats/min` | none |
| `HEIGHT` | `cm` | 420 | `cm` | none |

**Twenty-two records out of 17,385.** One tenth of one percent, and they are the reason the domain has
`VSSTRESN` at all.

:::number[The two conversions, checked against the data]
```text
97.2 F   ->  (97.2 - 32) x 5/9        = 36.222   stored as VSSTRESN = 36.2
199.1 LB ->  199.1 x 0.45359237       = 90.310   stored as VSSTRESN = 90.3
```

Both records exist: subject `CBX417-301-1002-0001`, screening temperature and a Cycle 4 Day 1 weight.
All 12 Fahrenheit records and all 10 pound records land in `VSSTRESN` at one decimal place, and
`VSORRES`/`VSORRESU` keep `97.2` and `F` unchanged.

**The individual wrong values are obvious and the summary is not.** A temperature of 97.2 °C and a
weight of 199.1 kg are both visibly impossible in a listing. But a mean computed over `VSORRES` —
pooling the 12 unconverted Fahrenheit readings with the 3,381 Celsius ones — comes out at
**36.82 °C** where the correct mean over `VSSTRESN` is **36.61 °C**. Weight behaves the same way:
70.55 kg pooled against 70.28 kg converted.

Both wrong answers look like perfectly reasonable answers. That is the whole problem with a unit error
in an aggregate: twelve absurd values out of 3,393 do not make the mean absurd, they make it slightly
wrong, and nothing in a summary table can show you which.
:::

:::standard{kind="official"}
`VSORRESU` and `VSSTRESU` use **VSRESU (C66770)** — "Units for Vital Signs Results" — which is
extensible and publishes 29 terms. `C`, `F`, `LB`, `kg`, `cm`, `mmHg` and `beats/min` are all published
submission values, and note the case: the pound is **`LB`**, not `lb`. `EG` has no dedicated units
codelist in this package; `EGORRESU` and `EGSTRESU` here use `ms` and `beats/min` from the general
**UNIT (C71620)** codelist, extensible, 950 terms.
:::

:::mistake[Treating a non-standard unit as a data error]
The study's answer key classifies all 22 as **"NON-STANDARD UNIT"** with the resolution *"Not an error:
unit recorded."* The site wrote down what its thermometer and its scale showed, and wrote down which
one. That is correct data collection. Querying the site to re-enter it in Celsius invents a number the
site never measured; converting it in SDTM and keeping the original is what the result pair is for.

Compare with the two records in the same file that **are** errors: a height of `17` cm and a weight of
`732` kg. Those were queried and corrected at the site to 172 cm and 73.2 kg, because no unit makes
them true.
:::

### One test, two results — and the one that has no number

`EG` is where the character-versus-numeric distinction in the standard result stops being theoretical:

```text
EGTESTCD = "QTCFAG"   EGORRES = "421"       EGSTRESC = "421"       EGSTRESN = 421
EGTESTCD = "EGHRMN"   EGORRES = "65"        EGSTRESC = "65"        EGSTRESN = 65
EGTESTCD = "INTP"     EGORRES = "Normal"    EGSTRESC = "NORMAL"    EGSTRESN = (null)
```

`EGSTRESC` is character and populated on all 5,601 records. `EGSTRESN` is numeric and null on all 1,867
`INTP` records, because an interpretation has no number.

::dataset{id="oncology/sdtm/eg" cols="USUBJID,EGSEQ,EGTESTCD,EGTEST,EGORRES,EGORRESU,EGSTRESC,EGSTRESN,EGSTRESU,EGLOBXFL,VISIT,EGDTC,EGDY" rows="9" caption="EG — three records per ECG, and the interpretation has no EGSTRESN"}

:::standard{kind="convention"}
The study's interpretation values are `NORMAL` (1,641) and `ABNORMAL` (226). Both are submission values
of the NCI/CDISC codelist **NORMABNM (C101834)**, "Normal Abnormal Response", non-extensible, with five
terms: `ABNORMAL`, `INDETERMINATE`, `NORMAL`, `NOT EVALUABLE` and `UNKNOWN`. Which codelist applies to
`EGSTRESC` is a study decision recorded in define.xml as **value-level metadata** — the codelist attaches
to `EGSTRESC` *where* `EGTESTCD = "INTP"`, not to `EGSTRESC` as a whole, because on the other 3,734
records that variable holds a number.
:::

:::number[Three collected values, two submitted ones — and what that costs]
The raw ECG export has three interpretation values, not two:

| `INTERPRETATION` | Raw records |
|---|---:|
| `Normal` | 1,641 |
| `Abnormal, not clinically significant` | 220 |
| `Abnormal, clinically significant` | **6** |

`EG` has `NORMAL` 1,641 and `ABNORMAL` 226. **The clinical-significance distinction is not carried
anywhere in the submitted domain**, and the six records a cardiologist would actually want to look at
are indistinguishable from the 220 they would not.

There is no published `EGTESTCD` term for clinical significance, so the study has to put it somewhere:
a **supplemental qualifier** — a `SUPPEG` record with a sponsor `QNAM` — or a second `EGTESTCD`.
CBX417-301 does neither, which is a documented simplification of this teaching dataset rather than a
defensible submission choice. **If a field is collected and matters, "we dropped it" is an answer that
has to be written down**, not one that happens silently.
:::

### --LOBXFL in both domains, and the arithmetic that checks it

| Domain | Tests | Flags per test | Expected | Actual |
|---|---:|---|---:|---:|
| `VS` | 6 | 416 treated subjects | 2,496 | **2,496** |
| `EG` | 3 | 416 treated subjects | 1,248 | **1,248** |

`HEIGHT` is the instructive one: it has only 420 records in the whole domain and **416** of them are
flagged. The four unflagged belong to the four randomized-but-never-treated subjects, who have no first
exposure for the flag to be "before".

## Worked example

Take the single raw row from the opening and produce every SDTM record it generates.

**In:**

```csv
RECORD_ID,SITE_ID,SUBJECT_ID,VISIT_NAME,VS_DATE,VS_TIME,SYSBP,DIABP,PULSE,TEMP,TEMP_UNIT,WEIGHT,WEIGHT_UNIT,HEIGHT,HEIGHT_UNIT,ECOG
VS-000002,1001,1001-0002,Screening,17 JUN 2022,09:03:00,105,92,77,36.8,C,65.3,kg,171,cm,1
```

**Out — six `VS` records:**

| `VSSEQ` | `VSTESTCD` | `VSPOS` | `VSORRES` | `VSORRESU` | `VSSTRESN` | `VSSTRESU` | `VSLOBXFL` | `VSDY` |
|---:|---|---|---:|---|---:|---|---|---:|
| 1 | `DIABP` | `SITTING` | 92 | mmHg | 92 | mmHg | | −21 |
| 9 | `HEIGHT` | | 171 | cm | 171 | cm | `Y` | −21 |
| 10 | `PULSE` | `SITTING` | 77 | beats/min | 77 | beats/min | | −21 |
| 18 | `SYSBP` | `SITTING` | 105 | mmHg | 105 | mmHg | | −21 |
| 26 | `TEMP` | | 36.8 | C | 36.8 | C | | −21 |
| 34 | `WEIGHT` | | 65.3 | kg | 65.3 | kg | | −21 |

**Plus one `RS` record** carrying the ECOG, with `RSSEQ = 6` and the same `RSDTC` as the `VS` records.

Three things in that table are worth stopping on.

**The sequence numbers are not 1 to 6.** `VSSEQ` is assigned across the whole subject after sorting, so
this visit's six records are scattered through the subject's 136. It is a handle, not a position.

**`VSPOS` is populated on three records and null on three.** Position matters for a blood pressure and a
pulse, which is why the protocol specifies sitting; it is meaningless for a temperature, a weight and a
height. **A null qualifier that does not apply is correct**, and `"N/A"` in those rows would be a
conformance finding.

:::standard{kind="official"}
`VSPOS` — "Vital Signs Position of Subject" — uses **POSITION (C71148)**, extensible, 17 terms.
`SITTING` is published, as are `STANDING`, `SUPINE`, `SEMI-RECUMBENT` and the rest. In CBX417-301 it is
populated on 10,179 records — exactly the 3,393 each of `SYSBP`, `DIABP` and `PULSE` — and null on the
other 7,206.
:::

**`VSLOBXFL = "Y"` on `HEIGHT` and nothing else.** Height is measured once, at screening, before first
dose, so the screening record *is* the last observation before exposure. The other five tests have later
pre-dose records at Cycle 1 Day 1, so their flag sits on those.

### The transposition, in code

::::tabs
:::tab[SAS]
```sas
proc transpose data=raw.vitals out=vs_long(rename=(_name_=vstestcd col1=_raw))
               name=_name_;
  by record_id site_id subject_id visit_name vs_date vs_time;
  var sysbp diabp pulse temp weight height;
run;

data vs;
  set vs_long;
  length vstestcd $8 vstest $40 vsorresu vsstresu $12 vspos $20;
  if missing(_raw) then delete;

  vstestcd = upcase(vstestcd);
  select (vstestcd);
    when ('SYSBP')  do; vstest='Systolic Blood Pressure';  vspos='SITTING'; end;
    when ('DIABP')  do; vstest='Diastolic Blood Pressure'; vspos='SITTING'; end;
    when ('PULSE')  do; vstest='Pulse Rate';               vspos='SITTING'; end;
    when ('TEMP')   vstest='Temperature';
    when ('WEIGHT') vstest='Weight';
    when ('HEIGHT') vstest='Height';
    otherwise put 'ERROR: unmapped column ' vstestcd=;
  end;
run;
```

:::lines
1-5: `PROC TRANSPOSE` does the rotation. The `BY` variables are everything that identifies the *visit*; the `VAR` variables are the six measurements. `_NAME_` comes back holding the column name, which becomes `VSTESTCD`.
10: `if missing(_raw) then delete;` is the line that turns 3,441 × 6 = 20,646 candidate rows into 17,385. Height is null on 2,973 of the 3,441 raw rows because it is collected once, and a null measurement is not a record.
13-16: The `SELECT` assigns `VSTEST` **and** `VSPOS` together, because both are properties of the test. Position applies to the three haemodynamic measurements and to nothing else.
20: `OTHERWISE` writes an error rather than falling through silently. A new column appearing in a mid-study export is routine; a transposition that maps it to a blank `VSTEST` is not.
:::
:::

:::tab[R]
```r
library(dplyr); library(tidyr)

meta <- tribble(
  ~VSTESTCD, ~VSTEST,                    ~VSPOS,    ~VSORRESU_default,
  "SYSBP",   "Systolic Blood Pressure",  "SITTING", "mmHg",
  "DIABP",   "Diastolic Blood Pressure", "SITTING", "mmHg",
  "PULSE",   "Pulse Rate",               "SITTING", "beats/min",
  "TEMP",    "Temperature",              NA,        NA,
  "WEIGHT",  "Weight",                   NA,        NA,
  "HEIGHT",  "Height",                   NA,        NA
)

vs <- raw_vitals |>
  pivot_longer(c(SYSBP, DIABP, PULSE, TEMP, WEIGHT, HEIGHT),
               names_to = "VSTESTCD", values_to = "VSORRES") |>
  filter(!is.na(VSORRES)) |>
  left_join(meta, by = "VSTESTCD") |>
  mutate(
    VSORRESU = coalesce(VSORRESU_default,
                        case_when(VSTESTCD == "TEMP"   ~ TEMP_UNIT,
                                  VSTESTCD == "WEIGHT" ~ WEIGHT_UNIT,
                                  VSTESTCD == "HEIGHT" ~ HEIGHT_UNIT)),
    VSSTRESU = case_when(VSTESTCD == "TEMP" ~ "C", VSTESTCD == "WEIGHT" ~ "kg",
                         VSTESTCD == "HEIGHT" ~ "cm", TRUE ~ VSORRESU),
    VSSTRESN = case_when(
      VSTESTCD == "TEMP"   & VSORRESU == "F"  ~ round((VSORRES - 32) * 5 / 9, 1),
      VSTESTCD == "WEIGHT" & VSORRESU == "LB" ~ round(VSORRES * 0.45359237, 1),
      TRUE                                    ~ VSORRES),
    VSSTRESC = as.character(VSSTRESN)
  )

stopifnot(!any(is.na(vs$VSTEST)), !any(is.na(vs$VSORRESU)))
```

:::lines
3-11: Everything that depends only on the test — name, position, and the unit for the three tests whose unit the protocol fixes — lives in a table rather than in a chain of `if` statements, so it can be reviewed by someone clinical.
14-15: `pivot_longer` is the rotation. The six column names become values of `VSTESTCD`.
16: The `filter` on a missing result is where 2,973 null heights disappear. Without it, every visit gains an empty height record.
19-22: `VSORRESU` comes from the metadata table when the protocol fixes it and from the *collected* unit column when the site recorded one. Temperature, weight and height are the three the site can vary, and exactly the three that need the fallback.
23-24: `VSSTRESU` is the study's standard unit, assigned unconditionally — it does not depend on what the site used.
25-28: The two conversions, each keyed on **test and unit together**. Keyed on unit alone, a study that also collected height in inches would apply the pound factor to a height.
29: `VSSTRESC` is derived from `VSSTRESN` after conversion, so the character and numeric results cannot disagree.
32: Two assertions: every record has a test name and an original unit. Both fail loudly if a new column appears in the export.
:::
:::
::::

## Data example

### The row that is not in VS

3,441 raw rows, 3,393 mapped visits. The 48 missing are the screening visits of screen failures, whose
other domains this study does not submit. Except the arithmetic does not quite close: only **47** of the
48 screen failures have a raw vital-signs row at all, and a 48th row is removed for a different reason.

```text
VS-001496   SITE_ID 1019   SUBJECT_ID 1019-0001   Screening   08 JUL 2022
VS-001535   SITE_ID 1020   SUBJECT_ID 1019-0001   Screening   14 APR 2022
```

Two rows, one subject identifier, two different sites and two different dates. The study's answer key
records it as **"DUPLICATE SUBJECT ID (SAME ID AT TWO SITES)"**: site 1020 keyed another site's prefix,
and the subject is in fact `1020-0001`, a screen failure at site 1020. The laboratory vendor's file
already carried the correct identifier, which is how it was caught.

:::why[Why a subject-identifier collision is worse than a wrong number]
A wrong blood pressure is one wrong cell. A wrong `SUBJECT_ID` silently moves an entire visit onto
another subject — their vital signs, their study day, their epoch, their baseline flag — and the
receiving subject's data still looks internally consistent. `USUBJID` is built from `SUBJID`, so the
record joins cleanly to `DM`, gets a plausible `VSDY`, and passes every structural check in the domain.

What caught this one was **a second source disagreeing**: the same subject had a different identifier in
the central laboratory transfer. Identifier errors are found by reconciliation across systems, not by
validation within one — the same reason SAE reconciliation exists.
:::

### Three values that are wrong and two that are not

| Record | Field | Raw | Verdict | In `VS` |
|---|---|---:|---|---:|
| `VS-001253` | `HEIGHT` | 17 | Last digit omitted — corrected by site | 172 |
| `VS-002026` | `WEIGHT` | 732 | Decimal point omitted — corrected by site | 73.2 |
| `VS-000305` | `WEIGHT` | 131.2 | **Source-verified** body weight, BMI over 50 — not an error | 131.2 |
| `VS-003382` | `SYSBP` | 204 | **Source-verified**, consistent with a grade 3 hypertension adverse event | 204 |

The delivered domain's ranges: height 144–192 cm, weight 36.1–131.6 kg, systolic 85–204 mmHg,
diastolic 47–112, pulse 48–126, temperature 35.5–39.3 °C. Every one of those extremes is a real value
that survived review.

:::mistake[Deleting outliers because they are outliers]
A height of 17 cm is impossible and a weight of 131.2 kg is unusual. Only one of them is wrong, and the
difference is not statistical — it is that somebody went back to the source document. The systolic of
204 is corroborated by an adverse event in `AE`.

An outlier rule that trims the extremes of `VS` removes the grade 3 hypertension from the safety
database while leaving the impossible height untouched, because 17 cm is not an extreme value — it is a
*small* one, and it sits comfortably inside any percentile-based filter.
:::

### What ADaM does not take

| SDTM | Records | ADaM | Records | Dropped |
|---|---:|---|---:|---|
| `VS` | 17,385 | `ADVS` | 16,965 | 420 `HEIGHT` |
| `EG` | 5,601 | `ADEG` | 3,734 | 1,867 `INTP` |

`ADVS` has five parameters and `ADEG` has two, because a height measured once has no change from
baseline and an interpretation has no `AVAL`. Both drops are exact and both are reversible — the records
are still in SDTM, which is the point of having two layers.

## Common mistakes

:::mistake[Leaving the CRF's column names as columns]
A `VS` dataset with a `SYSBP` column is not a Findings domain. The measurement identity belongs in
`VSTESTCD` as a controlled term, which is what makes it findable by a tool that has never seen your
study.
:::

:::mistake[Transposing before dropping nulls, or instead of it]
3,441 rows × 6 measurements is 20,646 candidate records; `VS` has 17,385. The 3,261 difference is almost
entirely the height column, which is collected once and null at 2,973 of 3,441 visits. A null
measurement is not a record.
:::

:::mistake[Converting the result and leaving the unit alone — or the reverse]
`VSORRES` and `VSORRESU` are what the site wrote: `97.2` and `F`. `VSSTRESN` and `VSSTRESU` are the
converted pair: `36.2` and `C`. Changing one without the other produces a record asserting a temperature
of 36.2 degrees Fahrenheit, which is about 2 °C and not what anyone measured.
:::

:::mistake[Filling in VSPOS on every record]
Position is null on 7,206 records — every temperature, weight and height — because it does not apply.
`"N/A"` or `"UNKNOWN"` in those rows is a conformance finding and destroys the variable's only job.
:::

:::mistake[Looking for ECOG in VS]
It is on the vital-signs page and in the `RS` domain, 3,075 records with `RSTESTCD = "ECOG101"`. SDTM
places data by what it is, not by which form it arrived on — the same rule that sends a pre-consent
condition from the adverse-event page to `MH`.
:::

:::mistake[Assuming EGSTRESN is populated because EGSTRESC is]
`EGSTRESN` is null on all 1,867 `INTP` records, so a mean over it has to be filtered to a numeric
parameter first. For the same reason a record count over `EG` answers "how many ECG measurements"
rather than "how many ECGs" — 5,601 against 1,867.
:::

## Knowledge check

::quiz{ids="sdtm.vseg.wide-to-long,sdtm.vseg.where-ecog-went,sdtm.vseg.vspos-null,sdtm.vseg.intp-stresn"}

## Hands-on exercise

::practice{ids="sdtm.vseg.count-rows,sdtm.vseg.convert-temp,sdtm.vseg.lobxfl-height,sdtm.vseg.transpose-code" title="Practice: rotating a CRF page into a Findings domain"}

## Challenge exercise

::practice{ids="sdtm.vseg.lost-qualifier,sdtm.vseg.outlier-triage,sdtm.vseg.open-vs-eg" title="Challenge: the values that are wrong and the values that are not"}

## Industry note

**`VS` and `EG` are the domains people learn transposition on, and the skill transfers immediately.**
`LB`, `PE`, `QS`, `PC`, `MB` and every other Findings domain has the same shape: a `--TESTCD` topic
variable, an original result pair, a standard result triple, timing, and qualifiers that apply to some
tests and not others. A programmer who can rotate the vital-signs page can rotate any of them, and the
study-specific work is always the same three questions — which columns are measurements, which
qualifiers apply to which measurement, and which units need converting.

**ECG data often arrives twice.** The site records an interpretation and a heart rate from the machine
in the EDC; on many studies a central cardiology vendor reads the same tracings and sends its own
intervals in a separate transfer. When that happens the two readings coexist in `EG` and are
distinguished by the Findings evaluator qualifier `--EVAL`, the same variable that carries
`INVESTIGATOR` on every `RS` and `TR` record in this study. CBX417-301 has a single investigator-read
source and so carries no `EGEVAL` at all. A study with a central reader has to decide which reading is
authoritative for the analysis, and that decision belongs to the SAP rather than to SDTM.

::widget{name="sdtm-explorer"}

:::standard{kind="simplification"}
This lesson treats `VS` as one visit-level page with six measurements. Real vital-signs collection is
often richer: triplicate blood pressures averaged before analysis, orthostatic measurements at two
positions, a `VSTPT`/`VSTPTNUM` time point relative to dosing, and `VSSTAT`/`VSREASND` for measurements
not done. CBX417-301 collects none of those, so they do not appear here. The structure they slot into is
the one this lesson describes — each is another qualifier on the same Findings record.
:::

:::interview[The vital-signs CRF page has six columns. Your VS domain has 17,385 rows. Explain.]
"The page is wide and the domain is long, and the rotation is the whole job.

Six measurements per visit, 3,441 visit rows collected, 3,393 of which are mapped — the 48 missing are
screening visits belonging to screen failures, whose only submitted domains in that study are `DM` and
`DS`. Each mapped visit produces one record per non-missing measurement, so five tests at 3,393 visits
plus height, which is collected once at screening and so only exists for the 420 randomized subjects.
That is 16,965 plus 420, which is the 17,385.

The transformation is that the **column name becomes a value**. `SYSBP` stops being a column and becomes
`VSTESTCD = 'SYSBP'`, a term from the published `VSTESTCD` codelist, so a reviewer's tool can find
systolic blood pressure without knowing what I called my columns.

Two things I'd flag about that page specifically. **One column doesn't go to `VS` at all**: ECOG
performance status is collected there and belongs in `RS`, because SDTM places data by what it is rather
than by which form it came on. And **the units are collected, not assumed** — twelve temperatures came
in Fahrenheit and ten weights in pounds. Those are not errors; the site recorded the unit. `VSORRES` and
`VSORRESU` keep 97.2 and F, and `VSSTRESN` and `VSSTRESU` carry 36.2 and C. Converting one without the
other is the failure mode, and temperature is the one to worry about because a wrong Fahrenheit-Celsius
mean still looks like a plausible temperature.

`EG` is the same structure with a different panel — three tests per ECG, so 1,867 ECGs give 5,601
records. The one thing it teaches that `VS` doesn't is `--STRESC` versus `--STRESN`: the interpretation
records carry `NORMAL` or `ABNORMAL` in the character variable and nothing in the numeric one, so any
summary over `EGSTRESN` has to be filtered to a parameter first."
:::
