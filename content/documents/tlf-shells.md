# Mock Tables, Listings and Figures (Shells) — CBX417-301

> **Educational, fictional document.** Mock shells for the synthetic study CBX417-301. All numbers
> are placeholders (`xx`, `xx.x`); no results are shown. Shell ids (for example `t-pfs`) are used by
> this app's TLF viewer; table numbers follow the ICH E3 Section 14 grouping (a convention).

**Placeholder conventions**

| Placeholder | Meaning |
|---|---|
| `xxx` | Integer count |
| `xx.x` | One decimal (percentages, months) |
| `x.xx` | Two decimals (hazard ratios, ratios) |
| `x.xxxx` | p-value, 4 decimals (`<0.0001` when smaller) |
| `xx.xxx` | Three decimals (standard deviations of 1-decimal data) |
| `DDMMMYYYY` | Date |

Every output carries: table number and title, population line, column headers with population counts, footnotes defining statistics and methods, and a program/output/data-cutoff line.

---

## Table 14.1.1 — Subject Disposition (`t-disp`)

```text
Table 14.1.1
Subject Disposition
All Screened Subjects

                                                CBX-417 +        Placebo +
                                                Docetaxel        Docetaxel          Total
                                                 (N=xxx)          (N=xxx)          (N=xxx)
Subjects screened                                    -                -              xxx
Screen failures                                      -                -              xxx
  Did not meet eligibility criteria                  -                -              xxx
  Withdrew consent                                   -                -              xxx
  Other                                              -                -              xxx
Subjects randomized                                 xxx              xxx             xxx
Subjects treated (safety population)                xxx              xxx             xxx
Subjects randomized but not treated                 xxx              xxx             xxx

Study treatment status
  Ongoing at data cutoff, n (%)                 xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Discontinued study treatment, n (%)           xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Progressive disease                         xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Adverse event                               xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Death                                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Withdrawal by subject                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Physician decision                          xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Other                                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)

Study status
  Ongoing at data cutoff, n (%)                 xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Died, n (%)                                   xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Discontinued study, n (%)                     xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Withdrawal by subject                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
    Lost to follow-up                           xxx (xx.x)       xxx (xx.x)      xxx (xx.x)

Analysis populations, n (%)
  ITT                                           xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Safety                                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Efficacy-evaluable                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Per-protocol                                  xxx (xx.x)       xxx (xx.x)      xxx (xx.x)

Note: Screening counts are derived from SDTM DM/DS; all other counts from ADSL.
Percentages for randomized subjects use the number randomized in each arm as denominator.
Subjects are summarized by randomized treatment (TRT01P).
Program: /cbx417-301/csr/prod/tlf/t_disp.sas   Output: t_14_1_1.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.1.2 — Demographic and Baseline Characteristics (`t-demog`)

```text
Table 14.1.2
Demographic and Baseline Characteristics
ITT Population

                                                CBX-417 +        Placebo +
                                                Docetaxel        Docetaxel          Total
                                                 (N=xxx)          (N=xxx)          (N=xxx)
Age (years)
  n                                                xxx              xxx              xxx
  Mean (SD)                                    xx.x (xx.xx)     xx.x (xx.xx)    xx.x (xx.xx)
  Median                                           xx.x             xx.x             xx.x
  Min, Max                                       xx, xx           xx, xx           xx, xx
Age group, n (%)
  <65 years                                    xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  >=65 years                                   xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Sex, n (%)
  Male                                         xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Female                                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Race, n (%)
  White                                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Asian                                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Black or African American                    xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Other/Multiple/Not reported                  xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Ethnicity, n (%)
  Hispanic or Latino                           xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Not Hispanic or Latino                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Not reported/Unknown                         xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Region, n (%)
  North America                                xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Europe                                       xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Asia-Pacific                                 xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
ECOG performance status (IxRS stratum), n (%)
  0                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  1                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
ECOG performance status (CRF, baseline), n (%)
  0                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  1                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Histology, n (%)
  Non-squamous                                 xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Squamous                                     xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Prior anti-PD-(L)1 therapy (IxRS stratum), n (%)
  Yes                                          xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  No                                           xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Number of prior lines, n (%)
  1                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  2                                            xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
PD-L1 TPS category, n (%)
  <1%                                          xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  1-49%                                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  >=50%                                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
  Not done                                     xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Brain metastases, n (%)                        xxx (xx.x)       xxx (xx.x)      xxx (xx.x)
Baseline sum of diameters (mm)
  n                                                xxx              xxx              xxx
  Mean (SD)                                    xx.x (xx.xx)     xx.x (xx.xx)    xx.x (xx.xx)
  Median                                           xx.x             xx.x             xx.x
  Min, Max                                       xx, xxx          xx, xxx          xx, xxx

Note: No statistical tests comparing treatment arms are performed for baseline characteristics.
Percentages use the number of ITT subjects in each column as denominator.
Program: /cbx417-301/csr/prod/tlf/t_demog.sas   Output: t_14_1_2.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.2.1.1 — Summary of Progression-Free Survival (`t-pfs`)

```text
Table 14.2.1.1
Summary of Progression-Free Survival per Investigator (RECIST 1.1)
ITT Population

                                                CBX-417 +        Placebo +
                                                Docetaxel        Docetaxel
                                                 (N=xxx)          (N=xxx)
Events, n (%)                                 xxx (xx.x)       xxx (xx.x)
  Progressive disease                         xxx (xx.x)       xxx (xx.x)
  Death                                       xxx (xx.x)       xxx (xx.x)
Censored, n (%)                               xxx (xx.x)       xxx (xx.x)
  No progression or death                     xxx (xx.x)       xxx (xx.x)
  No baseline/post-baseline assessment        xxx (xx.x)       xxx (xx.x)
  New anticancer therapy                      xxx (xx.x)       xxx (xx.x)
  Event after >=2 missed assessments          xxx (xx.x)       xxx (xx.x)

PFS (months) [a]
  25th percentile (95% CI)              xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)
  Median (95% CI)                       xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)
  75th percentile (95% CI)              xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)

Progression-free rate, % (95% CI) [b]
  At 3 months                          xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)
  At 6 months                          xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)
  At 12 months                         xx.x (xx.x, xx.x)  xx.x (xx.x, xx.x)

Stratified hazard ratio (95% CI) [c]              x.xx (x.xx, x.xx)
Stratified log-rank p-value [d]                        x.xxxx

[a] Kaplan-Meier estimates by treatment arm (unstratified); 95% CI by the Brookmeyer-Crowley
    method with log-log transformation.
[b] Kaplan-Meier estimate with Greenwood standard error and log-log transformation.
[c] Cox proportional hazards model with treatment as the only covariate, stratified by ECOG PS
    (0 vs 1) and prior anti-PD-(L)1 therapy (Yes vs No) as recorded in IxRS; ties handled by the
    Efron method; Wald confidence limits. HR < 1 favors CBX-417 + docetaxel.
[d] Two-sided log-rank test stratified by the same factors. Significance boundary per the
    alpha-spending function (SAP Section 3.5).
Subjects are summarized by randomized treatment (TRT01P). Censoring rules: SAP Section 9.4.
Program: /cbx417-301/csr/prod/tlf/t_pfs.sas   Output: t_14_2_1_1.rtf   Data cutoff: 31MAR2025
```

---

## Figure 14.2.1.2 — Kaplan-Meier Plot of PFS (`f-km-pfs`)

```text
Figure 14.2.1.2
Kaplan-Meier Plot of Progression-Free Survival per Investigator (RECIST 1.1)
ITT Population

  1.0 +----------------------------------------------------------+
      |  [step function, CBX-417 + Docetaxel, solid line]         |
  0.8 |  [step function, Placebo + Docetaxel, dashed line]        |
      |  [censoring marks: vertical ticks]                        |
  0.6 |                                                           |
      |                                                           |
  0.4 |                                                           |
      |                                                           |
  0.2 |                                                           |
      |                                                           |
  0.0 +----+-----+-----+-----+-----+-----+-----+-----+-----+------+
       0    3     6     9    12    15    18    21    24    27
                      Time from randomization (months)

Number at risk
  CBX-417 + Docetaxel   xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx
  Placebo + Docetaxel   xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx  xxx

Annotation box: Median PFS xx.x vs xx.x months; HR x.xx (95% CI x.xx, x.xx);
stratified log-rank p = x.xxxx.
Note: Censoring marks indicate censored observations. Analysis per SAP Sections 9.2-9.5.
Program: /cbx417-301/csr/prod/tlf/f_km_pfs.sas   Output: f_14_2_1_2.rtf   Data cutoff: 31MAR2025
```

---

## Figure 14.2.1.3 — Forest Plot of PFS by Subgroup (`f-forest-pfs`)

```text
Figure 14.2.1.3
Forest Plot of Progression-Free Survival by Subgroup
ITT Population

Subgroup                        n      Events    HR (95% CI)          Favors CBX | Favors PBO
Overall                        xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Age <65                        xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Age >=65                       xxx      xxx      x.xx (x.xx, x.xx)        --o--- |
Male                           xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Female                         xxx      xxx      x.xx (x.xx, x.xx)     ----o---  |
ECOG 0                         xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
ECOG 1                         xxx      xxx      x.xx (x.xx, x.xx)       ---o--  |
Non-squamous                   xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Squamous                       xxx      xxx      x.xx (x.xx, x.xx)        --o----|
PD-L1 <1%                      xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
PD-L1 1-49%                    xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
PD-L1 >=50%                    xxx      xxx      x.xx (x.xx, x.xx)     ---o----  |
Brain metastases: Yes          xxx      xxx      x.xx (x.xx, x.xx)    -----o-----|
Brain metastases: No           xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Prior anti-PD-(L)1: Yes        xxx      xxx      x.xx (x.xx, x.xx)      ---o---  |
Prior anti-PD-(L)1: No         xxx      xxx      x.xx (x.xx, x.xx)     ----o---  |
                                                       0.25    0.5    1.0    2.0  (log scale)

Note: Hazard ratios from unstratified Cox models within each subgroup. Subgroups with fewer than
20 events are displayed without a confidence interval. Subgroup analyses are exploratory and are
not adjusted for multiplicity (SAP Section 9.7).
Program: /cbx417-301/csr/prod/tlf/f_forest_pfs.sas   Output: f_14_2_1_3.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.2.3.1 — Confirmed Objective Response (`t-orr`)

```text
Table 14.2.3.1
Confirmed Objective Response per Investigator (RECIST 1.1)
ITT Population

                                                CBX-417 +        Placebo +
                                                Docetaxel        Docetaxel
                                                 (N=xxx)          (N=xxx)
Best overall response (confirmed), n (%)
  Complete response (CR)                      xxx (xx.x)       xxx (xx.x)
  Partial response (PR)                       xxx (xx.x)       xxx (xx.x)
  Stable disease (SD)                         xxx (xx.x)       xxx (xx.x)
  Progressive disease (PD)                    xxx (xx.x)       xxx (xx.x)
  Not evaluable (NE)                          xxx (xx.x)       xxx (xx.x)

Objective response rate (CR+PR)
  n (%)                                       xxx (xx.x)       xxx (xx.x)
  95% CI [a]                                (xx.x, xx.x)     (xx.x, xx.x)
Disease control rate (CR+PR+SD)
  n (%)                                       xxx (xx.x)       xxx (xx.x)
  95% CI [a]                                (xx.x, xx.x)     (xx.x, xx.x)

Difference in ORR (CBX-417 - Placebo), % [b]            xx.x
  95% CI                                            (xx.x, xx.x)
Stratified CMH p-value [b]                              x.xxxx

[a] Clopper-Pearson exact 95% confidence interval.
[b] Mantel-Haenszel common risk difference stratified by ECOG PS and prior anti-PD-(L)1 therapy
    (IxRS), 95% CI using the Sato variance estimator; CMH test stratified by the same factors,
    presented descriptively.
Denominator is the number of ITT subjects in each arm, including subjects without a post-baseline
tumor assessment (counted as non-responders). Confirmation requires a repeat assessment >=28 days
later (SAP Section 9.9).
Program: /cbx417-301/csr/prod/tlf/t_orr.sas   Output: t_14_2_3_1.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.1.1 — Overview of Treatment-Emergent Adverse Events (`t-ae-overview`)

```text
Table 14.3.1.1
Overview of Treatment-Emergent Adverse Events
Safety Population

                                                        CBX-417 +        Placebo +
                                                        Docetaxel        Docetaxel
                                                         (N=xxx)          (N=xxx)
Subjects with at least one:                            n (%)             n (%)
  TEAE                                              xxx (xx.x)       xxx (xx.x)
  TEAE related to CBX-417/placebo                   xxx (xx.x)       xxx (xx.x)
  TEAE related to docetaxel                         xxx (xx.x)       xxx (xx.x)
  Grade >=3 TEAE                                    xxx (xx.x)       xxx (xx.x)
  Serious TEAE                                      xxx (xx.x)       xxx (xx.x)
  TEAE leading to CBX-417/placebo dose reduction    xxx (xx.x)       xxx (xx.x)
  TEAE leading to CBX-417/placebo interruption      xxx (xx.x)       xxx (xx.x)
  TEAE leading to CBX-417/placebo discontinuation   xxx (xx.x)       xxx (xx.x)
  TEAE leading to docetaxel discontinuation         xxx (xx.x)       xxx (xx.x)
  TEAE with outcome of death (grade 5)              xxx (xx.x)       xxx (xx.x)
Deaths within 30 days of last dose                  xxx (xx.x)       xxx (xx.x)

Note: TEAE = adverse event with onset on or after the first dose and no later than 30 days after
the last dose (SAP Section 10.1.1). Subjects are counted once in each row and summarized by actual
treatment received (TRTA). MedDRA version xx.x.
Program: /cbx417-301/csr/prod/tlf/t_ae_overview.sas   Output: t_14_3_1_1.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.1.2 — TEAEs by System Organ Class and Preferred Term (`t-ae-soc-pt`)

```text
Table 14.3.1.2
Treatment-Emergent Adverse Events by System Organ Class and Preferred Term
Safety Population

                                                        CBX-417 +        Placebo +
                                                        Docetaxel        Docetaxel
System organ class                                       (N=xxx)          (N=xxx)
  Preferred term                                         n (%)             n (%)
Subjects with at least one TEAE                       xxx (xx.x)       xxx (xx.x)

Gastrointestinal disorders                            xxx (xx.x)       xxx (xx.x)
  Diarrhea                                            xxx (xx.x)       xxx (xx.x)
  Nausea                                              xxx (xx.x)       xxx (xx.x)
  Stomatitis                                          xxx (xx.x)       xxx (xx.x)
Blood and lymphatic system disorders                  xxx (xx.x)       xxx (xx.x)
  Neutropenia                                         xxx (xx.x)       xxx (xx.x)
  Anemia                                              xxx (xx.x)       xxx (xx.x)
General disorders and administration site conditions  xxx (xx.x)       xxx (xx.x)
  Fatigue                                             xxx (xx.x)       xxx (xx.x)
...

Note: A subject is counted once within each system organ class and once within each preferred
term, regardless of the number of occurrences. System organ classes are sorted alphabetically;
preferred terms within a system organ class are sorted by descending frequency in the
CBX-417 + Docetaxel column. Only preferred terms reported in at least 5% of subjects in either arm
are displayed. MedDRA version xx.x; primary system organ class is used.
Subjects are summarized by actual treatment received (TRTA).
Program: /cbx417-301/csr/prod/tlf/t_ae_soc_pt.sas   Output: t_14_3_1_2.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.1.3 — Grade 3 or Higher TEAEs by SOC and PT (`t-ae-grade3`)

```text
Table 14.3.1.3
Treatment-Emergent Adverse Events of Grade 3 or Higher by System Organ Class and Preferred Term
Safety Population

                                                        CBX-417 +        Placebo +
                                                        Docetaxel        Docetaxel
System organ class                                       (N=xxx)          (N=xxx)
  Preferred term                                         n (%)             n (%)
Subjects with at least one grade >=3 TEAE              xxx (xx.x)       xxx (xx.x)

Blood and lymphatic system disorders                   xxx (xx.x)       xxx (xx.x)
  Neutropenia                                          xxx (xx.x)       xxx (xx.x)
  Febrile neutropenia                                  xxx (xx.x)       xxx (xx.x)
...

Note: A subject is counted once per SOC/PT at their maximum CTCAE v5.0 grade; only events of
grade >=3 are included. Preferred terms reported in at least 2% of subjects in either arm are
displayed. Subjects are summarized by actual treatment received (TRTA). MedDRA version xx.x.
Program: /cbx417-301/csr/prod/tlf/t_ae_grade3.sas   Output: t_14_3_1_3.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.1.4 — Serious TEAEs by SOC and PT (`t-sae`)

```text
Table 14.3.1.4
Serious Treatment-Emergent Adverse Events by System Organ Class and Preferred Term
Safety Population

                                                        CBX-417 +        Placebo +
                                                        Docetaxel        Docetaxel
System organ class                                       (N=xxx)          (N=xxx)
  Preferred term                                         n (%)             n (%)
Subjects with at least one serious TEAE                xxx (xx.x)       xxx (xx.x)

Infections and infestations                            xxx (xx.x)       xxx (xx.x)
  Pneumonia                                            xxx (xx.x)       xxx (xx.x)
Blood and lymphatic system disorders                   xxx (xx.x)       xxx (xx.x)
  Febrile neutropenia                                  xxx (xx.x)       xxx (xx.x)
...

Note: Serious = AESER = 'Y' (any seriousness criterion). All preferred terms are displayed.
Serious adverse events that are not treatment-emergent are presented in Listing 16.2.7.2.
Subjects are summarized by actual treatment received (TRTA). MedDRA version xx.x.
Program: /cbx417-301/csr/prod/tlf/t_sae.sas   Output: t_14_3_1_4.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.4.1 — Shift from Baseline to Worst Post-Baseline CTCAE Grade (`t-lab-shift`)

```text
Table 14.3.4.1
Shift from Baseline to Worst Post-Baseline CTCAE Grade - Selected Laboratory Parameters
Safety Population

Parameter: Alanine aminotransferase (ALT)
CBX-417 + Docetaxel (N=xxx)
                        Worst post-baseline grade
Baseline grade      Grade 0   Grade 1   Grade 2   Grade 3   Grade 4   Missing    Total
  Grade 0             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Grade 1             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Grade 2             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Grade 3             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Grade 4             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Missing             xxx       xxx       xxx       xxx       xxx       xxx       xxx
  Total               xxx       xxx       xxx       xxx       xxx       xxx       xxx

[repeat block for Placebo + Docetaxel, then for AST, total bilirubin, neutrophils, platelets,
hemoglobin]

Note: Grade 0 = no CTCAE grade criterion met. Worst post-baseline grade uses all on-treatment
records (ONTRTFL = 'Y': after first dose through last dose + 30 days), including unscheduled
assessments. Laboratory grades follow CTCAE v5.0 criteria for subjects with a normal baseline
(SAP Section 10.3.1, a documented simplification). Subjects are summarized by actual treatment
received (TRTA).
Program: /cbx417-301/csr/prod/tlf/t_lab_shift.sas   Output: t_14_3_4_1.rtf   Data cutoff: 31MAR2025
```

---

## Table 14.3.4.2 — Laboratory Values and Change from Baseline by Visit (`t-lab-chg`)

```text
Table 14.3.4.2
Laboratory Values and Change from Baseline by Visit - Selected Parameters
Safety Population

Parameter: Alanine aminotransferase (U/L)
                                CBX-417 + Docetaxel              Placebo + Docetaxel
Visit                       Value            Change           Value            Change
Baseline
  n                           xxx                -              xxx                -
  Mean (SD)             xx.x (xx.xx)             -        xx.x (xx.xx)             -
  Median                     xx.x                -             xx.x                -
  Min, Max                 xx, xxx               -           xx, xxx               -
Cycle 2 Day 1
  n                           xxx              xxx              xxx              xxx
  Mean (SD)             xx.x (xx.xx)    xx.x (xx.xx)      xx.x (xx.xx)    xx.x (xx.xx)
  Median                     xx.x            xx.x              xx.x            xx.x
  Min, Max                 xx, xxx        -xx, xxx           xx, xxx        -xx, xxx
Cycle 3 Day 1
  ...
End of treatment
  ...

Note: One record per subject, parameter and analysis visit (ANL01FL = 'Y'): the scheduled record,
or the latest unscheduled record within the visit window (SAP Section 5.4). Change = value -
baseline. Subjects are summarized by actual treatment received (TRTA).
Program: /cbx417-301/csr/prod/tlf/t_lab_chg.sas   Output: t_14_3_4_2.rtf   Data cutoff: 31MAR2025
```

---

## Listing 16.2.7.2 — Serious Adverse Events (`l-sae`)

```text
Listing 16.2.7.2
Listing of Serious Adverse Events
Safety Population

Subject ID       Age/  Treatment   Preferred term      Start date  End date    Grade Ser.  Rel.  Action    Outcome   TE
                 Sex   (actual)    (verbatim term)     (study day) (study day)       crit. CBX   CBX                  FL
---------------------------------------------------------------------------------------------------------------------
CBX417-301-xxxx- xx/x  CBX-417 +   Febrile neutropenia DDMMMYYYY   DDMMMYYYY     3   HOSP  Rel.  Drug      Recovered/ Y
xxxx                   Docetaxel   (fever with low       (xx)        (xx)                       interrupt.resolved
                                   neutrophils)
CBX417-301-xxxx- xx/x  Placebo +   Pneumonia           DDMMMYYYY   DDMMMYYYY     4   HOSP, Not   Drug      Recovering/Y
xxxx                   Docetaxel   (chest infection)     (xx)        (xx)            LIFE  rel.  withdrawn resolving
...

Note: Ser. crit. = seriousness criteria (DEATH = results in death, LIFE = life-threatening,
HOSP = requires/prolongs hospitalization, DISAB = disability, CONG = congenital anomaly,
MIE = other medically important event). Rel. CBX = investigator's causality assessment for
CBX-417/placebo. TE FL = treatment-emergent flag. All serious adverse events are listed,
including those that are not treatment-emergent. Study day is relative to the first dose.
Sorted by subject and adverse event start date.
Program: /cbx417-301/csr/prod/tlf/l_sae.sas   Output: l_16_2_7_2.rtf   Data cutoff: 31MAR2025
```
