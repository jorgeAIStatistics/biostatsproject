## What problem are we trying to solve?

You are writing the ADSL program for CBX417-301. The SAP says:

> *Efficacy analyses use the ITT population, with subjects analyzed according to randomized treatment. Safety analyses use the safety population, with subjects analyzed according to treatment actually received.*

Then the edge cases arrive: 48 screen failures, 4 subjects randomized but never treated, and 3 subjects who received the wrong blinded kits because of dispensing errors. Your ADSL must place every one of these subjects correctly — and the column headers of every table in the CSR (`N = …`) will be computed from your flags.

Getting populations wrong is one of the most common and most visible errors in clinical reporting: every percentage in a table uses the population count as its denominator.

## Intuition

Each population answers a different question:

- **ITT (intention-to-treat):** "What happens when you *decide* to give CBX-417?" Everyone randomized, in the arm they were randomized to — even if they never took a pill or took the wrong one. This preserves the fair comparison that randomization created.
- **Safety:** "What harms occur in people who actually *took* the drug?" Everyone who received any study drug, grouped by what they actually received — because harm should be attributed to the exposure that caused it.
- **Per-protocol:** "What happens in patients who followed the protocol closely?" A supportive view that can reveal whether protocol deviations diluted the effect — at the cost of breaking randomization.

The same subject can be in several populations and, in rare cases, in **different arms** for efficacy and safety. That is not an inconsistency; it is the design.

## Clinical context

In CBX417-301 the populations, their flags in `ADSL`, and their uses are:

| Population | Flag | Definition (SAP) | Treatment variable | Used for |
|---|---|---|---|---|
| Randomized / ITT | `RANDFL`, `ITTFL` | All randomized subjects | `TRT01P` (planned) | Disposition, demographics, all efficacy endpoints (primary PFS) |
| Safety | `SAFFL` | Randomized subjects who received ≥1 dose of any study drug (CBX-417/placebo or docetaxel) | `TRT01A` (actual) | AEs, labs, vital signs, ECG, exposure |
| Efficacy-evaluable | `EFFFL` | ITT subjects with measurable disease at baseline and ≥1 post-baseline tumor assessment, or death before the first scheduled assessment | `TRT01P` | Sensitivity analyses of response endpoints |
| Per-protocol | `PPROTFL` | ITT subjects without major protocol deviations affecting efficacy | `TRT01P` | Sensitivity analysis of PFS |

`ADSL` contains all **randomized** subjects (420). Screen failures are not in ADSL in this study; the disposition table's "screened" rows come from SDTM (`DM`/`DS`), a sponsor decision stated in the ADaM specification.

:::standard{kind="official" source="ICH E9 Statistical Principles for Clinical Trials, Section 5.2"}
ICH E9 defines the full analysis set as the set of subjects as close as possible to the intention-to-treat ideal of including all randomized subjects, and the per-protocol set as the subset who complied sufficiently with the protocol. In superiority trials the full analysis set is usually primary; in equivalence and non-inferiority trials, results in both sets matter because the full analysis set is not necessarily conservative.
:::

:::standard{kind="official" source="ADaMIG v1.3"}
Subject-level population flags in ADSL (for example `ITTFL`, `SAFFL`, `PPROTFL`) take the values `Y` and `N`; they are not left null. A blank flag forces every downstream program to guess what "missing" means.
:::

## Formal concept

### Planned vs actual treatment

- `TRT01P` / `TRT01PN`: treatment the subject was **randomized** to (from IxRS), for period 01. In CBX417-301: `CBX-417 + Docetaxel` (1) or `Placebo + Docetaxel` (2).
- `TRT01A` / `TRT01AN`: treatment **actually received**, derived from exposure data and the kit list, using a rule written in the SAP. For CBX417-301:
  - a subject randomized to placebo who received **at least one** CBX-417 kit is analyzed as `CBX-417 + Docetaxel`;
  - a subject randomized to CBX-417 who received **only** placebo kits is analyzed as `Placebo + Docetaxel`;
  - never-treated subjects have `TRT01A` missing and `SAFFL = "N"`.

:::why[Why does one CBX-417 kit make a subject "CBX-417" for safety?]
It is the conservative choice for safety attribution. If a placebo-randomized subject received some active drug, an adverse event they experience could be caused by CBX-417. Counting them in the CBX-417 column ensures potential drug-related harm is not hidden in the placebo column. The rule is a sponsor decision — some SAPs use "majority of exposure" instead — which is why it must be written down.
:::

### SDTM counterparts

In SDTM `DM`, `ARM`/`ARMCD` hold the planned arm and `ACTARM`/`ACTARMCD` the actual arm. Screen failures have null arms with `ARMNRS = "SCREEN FAILURE"`; randomized-but-never-treated subjects keep `ARM` but have null `ACTARM` with `ARMNRS = "ASSIGNED, NOT TREATED"`. Both values come from the CDISC Arm Null Reason codelist (ARMNULRS).

## Worked example

Derive the CBX417-301 subject flow from the study design specification (confirm against ADSL once the data are generated).

**Step 1 — screened to randomized.** 468 subjects signed informed consent and were screened. 48 failed screening. 468 − 48 = **420 randomized** (`RANDFL = ITTFL = "Y"`), 210 per arm.

**Step 2 — randomized to treated.** 4 randomized subjects (2 per arm) never received any study drug: `SAFFL = "N"`. 420 − 4 = **416** in the safety population.

**Step 3 — planned vs actual among the 416.** Before dispensing errors, 208 treated subjects per arm. Now apply the three errors:

- 2 subjects randomized to placebo received ≥1 CBX-417 kit → `TRT01A = CBX-417 + Docetaxel`.
- 1 subject randomized to CBX-417 received only placebo kits → `TRT01A = Placebo + Docetaxel`.

| Randomized (`TRT01P`) ↓ / Actual (`TRT01A`) → | CBX-417 + Docetaxel | Placebo + Docetaxel | Never treated | Total (ITT) |
|---|---:|---:|---:|---:|
| CBX-417 + Docetaxel | 207 | 1 | 2 | 210 |
| Placebo + Docetaxel | 2 | 206 | 2 | 210 |
| **Total** | **209** | **207** | **4** | **420** |

:::number[Where do 209 and 207 come from?]
CBX-417 actual: 208 treated subjects randomized to CBX-417, minus the 1 who received only placebo (207), plus the 2 placebo-randomized subjects who received a CBX-417 kit: 207 + 2 = **209**. Placebo actual: 208 − 2 = 206 placebo-randomized subjects who stayed on placebo, plus the 1 CBX-randomized subject: 206 + 1 = **207**. Check: 209 + 207 = 416 = safety population.
:::

**Step 4 — consequences for tables.**

- Demographics and PFS tables: column headers `N = 210` and `N = 210` (ITT by `TRT01P`).
- AE and lab tables: `N = 209` and `N = 207` (safety by `TRT01A`).
- A subject with a dispensing error appears in the placebo column of the PFS table and the CBX-417 column of the AE table. Correct — and worth a footnote or a mention in the CSR.

## Data example

The four never-treated subjects are visible in ADSL with `SAFFL = "N"`:

::dataset{id="oncology/adam/adsl" cols="USUBJID,TRT01P,TRT01A,RANDDT,TRTSDT,ITTFL,SAFFL" filter="SAFFL=N" rows="6" caption="ADSL — randomized but never treated"}

And the subjects randomized to placebo who were analyzed as CBX-417 for safety:

::dataset{id="oncology/adam/adsl" cols="USUBJID,TRT01P,TRT01PN,TRT01A,TRT01AN,SAFFL" filter="TRT01PN=2;TRT01AN=1" rows="5" caption="ADSL — planned placebo, actual CBX-417 (dispensing errors)"}

## Code

A sketch of the population and actual-treatment derivations in SAS (not executed in this environment). It assumes `WORK.EXSUM` has one row per treated subject with `N_CBX_KITS` and `N_PBO_KITS` (kits dispensed by content, from EX joined to the kit list) and `TRTSDT`.

```sas title="adsl_populations.sas"
data adsl;
  merge adsl_base(in=inrand) exsum(in=intrt);
  by USUBJID;
  if inrand;

  RANDFL = ifc(not missing(RANDDT), 'Y', 'N');
  ITTFL  = RANDFL;
  SAFFL  = ifc(intrt and not missing(TRTSDT), 'Y', 'N');

  length TRT01A $40;
  if SAFFL = 'Y' then do;
    if N_CBX_KITS >= 1 then do; TRT01A = 'CBX-417 + Docetaxel'; TRT01AN = 1; end;
    else do;                    TRT01A = 'Placebo + Docetaxel'; TRT01AN = 2; end;
  end;
run;

proc freq data=adsl;
  tables TRT01P*TRT01A / missing norow nocol nopercent;
run;
```

:::lines
2-4: Keeps every randomized subject (`if inrand;`) whether or not they have exposure records — the never-treated must stay in ADSL for ITT.
6-7: Everyone with a randomization date is randomized; in this study ITT equals all randomized.
8: Safety requires at least one dose: the subject has exposure records and a first-dose date. `IFC` returns character `Y`/`N`, so the flag is never null.
10: Declares the length before the first assignment so labels are not truncated.
11-14: The SAP rule: any CBX-417 kit makes the subject CBX-417 for safety; otherwise placebo. Never-treated subjects keep `TRT01A` missing.
17-19: The cross-tabulation of planned vs actual treatment, with `MISSING` so never-treated subjects appear — the fastest QC of the whole derivation.
:::

## Output

Expected result of the `PROC FREQ` step, given the study design specification (compute from the generated data to confirm):

```output
Table of TRT01P by TRT01A

TRT01P                 TRT01A
Frequency       |                 |CBX-417 +       |Placebo +       |  Total
                |                 |Docetaxel       |Docetaxel       |
----------------+-----------------+----------------+----------------+
CBX-417 +       |        2        |      207       |        1       |   210
Docetaxel       |                 |                |                |
----------------+-----------------+----------------+----------------+
Placebo +       |        2        |        2       |      206       |   210
Docetaxel       |                 |                |                |
----------------+-----------------+----------------+----------------+
Total                    4             209              207            420
```

The first column (blank `TRT01A`) holds the never-treated subjects. Off-diagonal counts are the dispensing errors; if you expected 3 and see 0, your kit-content join failed; if you see many, your rule is inverted.

## Interpretation

- **ITT answers the policy question and protects randomization.** Excluding the never-treated from efficacy analyses would compare groups no longer formed by chance alone.
- **Safety by actual treatment attributes harm to exposure.** The 3 dispensing-error subjects sit in different columns for efficacy and safety by design.
- **Per-protocol and efficacy-evaluable analyses are sensitivity analyses in a superiority trial.** If they agree with ITT, the result is robust to protocol deviations; if they disagree, investigate why — do not simply prefer the more favorable one.
- **Denominators follow the population.** Every table's population line ("Safety population") and header counts should be checked against ADSL.

## Common mistakes

:::mistake[Defining ITT as randomized and treated]
"Modified ITT" definitions that drop never-treated subjects are sometimes justified (for example, in double-blind trials where not dosing cannot depend on assignment), but only if the SAP says so. In CBX417-301, ITT is all 420 randomized.
:::

:::mistake[Summarizing safety by planned treatment]
AE tables by `TRT01P` would count the 2 placebo-randomized subjects who received CBX-417 as placebo. Use `TRTA` in ADAE (copied from `TRT01A`).
:::

:::mistake[Leaving flags blank]
`SAFFL = ""` for never-treated subjects makes `where SAFFL ne 'Y'` and `where SAFFL = 'N'` return different rows. Population flags are always `Y` or `N`.
:::

:::mistake[Deriving per-protocol after unblinding]
Major deviations that exclude subjects from the per-protocol set must be classified blind, before database lock, at the blinded data review. Otherwise the choice of exclusions can be influenced by the results.
:::

## Knowledge check

::quiz{ids="trials.populations.safety-n,trials.populations.fas-definition,trials.populations.analysis-map,trials.populations.speed-trt01a"}

## Hands-on exercise

::practice{ids="trials.populations.actual-cbx-n,trials.populations.ni-population,trials.populations.saffl-code" title="Practice: derive populations and actual treatment"}

## Challenge exercise

::practice{ids="trials.populations.ae-denominator-qc,trials.populations.mitt-debug" title="QC and debug: wrong population, wrong treatment variable"}

## Industry note

- **Population counts are the first thing reviewers check.** Disposition, demographics and every table header must reconcile: 468 screened → 420 randomized → 416 treated. Build a reconciliation check into your QC.
- **Dispensing errors happen in real trials.** The SAP must define how actual treatment is assigned; the CSR and the ADRG explain the handling. Expect an interviewer to ask how you would handle a subject who received the wrong kit.
- **Terminology differs.** "FAS", "ITT", "mITT", "all randomized", "safety analysis set", "as-treated" — read the SAP's definitions, never the label alone.

:::interview[What are the ITT, per-protocol and safety populations, and when do you use each?]
"ITT includes every randomized subject, analyzed as randomized — it preserves the comparison randomization created, so it's the primary efficacy population in a superiority trial. Per-protocol restricts to subjects without major deviations; it's a sensitivity analysis in superiority trials but carries more weight in non-inferiority trials, where ITT isn't necessarily conservative. The safety population is everyone who received at least one dose, analyzed by actual treatment, so harms are attributed to what was taken. In ADSL these are Y/N flags — ITTFL, PPROTFL, SAFFL — with TRT01P and TRT01A for planned and actual treatment. In CBX417-301, for example, 420 are randomized, 416 treated, and three dispensing errors mean the safety columns are 209 and 207 rather than 208 and 208."
:::
