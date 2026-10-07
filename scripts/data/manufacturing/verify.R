#!/usr/bin/env Rscript
# HBX-14 — verification of the generated synthetic manufacturing datasets.
#
#   Rscript scripts/data/manufacturing/verify.R [data/manufacturing]
#
# Every claim data/manufacturing/README.md and raw/README.md make about these files is checked here
# against the generated CSVs. Nothing is assumed. The script exits non-zero if any check fails, so it
# can guard the generator against a change that quietly breaks one of the teaching properties.
#
# The four properties being protected:
#   1. Batch summaries are recomputable from the sensor series (so a learner can check their own work).
#   2. The messy raw exports reconcile to process/batches.csv (the capstone 7 ingestion answer key).
#   3. The two planted excursions are present, and are the size the documentation claims.
#   4. Row-level cross-validation is dramatically optimistic versus batch-grouped (the leakage trap).

suppressPackageStartupMessages({
  library(dplyr); library(readr); library(stringr); library(purrr); library(rpart)
})
args <- commandArgs(trailingOnly = TRUE)
dir <- if (length(args) >= 1) args[1] else "data/manufacturing"

fails <- 0L
check <- function(label, ok, detail = "") {
  cat(sprintf("%-58s %s%s\n", label, if (isTRUE(ok)) "PASS" else "FAIL",
              if (nzchar(detail)) paste0("  (", detail, ")") else ""))
  if (!isTRUE(ok)) fails <<- fails + 1L
}

b  <- read_csv(file.path(dir, "process", "batches.csv"), show_col_types = FALSE)
s  <- read_csv(file.path(dir, "process", "sensor-timeseries.csv"), show_col_types = FALSE)
sp <- read_csv(file.path(dir, "process", "spectra.csv"), show_col_types = FALSE)

cat("\n== 1. Batch summaries are recomputable from the sensor series ==\n")
rc <- s |>
  group_by(BATCHID) |>
  summarise(TEMP_MEAN = round(mean(TEMP_C), 3),
            TEMP_SD   = round(sd(TEMP_C - TEMP_SP), 4),
            PH_MEAN   = round(mean(PH), 4),
            PH_SD     = round(sd(PH - PH_SP), 4),
            DO_MEAN   = round(mean(DO_PCT), 2),
            VCD_PEAK  = round(max(VCD), 2),
            GLUCOSE_MIN  = round(min(GLUCOSE_G_L), 2),
            LACTATE_PEAK = round(max(LACTATE_G_L), 2),
            VIABILITY_END = VIABILITY_PCT[which.max(ELAPSED_H)],
            .groups = "drop")
j <- inner_join(b, rc, by = "BATCHID", suffix = c(".p", ".r"))
for (v in c("TEMP_MEAN","TEMP_SD","PH_MEAN","PH_SD","DO_MEAN","VCD_PEAK","GLUCOSE_MIN","LACTATE_PEAK","VIABILITY_END")) {
  n <- sum(abs(j[[paste0(v, ".p")]] - j[[paste0(v, ".r")]]) > 1e-9)
  check(paste0("  ", v, " recomputes from the series"), n == 0, paste(n, "mismatches"))
}

cat("\n== 2. Values are physically plausible ==\n")
check("  VCD_PEAK within 5-20 E6 cells/mL",   all(b$VCD_PEAK > 5 & b$VCD_PEAK < 20))
check("  LACTATE_PEAK above 0.5 g/L",          all(b$LACTATE_PEAK > 0.5))
check("  GLUCOSE never starves (> 0.3 g/L)",   all(s$GLUCOSE_G_L > 0.3))
check("  glucose rises at every feed hour",
      all(map_lgl(c(72, 120, 168, 216, 264), function(h) {
        d <- s |> filter(ELAPSED_H %in% c(h - 6, h)) |> group_by(BATCHID) |>
          summarise(up = GLUCOSE_G_L[ELAPSED_H == h] > GLUCOSE_G_L[ELAPSED_H == h - 6], .groups = "drop")
        mean(d$up) > 0.95
      })))
check("  VIABILITY_END within 45-99%",         all(b$VIABILITY_END > 45 & b$VIABILITY_END < 99))
check("  TITER_G_L positive and under 8",      all(b$TITER_G_L > 0 & b$TITER_G_L < 8))

cat("\n== 3. The planted excursions are present ==\n")
f <- b |> arrange(START_DATE) |> filter(LINE == "LINE-B", START_DATE >= "2024-09-01") |> head(4)
nf <- b |> filter(!BATCHID %in% f$BATCHID)
ratio <- mean(f$TEMP_SD) / mean(nf$TEMP_SD)
check("  controller fault: 4 LINE-B batches",  nrow(f) == 4)
check("  controller fault: TEMP_SD >= 2x normal", ratio >= 2, sprintf("%.1fx", ratio))
check("  controller fault: potency depressed", mean(f$POTENCY_PCT) < mean(b$POTENCY_PCT) - 5,
      sprintf("%.1f vs %.1f", mean(f$POTENCY_PCT), mean(b$POTENCY_PCT)))
lot <- b |> filter(SUPPLIER == "Northvale Media", START_DATE >= "2024-05-01") |>
  count(MEDIA_LOT) |> filter(n >= 3) |> slice(1) |> pull(MEDIA_LOT)
bl <- b |> filter(MEDIA_LOT == lot)
check("  bad media lot: at least 3 batches",   nrow(bl) >= 3, paste(lot, nrow(bl), "batches"))
check("  bad media lot: spans all three lines", length(unique(bl$LINE)) == 3)
check("  bad media lot: titer depressed",      mean(bl$TITER_G_L) < mean(b$TITER_G_L) - 0.5,
      sprintf("%.2f vs %.2f", mean(bl$TITER_G_L), mean(b$TITER_G_L)))

cat("\n== 4. Collinearity is real but not degenerate ==\n")
num <- b |> select(TEMP_SD, PH_SD, DO_MEAN, VCD_PEAK, GLUCOSE_MIN, LACTATE_PEAK,
                   VIABILITY_END, OSMOLALITY, TITER_G_L, PURITY_PCT, AGGREGATE_PCT)
cm <- cor(num); diag(cm) <- 0
check("  strongest pair between 0.80 and 0.98", max(abs(cm)) > 0.80 && max(abs(cm)) < 0.98,
      sprintf("max |r| = %.3f", max(abs(cm))))
W <- sp |> select(starts_with("W")) |> as.matrix()
check("  adjacent wavelengths correlate > 0.99", median(diag(cor(W)[-1, -ncol(W)])) > 0.99)

cat("\n== 5. The messy exports reconcile to batches.csv ==\n")
rawdir <- file.path(dir, "raw")
key <- c(batch_id="BATCHID", `batch id`="BATCHID", lotnumber="BATCHID",
  start_dt="START_DATE", `start date`="START_DATE", date_start="START_DATE", manufacturedate="START_DATE",
  line="LINE", `production line`="LINE", line_id="LINE",
  supplier="SUPPLIER", `media supplier`="SUPPLIER", supplier_name="SUPPLIER", vendor="SUPPLIER",
  media_lot="MEDIA_LOT", `media lot`="MEDIA_LOT", lot_number="MEDIA_LOT", rawmatlot="MEDIA_LOT",
  temp_mean="TEMP_MEAN", `mean temp`="TEMP_MEAN", temperature_mean="TEMP_MEAN", avgtemperature="TEMP_MEAN",
  temp_sd="TEMP_SD", `temp dev sd`="TEMP_SD", temperature_sd="TEMP_SD", stddevtemperature="TEMP_SD",
  ph_mean="PH_MEAN", `mean ph`="PH_MEAN", avgph="PH_MEAN",
  do_mean="DO_MEAN", `mean do (%)`="DO_MEAN", avgdo="DO_MEAN",
  vcd_peak="VCD_PEAK", `peak vcd (e6/ml)`="VCD_PEAK", vcd_max="VCD_PEAK", maxviablecelldensity="VCD_PEAK",
  lac_peak="LACTATE_PEAK", `peak lactate (g/l)`="LACTATE_PEAK", lactate_max="LACTATE_PEAK", maxlactate="LACTATE_PEAK",
  viab_end="VIABILITY_END", `harvest viability (%)`="VIABILITY_END", viability_final="VIABILITY_END",
  finalviability="VIABILITY_END",
  osmo="OSMOLALITY", `osmolality (mosm/kg)`="OSMOLALITY", osmolality="OSMOLALITY",
  titer="TITER_G_L", titer_final="TITER_G_L", proteintiter="TITER_G_L",
  purity="PURITY_PCT", `purity (%)`="PURITY_PCT", purity_pct="PURITY_PCT", purityresult="PURITY_PCT",
  hmw="AGGREGATE_PCT", `hmw (%)`="AGGREGATE_PCT", aggregate_pct="AGGREGATE_PCT", aggregateresult="AGGREGATE_PCT",
  potency="POTENCY_PCT", `potency (%)`="POTENCY_PCT", potency_pct="POTENCY_PCT", potencyresult="POTENCY_PCT",
  disp="DISPOSITION", disposition="DISPOSITION", status="DISPOSITION")

NUMCOLS <- c("TEMP_MEAN","TEMP_SD","PH_MEAN","DO_MEAN","VCD_PEAK","LACTATE_PEAK","VIABILITY_END",
             "OSMOLALITY","TITER_G_L","PURITY_PCT","AGGREGATE_PCT","POTENCY_PCT")

ingest <- function(path) {
  txt <- sub("^﻿", "", readLines(path, warn = FALSE))
  hdr <- which(str_detect(tolower(txt), "batch_id|batch id|lotnumber"))[1]
  body <- txt[hdr:length(txt)]
  sep <- if (str_detect(body[1], "\t")) "\t"
         else if (str_count(body[1], ";") > str_count(body[1], ",")) ";" else ","
  d <- read_delim(I(paste(body, collapse = "\n")), delim = sep, show_col_types = FALSE,
                  na = c("", "NA", "N/A", "-", "NULL"), trim_ws = TRUE,
                  col_types = cols(.default = col_character()))
  names(d) <- key[tolower(names(d))]
  fahrenheit <- any(str_detect(tolower(txt[seq_len(hdr)]), "degf"))
  d <- d |> mutate(across(all_of(NUMCOLS), as.numeric),
                   TEMP_MEAN = if (fahrenheit) (TEMP_MEAN - 32) / 1.8 else TEMP_MEAN,
                   TEMP_SD   = if (fahrenheit) TEMP_SD / 1.8 else TEMP_SD)
  # Resolve the date format by choosing the parse that lands every row inside the quarter in the name.
  qm <- str_match(basename(path), "(\\d{4})Q(\\d)")
  lo <- as.Date(sprintf("%s-%02d-01", qm[2], (as.integer(qm[3]) - 1) * 3 + 1)); hi <- lo + 100
  cands <- list(
    iso  = suppressWarnings(as.Date(d$START_DATE, "%Y-%m-%d")),
    dmy  = suppressWarnings(as.Date(d$START_DATE, "%d/%m/%Y")),
    mdy  = suppressWarnings(as.Date(d$START_DATE, "%m/%d/%Y")),
    dmyd = suppressWarnings(as.Date(d$START_DATE, "%d-%m-%Y")),
    xl   = suppressWarnings(as.Date(as.numeric(d$START_DATE), origin = "1899-12-30")))
  ok <- vapply(cands, function(x) !any(is.na(x)) && all(x >= lo & x <= hi), logical(1))
  if (!any(ok)) stop("no date format fits ", basename(path))
  d$START_DATE <- cands[[which(ok)[1]]]
  d
}

files <- list.files(rawdir, pattern = "\\.(csv|tsv)$", full.names = TRUE)
all <- map_dfr(files, ingest)
dedup <- distinct(all)
check("  every export parses",                 length(files) == 12, paste(length(files), "files"))
check("  duplicates present then removed",     nrow(all) > nrow(dedup), sprintf("%d -> %d", nrow(all), nrow(dedup)))
check("  row count matches batches.csv",       nrow(dedup) == nrow(b))
check("  batch ids match exactly",             setequal(dedup$BATCHID, b$BATCHID))
jr <- inner_join(dedup, b, by = "BATCHID", suffix = c(".p", ".t"))
check("  every date recovered",                all(jr$START_DATE.p == jr$START_DATE.t))
check("  disposition matches (case-insensitive)", all(toupper(jr$DISPOSITION.p) == toupper(jr$DISPOSITION.t)))
for (v in setdiff(NUMCOLS, c("TEMP_MEAN", "TEMP_SD"))) {
  check(paste0("  ", v, " bit-exact"), max(abs(jr[[paste0(v, ".p")]] - jr[[paste0(v, ".t")]])) < 1e-9)
}
# Temperature is lossy by construction: two decimals in degF is 0.005/1.8 = 0.00278 degC.
dT <- max(abs(jr$TEMP_MEAN.p - jr$TEMP_MEAN.t))
check("  TEMP_MEAN within the documented degF tolerance", dT < 0.003, sprintf("max %.6f degC", dT))

cat("\n== 6. The leakage trap bites ==\n")
mt <- s |> inner_join(b |> select(BATCHID, TEMP_SD, PH_SD, VCD_PEAK, LACTATE_PEAK, OSMOLALITY,
                                  TITER_G_L, VIABILITY_END, POTENCY_PCT), by = "BATCHID")
rmse <- function(a, p) sqrt(mean((a - p)^2))
set.seed(1)
folds <- sample(rep(1:5, length.out = nrow(mt)))
ub <- unique(mt$BATCHID)
mt$bfold <- setNames(sample(rep(1:5, length.out = length(ub))), ub)[mt$BATCHID]
feat <- c("TEMP_C","PH","DO_PCT","AGITATION_RPM","PRESSURE_BAR","VCD","VIABILITY_PCT","GLUCOSE_G_L",
          "LACTATE_G_L","ELAPSED_H","TEMP_SD","PH_SD","VCD_PEAK","LACTATE_PEAK","OSMOLALITY",
          "TITER_G_L","VIABILITY_END")
fml <- as.formula(paste("POTENCY_PCT ~", paste(feat, collapse = "+")))
ctl <- rpart.control(cp = 0.0002, minsplit = 8, maxdepth = 16)
rowlvl <- mean(sapply(1:5, function(k) {
  m <- rpart(fml, data = mt[folds != k, ], control = ctl)
  rmse(mt$POTENCY_PCT[folds == k], predict(m, mt[folds == k, ]))
}))
grouped <- mean(sapply(1:5, function(k) {
  m <- rpart(fml, data = mt[mt$bfold != k, ], control = ctl)
  rmse(mt$POTENCY_PCT[mt$bfold == k], predict(m, mt[mt$bfold == k, ]))
}))
check("  row-level CV is at least 5x optimistic", grouped / rowlvl >= 5,
      sprintf("row %.3f vs grouped %.3f = %.1fx", rowlvl, grouped, grouped / rowlvl))
check("  batch-grouped signal is real but modest",
      grouped < sd(b$POTENCY_PCT), sprintf("RMSE %.3f vs null SD %.3f", grouped, sd(b$POTENCY_PCT)))

cat(sprintf("\n%s  (%d check%s failed)\n", if (fails == 0) "ALL CHECKS PASSED" else "FAILURES",
            fails, if (fails == 1) "" else "s"))
quit(status = if (fails == 0) 0 else 1)
