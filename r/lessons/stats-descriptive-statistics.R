# Lesson: stats-descriptive-statistics
# Descriptive statistics for clinical tables — quantile definitions, skewed data, summaries by arm.
# Run from the project root:  Rscript r/lessons/stats-descriptive-statistics.R
# Uses base R only. Data: data/cardio/adsl.csv (synthetic VTX221-201 trial).

args <- commandArgs(trailingOnly = FALSE)
this <- sub("^--file=", "", args[grep("^--file=", args)])
root <- if (length(this)) normalizePath(file.path(dirname(this), "..", "..")) else getwd()
adsl <- read.csv(file.path(root, "data", "cardio", "adsl.csv"), stringsAsFactors = FALSE)

# ---- 1. Worked example: ALT (U/L) in ten subjects -------------------------------
alt <- c(14, 17, 18, 21, 22, 25, 29, 33, 48, 112)
cat("n =", length(alt), " sum =", sum(alt), " mean =", mean(alt), "\n")
cat("SD =", round(sd(alt), 2), " variance =", round(var(alt), 2), "\n")
cat("median =", median(alt), "\n")
cat("Q1, Q3 type 2 (SAS PCTLDEF=5 / QNTLDEF=5):", quantile(alt, c(.25, .75), type = 2), "\n")
cat("Q1, Q3 type 7 (R, NumPy, pandas, Excel QUARTILE.INC):", quantile(alt, c(.25, .75), type = 7), "\n")
cat("Q1, Q3 type 6 (SAS PCTLDEF=4, Excel QUARTILE.EXC):", quantile(alt, c(.25, .75), type = 6), "\n")
cat("IQR type 2 =", diff(quantile(alt, c(.25, .75), type = 2)), " IQR type 7 =", IQR(alt), "\n")
cat("mean without the 112 outlier =", round(mean(alt[-10]), 2), " median without it =", median(alt[-10]), "\n")
gm <- exp(mean(log(alt)))
cat("geometric mean =", round(gm, 2), " SD of log =", round(sd(log(alt)), 4),
    " geometric CV% =", round(100 * sqrt(exp(sd(log(alt))^2) - 1), 1), "\n")

# ---- 2. Baseline characteristics by arm (ITT) -------------------------------------
arms <- c("Placebo", "VTX-221 10 mg", "VTX-221 20 mg")
summ <- function(x, type) c(n = length(x), mean = mean(x), sd = sd(x), median = median(x),
                            q1 = unname(quantile(x, .25, type = type)), q3 = unname(quantile(x, .75, type = type)),
                            min = min(x), max = max(x))
for (v in c("AGE", "SBPBL")) {
  cat("\n", v, "by arm (quartiles type 2 = SAS default):\n")
  print(round(sapply(arms, function(a) summ(adsl[[v]][adsl$TRT01P == a], 2)), 3))
  cat(v, "quartiles type 7:\n")
  print(round(sapply(arms, function(a) quantile(adsl[[v]][adsl$TRT01P == a], c(.25, .75), type = 7)), 3))
}
cat("\nAGE overall: mean", round(mean(adsl$AGE), 2), " SD", round(sd(adsl$AGE), 3), "\n")

# ---- 3. A skewed variable: treatment compliance (safety population) ---------------
comp <- adsl$COMPLPCT[adsl$SAFFL == "Y"]
cat("\nCOMPLPCT: n", length(comp), " mean", round(mean(comp), 2), " median", median(comp),
    " SD", round(sd(comp), 2), " min", min(comp), " max", max(comp),
    " n < 80%:", sum(comp < 80), "\n")
cat("COMPLPCT Q1/Q3 type 2:", quantile(comp, c(.25, .75), type = 2), " type 7:", quantile(comp, c(.25, .75), type = 7), "\n")

# ---- 4. Item checks ---------------------------------------------------------------------
x <- c(4.1, 4.4, 4.9, 5.0, 5.6, 6.2, 7.3, 9.8)   # potassium-like values for the Q1 items
cat("\nitem data: Q1 type 2 =", quantile(x, .25, type = 2), " Q1 type 7 =", quantile(x, .25, type = 7),
    " median =", median(x), "\n")
y <- c(3, 5, 6, 8, 40)
cat("item y: mean", mean(y), " median", median(y), "\n")
