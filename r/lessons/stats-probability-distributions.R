# Lesson: stats-probability-distributions
# Binomial, Poisson, normal, t, chi-square, F and exponential distributions with clinical uses.
# Run from the project root:  Rscript r/lessons/stats-probability-distributions.R
# Base R only. Data: data/cardio (synthetic VTX221-201 trial).

args <- commandArgs(trailingOnly = FALSE)
this <- sub("^--file=", "", args[grep("^--file=", args)])
root <- if (length(this)) normalizePath(file.path(dirname(this), "..", "..")) else getwd()
adsl <- read.csv(file.path(root, "data", "cardio", "adsl.csv"), stringsAsFactors = FALSE)
ae   <- read.csv(file.path(root, "data", "cardio", "ae.csv"), stringsAsFactors = FALSE)

# ---- Binomial: how surprising is 16/88 dizziness if the true risk were 6%? ----
n <- 88; p <- 0.06
cat("E[X] =", n * p, " SD =", round(sqrt(n * p * (1 - p)), 3), "\n")
cat("P(X >= 16) =", signif(pbinom(15, n, p, lower.tail = FALSE), 4), "\n")
cat("P(X = 16)  =", signif(dbinom(16, n, p), 4), "  wrong 1 - pbinom(16) =", signif(1 - pbinom(16, n, p), 4), "\n")

# ---- Zero events: rule of three vs exact bound -----------------------------------
cat("0/90: rule of three", round(3 / 90, 4), " exact one-sided 95% upper", round(1 - 0.05^(1 / 90), 4),
    " two-sided 95% CP upper", round(1 - 0.025^(1 / 90), 4), "\n")

# ---- Poisson: TEAE counts per subject on VTX-221 20 mg ------------------------------
te <- subset(ae, AESTDY >= 1)
saf20 <- subset(adsl, SAFFL == "Y" & TRT01P == "VTX-221 20 mg")
cnt <- table(factor(te$USUBJID[te$USUBJID %in% saf20$USUBJID], levels = saf20$USUBJID))
lam <- mean(cnt)
cat("\n20 mg: subjects", nrow(saf20), " TEAE records", sum(cnt), " mean per subject", round(lam, 4), "\n")
cat("P(0) Poisson =", round(dpois(0, lam), 4), " observed share with 0 =", round(mean(cnt == 0), 4), "\n")
obs <- table(pmin(cnt, 3)); expd <- c(dpois(0:2, lam), ppois(2, lam, lower.tail = FALSE)) * nrow(saf20)
print(rbind(observed = as.numeric(obs), expected = round(expd, 1)))
cat("mean", round(mean(cnt), 3), " variance", round(var(as.numeric(cnt)), 3), "\n")
expo <- sum(saf20$TRTDURD) / 365.25
cat("patient-years", round(expo, 2), " events per 100 PY", round(100 * sum(cnt) / expo, 1), "\n")

# ---- Normal: baseline SBP ---------------------------------------------------------------
m <- mean(adsl$SBPBL); s <- sd(adsl$SBPBL)
cat("\nSBPBL mean", round(m, 2), " SD", round(s, 3), "\n")
cat("model P(SBP >= 160) =", round(pnorm(160, m, s, lower.tail = FALSE), 4),
    " observed =", round(mean(adsl$SBPBL >= 160), 4), " (", sum(adsl$SBPBL >= 160), ")\n")
cat("model P(SBP < 135) =", round(pnorm(135, m, s), 4), " observed =", round(mean(adsl$SBPBL < 135), 4), "\n")
cat("model P(SBP < 130) =", round(pnorm(130, m, s), 4), " observed =", mean(adsl$SBPBL < 130), "\n")
cat("z for 160:", round((160 - m) / s, 3), "\n")

# ---- t, chi-square, F critical values ----------------------------------------------------
cat("\nt 0.975 quantiles:", sapply(c(4, 9, 29, 234), function(d) round(qt(0.975, d), 4)), " z:", round(qnorm(0.975), 4), "\n")
cat("chi-square 0.95: df1", round(qchisq(0.95, 1), 3), " df2", round(qchisq(0.95, 2), 3), " 1.96^2 =", round(qnorm(.975)^2, 3), "\n")
cat("F 0.95 (2, 234):", round(qf(0.95, 2, 234), 4), " F(1,234) =", round(qf(0.95, 1, 234), 4), " t^2 =", round(qt(.975, 234)^2, 4), "\n")

# ---- Exponential: CBX-417 design assumptions ------------------------------------------------
lam_c <- log(2) / 4.2
cat("\nlambda control", round(lam_c, 4), "/month;  S(6) =", round(exp(-lam_c * 6), 4),
    "; lambda CBX", round(0.7 * lam_c, 4), " median", round(log(2) / (0.7 * lam_c), 2), " S(6) CBX =", round(exp(-0.7 * lam_c * 6), 4), "\n")

# ---- Item checks ----------------------------------------------------------------------------
cat("\nitems: 0.8^10 =", round(0.8^10, 4), " 1-0.8^10 =", round(1 - 0.8^10, 4), " exp(-0.5) =", round(exp(-0.5), 4),
    " P(Z>2) =", round(pnorm(2, lower.tail = FALSE), 5), " ln2/0.1 =", round(log(2) / 0.1, 3), " 3/150 =", 3 / 150, "\n")
cat("P(X>=3), Bin(20,0.05) =", round(pbinom(2, 20, 0.05, lower.tail = FALSE), 4), "\n")
