## What problem are we trying to solve?

The CBX417-301 safety tables are on your list: the TEAE overview, TEAEs by system organ class and preferred term, grade 3 or higher TEAEs, serious TEAEs, and lab shift tables. On day one, questions pile up:

- An AE started three days *before* the first dose. Does it count?
- An AE started 41 days after the last dose and was serious. Is it in the SAE table?
- The start date is `2023-05` — no day. Is it treatment-emergent?
- The medical monitor wants every subject with "possible Hy's law". What does that mean in data?

Safety data are where the largest volume of a CSR's tables comes from, where regulators look first for harm, and where small definitional slips (events vs subjects, planned vs actual treatment, one day in a window) change numbers. You need the concepts precisely.

## Intuition

Safety reporting answers: **what happened to patients while they were exposed, and how bad was it?**

- An **adverse event (AE)** is any unwanted medical occurrence in a trial participant — whether or not anyone thinks the drug caused it. Causality is assessed separately.
- **Severity** (how intense: CTCAE grade) and **seriousness** (what the consequences were: death, hospitalization…) are different axes. A grade 3 rash can be non-serious; a grade 2 pneumonia that leads to hospitalization is serious.
- **Treatment-emergent** narrows the question to events that began during exposure (plus a follow-up window), so that pre-existing problems are not attributed to the drug.
- **Unit of analysis:** safety tables count **subjects**, not events. A patient with three episodes of diarrhea counts once in the *Diarrhea* row — at their worst grade in grade tables.

Use the explorer to see how the same AE data give different percentages depending on the denominator (subjects vs events, safety vs ITT population):

::widget{name="denominator-explorer"}

## Clinical context

In CBX417-301:

- AEs are collected from informed consent until 30 days after the last dose of study drug; SAEs are reported to pharmacovigilance within 24 hours of the site's awareness.
- Grades follow **NCI CTCAE v5.0**. Disease progression itself is not an AE (it is an efficacy outcome).
- Relationship is recorded separately to CBX-417/placebo (`AEREL`) and docetaxel (SUPPAE `AERELDOC`), because a combination regimen makes attribution a two-part question.
- Safety analyses use the **safety population** by **actual** treatment (`TRTA` from `TRT01A`): N = 209 and 207 per the study design.

:::standard{kind="official" source="ICH E2A Clinical Safety Data Management: Definitions and Standards for Expedited Reporting"}
ICH E2A defines an adverse event as any untoward medical occurrence in a subject administered a pharmaceutical product, not necessarily causally related, and a serious adverse event as one that results in death, is life-threatening, requires inpatient hospitalization or prolongs an existing hospitalization, results in persistent or significant disability/incapacity, is a congenital anomaly/birth defect, or is otherwise medically important.
:::

## Formal concept

### AE, SAE, TEAE

| Term | Definition | In CBX417-301 data |
|---|---|---|
| AE | Any untoward medical occurrence after informed consent | Every record in SDTM `AE` |
| SAE | AE meeting at least one seriousness criterion | `AESER = "Y"`; criteria in `AESDTH`, `AESLIFE`, `AESHOSP`, `AESDISAB`, `AESCONG`, `AESMIE` |
| TEAE | AE with onset on or after the first dose and no later than 30 days after the last dose | `TRTEMFL = "Y"` in `ADAE` |

SAP rule (CBX417-301): `TRTEMFL = "Y"` if `TRTSDT ≤ ASTDT ≤ TRTEDT + 30`, where `ASTDT` is the analysis start date after partial-date imputation.

:::standard{kind="convention"}
Many SAPs also count a pre-existing AE as treatment-emergent if it *worsens* after the first dose. When worsening is captured as a new AE record with a new start date (a common CRF convention), the date rule handles it automatically. The exact TEAE definition is a sponsor decision written in the SAP.
:::

### Partial start dates (CBX417-301 SAP rules)

| `AESTDTC` | Imputation | `ASTDTF` |
|---|---|---|
| Complete (`2023-07-15`) | None | blank |
| Day missing (`2023-05`) | 1st of the month — **unless** the month and year equal those of `TRTSDT`, then `TRTSDT` | `D` |
| Day and month missing (`2023`) | 1 January — **unless** the year equals that of `TRTSDT`, then `TRTSDT` | `M` |
| Any imputation | Never later than a complete AE end date: if the imputed date is after `AENDT`, use `AENDT` | as above |

The logic: when a partial date is compatible with onset on or after first dose, assume it was (conservative for safety); when the known end date proves otherwise, respect it.

### CTCAE grades

| Grade | Meaning (general CTCAE v5.0 description) |
|---|---|
| 1 | Mild; asymptomatic or mild symptoms; intervention not indicated |
| 2 | Moderate; minimal, local or noninvasive intervention indicated |
| 3 | Severe or medically significant but not immediately life-threatening |
| 4 | Life-threatening consequences; urgent intervention indicated |
| 5 | Death related to the AE |

### The MedDRA hierarchy (concept)

MedDRA organizes terms in five levels: **System Organ Class (SOC)** → **High Level Group Term (HLGT)** → **High Level Term (HLT)** → **Preferred Term (PT)** → **Lowest Level Term (LLT)**. Verbatim terms are coded to an LLT, which belongs to exactly one PT. A PT can sit under several SOCs (MedDRA is multiaxial), but each PT has one **primary SOC**, used in standard AE tables so each event is counted in one SOC only. There are 27 SOCs. Tables are usually "SOC and PT"; HLT/HLGT are used for grouped analyses. (The dictionary is licensed; this app uses illustrative PT/SOC names without codes.)

### Lab safety

- **Reference ranges** give `ANRIND` (LOW/NORMAL/HIGH) and multiples of the upper limit of normal (×ULN).
- **CTCAE lab grades** turn values into grades for selected tests. Simplified CTCAE v5.0 criteria for subjects with normal baseline:

| Test | Grade 1 | Grade 2 | Grade 3 | Grade 4 |
|---|---|---|---|---|
| ALT or AST increased | >ULN – 3.0 × ULN | >3.0 – 5.0 × ULN | >5.0 – 20.0 × ULN | >20.0 × ULN |
| Blood bilirubin increased | >ULN – 1.5 × ULN | >1.5 – 3.0 × ULN | >3.0 – 10.0 × ULN | >10.0 × ULN |
| Neutrophil count decreased | <LLN – 1.5 × 10⁹/L | <1.5 – 1.0 | <1.0 – 0.5 | <0.5 |
| Platelet count decreased | <LLN – 75 × 10⁹/L | <75 – 50 | <50 – 25 | <25 |

:::standard{kind="simplification"}
CTCAE v5.0 includes different criteria when the baseline value is abnormal, and some grades depend on clinical information (for example, anemia grade 4 is defined by life-threatening consequences, not a lab value). The CBX417-301 `ADLB` grading uses the baseline-normal thresholds above as a teaching simplification.
:::

- **Shift tables** cross-tabulate baseline grade (or `BNRIND`) against the **worst post-baseline** grade, showing how many subjects moved to a worse category.

### Hy's law and eDISH

A potential **Hy's law** case is a subject with ALT or AST > 3 × ULN **and** total bilirubin > 2 × ULN, without initial evidence of cholestasis (alkaline phosphatase not elevated to ≥ 2 × ULN), and with no other explanation. Such cases signal a risk of serious drug-induced liver injury. The **eDISH** plot (evaluation of Drug-Induced Serious Hepatotoxicity) shows each subject's peak ALT (× ULN) against peak bilirubin (× ULN) on log scales, with reference lines at 3 × and 2 × ULN; the upper-right quadrant holds potential Hy's law cases.

:::standard{kind="official" source="FDA Guidance: Drug-Induced Liver Injury — Premarketing Clinical Evaluation (2009)"}
The guidance describes Hy's law criteria and the importance of identifying such cases during development. Whether peak values must occur within a defined time window of each other is a sponsor/SAP detail; state it explicitly in your spec.
:::

## Worked example

Two subjects (illustrative data). S1: `TRTSDT = 2023-05-02`, `TRTEDT = 2023-10-10`. S2: `TRTSDT = 2023-06-12`, `TRTEDT = 2023-08-01`.

| Subject | PT | `AESTDTC` | `AEENDTC` | `ASTDT` | `ASTDTF` | TEAE? | Why |
|---|---|---|---|---|---|---|---|
| S1 | Nausea | 2023-04-28 | 2023-05-03 | 2023-04-28 | | No | Starts before first dose |
| S1 | Diarrhea (grade 2) | 2023-05 | 2023-05-20 | 2023-05-02 | D | Yes | Same month as `TRTSDT` → impute `TRTSDT` |
| S1 | Diarrhea (grade 3) | 2023-07-15 | 2023-07-30 | 2023-07-15 | | Yes | Within window |
| S1 | Pneumonia (serious) | 2023-11-20 | 2023-12-02 | 2023-11-20 | | No | After `TRTEDT + 30 = 2023-11-09` |
| S2 | Rash | 2023-08-25 | ongoing | 2023-08-25 | | Yes | `TRTEDT + 30 = 2023-08-31` |
| S2 | Diarrhea | 2023 | 2023-06-01 | 2023-06-01 | M | No | Year = `TRTSDT` year → `TRTSDT` (06-12), but capped at the known end date 06-01, before first dose |

:::number[Why is S2's diarrhea not treatment-emergent even though its year matches the first dose?]
The rule first proposes `TRTSDT` (2023-06-12). But the AE ended on 2023-06-01 — it cannot have started after it ended. The cap sets `ASTDT = 2023-06-01`, which is before the first dose, so `TRTEMFL` is not `Y`. Without the cap, a pre-treatment AE would be wrongly attributed to the drug.
:::

**Counting for the tables** (these two subjects only):

- *Diarrhea* row, any grade: S1 counts **once** (two TEAE records). S2 is not counted (its diarrhea is not a TEAE).
- *Diarrhea*, grade ≥ 3: S1 counts once (worst grade 3).
- *Rash*: S2 counts once.
- SOC *Gastrointestinal disorders*: S1 once.
- Serious TEAE table: S1's pneumonia is serious but **not** treatment-emergent, so it is excluded from the serious **TEAE** table — but it appears in the listing of all SAEs, which is not restricted to TEAEs.

## Data example

Records in the CBX417-301 `ADAE` whose start day was imputed:

::dataset{id="oncology/adam/adae" cols="USUBJID,AEDECOD,ASTDT,ASTDTF,TRTSDT,TRTEMFL,ATOXGR,AESER" filter="ASTDTF=D" rows="10" caption="ADAE — imputed start dates and treatment emergence"}

For each row, check the rule by hand: is the AE month equal to the `TRTSDT` month? If so, `ASTDT` should equal `TRTSDT` (unless capped by the end date).

## Code

The start-date imputation and TEAE flag in SAS (a sketch, not executed here). It assumes `AE` is SDTM AE and `ADSL` provides `TRTSDT`, `TRTEDT` and `SAFFL`.

```sas title="adae_teae.sas"
data adae;
  merge ae(in=inae) adsl(keep=USUBJID TRTSDT TRTEDT TRT01A TRT01AN SAFFL);
  by USUBJID;
  if inae;
  length ASTDTF TRTEMFL $1;
  if length(AEENDTC) >= 10 then AENDT = input(substr(AEENDTC, 1, 10), yymmdd10.);
  if length(AESTDTC) >= 10 then ASTDT = input(substr(AESTDTC, 1, 10), yymmdd10.);
  else if length(AESTDTC) = 7 then do;
    ASTDT = input(cats(AESTDTC, '-01'), yymmdd10.);
    if put(ASTDT, yymmn6.) = put(TRTSDT, yymmn6.) then ASTDT = TRTSDT;
    ASTDTF = 'D';
  end;
  else if length(AESTDTC) = 4 then do;
    ASTDT = mdy(1, 1, input(AESTDTC, 4.));
    if year(ASTDT) = year(TRTSDT) then ASTDT = TRTSDT;
    ASTDTF = 'M';
  end;
  if not missing(ASTDTF) and not missing(AENDT) and ASTDT > AENDT then ASTDT = AENDT;
  if SAFFL = 'Y' and not missing(ASTDT) and TRTSDT <= ASTDT <= TRTEDT + 30 then TRTEMFL = 'Y';
  TRTA = TRT01A; TRTAN = TRT01AN;
  format ASTDT AENDT TRTSDT TRTEDT yymmdd10.;
run;
```

:::lines
2-4: Brings subject-level dates and treatment onto every AE record; `if inae;` keeps AE records only.
5: Declares the flag lengths before first use.
6: Uses the end date only when complete, for the "never after the end date" cap.
7: A complete start date (possibly with a time part) is used as is.
8-12: Day missing: start from the 1st of the month; `YYMMN6.` formats a date as `YYYYMM`, so equal strings mean the same month and year as the first dose, in which case `TRTSDT` is used. `ASTDTF = 'D'` records that the day was imputed.
13-17: Month and day missing: start from 1 January; if the year equals the first-dose year, use `TRTSDT`. `ASTDTF = 'M'`.
18: The cap: an imputed start date may not be later than a complete end date.
19: The SAP's TEAE rule. SAS evaluates the chained comparison `TRTSDT <= ASTDT <= TRTEDT + 30` as two comparisons joined by AND. The flag is `Y` or blank.
20: Record-level actual treatment for safety tables.
:::

## Output

Expected `ADAE` values for the six worked-example records (computed independently in R from the same rules):

```output
USUBJID  AEDECOD    AESTDTC     AEENDTC     TRTSDT      TRTEDT      ASTDT       ASTDTF  TRTEMFL
S1       Nausea     2023-04-28  2023-05-03  2023-05-02  2023-10-10  2023-04-28
S1       Diarrhea   2023-05     2023-05-20  2023-05-02  2023-10-10  2023-05-02  D       Y
S1       Diarrhea   2023-07-15  2023-07-30  2023-05-02  2023-10-10  2023-07-15          Y
S1       Pneumonia  2023-11-20  2023-12-02  2023-05-02  2023-10-10  2023-11-20
S2       Rash       2023-08-25              2023-06-12  2023-08-01  2023-08-25          Y
S2       Diarrhea   2023        2023-06-01  2023-06-12  2023-08-01  2023-06-01  M
```

## Interpretation

- **TEAE tables answer "what happened during exposure"; SAE listings answer "what serious events happened at all".** Keep the two scopes distinct and say which is which in titles.
- **Worst grade per subject** is the right summary for grade tables; the same subject can appear in "any grade" and "grade ≥ 3" rows for the same PT.
- **Causality is an investigator judgment**, useful but noisy. Imbalances in all-causality TEAEs between randomized arms are often more informative than investigator-assessed relatedness.
- **Lab shifts and Hy's law screens complement AE reporting.** A lab abnormality may never be reported as an AE; the lab data catch it.

## Common mistakes

:::mistake[Counting events instead of subjects]
Summing AE records per PT inflates percentages and can exceed 100%. Count distinct `USUBJID` per PT (and per SOC); use first-occurrence flags such as `AOCCPFL` or a distinct count. See the BY-group lesson for the programming pattern.
:::

::lesson{id="sas-by-group-processing" label="Review: BY-group processing and first-occurrence flags"}

:::mistake[Imputing partial dates in SDTM]
`AESTDTC` keeps exactly what was collected (`2023-05`). Imputation belongs in ADaM (`ASTDT`, `ASTDTF`). An imputed day in SDTM is a traceability defect.
:::

:::mistake[Forgetting subjects still on treatment at the cutoff]
If `TRTEDT` is missing for subjects ongoing at the data cutoff, `TRTEDT + 30` is missing and the TEAE condition fails for all their later AEs. The ADSL spec must define `TRTEDT` for ongoing subjects (for example, the last dose date on or before the cutoff).
:::

:::mistake[Confusing severity and seriousness]
"Severe" (grade 3) is not "serious". Tables of grade ≥ 3 TEAEs and serious TEAEs overlap but are different; a question about "serious AEs" must be answered with `AESER = "Y"`.
:::

## Knowledge check

::quiz{ids="trials.safety.severity-vs-serious,trials.safety.serious-criteria,trials.safety.meddra-order,trials.safety.teae-window-date"}

## Hands-on exercise

::practice{ids="trials.safety.partial-date,trials.safety.hys-law,trials.safety.percent-calc" title="Practice: TEAE rules, Hy's law and percentages"}

## Challenge exercise

::practice{ids="trials.safety.trtedt-bug,trials.safety.events-vs-subjects-qc" title="Debug and QC: safety derivations"}

## Industry note

- **Safety tables dominate the CSR's Section 14.3.** Programmers who understand TEAE rules, worst-grade logic and denominators produce correct tables faster and catch QC issues quickly.
- **Integrated safety summaries** pool several studies; definitions (TEAE window, MedDRA version, grading) must be harmonized first — a frequent source of work for experienced programmers.
- **Interviewers love TEAE questions**: "Define a TEAE", "How do you handle partial dates?", "How do you count a subject with multiple events?", "What is Hy's law?"

:::interview[How do you derive the treatment-emergent flag, and how do you handle partial dates?]
"From the SAP: in this study, an AE is treatment-emergent if its analysis start date is on or after the first dose and no later than the last dose plus 30 days. For partial start dates I impute in ADaM, not SDTM: a missing day becomes the 1st of the month, unless the month and year equal the first-dose month, in which case the first dose date; a missing month and day becomes 1 January, unless the year equals the first-dose year, then the first dose date. The imputed date is never later than a complete end date. I record the imputation level in ASTDTF — D or M. I also make sure TRTEDT is defined for subjects still on treatment at the cutoff, otherwise the upper bound is missing. QC: check every imputed record against the rule, and confirm TEAE counts per subject with an independent method."
:::
