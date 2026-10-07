## What problem are we trying to solve?

You are assigned Table 14.2.1.1, *Summary of Progression-Free Survival (ITT Population)*, for CBX417-301. You receive two documents: the statistical analysis plan (SAP) and the mock shells. The SAP says, in section 9.3:

> *The hazard ratio and its 95% CI will be estimated using a Cox proportional hazards model stratified by the randomization stratification factors, with treatment as the only covariate. Ties will be handled with the Efron method.*

The shell shows a table full of `xx`, `xx.x` and `(xx.x, xx.x)`, with footnotes. Your job is to turn those words and placeholders into a program that produces the right numbers in the right cells — and your QC colleague will do the same independently, in another language.

If the SAP were vague about ties or confidence-interval methods, SAS and R would silently give different answers with their default settings. This lesson is about reading the SAP and shells precisely enough that two independent programmers produce identical tables.

## Intuition

Three documents form a chain of contracts:

- The **SAP** says **what** to analyze and **how**: populations, endpoints, models, options, conventions.
- The **shells** say **what the output looks like**: every row, column, statistic, decimal place, footnote and sort order — with placeholders instead of numbers.
- The **ADaM specification** says **how each variable is derived**, so that the analysis programs can be simple.

A good SAP sentence can be translated into code almost word for word. "Stratified by the randomization stratification factors" → `strata STRAT1R STRAT2R`. "Efron method for ties" → `ties=efron`. "Brookmeyer–Crowley CI with log-log transformation" → `conftype=loglog`. Where a sentence is vague, the two languages' defaults fill the gap — differently.

## Clinical context

:::standard{kind="official" source="ICH E9 Statistical Principles for Clinical Trials, Section 5.1"}
ICH E9 expects the principal features of the analysis to be described in the protocol and a detailed statistical analysis plan to be finalized before the blind is broken, with any later changes documented. The SAP is therefore a controlled, versioned document; changes after unblinding are reported as such in the CSR.
:::

Who does what:

- The **biostatistician** writes the SAP and the shells, often with the lead programmer reviewing for programmability.
- The **statistical programmers** raise questions ("Which ECOG value is used for strata?", "What is the tie method?"), implement, and QC.
- The **medical writer** later uses the same shells' numbering in the CSR text.

The CBX417-301 SAP and shells are in the document library:

::doc{id="sap" label="CBX417-301 statistical analysis plan"}

::doc{id="tlf-shells" label="CBX417-301 mock TLF shells"}

## Formal concept

### SAP anatomy

| Section (CBX417-301 SAP) | What programmers take from it |
|---|---|
| 2 Objectives, endpoints, estimands | The list of analyses and the intercurrent-event strategies behind derivations |
| 3 Design, randomization, sample size, interim | Strata, planned events, analysis timing |
| 4 Analysis populations | Flag definitions (`ITTFL`, `SAFFL`, `EFFFL`, `PPROTFL`) |
| 5 General considerations | Decimal places, baseline, study day, visit windows, missing data, month conversion |
| 6–8 Disposition, demographics, exposure | Descriptive table content |
| 9 Efficacy | Endpoint definitions, models, options, censoring rules, sensitivity and subgroup analyses, multiplicity |
| 10 Safety | TEAE definition, date imputation, AE/lab/vital-sign summaries, shift tables |
| Appendix | List of TLFs with numbers and shell ids |

### Shell anatomy

```text
Table 14.2.1.1
Summary of Progression-Free Survival per Investigator (RECIST 1.1)
ITT Population
                                        CBX-417 + Docetaxel     Placebo + Docetaxel
                                             (N=xxx)                 (N=xxx)
Number of events, n (%)                     xxx (xx.x)              xxx (xx.x)
  Progressive disease                       xxx (xx.x)              xxx (xx.x)
  Death                                     xxx (xx.x)              xxx (xx.x)
Number censored, n (%)                      xxx (xx.x)              xxx (xx.x)
PFS (months) [a]
  Median (95% CI)                     xx.x (xx.x, xx.x)       xx.x (xx.x, xx.x)
Stratified hazard ratio (95% CI) [b]             x.xx (x.xx, x.xx)
Stratified log-rank p-value [c]                        x.xxxx
[a] Kaplan-Meier estimates; 95% CI by Brookmeyer-Crowley with log-log transformation.
[b] Cox model stratified by ECOG PS and prior anti-PD-(L)1 (IxRS); ties handled by Efron method.
[c] Two-sided.
Program: /cbx417-301/csr/prod/tlf/t_pfs.sas   Output: t_14_2_1_1.rtf   Data cutoff: 31MAR2025
```

Each element is a requirement: the **population line** names the flag; **N** in the header is the population count by arm; **n (%)** says the denominator is N; `xx.x` fixes decimals; footnotes pin down methods and definitions; the **program line** makes the output traceable to its program and data cut.

### Mapping SAP text to ADaM variables and code

| SAP text | ADaM | SAS | R (`survival`) |
|---|---|---|---|
| "ITT population" | `ADSL.ITTFL = "Y"` (carried to `ADTTE.ITTFL`) | `where ITTFL = 'Y'` | `subset(ITTFL == "Y")` |
| "by randomized treatment" | `TRTP` / `TRTPN` | `class TRTP` | factor `TRTP` |
| "PFS" | `PARAMCD = "PFS"`, `AVAL` (days), `CNSR` | `time AVAL*CNSR(1,2,3,4)` | `Surv(AVAL, CNSR == 0)` |
| "stratified by the randomization factors (IxRS)" | `STRAT1R`, `STRAT2R` | `strata STRAT1R STRAT2R` | `+ strata(STRAT1R, STRAT2R)` |
| "ties handled by Efron" | — | `ties=efron` (SAS default is Breslow) | `ties = "efron"` (R default) |
| "median with Brookmeyer–Crowley CI, log-log" | — | `conftype=loglog` (SAS default) | `conf.type = "log-log"` (R default is "log") |
| "months = days / 30.4375" | derived in the program | `AVALM = AVAL / 30.4375;` | `AVAL / 30.4375` |

:::warning[Defaults differ between SAS and R]
`PROC PHREG` uses Breslow ties by default; R's `coxph()` uses Efron. `PROC LIFETEST` uses the log-log transformation for survival and median CIs by default; R's `survfit()` uses "log". If the SAP does not state both, production (SAS) and QC (R) will disagree for reasons that have nothing to do with correctness.
:::

## Worked example

Translate SAP §9.2–9.5 into the program behind Table 14.2.1.1, cell by cell.

| Shell cell | SAP section | Computation |
|---|---|---|
| N per arm | 4, 9.2 | Count of `ITTFL = "Y"` by `TRTP` |
| Events, n (%) | 9.1 | `CNSR = 0`, split by event description (PD vs death); % of N |
| Censored, n (%) | 9.4 | `CNSR ≥ 1`; % of N |
| Median (95% CI) | 9.5 | KM by `TRTP` (unstratified), Brookmeyer–Crowley CI, log-log |
| HR (95% CI) | 9.3 | Cox, `TRTP` only, stratified by `STRAT1R STRAT2R`, Efron ties, Wald CI |
| Log-rank p | 9.2 | Log-rank stratified by `STRAT1R STRAT2R`, two-sided |

Two things the translation reveals:

1. **Medians are per arm and unstratified, but the test and HR are stratified.** In SAS that needs two `PROC LIFETEST` calls (or one plus `PROC PHREG`): one with `strata TRTP` for the KM estimates by arm, and one with `strata STRAT1R STRAT2R / group=TRTP` for the stratified test.
2. **Every option the SAP names must appear in the code**, even when it equals the default in one language — the QC programmer in the other language needs it, and the reviewer reading your code should see it.

### What the defaults can do: a simulation

To show why the SAP must name ties and CI methods, the R program below simulates a two-arm trial (not CBX417-301 data): 240 subjects, 195 events, progression detected at 6-weekly scans. With event days exactly on the scan grid (only 12 distinct event days), the tie method changes the second decimal of the HR; with realistic scan-date variation it barely matters. The CI transformation, however, changes a median's upper limit substantially:

| Simulated scenario | Efron HR (95% CI) | Breslow HR (95% CI) |
|---|---|---|
| Event days on an exact 42-day grid (12 distinct event days) | 0.611 (0.459, 0.813) | 0.642 (0.482, 0.856) |
| Scan dates varying ±7 days (93 distinct event days) | 0.618 (0.464, 0.824) | 0.622 (0.467, 0.829) |

| Arm (jittered scenario) | Median, months | 95% CI, "log" (R default) | 95% CI, "log-log" (SAS default) |
|---|---|---|---|
| B (control) | 4.24 | (2.83, 5.29) | (2.79, 4.37) |
| A (experimental) | 6.74 | (5.55, 7.06) | (5.45, 7.00) |

:::deeper[The simulation code]
```r
library(survival)
set.seed(2025)
n <- 240
trt   <- factor(rep(c("A", "B"), each = n / 2), levels = c("B", "A"))
strat <- sample(c("S1", "S2"), n, replace = TRUE)
rate  <- ifelse(trt == "A", log(2) / 6, log(2) / 4.2) * ifelse(strat == "S2", 1.35, 1)
t_ev  <- rexp(n, rate) * 30.4375          # true event time, days
t_cn  <- runif(n, 60, 700)                # censoring time, days
ev    <- as.integer(t_ev <= t_cn)
scan  <- ceiling(pmin(t_ev, t_cn) / 42) * 42          # next 6-weekly scan
days_grid <- ifelse(ev == 1, scan, floor(t_cn))
days_jit  <- ifelse(ev == 1, pmax(1, scan + sample(-7:7, n, replace = TRUE)), floor(t_cn))
for (v in c("days_grid", "days_jit")) {
  d <- data.frame(days = get(v), ev, trt, strat)
  hr <- sapply(c("efron", "breslow"), function(ti)
    summary(coxph(Surv(days, ev) ~ trt + strata(strat), data = d, ties = ti))$conf.int[1, c(1, 3, 4)])
  cat(v, "- distinct event days:", length(unique(d$days[d$ev == 1])), "\n")
  print(round(t(hr), 3))
}
d <- data.frame(days = days_jit, ev, trt)
for (ct in c("log", "log-log")) {
  km <- survfit(Surv(days / 30.4375, ev) ~ trt, data = d, conf.type = ct)
  cat(ct, "\n"); print(round(summary(km)$table[, c("median", "0.95LCL", "0.95UCL")], 2))
}
```
Run with R 4.6 and `survival`; the values in the two tables above are its output.
:::

## Code

The analysis program for Table 14.2.1.1 in SAS (not executed in this environment), following the SAP options exactly:

```sas title="t_pfs.sas"
data pfs;
  set adam.adtte;
  where PARAMCD = 'PFS' and ITTFL = 'Y';
  AVALM = AVAL / 30.4375;
run;

proc lifetest data=pfs method=km conftype=loglog;
  time AVALM * CNSR(1,2,3,4);
  strata TRTP;
  ods output Quartiles=km_quart CensoredSummary=km_cens;
run;

proc lifetest data=pfs notable;
  time AVALM * CNSR(1,2,3,4);
  strata STRAT1R STRAT2R / group=TRTP test=logrank;
  ods output HomTests=lr_test;
run;

proc phreg data=pfs;
  class TRTP (ref='Placebo + Docetaxel') / param=ref;
  model AVALM * CNSR(1,2,3,4) = TRTP / ties=efron risklimits;
  strata STRAT1R STRAT2R;
  ods output ParameterEstimates=cox_est;
run;
```

:::lines
1-5: Selects the PFS parameter in the ITT population and converts days to months with the SAP constant.
7: KM estimation. `conftype=loglog` is SAS's default, written explicitly because the SAP names it and the R QC program must match it.
8: Lists every censoring code (1–4) as censored; `CNSR = 0` is an event. Forgetting a code (for example writing `CNSR(1)`) would turn censored subjects into events.
9: One KM curve per randomized arm — unstratified, as the shell's median row requires.
10: Captures the median and quartiles with CIs, and the event/censoring counts, as datasets for the table program.
13-17: A second call for the **stratified** log-rank test: `GROUP=TRTP` within strata `STRAT1R STRAT2R`. `NOTABLE` suppresses the per-stratum survival tables not needed here.
19-24: The stratified Cox model with treatment as the only covariate, the reference level set to placebo so the HR is CBX-417 vs placebo, `ties=efron` because the SAP says so (SAS's default would be Breslow), and `risklimits` for the Wald 95% CI of the HR.
:::

The R QC program mirrors every option:

```r title="qc_t_pfs.R"
library(survival)
pfs <- subset(adtte, PARAMCD == "PFS" & ITTFL == "Y")
pfs$EVENT  <- as.integer(pfs$CNSR == 0)
pfs$AVALM  <- pfs$AVAL / 30.4375
pfs$TRTP   <- factor(pfs$TRTP, levels = c("Placebo + Docetaxel", "CBX-417 + Docetaxel"))
km  <- survfit(Surv(AVALM, EVENT) ~ TRTP, data = pfs, conf.type = "log-log")
lr  <- survdiff(Surv(AVALM, EVENT) ~ TRTP + strata(STRAT1R, STRAT2R), data = pfs)
cox <- coxph(Surv(AVALM, EVENT) ~ TRTP + strata(STRAT1R, STRAT2R), data = pfs, ties = "efron")
summary(km)$table; lr; summary(cox)$conf.int
```

:::lines
2-4: Same population and parameter; the event indicator is `CNSR == 0`, so every censoring code counts as censored.
5: Placebo first, so the Cox coefficient is CBX-417 vs placebo (matching `ref=` in SAS).
6: `conf.type = "log-log"` overrides R's default ("log") to match the SAP and SAS.
7: Stratified log-rank test; its chi-square and p-value must match `HomTests` from SAS.
8: Stratified Cox model; `ties = "efron"` is R's default, written explicitly for the reader.
9: The three results that fill the shell.
:::

## Output

The filled version of this shell, computed live from the CBX417-301 ADaM data, is available in the TLF viewer:

::widget{name="tlf" id="t-pfs"}

Compare each cell with the program above: which procedure's output feeds it, and which SAP section justifies the option used?

## Interpretation

- **A precise SAP makes independent QC meaningful.** When production and QC agree to the last decimal, it is because both implemented the same fully specified method — not because they share code.
- **Shell footnotes are part of the result.** "Stratified", "Efron", "log-log", "two-sided" tell the reader how to interpret the numbers; without them, the same numbers could mean different things.
- **Programmers are reviewers too.** Ambiguities you find while programming are SAP defects. Raise them before unblinding, when the SAP can still be amended cleanly.

## Common mistakes

:::mistake[Relying on software defaults]
If the SAP says "Cox model" without a tie method, SAS gives Breslow and R gives Efron. Ask for the method to be specified, and write the option in code either way.
:::

:::mistake[Stratifying the medians]
Putting `STRAT1R STRAT2R` in the same `STRATA` statement as `TRTP` produces one curve per arm-by-stratum combination, not per arm. The shell asks for medians by arm; only the test and HR are stratified.
:::

:::mistake[Listing only CNSR = 1 as censored]
`CNSR(1)` treats codes 2, 3 and 4 as events. In CBX417-301 censoring codes go from 1 to 4; list them all, or use a variable where every non-zero value is censored.
:::

:::mistake[Changing the shell without telling anyone]
Adding a row, changing a decimal rule or re-sorting because "it looks better" creates a difference from the approved shell that QC will flag and the CSR author will not expect. Propose shell changes to the statistician.
:::

## Knowledge check

::quiz{ids="trials.sap.when-final,trials.sap.text-to-variable,trials.sap.ties-default,trials.sap.conftype-default"}

## Hands-on exercise

::practice{ids="trials.sap.which-document,trials.sap.phreg-code,trials.sap.decimals" title="Practice: from SAP text to code"}

## Challenge exercise

::practice{ids="trials.sap.median-ci-qc,trials.sap.shell-review" title="QC and review: when outputs and shells disagree"}

## Industry note

- **Programmers read SAPs line by line.** A common first task on a study is a "SAP review" in which programmers list every ambiguity: undefined windows, unstated options, missing tie-breaks. Good reviews save weeks of rework.
- **Shells are negotiated.** Statisticians, programmers and medical writers agree the shells before programming; later changes follow a change-control process.
- **Interviewers test translation.** "Here is a SAP paragraph — write the PROC PHREG call" is a common practical question; so is "Why might your R and SAS medians differ?"

:::interview[Production (SAS) and QC (R) medians agree but the upper confidence limits differ. What do you check?]
"First the method: `PROC LIFETEST` uses a log-log transformation by default and R's `survfit()` uses log, so unless both specify the SAP's method the CIs will differ while the medians match. Then the event definition — whether all censoring codes are treated as censored in both — and the time unit, including the days-to-months constant. I'd also check that both use the same population and data cut. The fix is to set the transformation explicitly in both programs to what the SAP says, and if the SAP doesn't say, ask the statistician to specify it."
:::
