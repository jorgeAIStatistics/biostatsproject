# CBX417-301 — computed study facts

All numbers below are **computed from the generated datasets** by `scripts/data/oncology/verify.R`
(R 4.6.1, survival 3.8.9) — nothing here is assumed or hand-written.
Data cutoff 2025-03-31. Everything is synthetic.

## 1. Subject flow

| | n |
|---|---|
| Screened (informed consent) | 468 |
| Screen failures | 48 |
| Randomized (ITT) | 420 |
| — CBX-417 + docetaxel | 210 |
| — Placebo + docetaxel | 210 |
| Randomized, never treated (SAFFL = N) | 4 (CBX 2 / PBO 2) |
| Treated (safety population) | 416 |
| — actual treatment CBX-417 + docetaxel | 209 |
| — actual treatment placebo + docetaxel | 207 |
| Planned treatment != actual treatment (dispensing errors) | 3 |
| Efficacy population (EFFFL = Y) | 411 |
| Per-protocol population (PPROTFL = Y) | 388 |
| Deaths reported | 356 |
| Still on treatment at cutoff | 27 |
| Still in study (follow-up or treatment) at cutoff | 53 |

Exposure (safety population): median 23.7 weeks (CBX-417 + docetaxel) vs 16.4 weeks (placebo + docetaxel); median 5 docetaxel infusions (max 50).

## 2. Progression-free survival (investigator, RECIST 1.1)

| Arm | n | Events | Median (months) | 95% CI (log) | 95% CI (log-log) |
|---|---|---|---|---|---|

- Log-rank p (unstratified): **0.0006**; stratified by STRAT1R and STRAT2R: **0.0006**
- Cox HR (CBX-417 vs placebo), unstratified, Efron ties (R default): **0.685 (0.551-0.851), p = 0.0006**
- Cox HR, unstratified, Breslow ties (SAS PROC PHREG default): **0.689 (0.554-0.856), p = 0.0008**
- Cox HR, stratified by STRAT1R/STRAT2R, Efron ties: **0.681 (0.546-0.849), p = 0.0006**
- Cox HR, stratified, Breslow ties: **0.685 (0.549-0.854), p = 0.0008**

Censoring reasons (PFS):

| Reason | CBX-417 + Docetaxel | Placebo + Docetaxel |
|---|---|---|
| Event | 155 | 177 |
| Censored: alive without progression | 21 | 15 |
| Censored: no baseline/post-baseline assessment | 5 | 4 |
| Censored: new anticancer therapy | 23 | 5 |
| Censored: >=2 missed assessments | 6 | 9 |

## 3. Overall survival

| Arm | n | Events | Median (months) | 95% CI (log) | 95% CI (log-log) |
|---|---|---|---|---|---|

- Log-rank p (unstratified): **0.0444**; stratified: **0.0358**
- Cox HR, unstratified, Efron: **0.808 (0.655-0.995), p = 0.0448**
- Cox HR, unstratified, Breslow: **0.808 (0.656-0.995), p = 0.0451**
- Cox HR, stratified, Efron: **0.796 (0.644-0.985), p = 0.0357**
- Cox HR, stratified, Breslow: **0.797 (0.645-0.986), p = 0.0365**

## 4. Response (confirmed, investigator)

| Arm | n (ITT) | Responders (CR+PR) | ORR | 95% CI (Clopper-Pearson) |
|---|---|---|---|---|
| Placebo + Docetaxel | 210 | 31 | 14.8% | 10.3%-20.3% |
| CBX-417 + Docetaxel | 210 | 58 | 27.6% | 21.7%-34.2% |

- Difference in ORR (ITT): **12.9 percentage points**.
- ORR in the efficacy population (EFFFL = Y): 28.3% (58/205) vs 15.0% (31/206).
- Duration of response (responders only): median 6.87 months (CBX-417 + docetaxel, n = 31) vs 9.30 months (placebo + docetaxel, n = 58).

Confirmed best overall response:

| CBOR | CBX-417 + Docetaxel | Placebo + Docetaxel |
|---|---|---|
| NE | 8 | 6 |
| PD | 31 | 40 |
| PR | 57 | 31 |
| SD | 113 | 133 |
| CR | 1 | 0 |

## 5. Adverse events (safety population, treatment-emergent)

| | CBX-417 + Docetaxel (N=209) | Placebo + Docetaxel (N=207) |
|---|---|---|
| Subjects with Any TEAE | 209 (100.0%) | 205 (99.0%) |
| Subjects with Grade >=3 TEAE | 152 (72.7%) | 145 (70.0%) |
| Subjects with Serious TEAE | 72 (34.4%) | 61 (29.5%) |
| Subjects with TEAE leading to discontinuation of CBX-417/placebo | 49 (23.4%) | 34 (16.4%) |
| Subjects with TEAE leading to discontinuation of any study drug | 71 (34.0%) | 47 (22.7%) |
| Subjects with Fatal TEAE (grade 5) | 8 (3.8%) | 17 (8.2%) |
| Subjects with TEAE related to CBX-417/placebo | 204 (97.6%) | 164 (79.2%) |
| Subjects with Grade >=3 TEAE related to CBX-417/placebo | 109 (52.2%) | 62 (30.0%) |

Most frequent preferred terms (any grade, by number of subjects):

| Preferred term | CBX-417 + Docetaxel n (%) | Placebo + Docetaxel n (%) |
|---|---|---|
| Neutropenia | 84 (40.2%) | 95 (45.9%) |
| Fatigue | 97 (46.4%) | 69 (33.3%) |
| Diarrhea | 102 (48.8%) | 46 (22.2%) |
| Alopecia | 60 (28.7%) | 70 (33.8%) |
| Nausea | 68 (32.5%) | 57 (27.5%) |
| Stomatitis | 61 (29.2%) | 33 (15.9%) |
| Rash | 59 (28.2%) | 15 (7.2%) |
| Decreased appetite | 39 (18.7%) | 34 (16.4%) |
| Anemia | 33 (15.8%) | 27 (13.0%) |
| Constipation | 20 (9.6%) | 36 (17.4%) |

Most frequent grade >=3 preferred terms:

| Preferred term | CBX-417 + Docetaxel n (%) | Placebo + Docetaxel n (%) |
|---|---|---|
| Neutropenia | 66 (31.6%) | 71 (34.3%) |
| Febrile neutropenia | 19 (9.1%) | 12 (5.8%) |
| Diarrhea | 25 (12.0%) | 4 (1.9%) |
| Pneumonia | 12 (5.7%) | 16 (7.7%) |
| Fatigue | 18 (8.6%) | 9 (4.3%) |

## 6. Laboratory

Alanine aminotransferase, change from baseline at Cycle 4 Day 1 (ANL01FL = Y, safety population):

| Actual treatment | n | Mean baseline (U/L) | Mean value (U/L) | Mean change | SD of change |
|---|---|---|---|---|---|
| CBX-417 + Docetaxel | 147 | 23.2 | 28.6 | 5.34 | 16.97 |
| Placebo + Docetaxel | 145 | 22.9 | 25.9 | 3.02 | 21.60 |

Worst on-treatment CTCAE grade >=3 laboratory abnormality (subjects with at least one on-treatment value):

| Parameter | CBX-417 + Docetaxel | Placebo + Docetaxel |
|---|---|---|
| ALT | 12/203 (5.9%) | 0/203 (0.0%) |
| AST | 5/203 (2.5%) | 0/203 (0.0%) |
| BILI | 0/203 (0.0%) | 0/203 (0.0%) |
| HGB | 5/209 (2.4%) | 6/207 (2.9%) |
| NEUT | 62/209 (29.7%) | 52/207 (25.1%) |
| PLAT | 4/209 (1.9%) | 4/207 (1.9%) |

## 7. Consistency checks

- PASS **USUBJID unique in DM and ADSL**
- PASS **Subject flow: 468 screened, 48 screen failures, 420 randomized (210/210), 416 treated**
- PASS **ADTTE AVAL = ADT - STARTDT + 1 for every record**
- PASS **ADLB CHG = AVAL - BASE where populated**
- PASS **ADLB has exactly one ABLFL = 'Y' per subject and parameter (where baseline exists)**
- PASS **ADAE TRTEMFL = Y matches TRTSDT <= ASTDT <= TRTEDT + 30**
- PASS **No analysis date after the data cutoff 2025-03-31**
- PASS **Every ADTTE record has a source SDTM sequence number (SRCSEQ) or is censored at randomization**

(Further structural checks — `--SEQ` uniqueness, lineage coverage, SRCSEQ resolution, study-day rules —
run inside the generator: `scripts/data/oncology/check.ts`.)

## 8. The R code that produced this file

```r
#!/usr/bin/env Rscript
# CBX417-301 - verification of the generated synthetic datasets.
#
#   Rscript scripts/data/oncology/verify.R [data/oncology]
#
# Every number in data/oncology/STUDY_FACTS.md is computed here from the
# generated ADaM/SDTM CSVs with the survival package; nothing is assumed.
# The script also writes STUDY_FACTS.md (including this code).

suppressPackageStartupMessages({
  library(survival); library(dplyr); library(readr); library(tidyr)
})
options(stringsAsFactors = FALSE)
args <- commandArgs(trailingOnly = TRUE)
dir <- if (length(args) >= 1) args[1] else "data/oncology"
self <- (function() {
  a <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", a[grep("^--file=", a)])
  if (length(f)) normalizePath(f) else "scripts/data/oncology/verify.R"
})()
rd <- function(p) suppressWarnings(read_csv(file.path(dir, p), show_col_types = FALSE, progress = FALSE))

adsl  <- rd("adam/adsl.csv");  adtte <- rd("adam/adtte.csv"); adae <- rd("adam/adae.csv")
adrs  <- rd("adam/adrs.csv");  adlb  <- rd("adam/adlb.csv")
dm    <- rd("sdtm/dm.csv");    ex    <- rd("sdtm/ex.csv")

MONTH <- 30.4375
f2 <- function(x, d = 2) formatC(x, format = "f", digits = d)
pf <- function(p) if (is.na(p)) "NA" else if (p < 0.0001) "<0.0001" else formatC(p, format = "f", digits = 4)
arm_f <- function(x) factor(x, levels = c("Placebo + Docetaxel", "CBX-417 + Docetaxel"))
out <- character(0); say <- function(...) out <<- c(out, paste0(...))

## ---------------------------------------------------------------- subject flow
flow <- list(
  screened   = nrow(dm),
  screenfail = sum(dm$ARMNRS %in% "SCREEN FAILURE"),
  randomized = nrow(adsl),
  rand_cbx   = sum(adsl$ARMCD == "CBX+DOC"),
  rand_pbo   = sum(adsl$ARMCD == "PBO+DOC"),
  treated    = sum(adsl$SAFFL == "Y"),
  nt_cbx     = sum(adsl$ARMCD == "CBX+DOC" & adsl$SAFFL == "N"),
  nt_pbo     = sum(adsl$ARMCD == "PBO+DOC" & adsl$SAFFL == "N"),
  act_cbx    = sum(adsl$TRT01A %in% "CBX-417 + Docetaxel"),
  act_pbo    = sum(adsl$TRT01A %in% "Placebo + Docetaxel"),
  mismatch   = sum(adsl$SAFFL == "Y" & adsl$TRT01A != ifelse(adsl$ARMCD == "CBX+DOC", "CBX-417 + Docetaxel", "Placebo + Docetaxel")),
  eff        = sum(adsl$EFFFL == "Y"), pp = sum(adsl$PPROTFL == "Y"),
  deaths     = sum(adsl$DTHFL == "Y"), ongoing_trt = sum(adsl$EOTSTT %in% "ONGOING"),
  in_fu      = sum(adsl$EOSSTT == "ONGOING")
)

## ---------------------------------------------------------------- time-to-event
tte_fit <- function(paramcd) {
  d <- adtte %>% filter(PARAMCD == paramcd) %>%
    mutate(time = AVAL / MONTH, event = as.integer(CNSR == 0), arm = arm_f(TRTP),
           s1 = factor(STRAT1R), s2 = factor(STRAT2R))
  km   <- survfit(Surv(time, event) ~ arm, data = d, conf.type = "log")
  kmll <- survfit(Surv(time, event) ~ arm, data = d, conf.type = "log-log")
  tab  <- summary(km)$table; tabll <- summary(kmll)$table
  lr_u <- survdiff(Surv(time, event) ~ arm, data = d)
  lr_s <- survdiff(Surv(time, event) ~ arm + strata(s1, s2), data = d)
  p_of <- function(x) pchisq(x$chisq, length(x$n) - 1, lower.tail = FALSE)
  cox <- function(strat, ties) {
    fml <- if (strat) Surv(time, event) ~ arm + strata(s1, s2) else Surv(time, event) ~ arm
    m <- coxph(fml, data = d, ties = ties)
    s <- summary(m)
    list(hr = unname(s$conf.int[1, 1]), lo = unname(s$conf.int[1, 3]), hi = unname(s$conf.int[1, 4]),
         p = unname(s$coefficients[1, 5]), se = unname(s$coefficients[1, 3]))
  }
  list(data = d, n = as.integer(tab[, "records"]), events = as.integer(tab[, "events"]),
       median = tab[, "median"], lo = tab[, "0.95LCL"], hi = tab[, "0.95UCL"],
       median_ll = tabll[, "median"], lo_ll = tabll[, "0.95LCL"], hi_ll = tabll[, "0.95UCL"],
       p_unstrat = p_of(lr_u), p_strat = p_of(lr_s),
       cox_u_ef = cox(FALSE, "efron"), cox_s_ef = cox(TRUE, "efron"),
       cox_u_br = cox(FALSE, "breslow"), cox_s_br = cox(TRUE, "breslow"),
       cnsr = table(d$CNSR, d$arm))
}
pfs <- tte_fit("PFS"); os <- tte_fit("OS")
dor <- adtte %>% filter(PARAMCD == "DOR") %>% mutate(time = AVAL / MONTH, event = as.integer(CNSR == 0), arm = arm_f(TRTP))
dor_km <- if (nrow(dor)) summary(survfit(Surv(time, event) ~ arm, data = dor, conf.type = "log"))$table else NULL

## ---------------------------------------------------------------- response
cbor <- adrs %>% filter(PARAMCD == "CBOR") %>% select(USUBJID, CBOR = AVALC)
resp <- adsl %>% left_join(cbor, by = "USUBJID") %>% mutate(arm = arm_f(TRT01P), responder = CBOR %in% c("CR", "PR"))
orr <- resp %>% group_by(arm) %>% summarise(n = n(), x = sum(responder), .groups = "drop") %>%
  rowwise() %>% mutate(pct = 100 * x / n,
                       lo = 100 * binom.test(x, n)$conf.int[1], hi = 100 * binom.test(x, n)$conf.int[2]) %>% ungroup()
orr_eff <- resp %>% filter(EFFFL == "Y") %>% group_by(arm) %>% summarise(n = n(), x = sum(responder), .groups = "drop") %>%
  rowwise() %>% mutate(pct = 100 * x / n) %>% ungroup()
bor_tab <- resp %>% mutate(CBOR = ifelse(is.na(CBOR), "NE", CBOR)) %>% count(arm, CBOR) %>%
  pivot_wider(names_from = arm, values_from = n, values_fill = 0)
orr_diff <- orr$pct[orr$arm == "CBX-417 + Docetaxel"] - orr$pct[orr$arm == "Placebo + Docetaxel"]

## ---------------------------------------------------------------- safety
saf <- adsl %>% filter(SAFFL == "Y") %>% select(USUBJID, TRTA = TRT01A)
n_saf <- saf %>% count(TRTA)
teae <- adae %>% filter(TRTEMFL == "Y", USUBJID %in% saf$USUBJID)
cat_flags <- teae %>% mutate(
  any = TRUE, g3 = ATOXGRN >= 3, ser = AESER == "Y", fatal = ATOXGRN == 5 | AEOUT == "FATAL",
  disc_cbx = AEACN == "DRUG WITHDRAWN", disc_any = AEACN == "DRUG WITHDRAWN" | AEACNDOC %in% "DRUG WITHDRAWN",
  rel = AREL %in% "RELATED", rel_g3 = AREL %in% "RELATED" & ATOXGRN >= 3)
subj_flag <- function(col) cat_flags %>% filter(.data[[col]]) %>% distinct(USUBJID, TRTA) %>% count(TRTA)
overview <- lapply(c("any", "g3", "ser", "disc_cbx", "disc_any", "fatal", "rel", "rel_g3"), subj_flag)
names(overview) <- c("Any TEAE", "Grade >=3 TEAE", "Serious TEAE", "TEAE leading to discontinuation of CBX-417/placebo",
                     "TEAE leading to discontinuation of any study drug", "Fatal TEAE (grade 5)",
                     "TEAE related to CBX-417/placebo", "Grade >=3 TEAE related to CBX-417/placebo")
pct_of <- function(tab, arm) {
  n <- n_saf$n[n_saf$TRTA == arm]; v <- tab$n[tab$TRTA == arm]; if (!length(v)) v <- 0
  sprintf("%d (%.1f%%)", v, 100 * v / n)
}
top_pt <- teae %>% distinct(USUBJID, TRTA, AEDECOD) %>% count(AEDECOD, TRTA) %>%
  pivot_wider(names_from = TRTA, values_from = n, values_fill = 0) %>%
  mutate(total = `CBX-417 + Docetaxel` + `Placebo + Docetaxel`) %>% arrange(desc(total)) %>% head(10)
top_pt_g3 <- teae %>% filter(ATOXGRN >= 3) %>% distinct(USUBJID, TRTA, AEDECOD) %>% count(AEDECOD, TRTA) %>%
  pivot_wider(names_from = TRTA, values_from = n, values_fill = 0) %>%
  mutate(total = `CBX-417 + Docetaxel` + `Placebo + Docetaxel`) %>% arrange(desc(total)) %>% head(5)

## ---------------------------------------------------------------- laboratory
alt_c4 <- adlb %>% filter(PARAMCD == "ALT", AVISIT == "CYCLE 4 DAY 1", ANL01FL == "Y", SAFFL == "Y", !is.na(CHG)) %>%
  group_by(TRTA) %>% summarise(n = n(), mean_base = mean(BASE), mean_chg = mean(CHG), sd_chg = sd(CHG),
                               mean_aval = mean(AVAL), .groups = "drop")
shift <- adlb %>% filter(SAFFL == "Y", ONTRTFL == "Y", !is.na(ATOXGRN)) %>%
  group_by(TRTA, PARAMCD, USUBJID) %>% summarise(worst = max(ATOXGRN), .groups = "drop") %>%
  group_by(TRTA, PARAMCD) %>% summarise(n = n(), g3plus = sum(worst >= 3), pct = 100 * mean(worst >= 3), .groups = "drop") %>%
  pivot_wider(names_from = TRTA, values_from = c(n, g3plus, pct))
expo <- adsl %>% filter(SAFFL == "Y") %>% group_by(TRT01A) %>%
  summarise(n = n(), median_weeks = median(TRTDURD) / 7, mean_weeks = mean(TRTDURD) / 7, .groups = "drop")
cycles <- ex %>% filter(EXTRT == "DOCETAXEL") %>% count(USUBJID) %>% summarise(median = median(n), max = max(n))

## ---------------------------------------------------------------- checks
chk <- function(label, ok) sprintf("- %s **%s**", ifelse(ok, "PASS", "FAIL"), label)
checks <- c(
  chk("USUBJID unique in DM and ADSL", !any(duplicated(dm$USUBJID)) && !any(duplicated(adsl$USUBJID))),
  chk("Subject flow: 468 screened, 48 screen failures, 420 randomized (210/210), 416 treated",
      flow$screened == 468 && flow$screenfail == 48 && flow$randomized == 420 && flow$rand_cbx == 210 && flow$treated == 416),
  chk("ADTTE AVAL = ADT - STARTDT + 1 for every record",
      all(adtte$AVAL == as.integer(as.Date(adtte$ADT) - as.Date(adtte$STARTDT)) + 1L)),
  chk("ADLB CHG = AVAL - BASE where populated",
      all(abs(adtte$AVAL - adtte$AVAL) == 0) && all(abs((adlb$AVAL - adlb$BASE) - adlb$CHG)[!is.na(adlb$CHG)] < 1e-6)),
  chk("ADLB has exactly one ABLFL = 'Y' per subject and parameter (where baseline exists)",
      all((adlb %>% filter(ABLFL == "Y") %>% count(USUBJID, PARAMCD))$n == 1)),
  chk("ADAE TRTEMFL = Y matches TRTSDT <= ASTDT <= TRTEDT + 30",
      all((adae$TRTEMFL %in% "Y") == (!is.na(adae$TRTSDT) & as.Date(adae$ASTDT) >= as.Date(adae$TRTSDT) &
                                        as.Date(adae$ASTDT) <= as.Date(adae$TRTEDT) + 30))),
  chk("No analysis date after the data cutoff 2025-03-31",
      max(c(as.Date(adtte$ADT), as.Date(adae$ASTDT), as.Date(adlb$ADT))) <= as.Date("2025-03-31")),
  chk("Every ADTTE record has a source SDTM sequence number (SRCSEQ) or is censored at randomization",
      all(!is.na(adtte$SRCSEQ) | adtte$CNSDTDSC %in% c("RANDOMIZATION DATE")))
)

## ---------------------------------------------------------------- report
arms <- c("CBX-417 + Docetaxel", "Placebo + Docetaxel")
km_row <- function(f, i) sprintf("%d | %d (%.1f%%) | %s | %s-%s | %s-%s", f$n[i], f$events[i], 100 * f$events[i] / f$n[i],
                                 f2(f$median[i]), f2(f$lo[i]), f2(f$hi[i]), f2(f$lo_ll[i]), f2(f$hi_ll[i]))
hr_row <- function(c) sprintf("%s (%s-%s), p = %s", f2(c$hr, 3), f2(c$lo, 3), f2(c$hi, 3), pf(c$p))
cnsr_lbl <- c("0" = "Event", "1" = "Censored: alive without progression", "2" = "Censored: no baseline/post-baseline assessment",
              "3" = "Censored: new anticancer therapy", "4" = "Censored: >=2 missed assessments")

say("# CBX417-301 — computed study facts")
say("")
say("All numbers below are **computed from the generated datasets** by `scripts/data/oncology/verify.R`")
say("(R ", getRversion(), ", survival ", as.character(packageVersion("survival")), ") — nothing here is assumed or hand-written.")
say("Data cutoff 2025-03-31. Everything is synthetic.")
say("")
say("## 1. Subject flow")
say("")
say("| | n |"); say("|---|---|")
say(sprintf("| Screened (informed consent) | %d |", flow$screened))
say(sprintf("| Screen failures | %d |", flow$screenfail))
say(sprintf("| Randomized (ITT) | %d |", flow$randomized))
say(sprintf("| — CBX-417 + docetaxel | %d |", flow$rand_cbx))
say(sprintf("| — Placebo + docetaxel | %d |", flow$rand_pbo))
say(sprintf("| Randomized, never treated (SAFFL = N) | %d (CBX %d / PBO %d) |", flow$randomized - flow$treated, flow$nt_cbx, flow$nt_pbo))
say(sprintf("| Treated (safety population) | %d |", flow$treated))
say(sprintf("| — actual treatment CBX-417 + docetaxel | %d |", flow$act_cbx))
say(sprintf("| — actual treatment placebo + docetaxel | %d |", flow$act_pbo))
say(sprintf("| Planned treatment != actual treatment (dispensing errors) | %d |", flow$mismatch))
say(sprintf("| Efficacy population (EFFFL = Y) | %d |", flow$eff))
say(sprintf("| Per-protocol population (PPROTFL = Y) | %d |", flow$pp))
say(sprintf("| Deaths reported | %d |", flow$deaths))
say(sprintf("| Still on treatment at cutoff | %d |", flow$ongoing_trt))
say(sprintf("| Still in study (follow-up or treatment) at cutoff | %d |", flow$in_fu))
say("")
say(sprintf("Exposure (safety population): median %s weeks (CBX-417 + docetaxel) vs %s weeks (placebo + docetaxel); median %d docetaxel infusions (max %d).",
            f2(expo$median_weeks[expo$TRT01A == arms[1]], 1), f2(expo$median_weeks[expo$TRT01A == arms[2]], 1), cycles$median, cycles$max))
say("")
say("## 2. Progression-free survival (investigator, RECIST 1.1)")
say("")
say("| Arm | n | Events | Median (months) | 95% CI (log) | 95% CI (log-log) |")
say("|---|---|---|---|---|---|")
for (i in 1:2) say(sprintf("| %s | %s |", sub("arm=", "", names(pfs$events)[i]), km_row(pfs, i)))
say("")
say(sprintf("- Log-rank p (unstratified): **%s**; stratified by STRAT1R and STRAT2R: **%s**", pf(pfs$p_unstrat), pf(pfs$p_strat)))
say(sprintf("- Cox HR (CBX-417 vs placebo), unstratified, Efron ties (R default): **%s**", hr_row(pfs$cox_u_ef)))
say(sprintf("- Cox HR, unstratified, Breslow ties (SAS PROC PHREG default): **%s**", hr_row(pfs$cox_u_br)))
say(sprintf("- Cox HR, stratified by STRAT1R/STRAT2R, Efron ties: **%s**", hr_row(pfs$cox_s_ef)))
say(sprintf("- Cox HR, stratified, Breslow ties: **%s**", hr_row(pfs$cox_s_br)))
say("")
say("Censoring reasons (PFS):")
say("")
say(sprintf("| Reason | %s | %s |", arms[1], arms[2])); say("|---|---|---|")
for (k in rownames(pfs$cnsr)) say(sprintf("| %s | %d | %d |", cnsr_lbl[k], pfs$cnsr[k, 2], pfs$cnsr[k, 1]))
say("")
say("## 3. Overall survival")
say("")
say("| Arm | n | Events | Median (months) | 95% CI (log) | 95% CI (log-log) |")
say("|---|---|---|---|---|---|")
for (i in 1:2) say(sprintf("| %s | %s |", sub("arm=", "", names(os$events)[i]), km_row(os, i)))
say("")
say(sprintf("- Log-rank p (unstratified): **%s**; stratified: **%s**", pf(os$p_unstrat), pf(os$p_strat)))
say(sprintf("- Cox HR, unstratified, Efron: **%s**", hr_row(os$cox_u_ef)))
say(sprintf("- Cox HR, unstratified, Breslow: **%s**", hr_row(os$cox_u_br)))
say(sprintf("- Cox HR, stratified, Efron: **%s**", hr_row(os$cox_s_ef)))
say(sprintf("- Cox HR, stratified, Breslow: **%s**", hr_row(os$cox_s_br)))
say("")
say("## 4. Response (confirmed, investigator)")
say("")
say("| Arm | n (ITT) | Responders (CR+PR) | ORR | 95% CI (Clopper-Pearson) |")
say("|---|---|---|---|---|")
for (i in seq_len(nrow(orr))) say(sprintf("| %s | %d | %d | %s%% | %s%%-%s%% |", as.character(orr$arm[i]), orr$n[i], orr$x[i],
                                          f2(orr$pct[i], 1), f2(orr$lo[i], 1), f2(orr$hi[i], 1)))
say("")
say(sprintf("- Difference in ORR (ITT): **%s percentage points**.", f2(orr_diff, 1)))
say(sprintf("- ORR in the efficacy population (EFFFL = Y): %s%% (%d/%d) vs %s%% (%d/%d).",
            f2(orr_eff$pct[orr_eff$arm == arms[1]], 1), orr_eff$x[orr_eff$arm == arms[1]], orr_eff$n[orr_eff$arm == arms[1]],
            f2(orr_eff$pct[orr_eff$arm == arms[2]], 1), orr_eff$x[orr_eff$arm == arms[2]], orr_eff$n[orr_eff$arm == arms[2]]))
if (!is.null(dor_km)) say(sprintf("- Duration of response (responders only): median %s months (CBX-417 + docetaxel, n = %d) vs %s months (placebo + docetaxel, n = %d).",
                                  f2(dor_km[1, "median"]), as.integer(dor_km[1, "records"]), f2(dor_km[2, "median"]), as.integer(dor_km[2, "records"])))
say("")
say("Confirmed best overall response:")
say("")
say(sprintf("| CBOR | %s | %s |", arms[1], arms[2])); say("|---|---|---|")
for (i in seq_len(nrow(bor_tab))) say(sprintf("| %s | %d | %d |", bor_tab$CBOR[i], bor_tab[[arms[1]]][i], bor_tab[[arms[2]]][i]))
say("")
say("## 5. Adverse events (safety population, treatment-emergent)")
say("")
say(sprintf("| | %s (N=%d) | %s (N=%d) |", arms[1], n_saf$n[n_saf$TRTA == arms[1]], arms[2], n_saf$n[n_saf$TRTA == arms[2]]))
say("|---|---|---|")
for (nm in names(overview)) say(sprintf("| Subjects with %s | %s | %s |", nm, pct_of(overview[[nm]], arms[1]), pct_of(overview[[nm]], arms[2])))
say("")
say("Most frequent preferred terms (any grade, by number of subjects):")
say("")
say(sprintf("| Preferred term | %s n (%%) | %s n (%%) |", arms[1], arms[2])); say("|---|---|---|")
for (i in seq_len(nrow(top_pt))) say(sprintf("| %s | %d (%.1f%%) | %d (%.1f%%) |", top_pt$AEDECOD[i],
                                             top_pt[[arms[1]]][i], 100 * top_pt[[arms[1]]][i] / n_saf$n[n_saf$TRTA == arms[1]],
                                             top_pt[[arms[2]]][i], 100 * top_pt[[arms[2]]][i] / n_saf$n[n_saf$TRTA == arms[2]]))
say("")
say("Most frequent grade >=3 preferred terms:")
say("")
say(sprintf("| Preferred term | %s n (%%) | %s n (%%) |", arms[1], arms[2])); say("|---|---|---|")
for (i in seq_len(nrow(top_pt_g3))) say(sprintf("| %s | %d (%.1f%%) | %d (%.1f%%) |", top_pt_g3$AEDECOD[i],
                                                top_pt_g3[[arms[1]]][i], 100 * top_pt_g3[[arms[1]]][i] / n_saf$n[n_saf$TRTA == arms[1]],
                                                top_pt_g3[[arms[2]]][i], 100 * top_pt_g3[[arms[2]]][i] / n_saf$n[n_saf$TRTA == arms[2]]))
say("")
say("## 6. Laboratory")
say("")
say("Alanine aminotransferase, change from baseline at Cycle 4 Day 1 (ANL01FL = Y, safety population):")
say("")
say("| Actual treatment | n | Mean baseline (U/L) | Mean value (U/L) | Mean change | SD of change |")
say("|---|---|---|---|---|---|")
for (i in seq_len(nrow(alt_c4))) say(sprintf("| %s | %d | %s | %s | %s | %s |", alt_c4$TRTA[i], alt_c4$n[i],
                                             f2(alt_c4$mean_base[i], 1), f2(alt_c4$mean_aval[i], 1), f2(alt_c4$mean_chg[i], 2), f2(alt_c4$sd_chg[i], 2)))
say("")
say("Worst on-treatment CTCAE grade >=3 laboratory abnormality (subjects with at least one on-treatment value):")
say("")
say(sprintf("| Parameter | %s | %s |", arms[1], arms[2])); say("|---|---|---|")
for (i in seq_len(nrow(shift))) say(sprintf("| %s | %d/%d (%.1f%%) | %d/%d (%.1f%%) |", shift$PARAMCD[i],
                                            shift[[paste0("g3plus_", arms[1])]][i], shift[[paste0("n_", arms[1])]][i], shift[[paste0("pct_", arms[1])]][i],
                                            shift[[paste0("g3plus_", arms[2])]][i], shift[[paste0("n_", arms[2])]][i], shift[[paste0("pct_", arms[2])]][i]))
say("")
say("## 7. Consistency checks")
say("")
out <- c(out, checks)
say("")
say("(Further structural checks — `--SEQ` uniqueness, lineage coverage, SRCSEQ resolution, study-day rules —")
say("run inside the generator: `scripts/data/oncology/check.ts`.)")
say("")
say("## 8. The R code that produced this file")
say("")
say("```r")
out <- c(out, readLines(self))
say("```")

writeLines(out, file.path(dir, "STUDY_FACTS.md"))
cat(sprintf("PFS HR (stratified, Efron) %s [%s-%s]; medians %s vs %s months; events %d/%d\n",
            f2(pfs$cox_s_ef$hr, 3), f2(pfs$cox_s_ef$lo, 3), f2(pfs$cox_s_ef$hi, 3),
            f2(pfs$median[1]), f2(pfs$median[2]), sum(pfs$events), sum(pfs$n)))
cat(sprintf("OS  HR (stratified, Efron) %s [%s-%s]; medians %s vs %s months; events %d\n",
            f2(os$cox_s_ef$hr, 3), f2(os$cox_s_ef$lo, 3), f2(os$cox_s_ef$hi, 3), f2(os$median[1]), f2(os$median[2]), sum(os$events)))
cat(sprintf("ORR %s%% vs %s%%; any TEAE %s / %s; STUDY_FACTS.md written\n",
            f2(orr$pct[orr$arm == arms[1]], 1), f2(orr$pct[orr$arm == arms[2]], 1),
            pct_of(overview[["Any TEAE"]], arms[1]), pct_of(overview[["Any TEAE"]], arms[2])))
if (any(grepl("FAIL", checks))) quit(status = 1)
```
