# Computes the key results of the synthetic VTX221-201 trial from the generated CSV files and
# writes data/cardio/FACTS.md. Run from the project root:
#   Rscript scripts/data/cardio/facts.R
# Uses base R + nlme only (no emmeans/mmrm), so every LS mean is computed from model coefficients.
suppressMessages(library(nlme))

args <- commandArgs(trailingOnly = FALSE)
script <- sub("^--file=", "", args[grep("^--file=", args)])
root <- if (length(script)) normalizePath(file.path(dirname(script), "..", "..", "..")) else getwd()
dd <- file.path(root, "data", "cardio")

adsl <- read.csv(file.path(dd, "adsl.csv"), stringsAsFactors = FALSE)
advs <- read.csv(file.path(dd, "advs.csv"), stringsAsFactors = FALSE)
ae   <- read.csv(file.path(dd, "ae.csv"), stringsAsFactors = FALSE)

arms <- c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg")
f1 <- function(x) formatC(x, format = "f", digits = 1)
f2 <- function(x) formatC(x, format = "f", digits = 2)
f3 <- function(x) formatC(x, format = "f", digits = 3)
fp <- function(p) ifelse(p < 0.0001, "<0.0001", formatC(p, format = "f", digits = 4))
row <- function(...) paste0("| ", paste(c(...), collapse = " | "), " |")
out <- character()
add <- function(...) out <<- c(out, ...)

# ---------------- Disposition ----------------
adsl$TRT01P <- factor(adsl$TRT01P, arms)
nr <- table(adsl$TRT01P)
add("# VTX221-201 — key facts (computed in R)", "",
    "> Synthetic, fictional data. Every number below is computed by `scripts/data/cardio/facts.R` from",
    "> `adsl.csv`, `advs.csv` and `ae.csv`. Quote these numbers (or recompute them) — never estimate.", "",
    "## 1. Subject disposition (ITT = all randomized)", "",
    row("", arms, "Total"), row("---", "---:", "---:", "---:", "---:"))
cnt <- function(f) { x <- tapply(f, adsl$TRT01P, sum); c(x, sum(x)) }
pct <- function(n, d) paste0(n, " (", f1(100 * n / d), "%)")
tot <- c(nr, sum(nr))
add(row("Randomized (ITTFL = Y)", paste(tot)),
    row("Treated (SAFFL = Y)", paste(cnt(adsl$SAFFL == "Y"))),
    row("Completed Week 12 (COMPLFL = Y)", pct(cnt(adsl$COMPLFL == "Y"), tot)),
    row("Discontinued", pct(cnt(adsl$COMPLFL == "N"), tot)))
for (r in sort(unique(adsl$DCSREAS[adsl$DCSREAS != ""])))
  add(row(paste0("&nbsp;&nbsp;", r), paste(cnt(adsl$DCSREAS == r))))
add(row("Per-protocol (PPROTFL = Y)", paste(cnt(adsl$PPROTFL == "Y"))),
    row("Stratified in error (STRAT1R ≠ SBPGR1)", paste(cnt(adsl$STRAT1R != adsl$SBPGR1))), "")

# ---------------- Baseline ----------------
msd <- function(x, g) { m <- tapply(x, g, mean); s <- tapply(x, g, sd); c(paste0(f1(m), " (", f1(s), ")"), paste0(f1(mean(x)), " (", f1(sd(x)), ")")) }
add("## 2. Baseline characteristics (ITT)", "", row("", arms, "Total"), row("---", "---:", "---:", "---:", "---:"),
    row("Age, mean (SD)", msd(adsl$AGE, adsl$TRT01P)),
    row("Female, n (%)", pct(cnt(adsl$SEX == "F"), tot)),
    row("Age >= 65, n (%)", pct(cnt(adsl$AGEGR1 == ">=65"), tot)),
    row("BMI kg/m2, mean (SD)", msd(adsl$BMIBL, adsl$TRT01P)),
    row("Type 2 diabetes, n (%)", pct(cnt(adsl$DIABFL == "Y"), tot)),
    row("Baseline SBP mmHg, mean (SD)", msd(adsl$SBPBL, adsl$TRT01P)),
    row("Baseline DBP mmHg, mean (SD)", msd(adsl$DBPBL, adsl$TRT01P)),
    row("Baseline SBP >= 150 (SBPGR1N = 2), n (%)", pct(cnt(adsl$SBPGR1N == 2), tot)), "")

scr <- subset(advs, PARAMCD == "SYSBP" & AVISIT == "SCREENING")
add(paste0("Screening SBP (all randomized): mean ", f1(mean(scr$AVAL)), " mmHg; baseline (Day 1) SBP: mean ",
           f1(mean(adsl$SBPBL)), " mmHg — the ", f1(mean(scr$AVAL) - mean(adsl$SBPBL)),
           " mmHg drop before any treatment is regression to the mean after selecting on screening SBP >= 140."), "")

# ---------------- Observed data by visit ----------------
sbp <- subset(advs, PARAMCD == "SYSBP" & ANL01FL == "Y")
sbp$TRTP <- factor(sbp$TRTP, arms)
add("## 3. Observed seated SBP change from baseline by visit (ANL01FL = Y)", "",
    row("Visit", paste0(arms, ": n, mean CHG (SD)")), row("---", "---", "---", "---"))
for (v in c(2, 4, 8, 12)) {
  d <- subset(sbp, AVISITN == v)
  cells <- sapply(arms, function(a) { x <- d$CHG[d$TRTP == a]; paste0(length(x), ", ", f1(mean(x)), " (", f1(sd(x)), ")") })
  add(row(paste("Week", v), cells))
}
add("")

# ---------------- ANCOVA at Week 12 (complete case) ----------------
w12 <- subset(sbp, AVISITN == 12)
fit <- lm(CHG ~ TRTP + BASE, data = w12)
b <- coef(fit); V <- vcov(fit); dfe <- df.residual(fit); tq <- qt(0.975, dfe)
mb <- mean(w12$BASE)
lsm <- sapply(1:3, function(i) { L <- c(1, i == 2, i == 3, mb); c(est = sum(L * b), se = sqrt(drop(t(L) %*% V %*% L))) })
add("## 4. Primary endpoint — ANCOVA at Week 12 (complete cases, ITT)", "",
    "Model: `lm(CHG ~ TRTP + BASE)` on SYSBP records with `AVISITN = 12` and `ANL01FL = \"Y\"`",
    paste0("(n = ", nrow(w12), "; residual df = ", dfe, "; residual SD = ", f2(summary(fit)$sigma),
           "; baseline slope = ", f3(b["BASE"]), " (SE ", f3(sqrt(V["BASE", "BASE"])), ")). LS means are evaluated at the mean",
           " baseline of the analysis set, ", f2(mb), " mmHg (the SAS PROC GLM LSMEANS convention)."), "",
    row("Arm", "n", "LS mean CHG (SE)", "95% CI"), row("---", "---:", "---:", "---"))
for (i in 1:3) add(row(arms[i], sum(w12$TRTP == arms[i]), paste0(f2(lsm[1, i]), " (", f3(lsm[2, i]), ")"),
                       paste0(f2(lsm[1, i] - tq * lsm[2, i]), " to ", f2(lsm[1, i] + tq * lsm[2, i]))))
add("", row("Comparison", "Difference in LS means (SE)", "95% CI", "t", "p (two-sided)"), row("---", "---:", "---", "---:", "---:"))
sm <- summary(fit)$coefficients
for (i in 2:3) {
  est <- sm[i, 1]; se <- sm[i, 2]
  add(row(paste(arms[i], "− Placebo"), paste0(f2(est), " (", f3(se), ")"), paste0(f2(est - tq * se), " to ", f2(est + tq * se)), f2(sm[i, 3]), fp(sm[i, 4])))
}
L <- c(0, -1, 1, 0); e <- sum(L * b); s <- sqrt(drop(t(L) %*% V %*% L))
add(row("VTX-221 20 mg − 10 mg", paste0(f2(e), " (", f3(s), ")"), paste0(f2(e - tq * s), " to ", f2(e + tq * s)), f2(e / s), fp(2 * pt(-abs(e / s), dfe))), "")
a1 <- anova(lm(CHG ~ BASE + TRTP, data = w12))
add(paste0("Overall treatment F test (Type I after BASE, equal to Type III here): F(2, ", dfe, ") = ", f2(a1["TRTP", "F value"]), ", p = ", fp(a1["TRTP", "Pr(>F)"]), "."), "")

fit_s <- lm(CHG ~ TRTP + BASE + factor(STRAT1RN), data = merge(w12, adsl[, c("USUBJID", "STRAT1RN")], by = "USUBJID"))
ss <- summary(fit_s)$coefficients
add(paste0("Adding the randomization stratum (`factor(STRAT1RN)`) changes the estimates only slightly: 10 mg − placebo ",
           f2(ss[2, 1]), " (SE ", f3(ss[2, 2]), "), 20 mg − placebo ", f2(ss[3, 1]), " (SE ", f3(ss[3, 2]), ")."), "")

# Unadjusted comparisons (same subjects)
un <- summary(lm(CHG ~ TRTP, data = w12))$coefficients
po <- summary(lm(AVAL ~ TRTP, data = w12))$coefficients
add("### Why adjust? Same subjects, three analyses of the Week 12 effect", "",
    row("Analysis", "10 mg − placebo (SE)", "20 mg − placebo (SE)"), row("---", "---:", "---:"),
    row("Week 12 value only (`AVAL ~ TRTP`)", paste0(f2(po[2, 1]), " (", f3(po[2, 2]), ")"), paste0(f2(po[3, 1]), " (", f3(po[3, 2]), ")")),
    row("Change score, unadjusted (`CHG ~ TRTP`)", paste0(f2(un[2, 1]), " (", f3(un[2, 2]), ")"), paste0(f2(un[3, 1]), " (", f3(un[3, 2]), ")")),
    row("ANCOVA (`CHG ~ TRTP + BASE`)", paste0(f2(sm[2, 1]), " (", f3(sm[2, 2]), ")"), paste0(f2(sm[3, 1]), " (", f3(sm[3, 2]), ")")), "",
    paste0("Correlation between baseline and Week 12 SBP in these subjects: r = ", f3(cor(w12$BASE, w12$AVAL)),
           ". SD of baseline = ", f2(sd(w12$BASE)), ", SD of Week 12 SBP = ", f2(sd(w12$AVAL)), ", SD of CHG = ", f2(sd(w12$CHG)), "."), "")

# ---------------- MMRM ----------------
pb <- subset(sbp, AVISITN > 0)
pb$AVISIT <- factor(pb$AVISITN)
pb <- pb[order(pb$USUBJID, pb$AVISITN), ]
mm <- gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, data = pb,
          correlation = corSymm(form = ~ as.integer(AVISIT) | USUBJID),
          weights = varIdent(form = ~ 1 | AVISIT), method = "REML")
bm <- coef(mm); Vm <- vcov(mm)
contr <- function(arm, visit) {
  L <- setNames(rep(0, length(bm)), names(bm)); a <- paste0("TRTP", arm); L[a] <- 1
  if (visit != "2") L[paste0(a, ":AVISIT", visit)] <- 1
  L
}
add("## 5. Complete-case ANCOVA vs MMRM (missing data)", "",
    "MMRM: `nlme::gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, correlation = corSymm(form = ~ as.integer(AVISIT) | USUBJID), weights = varIdent(form = ~ 1 | AVISIT), method = \"REML\")`",
    paste0("on all post-baseline `ANL01FL = \"Y\"` SYSBP records (", nrow(pb), " records from ", length(unique(pb$USUBJID)),
           " subjects). This is an unstructured covariance (separate variance per visit + a free correlation for every pair of visits).",
           " CIs below use the normal approximation; `nlme` does not provide Kenward–Roger degrees of freedom (SAS PROC MIXED with `DDFM=KR` would give slightly wider intervals)."), "",
    row("Comparison at Week 12", "Complete-case ANCOVA (SE)", "MMRM (SE)", "MMRM 95% CI", "MMRM p"), row("---", "---:", "---:", "---", "---:"))
for (i in 2:3) {
  L <- contr(arms[i], "12"); e <- sum(L * bm); s <- sqrt(drop(t(L) %*% Vm %*% L))
  add(row(paste(arms[i], "− Placebo"), paste0(f2(sm[i, 1]), " (", f3(sm[i, 2]), ")"), paste0(f2(e), " (", f3(s), ")"),
          paste0(f2(e - 1.96 * s), " to ", f2(e + 1.96 * s)), fp(2 * pnorm(-abs(e / s)))))
}
add("", row("MMRM difference vs placebo by visit", "Week 2", "Week 4", "Week 8", "Week 12"), row("---", "---:", "---:", "---:", "---:"))
for (i in 2:3) add(row(arms[i], sapply(c("2", "4", "8", "12"), function(v) { L <- contr(arms[i], v); f2(sum(L * bm)) })))
sig <- summary(mm)$sigma * c(1, coef(mm$modelStruct$varStruct, unconstrained = FALSE))
add("", paste0("Estimated residual SD by visit (Weeks 2, 4, 8, 12): ", paste(f2(sig), collapse = ", "), " mmHg."), "")
cm <- corMatrix(mm$modelStruct$corStruct)[[1]]
add(paste0("Estimated within-subject correlations: Week 2–4 ", f2(cm[1, 2]), ", Week 4–8 ", f2(cm[2, 3]), ", Week 8–12 ", f2(cm[3, 4]), ", Week 2–12 ", f2(cm[1, 4]), "."), "")

nobs <- sapply(c(2, 4, 8, 12), function(v) table(factor(sbp$TRTP[sbp$AVISITN == v], arms)))
add("Subjects with an analysis SBP value by visit:", "", row("Arm", "Week 2", "Week 4", "Week 8", "Week 12"), row("---", "---:", "---:", "---:", "---:"))
for (i in 1:3) add(row(arms[i], nobs[i, ]))
add("", "Why the two analyses differ: lack-of-efficacy dropout depends on the last observed SBP (MAR), and it is most common on placebo.",
    "Placebo completers are therefore the better responders, which makes the complete-case placebo change look better and shrinks the",
    "complete-case treatment differences. MMRM uses the pre-dropout visits of subjects who left, which (under MAR) corrects for this.", "")

# ---------------- DBP and responders ----------------
dbp <- subset(advs, PARAMCD == "DIABP" & ANL01FL == "Y" & AVISITN == 12); dbp$TRTP <- factor(dbp$TRTP, arms)
fd <- summary(lm(CHG ~ TRTP + BASE, data = dbp))$coefficients
add("## 6. Secondary summaries", "",
    paste0("- Week 12 DBP, ANCOVA complete case: 10 mg − placebo ", f2(fd[2, 1]), " (SE ", f3(fd[2, 2]), "), 20 mg − placebo ",
           f2(fd[3, 1]), " (SE ", f3(fd[3, 2]), ") mmHg."))
resp <- tapply(w12$AVAL < 140, w12$TRTP, sum); nn <- table(w12$TRTP)
add(paste0("- Week 12 SBP < 140 mmHg (controlled), among subjects with a Week 12 value: ",
           paste0(arms, " ", resp, "/", nn, " (", f1(100 * resp / nn), "%)", collapse = "; "), "."))
r10 <- tapply(w12$CHG <= -10, w12$TRTP, sum)
add(paste0("- Week 12 SBP reduction >= 10 mmHg: ", paste0(arms, " ", r10, "/", nn, " (", f1(100 * r10 / nn), "%)", collapse = "; "), "."), "")

# ---------------- Adverse events ----------------
ae$TRT01P <- factor(adsl$TRT01P[match(ae$USUBJID, adsl$USUBJID)], arms)
te <- subset(ae, AESTDY >= 1)
saf <- subset(adsl, SAFFL == "Y"); ns <- table(saf$TRT01P)
subj <- function(d) { u <- unique(d[, c("USUBJID", "TRT01P")]); as.vector(table(u$TRT01P)) }
cellp <- function(n) paste0(n, " (", f1(100 * n / ns), "%)")
add("## 7. Treatment-emergent adverse events (safety population; TEAE = AESTDY >= 1)", "",
    row("", paste0(arms, " (N = ", ns, ")")), row("---", "---:", "---:", "---:"),
    row("Subjects with >= 1 TEAE", cellp(subj(te))),
    row("Subjects with >= 1 related TEAE", cellp(subj(subset(te, AEREL == "RELATED")))),
    row("Subjects with >= 1 serious TEAE", cellp(subj(subset(te, AESER == "Y")))),
    row("Subjects with >= 1 severe TEAE", cellp(subj(subset(te, AESEV == "SEVERE")))),
    row("Subjects with a TEAE leading to discontinuation", cellp(subj(subset(te, AEACN == "DRUG WITHDRAWN")))),
    row("TEAE records (events)", paste(table(te$TRT01P))))
pts <- names(sort(tapply(te$USUBJID, te$AEDECOD, function(x) length(unique(x))), decreasing = TRUE))
for (p in pts) add(row(paste0("&nbsp;&nbsp;", p, " (subjects)"), cellp(subj(subset(te, AEDECOD == p)))))
add("", paste0("Pre-treatment AEs (EPOCH = SCREENING, AESTDY < 1): ", sum(ae$AESTDY < 1), " records — not treatment-emergent."), "")

add("## 8. R code used", "", "The complete script is `scripts/data/cardio/facts.R`. The two central models:", "",
    "```r",
    "sbp <- subset(advs, PARAMCD == \"SYSBP\" & ANL01FL == \"Y\")",
    "w12 <- subset(sbp, AVISITN == 12)",
    "fit <- lm(CHG ~ TRTP + BASE, data = w12)                   # ANCOVA, complete cases",
    "L   <- c(1, 0, 1, mean(w12$BASE))                          # LS mean for VTX-221 20 mg",
    "sum(L * coef(fit)); sqrt(t(L) %*% vcov(fit) %*% L)",
    "",
    "pb <- subset(sbp, AVISITN > 0); pb$AVISIT <- factor(pb$AVISITN)",
    "mm <- nlme::gls(CHG ~ TRTP * AVISIT + BASE * AVISIT, data = pb,",
    "                correlation = nlme::corSymm(form = ~ as.integer(AVISIT) | USUBJID),",
    "                weights = nlme::varIdent(form = ~ 1 | AVISIT), method = \"REML\")",
    "```", "")

writeLines(out, file.path(dd, "FACTS.md"))
cat("FACTS.md written\n")
