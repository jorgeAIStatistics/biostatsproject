## What problem are we trying to solve?

The biostatistician on CBX417-301 hands you three things: the IxRS randomization export (`randomization.csv`), the ADSL specification, and a line from the SAP: *"The primary analysis will use a log-rank test stratified by the randomization stratification factors as recorded in IxRS."*

Then the questions start arriving:

- Why does ADSL need `STRAT1R` and `STRAT2R` when `ECOGBL` and `PRIORIO` already exist?
- A subject's IxRS stratum says ECOG 0, but the screening CRF says ECOG 1. Which value goes into the model?
- The randomization list has 960 rows for a 420-subject study. Is that an error?
- Why is the analysis stratified at all — wasn't randomization supposed to take care of balance?

To answer, you need to understand what randomization protects, how permuted blocks and stratification work, and why the way you randomize dictates the way you analyze.

## Intuition

Randomization is a **fair lottery for treatment**. Its job is not to make the arms identical; it is to make any difference between them the result of chance alone — including differences in factors nobody measured. That is what lets a statistical test attribute a difference in outcomes to the treatment.

Pure chance, however, can be lumpy. Flip a fair coin for 20 patients and there is about a 26% chance the split is 7:13 or worse. In a large trial overall balance evens out, but within important subgroups — say, patients with ECOG 1 who received prior immunotherapy — lumps persist. Two refinements fix that:

- **Permuted blocks** force balance every few patients (for example, every block of 4 contains exactly 2 A and 2 B, in random order).
- **Stratification** runs a separate block sequence inside each combination of key prognostic factors, so balance holds *within* each stratum.

The price of forcing balance is **predictability**: if you know the block size and the assignments so far, you can sometimes guess the next one. That is why the sequence is **concealed** — held by a central system (IxRS), revealed one assignment at a time, only after a patient is irrevocably enrolled.

Try it in the simulator: compare simple, block and stratified randomization, and watch imbalance and predictability move in opposite directions.

::widget{name="randomization-simulator"}

## Clinical context

In CBX417-301:

- Randomization is **1:1** to CBX-417 + docetaxel or placebo + docetaxel.
- It is **stratified** by ECOG performance status (0 vs 1) and prior anti-PD-(L)1 therapy (Yes vs No): 2 × 2 = **4 strata**.
- Within each stratum, assignments come from **permuted blocks of 4**.
- An **IxRS** (interactive response system — web or voice; also called IRT) randomizes subjects and assigns blinded drug **kit numbers**. The IxRS export is a vendor transfer, separate from the EDC.

Both factors are prognostic: patients with ECOG 1 generally progress faster than ECOG 0, and prior immunotherapy exposure changes the disease setting. An imbalance in either could make one arm look better for reasons unrelated to CBX-417 — stratification prevents that.

:::note[What the programmer sees]
`randomization.csv` has one row per randomized subject: `SUBJECT_ID`, `RAND_NO`, `RAND_DATE`, `STRAT_ECOG`, `STRAT_PRIOR_IO`, `ARM_ASSIGNED`. These become `RANDDT`, `STRAT1R`, `STRAT2R` and the planned arm (`ARM`, `TRT01P`) in SDTM/ADaM. The kit list (`kit_list.csv`) maps each `KIT_NUMBER` to its content, which is how **actual** treatment is reconstructed from dispensing records.
:::

## Formal concept

### Simple randomization

Each subject is assigned independently with probability 1/2. The number assigned to A out of *n* is Binomial(*n*, 0.5). Unpredictable, but imbalance can be sizeable in small samples or subgroups.

:::number[Where does "about 26% chance of 7:13 or worse" come from?]
Let X ~ Binomial(20, 0.5). A split of 7:13 or worse means X ≤ 7 or X ≥ 13. By symmetry P = 2 × P(X ≤ 7) = 2 × 0.1316 = 0.2632. For 6:14 or worse it is still 0.1153.
:::

### Permuted-block randomization

Allocation is organized in blocks of size *b* containing *b*/2 of each arm, randomly permuted. With *b* = 4 there are

$$\binom{4}{2} = 6$$

possible blocks: AABB, ABAB, ABBA, BAAB, BABA, BBAA. At the end of every block the arms are exactly balanced, and the imbalance at any moment is at most *b*/2 = 2.

:::number[How predictable are blocks of 4?]
If an observer knew the block size and every previous assignment, the 4th assignment of every block is certain; the 3rd is also certain when the first two are identical (AA or BB — 2 of the 6 blocks). Expected certain guesses per block = (2 + 1 + 1 + 1 + 1 + 2) / 6 = 1.33, i.e., one assignment in three. Random block sizes (for example 4 and 6) and concealment reduce this.
:::

:::standard{kind="official" source="ICH E9 Statistical Principles for Clinical Trials, Section 2.3"}
ICH E9 recommends choosing block lengths short enough to limit imbalance but long enough to avoid predictability, and says investigators should generally be unaware of the block length (randomly varying block lengths serve the same purpose). The CBX417-301 specification tells *you* the block size because programmers and statisticians working with the randomization specification need it; a real protocol would normally not disclose it to sites.
:::

### Stratified randomization

A separate permuted-block sequence is generated for each stratum. A subject's stratum is determined at randomization, and the next unused assignment in that stratum's list is used. The randomization list is generated in advance with **more slots than needed** in every stratum, because no one knows how many subjects each stratum will enroll.

The trade-off is **too many strata**. Each stratum can end with an incomplete block, and each incomplete block can be unbalanced by up to *b*/2. With *K* strata the worst-case overall imbalance is *K* × *b*/2. For CBX417-301, 4 × 2 = 8 — trivial for 420 subjects. Stratify by site × ECOG × prior IO × region with 42 sites, and you could have hundreds of mostly empty strata. That is why trials stratify on a few strong prognostic factors, and sometimes use **minimization** (dynamic allocation that balances marginal totals) when there are many factors.

### Allocation concealment vs blinding

| | Allocation concealment | Blinding |
|---|---|---|
| Protects | The sequence **before** assignment | Knowledge of treatment **after** assignment |
| Prevents | Selection bias (choosing which patient gets the next slot) | Performance and assessment bias |
| Mechanism | Central IxRS, randomize only after eligibility is confirmed | Matching placebo, blinded kits, restricted access to codes |
| Possible without the other? | Yes — an open-label trial must still conceal allocation | Yes, but blinding without concealment leaves selection bias |

### Why stratification factors reappear in the analysis

Randomization within strata makes arm assignment balanced *conditionally on the strata*. The analysis should respect that design:

- A **stratified log-rank test** compares arms within each stratum and combines the within-stratum comparisons.
- A **stratified Cox model** allows a different baseline hazard in each stratum while estimating one common hazard ratio.
- Ignoring the strata in the analysis tends to make tests **conservative** (the variance is overstated because it ignores the balance the design enforced), which costs power.

:::standard{kind="official" source="ICH E9; EMA Guideline on adjustment for baseline covariates in clinical trials (EMA/CHMP/295050/2013)"}
Both documents recommend that factors used to stratify the randomization be accounted for in the primary analysis. Which *values* to use (as randomized in IxRS, or as recorded on the CRF) is a study decision the SAP must state; using the IxRS values is the common choice because they reflect how balance was actually enforced.
:::

## Worked example

Build a small stratified list for CBX417-301's four strata and follow three subjects through it.

**Step 1 — generate the list.** For each of the 4 strata, concatenate random permutations of AABB. The R code below makes 60 blocks per stratum (240 slots per stratum, 960 in total) — far more than 420 subjects will use. The spare capacity is deliberate: no stratum can run out.

**Step 2 — randomize three subjects.** Suppose the first three subjects to enroll all have ECOG 1 and prior IO = Yes. They take the first three slots of that stratum's list: A, B, B (see the Output section). The fourth subject in that stratum must be A to complete the block — someone who knew the block size and the first three assignments could predict it. In a double-blind study, nobody at the site sees "A" or "B", only kit numbers, which is one reason blinding and central IxRS keep predictability low even with small blocks.

**Step 3 — carry the strata into ADSL.** `STRAT1R` = the ECOG stratum recorded by IxRS; `STRAT2R` = the prior-IO stratum. They are **not** derived from the CRF; they record what the randomization system used.

**Step 4 — a mis-stratification.** Subject 1012-0031 (illustrative) was randomized in the "ECOG 0" stratum, but the screening vital-signs page records ECOG 1. The IxRS entry was wrong. Consequences:

- `STRAT1R = "0"` (as randomized) and `ECOGBL = "1"` (as assessed).
- The primary stratified analysis uses `STRAT1R` per the SAP; a sensitivity analysis may use CRF values.
- The event is logged as a protocol deviation; data management does **not** "correct" the IxRS record — it truthfully records what happened at randomization.

## Code

```r title="stratified_block_list.R"
set.seed(417301)
strata <- expand.grid(ecog = c("0", "1"), prior_io = c("Y", "N"),
                      stringsAsFactors = FALSE)
make_list <- function(n_blocks, block = c("A", "A", "B", "B")) {
  unlist(lapply(seq_len(n_blocks), function(i) sample(block)))
}
rand_list <- do.call(rbind, lapply(seq_len(nrow(strata)), function(s) {
  arm <- make_list(n_blocks = 60)
  data.frame(stratum = paste0("ECOG ", strata$ecog[s], " / prior IO ", strata$prior_io[s]),
             seq_in_stratum = seq_along(arm), arm = arm)
}))
head(rand_list[rand_list$stratum == "ECOG 1 / prior IO Y", ], 8)
table(rand_list$stratum, rand_list$arm)
```

:::lines
1: A fixed seed makes the list reproducible — real randomization specifications record the seed and the generating program, held by an unblinded statistician or the IxRS vendor.
2-3: The four strata: every combination of ECOG (0, 1) and prior anti-PD-(L)1 (Y, N).
4-6: One block is a random permutation (`sample()`) of A, A, B, B; `make_list()` concatenates `n_blocks` independent blocks.
7-11: For each stratum, build 60 blocks (240 slots) and number the slots in order of use.
12: Shows the first 8 slots of one stratum — the order in which subjects in that stratum would be assigned.
13: Confirms each stratum's list is exactly balanced over complete blocks.
:::

## Output

Output of the program above (R 4.6, seed 417301):

```output
                stratum seq_in_stratum arm
241 ECOG 1 / prior IO Y              1   A
242 ECOG 1 / prior IO Y              2   B
243 ECOG 1 / prior IO Y              3   B
244 ECOG 1 / prior IO Y              4   A
245 ECOG 1 / prior IO Y              5   A
246 ECOG 1 / prior IO Y              6   A
247 ECOG 1 / prior IO Y              7   B
248 ECOG 1 / prior IO Y              8   B

                        A   B
  ECOG 0 / prior IO N 120 120
  ECOG 0 / prior IO Y 120 120
  ECOG 1 / prior IO N 120 120
  ECOG 1 / prior IO Y 120 120
```

:::number[Why do slots 1–4 read A, B, B, A and slots 5–8 read A, A, B, B?]
Each group of four is one block: ABBA, then AABB. Within every block there are exactly two of each arm. Across 60 complete blocks each stratum has 120 A and 120 B. In the trial, only the used slots matter: if 97 subjects enroll in this stratum, the first 24 blocks are complete and the 25th has one slot used, so the stratum's imbalance is at most 1.
:::

## Interpretation

- **Balance is a property of the design, not a test result.** Do not run significance tests comparing baseline characteristics between randomized arms; any difference is by definition due to chance. Describe the arms (Table 14.1.x) and judge clinical relevance.
- **Stratified analysis is the design-consistent analysis.** When the SAP says "stratified log-rank", the strata come from `STRAT1R`/`STRAT2R`; changing their source is an analysis change requiring justification.
- **The randomization list is unblinding material.** It lives with the unblinded team or vendor until database lock; programmers develop code on dummy randomization.

## Common mistakes

:::mistake[Using CRF values instead of IxRS strata in the primary model]
If 6 subjects were mis-stratified, a model on CRF ECOG moves them to different strata than the ones randomization balanced. Use the as-randomized values (`STRAT1R`, `STRAT2R`) unless the SAP says otherwise, and report mis-stratification counts.
:::

:::mistake[Deriving the stratum from baseline variables]
`STRAT1R` is not `ECOGBL` renamed. It must come from the IxRS transfer (via SDTM or a sponsor-defined location). A program that recodes `ECOGBL` into `STRAT1R` hides every mis-stratification.
:::

:::mistake[Testing baseline balance with p-values]
A table of baseline p-values invites the reader to "adjust" for whatever happens to be significant. CONSORT and most sponsors advise against it for randomized trials. Adjustment covariates are prespecified in the SAP.
:::

:::mistake[Treating unused list slots as data]
The list has 960 slots for 420 subjects. Only slots linked to a randomized subject (by `RAND_NO`) are data. Merging the full list into ADSL creates hundreds of phantom rows.
:::

## Knowledge check

::quiz{ids="trials.randomization.concealment-vs-blinding,trials.randomization.block-count,trials.randomization.next-assignment,trials.randomization.strata-source"}

## Hands-on exercise

::practice{ids="trials.randomization.max-imbalance,trials.randomization.block-code" title="Practice: blocks, strata and imbalance"}

## Challenge exercise

::practice{ids="trials.randomization.strata-qc,trials.randomization.block-size-risk" title="QC and design review: stratification in practice"}

## Industry note

- **Who generates the list?** Usually an unblinded statistician (not on the study team) or the IxRS vendor, from a signed randomization specification. The study team sees only dummy lists until unblinding.
- **Reconciliation matters.** Data management reconciles IxRS against EDC (randomization dates, strata, kits dispensed). Programmers often write these checks.
- **Strata in the SAP.** Expect the SAP to say which stratification values are used, how sparse strata are handled (for example, pooling if a stratum has too few events), and what sensitivity analyses use CRF values.

:::interview[Why stratify randomization, and what does that mean for the analysis?]
"Stratification guarantees balance on a few strong prognostic factors within the trial, which chance alone doesn't guarantee in subgroups — for CBX-417 that's ECOG and prior immunotherapy. It's implemented with permuted blocks within each stratum through IxRS, with the sequence concealed. Because randomization was restricted within strata, the analysis should account for them: a stratified log-rank test and a stratified Cox model using the strata as randomized. Ignoring them usually makes the test conservative and loses power. I'd also report mis-stratified subjects and run a sensitivity analysis with the CRF values if the SAP requires it."
:::
