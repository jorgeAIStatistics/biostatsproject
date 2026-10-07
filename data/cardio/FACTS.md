# VTX221-201 — key facts (computed in R)

> Synthetic, fictional data. Every number below is computed by `scripts/data/cardio/facts.R` from
> `adsl.csv`, `advs.csv` and `ae.csv`. Quote these numbers (or recompute them) — never estimate.

## 1. Subject disposition (ITT = all randomized)

|  | Placebo | VTX-221 10 mg | VTX-221 20 mg | Total |
| --- | ---: | ---: | ---: | ---: |
| Randomized (ITTFL = Y) | 91 | 90 | 89 | 270 |
| Treated (SAFFL = Y) | 90 | 90 | 88 | 268 |
| Completed Week 12 (COMPLFL = Y) | 76 (83.5%) | 81 (90.0%) | 78 (87.6%) | 235 (87.0%) |
| Discontinued | 15 (16.5%) | 9 (10.0%) | 11 (12.4%) | 35 (13.0%) |
| &nbsp;&nbsp;ADVERSE EVENT | 0 | 2 | 5 | 7 |
| &nbsp;&nbsp;LACK OF EFFICACY | 10 | 5 | 4 | 19 |
| &nbsp;&nbsp;LOST TO FOLLOW-UP | 2 | 2 | 0 | 4 |
| &nbsp;&nbsp;WITHDRAWAL BY SUBJECT | 3 | 0 | 2 | 5 |
| Per-protocol (PPROTFL = Y) | 71 | 81 | 75 | 227 |
| Stratified in error (STRAT1R ≠ SBPGR1) | 3 | 0 | 0 | 3 |

## 2. Baseline characteristics (ITT)

|  | Placebo | VTX-221 10 mg | VTX-221 20 mg | Total |
| --- | ---: | ---: | ---: | ---: |
| Age, mean (SD) | 56.7 (9.8) | 54.9 (10.4) | 55.5 (10.0) | 55.7 (10.0) |
| Female, n (%) | 47 (51.6%) | 41 (45.6%) | 39 (43.8%) | 127 (47.0%) |
| Age >= 65, n (%) | 19 (20.9%) | 18 (20.0%) | 18 (20.2%) | 55 (20.4%) |
| BMI kg/m2, mean (SD) | 30.7 (4.8) | 30.6 (4.1) | 31.1 (4.7) | 30.8 (4.5) |
| Type 2 diabetes, n (%) | 17 (18.7%) | 20 (22.2%) | 14 (15.7%) | 51 (18.9%) |
| Baseline SBP mmHg, mean (SD) | 149.5 (9.9) | 150.7 (8.9) | 151.2 (9.4) | 150.4 (9.4) |
| Baseline DBP mmHg, mean (SD) | 89.4 (7.6) | 90.2 (7.3) | 90.4 (8.0) | 90.0 (7.6) |
| Baseline SBP >= 150 (SBPGR1N = 2), n (%) | 40 (44.0%) | 44 (48.9%) | 43 (48.3%) | 127 (47.0%) |

Screening SBP (all randomized): mean 151.3 mmHg; baseline (Day 1) SBP: mean 150.4 mmHg — the 0.9 mmHg drop before any treatment is regression to the mean after selecting on screening SBP >= 140.

## 3. Observed seated SBP change from baseline by visit (ANL01FL = Y)

| Visit | Placebo: n, mean CHG (SD) | VTX-221 10 mg: n, mean CHG (SD) | VTX-221 20 mg: n, mean CHG (SD) |
| --- | --- | --- | --- |
| Week 2 | 87, -1.9 (7.9) | 85, -5.7 (8.1) | 85, -7.9 (6.6) |
| Week 4 | 84, -3.1 (9.8) | 85, -6.7 (8.6) | 81, -10.8 (8.3) |
| Week 8 | 82, -3.3 (10.2) | 79, -7.9 (10.4) | 82, -12.3 (10.2) |
| Week 12 | 77, -3.3 (11.6) | 81, -8.8 (11.5) | 80, -12.3 (11.5) |

## 4. Primary endpoint — ANCOVA at Week 12 (complete cases, ITT)

Model: `lm(CHG ~ TRTP + BASE)` on SYSBP records with `AVISITN = 12` and `ANL01FL = "Y"`
(n = 238; residual df = 234; residual SD = 10.27; baseline slope = -0.587 (SE 0.074)). LS means are evaluated at the mean baseline of the analysis set, 149.82 mmHg (the SAS PROC GLM LSMEANS convention).

| Arm | n | LS mean CHG (SE) | 95% CI |
| --- | ---: | ---: | --- |
| Placebo | 77 | -4.05 (1.174) | -6.37 to -1.74 |
| VTX-221 10 mg | 81 | -8.61 (1.142) | -10.86 to -6.36 |
| VTX-221 20 mg | 80 | -11.77 (1.150) | -14.03 to -9.50 |

| Comparison | Difference in LS means (SE) | 95% CI | t | p (two-sided) |
| --- | ---: | --- | ---: | ---: |
| VTX-221 10 mg − Placebo | -4.56 (1.639) | -7.79 to -1.33 | -2.78 | 0.0059 |
| VTX-221 20 mg − Placebo | -7.72 (1.648) | -10.96 to -4.47 | -4.68 | <0.0001 |
| VTX-221 20 mg − 10 mg | -3.16 (1.619) | -6.35 to 0.03 | -1.95 | 0.0525 |

Overall treatment F test (Type I after BASE, equal to Type III here): F(2, 234) = 11.06, p = <0.0001.

Adding the randomization stratum (`factor(STRAT1RN)`) changes the estimates only slightly: 10 mg − placebo -4.59 (SE 1.646), 20 mg − placebo -7.76 (SE 1.660).

### Why adjust? Same subjects, three analyses of the Week 12 effect

| Analysis | 10 mg − placebo (SE) | 20 mg − placebo (SE) |
| --- | ---: | ---: |
| Week 12 value only (`AVAL ~ TRTP`) | -3.88 (1.735) | -6.83 (1.741) |
| Change score, unadjusted (`CHG ~ TRTP`) | -5.53 (1.835) | -8.98 (1.841) |
| ANCOVA (`CHG ~ TRTP + BASE`) | -4.56 (1.639) | -7.72 (1.648) |

Correlation between baseline and Week 12 SBP in these subjects: r = 0.304. SD of baseline = 9.01, SD of Week 12 SBP = 11.21, SD of CHG = 12.06.

## 5. Complete-case ANCOVA vs MMRM (missing data)

MMRM: `nlme::gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, correlation = corSymm(form = ~ as.integer(AVISIT) | USUBJID), weights = varIdent(form = ~ 1 | AVISIT), method = "REML")`
on all post-baseline `ANL01FL = "Y"` SYSBP records (988 records from 267 subjects). This is an unstructured covariance (separate variance per visit + a free correlation for every pair of visits). CIs below use the normal approximation; `nlme` does not provide Kenward–Roger degrees of freedom (SAS PROC MIXED with `DDFM=KR` would give slightly wider intervals).

| Comparison at Week 12 | Complete-case ANCOVA (SE) | MMRM (SE) | MMRM 95% CI | MMRM p |
| --- | ---: | ---: | --- | ---: |
| VTX-221 10 mg − Placebo | -4.56 (1.639) | -5.42 (1.625) | -8.60 to -2.23 | 0.0009 |
| VTX-221 20 mg − Placebo | -7.72 (1.648) | -8.35 (1.631) | -11.55 to -5.16 | <0.0001 |

| MMRM difference vs placebo by visit | Week 2 | Week 4 | Week 8 | Week 12 |
| --- | ---: | ---: | ---: | ---: |
| VTX-221 10 mg | -3.59 | -3.71 | -4.20 | -5.42 |
| VTX-221 20 mg | -5.71 | -7.32 | -8.19 | -8.35 |

Estimated residual SD by visit (Weeks 2, 4, 8, 12): 7.34, 8.42, 9.42, 10.37 mmHg.

Estimated within-subject correlations: Week 2–4 0.67, Week 4–8 0.56, Week 8–12 0.64, Week 2–12 0.45.

Subjects with an analysis SBP value by visit:

| Arm | Week 2 | Week 4 | Week 8 | Week 12 |
| --- | ---: | ---: | ---: | ---: |
| Placebo | 87 | 84 | 82 | 77 |
| VTX-221 10 mg | 85 | 85 | 79 | 81 |
| VTX-221 20 mg | 85 | 81 | 82 | 80 |

Why the two analyses differ: lack-of-efficacy dropout depends on the last observed SBP (MAR), and it is most common on placebo.
Placebo completers are therefore the better responders, which makes the complete-case placebo change look better and shrinks the
complete-case treatment differences. MMRM uses the pre-dropout visits of subjects who left, which (under MAR) corrects for this.

## 6. Secondary summaries

- Week 12 DBP, ANCOVA complete case: 10 mg − placebo -2.89 (SE 1.145), 20 mg − placebo -3.75 (SE 1.149) mmHg.
- Week 12 SBP < 140 mmHg (controlled), among subjects with a Week 12 value: Placebo 20/77 (26.0%); VTX-221 10 mg 37/81 (45.7%); VTX-221 20 mg 43/80 (53.8%).
- Week 12 SBP reduction >= 10 mmHg: Placebo 26/77 (33.8%); VTX-221 10 mg 38/81 (46.9%); VTX-221 20 mg 48/80 (60.0%).

## 7. Treatment-emergent adverse events (safety population; TEAE = AESTDY >= 1)

|  | Placebo (N = 90) | VTX-221 10 mg (N = 90) | VTX-221 20 mg (N = 88) |
| --- | ---: | ---: | ---: |
| Subjects with >= 1 TEAE | 24 (26.7%) | 32 (35.6%) | 48 (54.5%) |
| Subjects with >= 1 related TEAE | 4 (4.4%) | 15 (16.7%) | 26 (29.5%) |
| Subjects with >= 1 serious TEAE | 1 (1.1%) | 0 (0.0%) | 3 (3.4%) |
| Subjects with >= 1 severe TEAE | 3 (3.3%) | 1 (1.1%) | 2 (2.3%) |
| Subjects with a TEAE leading to discontinuation | 0 (0.0%) | 2 (2.2%) | 5 (5.7%) |
| TEAE records (events) | 29 | 38 | 70 |
| &nbsp;&nbsp;Dizziness (subjects) | 5 (5.6%) | 6 (6.7%) | 16 (18.2%) |
| &nbsp;&nbsp;Headache (subjects) | 4 (4.4%) | 9 (10.0%) | 5 (5.7%) |
| &nbsp;&nbsp;Edema peripheral (subjects) | 1 (1.1%) | 2 (2.2%) | 11 (12.5%) |
| &nbsp;&nbsp;Nasopharyngitis (subjects) | 1 (1.1%) | 7 (7.8%) | 5 (5.7%) |
| &nbsp;&nbsp;Upper respiratory tract infection (subjects) | 5 (5.6%) | 2 (2.2%) | 4 (4.5%) |
| &nbsp;&nbsp;Back pain (subjects) | 4 (4.4%) | 2 (2.2%) | 4 (4.5%) |
| &nbsp;&nbsp;Hypertension (subjects) | 6 (6.7%) | 2 (2.2%) | 0 (0.0%) |
| &nbsp;&nbsp;Cough (subjects) | 1 (1.1%) | 1 (1.1%) | 5 (5.7%) |
| &nbsp;&nbsp;Fatigue (subjects) | 1 (1.1%) | 0 (0.0%) | 6 (6.8%) |
| &nbsp;&nbsp;Nausea (subjects) | 0 (0.0%) | 4 (4.4%) | 1 (1.1%) |
| &nbsp;&nbsp;Orthostatic hypotension (subjects) | 0 (0.0%) | 2 (2.2%) | 3 (3.4%) |
| &nbsp;&nbsp;Hypotension (subjects) | 0 (0.0%) | 1 (1.1%) | 3 (3.4%) |
| &nbsp;&nbsp;Syncope (subjects) | 0 (0.0%) | 0 (0.0%) | 3 (3.4%) |
| &nbsp;&nbsp;Hyperkalemia (subjects) | 0 (0.0%) | 0 (0.0%) | 1 (1.1%) |

Pre-treatment AEs (EPOCH = SCREENING, AESTDY < 1): 5 records — not treatment-emergent.

## 8. R code used

The complete script is `scripts/data/cardio/facts.R`. The two central models:

```r
sbp <- subset(advs, PARAMCD == "SYSBP" & ANL01FL == "Y")
w12 <- subset(sbp, AVISITN == 12)
fit <- lm(CHG ~ TRTP + BASE, data = w12)                   # ANCOVA, complete cases
L   <- c(1, 0, 1, mean(w12$BASE))                          # LS mean for VTX-221 20 mg
sum(L * coef(fit)); sqrt(t(L) %*% vcov(fit) %*% L)

pb <- subset(sbp, AVISITN > 0); pb$AVISIT <- factor(pb$AVISITN)
mm <- nlme::gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, data = pb,
                correlation = nlme::corSymm(form = ~ as.integer(AVISIT) | USUBJID),
                weights = nlme::varIdent(form = ~ 1 | AVISIT), method = "REML")
```

