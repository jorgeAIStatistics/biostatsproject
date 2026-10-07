## What problem are we trying to solve?

You own two CBX417-301 ADaM datasets: `ADRS` (tumor response by visit and best overall response) and `ADTTE` (PFS, OS and DoR). The SAP gives you RECIST 1.1 rules and a PFS censoring table. Then the edge cases arrive:

- A subject had PR at week 12 and SD at week 18. Is she a responder?
- A subject's tumor grew 18% from its smallest size. Is that progression?
- A subject missed two scans, then progressed. Event or censored?
- A subject started a new anticancer drug, then progressed. Which date do you use?

These are the questions interviewers ask oncology programmers and statisticians, because they separate people who have memorized "PFS = progression-free survival" from people who can derive it.

## Intuition

At baseline, the radiologist picks a few measurable tumors (**target lesions**) and adds up their diameters: the **sum of diameters (SLD)**. At every scan, the SLD is measured again and compared:

- with **baseline** to decide whether the tumor has shrunk enough to call it a response;
- with the **smallest SLD so far (the nadir)** to decide whether it has grown enough to call it progression.

Other tumors that are present but not measured precisely (**non-target lesions**) are followed qualitatively, and any **new lesion** means progression. Each scan gets an **overall response**: CR, PR, SD, PD or NE (not evaluable). Over time, a subject's scans produce a **best overall response**, a **date of progression** (if any), and — combined with death dates — the time-to-event endpoints.

Because progression can only be seen at a scan, PFS is known only up to the scan schedule. That is why the rules about *which* scan counts, and what to do when scans are missing, matter so much.

## Clinical context

In CBX417-301, response is assessed by the investigator per RECIST 1.1 at baseline (within 28 days before randomization), every 6 weeks (±7 days) to week 48, and every 9 weeks thereafter, until progression, death, withdrawal, new anticancer therapy or the data cutoff. Scans continue after treatment discontinuation for reasons other than progression.

| Data | Raw | SDTM | ADaM |
|---|---|---|---|
| Sum of target diameters per visit | `tumor_assessment.csv` `TARGET_SLD_MM` | `TR` (`TRTESTCD = "SUMDIAM"`) | `ADTR` (`SUMDIAM`, `BPCHG`) |
| Overall response per visit | `OVERALL_RESP` | `RS` (`RSTESTCD = "OVRLRESP"`, `RSEVAL = "INVESTIGATOR"`) | `ADRS` (`OVRLRESP`) |
| Best overall response | — | — | `ADRS` (`BOR`, `CBOR`) |
| PFS, OS, DoR | — | — | `ADTTE` (`PFS`, `OS`, `DOR`) |

:::standard{kind="official" source="RECIST 1.1 — Eisenhauer EA et al., Eur J Cancer 2009;45:228–247"}
RECIST 1.1 defines measurable disease, target and non-target lesions, the response categories and the progression criteria used here. It states that confirmation of response is required in non-randomized trials where response is the primary endpoint, and is not required in randomized trials; many randomized-trial SAPs, including CBX417-301's, still require confirmation for the ORR endpoint.
:::

:::standard{kind="simplification"}
The CBX417-301 SDTM data contain only the sum of diameters (`TR` with `SUMDIAM`) and the investigator's overall response; individual lesions (`TU` and per-lesion `TR` records), non-target assessments and new-lesion records are omitted. Real oncology SDTM includes them.
:::

## Formal concept

### Lesions at baseline

- **Measurable lesion:** longest diameter ≥ 10 mm on CT (slice thickness ≤ 5 mm); a lymph node is measurable if its **short axis** is ≥ 15 mm.
- **Target lesions:** up to 5 in total, at most 2 per organ, chosen among measurable lesions. SLD sums longest diameters for non-nodal lesions and short axes for nodes.
- **Non-target lesions:** all other disease, followed qualitatively.

### Target lesion response at a time point

| Category | Criterion |
|---|---|
| **CR** | Disappearance of all target lesions; all target nodes < 10 mm short axis |
| **PR** | ≥ 30% decrease in SLD from **baseline** |
| **PD** | ≥ 20% increase in SLD from the **nadir** (smallest SLD on study, baseline included) **and** an absolute increase ≥ 5 mm |
| **SD** | Neither PR nor PD |

### Overall response at a time point

| Target | Non-target | New lesion | Overall |
|---|---|---|---|
| CR | CR | No | CR |
| CR | Non-CR/non-PD or not evaluated | No | PR |
| PR | Non-PD or not all evaluated | No | PR |
| SD | Non-PD or not all evaluated | No | SD |
| Not all evaluated | Non-PD | No | NE |
| PD | Any | Any | PD |
| Any | PD | Any | PD |
| Any | Any | Yes | PD |

### Best overall response and confirmation (CBX417-301 SAP)

- **BOR (unconfirmed):** the best time-point response recorded from randomization until progression, new anticancer therapy or the cutoff.
- **CBOR (confirmed):** CR or PR counts only if a subsequent assessment **≥ 28 days later** shows the same or better response, with no progression in between. An unconfirmed PR becomes SD if the SD criterion is met.
- **SD** requires at least one assessment showing SD (or better) **≥ 35 days** after randomization (6 weeks minus the 7-day window); otherwise BOR is NE (unless PD).
- `ADRS.AVAL` coding: CR = 1, PR = 2, SD = 3, PD = 4, NE = 5 (lower is better).

### The time-to-event endpoints

| Endpoint | Start | Event | Censoring |
|---|---|---|---|
| **PFS** | Randomization | First documented PD or death from any cause | Per the SAP table below |
| **OS** | Randomization | Death from any cause | Last known alive date (`LSTALVDT`), CNSR = 1 |
| **DoR** | First documented CR/PR (confirmed responders) | PD or death | Same rules as PFS |
| **ORR** | — (binary) | Confirmed CR or PR | — |

`AVAL = ADT − STARTDT + 1` (days).

### PFS censoring rules (CBX417-301 SAP)

| Situation | Outcome | Date | `CNSR` |
|---|---|---|---|
| Documented PD or death, whichever first, with ≤ 1 missed assessment before it | Event | Date of PD / death | 0 |
| No PD, no death | Censored | Last adequate tumor assessment | 1 |
| No baseline or no post-baseline assessment, and no death within 2 scheduled intervals (12 weeks + window) | Censored | Randomization date | 2 |
| New anticancer therapy started before PD | Censored | Last adequate assessment on or before new therapy start | 3 |
| PD or death after ≥ 2 consecutive missed scheduled assessments | Censored | Last adequate assessment before the missed assessments | 4 |

An **adequate** assessment has an overall response of CR, PR, SD or PD. A scheduled assessment is **missed** if its whole ±7-day window passes with no adequate assessment. The SAP applies the rules in the order CNSR 2 → 3 → 4 → event → 1.

:::standard{kind="convention"}
These rules follow the approach described in FDA's oncology endpoint guidance and common industry practice, but the table itself is a **SAP rule**, not a regulation. Sponsors differ, for example on whether new anticancer therapy censors or counts, and on how many missed assessments trigger censoring. Always derive from your study's SAP.
:::

## Worked example

### Part 1 — response from the sum of diameters

Baseline SLD = 68 mm (illustrative subject).

| Visit | SLD (mm) | Change from baseline | Change from nadir | Time-point target response |
|---|---:|---:|---:|---|
| Baseline | 68 | — | — | — |
| Week 6 | 52 | −23.5% | −23.5% (nadir 68) | SD |
| Week 12 | 45 | −33.8% | — | PR |
| Week 18 | 44 | −35.3% | — | PR (new nadir 44) |
| Week 24 | 56 | −17.6% | +27.3%, +12 mm | **PD** |

:::number[Why is week 24 progression even though the tumor is still smaller than at baseline?]
Progression is measured from the **nadir**, not from baseline. The smallest SLD was 44 mm at week 18. At week 24: (56 − 44) / 44 = +27.3% ≥ 20%, and 56 − 44 = 12 mm ≥ 5 mm. Both criteria are met, so the target response is PD — even though the SLD is 17.6% below baseline.
:::

Confirmation: PR at week 12 (day 84) and again at week 18 (day 126), 42 days later ≥ 28 → **confirmed PR**; `CBOR = PR`. DoR starts at the week 12 assessment date and ends with the PD at week 24.

Two traps: if week 24 had shown 52 mm, the change from nadir would be +18.2% — **not** PD, and relative to baseline (−23.5%) the time-point response would be **SD**, not PR. And for a small tumor with nadir 20 mm, growth to 24 mm is +20% but only +4 mm — **not** PD because of the 5 mm rule.

::widget{name="waterfall-plot"}

### Part 2 — which PFS rule applies?

Seven illustrative subjects, data cutoff 2025-03-31:

| Subject | Randomized | Tumor assessments and events | Rule | `ADT` | `AVAL` | `CNSR` |
|---|---|---|---|---|---:|---:|
| A | 2023-01-10 | SD, PR, PR; PD at 2023-06-27 | Event (PD) | 2023-06-27 | 169 | 0 |
| B | 2023-02-01 | SD, SD (last 2023-04-26); died 2023-05-20, no PD | Event (death) | 2023-05-20 | 109 | 0 |
| C | 2023-03-06 | PR (unconfirmed) then SD at every scan; last 2025-03-10; alive | No PD, no death | 2025-03-10 | 736 | 1 |
| D | 2023-04-03 | SD at 2023-05-15; weeks 12 and 18 missed; PD 2023-09-18 | ≥ 2 missed before PD | 2023-05-15 | 43 | 4 |
| E | 2023-05-08 | SD at 2023-06-19; new therapy 2023-07-20; PD 2023-08-28 | New therapy before PD | 2023-06-19 | 43 | 3 |
| F | 2023-06-05 | No post-baseline assessment; withdrew; alive | No post-baseline assessment | 2023-06-05 | 1 | 2 |
| G | 2023-07-03 | No post-baseline assessment; died 2023-08-28 | Death within 2 intervals | 2023-08-28 | 57 | 0 |

:::number[Why is subject G an event but subject F censored at randomization?]
Neither has a post-baseline scan. G died on day 57, before the second scheduled assessment window had passed (only the week-6 window, days 36–50, was missed), so the death is a PFS event. F never had an assessment and did not die: there is no information about progression, so F is censored at randomization with `AVAL = 1` (day of randomization counts as day 1).
:::

:::number[Where does "2 missed assessments" come from for subject D?]
Scheduled targets after the last adequate scan (2023-05-15, week 6) are week 12 (2023-06-26, window 06-19 to 07-03) and week 18 (2023-08-07, window 07-31 to 08-14). Both windows passed with no adequate assessment, and both lie before the PD on 2023-09-18: two consecutive missed assessments. The PD date could be weeks later than the true progression, so the SAP censors at the last adequate scan instead of accepting a late-dated event.
:::

## Code

The same rules in R, applied to the illustrative subjects (a teaching implementation; production code would read `ADSL`, `ADRS` and the new-therapy records):

```r title="pfs_censoring.R"
subj <- data.frame(
  USUBJID = c("A", "B", "C", "D", "E", "F", "G"),
  RANDDT  = as.Date(c("2023-01-10", "2023-02-01", "2023-03-06", "2023-04-03", "2023-05-08", "2023-06-05", "2023-07-03")),
  DTHDT   = as.Date(c(NA, "2023-05-20", NA, NA, NA, NA, "2023-08-28")),
  NATDT   = as.Date(c(NA, NA, NA, NA, "2023-07-20", NA, NA)),
  BLSCAN  = c(TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE))
scans <- data.frame(
  USUBJID = c("A", "A", "A", "A", "B", "B", "C", "C", "D", "D", "E", "E"),
  ADT  = as.Date(c("2023-02-21", "2023-04-04", "2023-05-16", "2023-06-27", "2023-03-15", "2023-04-26",
                   "2023-04-17", "2025-03-10", "2023-05-15", "2023-09-18", "2023-06-19", "2023-08-28")),
  RESP = c("SD", "PR", "PR", "PD", "SD", "SD", "PR", "SD", "SD", "PD", "SD", "PD"))
dco <- as.Date("2025-03-31")
sched_weeks <- c(seq(6, 48, by = 6), seq(57, 57 + 9 * 30, by = 9))

missed_between <- function(randdt, from, to) {
  target <- randdt + 7 * sched_weeks
  sum(target - 7 > from & target + 7 < to)   # whole window after 'from' and before 'to'
}

pfs_one <- function(s) {
  sc <- scans[scans$USUBJID == s$USUBJID & scans$ADT <= dco & scans$RESP %in% c("CR", "PR", "SD", "PD"), ]
  sc <- sc[order(sc$ADT), ]
  pd  <- if (any(sc$RESP == "PD")) min(sc$ADT[sc$RESP == "PD"]) else as.Date(NA)
  dth <- if (!is.na(s$DTHDT) && s$DTHDT <= dco) s$DTHDT else as.Date(NA)
  evt <- suppressWarnings(min(c(pd, dth), na.rm = TRUE)); if (is.infinite(evt)) evt <- as.Date(NA)
  out <- function(adt, cnsr, desc) data.frame(USUBJID = s$USUBJID, ADT = adt,
                                              AVAL = as.numeric(adt - s$RANDDT) + 1, CNSR = cnsr, DESC = desc)
  if (!s$BLSCAN || nrow(sc) == 0) {
    if (!is.na(dth) && missed_between(s$RANDDT, s$RANDDT, dth) < 2) return(out(dth, 0, "Death"))
    return(out(s$RANDDT, 2, "No baseline/post-baseline assessment"))
  }
  if (!is.na(s$NATDT) && (is.na(evt) || s$NATDT < evt)) {
    pre <- sc$ADT[sc$ADT <= s$NATDT]
    return(out(if (length(pre)) max(pre) else s$RANDDT, 3, "New anticancer therapy"))
  }
  if (!is.na(evt)) {
    last <- sc$ADT[sc$ADT < evt]; last <- if (length(last)) max(last) else s$RANDDT
    if (missed_between(s$RANDDT, last, evt) >= 2) return(out(last, 4, "Event after >=2 missed assessments"))
    return(out(evt, 0, if (!is.na(pd) && evt == pd) "Progressive disease" else "Death"))
  }
  out(max(sc$ADT), 1, "No PD or death: last adequate assessment")
}
pfs <- do.call(rbind, lapply(split(subj, subj$USUBJID), pfs_one))
print(pfs, row.names = FALSE)
```

:::lines
1-6: One row per subject: randomization date, death date, new anticancer therapy start (`NATDT`) and whether a baseline scan exists.
7-11: Post-baseline assessments with the overall response per scan (only the first and last of subject C's scans are listed).
12-13: The data cutoff and the protocol's scan schedule in weeks from randomization: every 6 weeks to week 48, then every 9 weeks.
15-18: Counts scheduled assessments whose entire ±7-day window lies strictly between two dates — the "missed" assessments, since no adequate scan occurred in that interval.
21-22: Keeps adequate assessments on or before the cutoff, in date order.
23-25: First PD date, death date (ignored if after the cutoff), and the earlier of the two as the candidate event date.
26-27: A helper that builds the ADTTE-like record, with `AVAL = ADT − RANDDT + 1`.
28-31: CNSR 2 first: no baseline or no post-baseline assessment. A death before two scheduled windows have passed is still an event.
32-35: CNSR 3: new anticancer therapy before the event — censor at the last adequate assessment on or before the therapy start.
36-40: An event preceded by two or more missed assessments is censored at the last adequate assessment (CNSR 4); otherwise it is an event (CNSR 0).
41: No event: censored at the last adequate assessment (CNSR 1).
43-44: Applies the function to every subject and prints the result.
:::

## Output

Output of the program above (R 4.6):

```output
 USUBJID        ADT AVAL CNSR                                     DESC
       A 2023-06-27  169    0                      Progressive disease
       B 2023-05-20  109    0                                    Death
       C 2025-03-10  736    1 No PD or death: last adequate assessment
       D 2023-05-15   43    4       Event after >=2 missed assessments
       E 2023-06-19   43    3                   New anticancer therapy
       F 2023-06-05    1    2     No baseline/post-baseline assessment
       G 2023-08-28   57    0                                    Death
```

:::number[Why is C's AVAL 736?]
From 2023-03-06 to 2025-03-06 is 731 days (2024 is a leap year: 366 + 365). Four more days to 2025-03-10 gives 735, and adding 1 (randomization day = day 1) gives 736.
:::

## Interpretation

- **Censoring rules encode assumptions.** CNSR 3 assumes subjects who start new therapy would have behaved like similar subjects still followed (a hypothetical estimand); CNSR 4 assumes a late-documented PD should not be trusted. Sensitivity analyses vary these rules.
- **A subject censored at day 1 still counts** in the ITT population and the number at risk at time 0.
- **ORR and PFS can disagree.** A drug can delay progression by stabilizing disease without shrinking it; ORR would be unimpressive while PFS improves.
- **DoR describes responders only** and is not a randomized comparison.

## Common mistakes

:::mistake[Measuring progression from baseline instead of the nadir]
A tumor that shrank 40% then regrew 30% from its nadir has progressed, even though it is smaller than at baseline. Derive the nadir as the running minimum of SLD, including baseline.
:::

:::mistake[Forgetting the 5 mm absolute rule]
Small tumors can show +20% from nadir with only a 2–4 mm change, within measurement error. RECIST 1.1 requires both the relative and the absolute increase.
:::

:::mistake[Censoring at the data cutoff]
A subject without PD whose last scan was 2024-11-18 is censored at 2024-11-18, not 2025-03-31. Using the cutoff credits unobserved time as progression-free and biases PFS upward.
:::

:::mistake[Using scans after new anticancer therapy or after the cutoff]
Assessments after a new therapy starts (for CNSR 3) and anything after the cutoff must be excluded before looking for PD or the last adequate assessment.
:::

:::mistake[Counting unconfirmed responses]
A PR followed by SD is not a confirmed response. Keep `BOR` and `CBOR` as separate parameters and use the one the shell specifies.
:::

## Knowledge check

::quiz{ids="trials.recist.pd-from-nadir,trials.recist.five-mm,trials.recist.censor-no-pd,trials.recist.cnsr-map"}

## Hands-on exercise

::practice{ids="trials.recist.pct-change,trials.recist.confirmation,trials.recist.aval-calc" title="Practice: response and PFS derivations"}

## Challenge exercise

::practice{ids="trials.recist.censor-order-bug,trials.recist.which-rule" title="Debug: censoring rules in practice"}

## Industry note

- **Oncology programming is a specialty.** RECIST-based ADRS and ADTTE derivations, censoring tables and PFS sensitivity analyses are core skills for oncology programmers and statisticians, and a frequent interview topic.
- **Expect sensitivity analyses** that change one rule at a time: count PD after two missed scans as an event; count events after new therapy; use the date of the scheduled visit; use blinded independent review data.
- **Know the other criteria exist**: iRECIST for immunotherapy (unconfirmed progression), Lugano for lymphoma, RANO for brain tumors. The data structures are similar; the rules differ.

:::interview[How do you derive PFS, and which censoring rules do you apply?]
"PFS runs from randomization to the first documented progression per RECIST 1.1 or death from any cause, whichever comes first. The PD date is the date of the assessment that documents it. I follow the SAP's censoring table: subjects without PD or death are censored at their last adequate assessment; subjects with no baseline or post-baseline assessment and no early death are censored at randomization; subjects who start new anticancer therapy before PD are censored at the last adequate assessment on or before the new therapy; and events after two or more consecutive missed assessments are censored at the last adequate assessment before the gap. I exclude everything after the data cutoff, store AVAL in days as ADT minus RANDDT plus one, with CNSR codes and event/censoring descriptions so every record is traceable. QC includes a listing of subjects per CNSR category and spot checks of boundary cases."
:::
