## What problem are we trying to solve?

Imagine CBX417-301's analysis package has gone out the door. Six weeks later, four questions come back from the reviewer:

> 1. Table 14.1.2 reports N = 210 for the CBX-417 arm and Table 14.3.1.1 reports N = 209. Please explain the discrepancy.
> 2. `ADSL` contains 420 subjects. The disposition table reports 468 screened. Please provide the analysis records for the 48 missing subjects.
> 3. `ADSL.STRAT1R` disagrees with `ADSL.ECOGBL` for 16 subjects. Please confirm which is correct and whether the primary analysis is affected.
> 4. `ADRS` contains derived `BOR` and `CBOR` records and no `DTYPE` variable. Please clarify.

Every one of those has a one-sentence answer, and your team already knows all four:

1. The first is the ITT population by planned treatment; the second is the safety population by actual treatment, and three subjects received a kit they were not randomized to.
2. Screen failures are never in ADaM. Those counts come from SDTM `DM` and `DS`.
3. `STRAT1R` is the value the IxRS used at randomization, which is the partition the allocation respected. A sensitivity analysis on the CRF values is reported separately.
4. The derived values were given their own `PARAMCD` values, so no parameter mixes observations with derivations and `DTYPE` has nothing to distinguish.

**Four sentences. Nobody wrote them down, so each one is now a formal information request, a meeting, a response document and several weeks of elapsed time.**

The Analysis Data Reviewer's Guide is the document where those four sentences live. It is written by the sponsor, it accompanies the analysis datasets, and its entire job is to answer — before they are asked — the questions a competent stranger will have about data they did not build.

:::why[If the answers are already in define.xml and the SAP, why does a third document exist?]
Because those two answer different questions, and none of the four above is one of them.

**Define-XML answers "what is this variable?"** — one entry per variable per dataset, with its label, type, codelist, origin and derivation. It is machine-readable, exhaustive, and organised by variable. Ask it why two tables have different denominators and it has nothing to say, because the answer is not a property of any single variable.

**The SAP answers "what analyses will be run, and why?"** — written and signed before unblinding, in the language of estimands and statistical methods. It says the safety population is subjects who received at least one dose. It does not say that on this study that is 416 subjects, or that three of them are in a different column than they are in the efficacy tables.

**The ADRG answers "why does this look wrong?"** It is prose, it is organised by the reviewer's confusion rather than by the data model, and it is the only one of the three that is allowed to say *"you will notice X; here is why X is correct."*
:::

## Intuition

An ADRG is a **defect report you write about your own data, for things that are not defects.**

That framing gets the tone right. Every entry in it is something a reviewer will find, stop at and wonder about. Your job is to reach each of those places first and leave a note.

The test for whether something belongs is simple: **would a competent person who did not build this data be surprised by it?** If yes, it goes in — whether it came from the protocol, the SAP, a data-quality event, a standards decision or a limitation you could not fix.

:::why[Why does the ADRG's *order* matter as much as its content?]
Because a reviewer reads it while looking at something specific, not from the beginning.

The community template's section order is not arbitrary. It runs from the general to the particular: what the study was, what the datasets are, what conventions hold across all of them, which individual derivations need explaining, what depends on what, how to trace a value, and finally what the conformance checks flagged.

A reviewer who is puzzled by a number in ADAE starts at the cross-dataset conventions, because that is where an unfamiliar rule most often lives — study day with no day 0, flags that are `Y` or null rather than `Y`/`N`, the data cutoff. Only if that does not explain it do they go to the dataset-specific section.

Putting a cross-dataset convention in a dataset-specific section is the most common structural mistake, and it costs the reviewer the same time as not writing it at all.
:::

## Clinical context

::doc{id="adrg-excerpt" label="Open the CBX417-301 Analysis Data Reviewer's Guide excerpt"}

Read section 4 of that document before going further. Six numbered sentences, none of them longer than three lines, each one closing off a question that would otherwise become a query.

:::standard{kind=official}
**The ADRG is a sponsor deliverable, not a CDISC standard.** CDISC publishes ADaM and Define-XML; the Analysis Data Reviewer's Guide is a document *about* a study's analysis datasets, written by the sponsor to accompany them.

FDA's **Study Data Technical Conformance Guide** describes the study data package and recommends preparing an ADRG alongside the analysis datasets and their define.xml. The widely used section structure comes from a **PHUSE** working-group template; FDA prefers but does not require the PHUSE templates. PHUSE is an independent, not-for-profit community organisation — its deliverables are not regulations.

Say "the TCG recommends an ADRG", not "FDA requires an ADRG". The distinction gets noticed in interviews.
:::

:::standard{kind=simplification}
The document in this app is an **educational excerpt** describing a **synthetic** study. It is written in the spirit of the community template with original wording, and it is not a submission, not reviewed by anyone and not evidence that these datasets would pass anything. Nothing in this lesson should be read as a statement about what a particular real submission requires.

What it is good for is the thing that matters here: seeing what the sentences look like, and how short they are.
:::

The sections, and what each one has to contain that nothing else does:

| Section | Contains | Why not elsewhere |
|---|---|---|
| Purpose | What the guide is for and what it does not repeat | — |
| Study in brief | Design, population, endpoints in one paragraph | The protocol is 200 pages |
| Dataset overview | One line per analysis dataset: structure, purpose, key variables | define.xml is per-variable, not per-dataset |
| **Cross-dataset conventions** | Rules that hold everywhere | No variable's metadata can state a rule about all variables |
| **Derivations needing explanation** | The non-obvious ones, in prose | define.xml gives the method; this gives the reason |
| **Data dependencies** | What must be built before what | Nothing else records build order |
| **Traceability** | How to walk a table cell back to a CRF field | The chain crosses datasets |
| **Conformance findings** | What the rules flagged, and why each is correct | A rule engine cannot know your study |

## Formal concept

### The three things only the ADRG can say

**1. Conventions that hold across every dataset.** `ADY = ADT − TRTSDT + 1` with no day 0. Subject-level flags `Y`/`N`, record-level flags `Y` or null. `ADTTE.AVAL` in days, converted to months with 30.4375. Nothing after the 31 March 2025 cutoff. Each of these is a property of the *package*, and Define-XML has no place to put a statement about all datasets at once.

**2. Why a derivation is the way it is.** Define-XML carries the method for `STRAT1R`: the IxRS stratum value. It does not carry the sentence that matters — that this disagrees with the CRF for 16 subjects, that the disagreement is expected, and that the analysis uses the IxRS value because that is the partition randomization balanced within.

**3. What depends on what.** `ADTTE` needs progression dates from `ADRS`, randomization and last-known-alive dates from `ADSL`, and subsequent-therapy dates from SDTM `CM`. So `ADTTE` is built after `ADRS`, and a reviewer who wants to reproduce a censoring decision needs three datasets rather than one. Nothing in the data records that order.

### Conformance findings you explain rather than fix

A conformance rule engine applies generic rules to your specific study. Some of what it flags is correct data that the rules could not anticipate.

CBX417-301's documented findings:

| Finding | Why it is not fixed |
|---|---|
| Dictionary code variables absent for coded terms | MedDRA and WHODrug are licensed; the synthetic data carry realistic term text without codes |
| `TR` contains only `SUMDIAM`; `TU` is absent | Deliberate simplification of the tumour data model, also documented in the SDTM specification |
| Several baseline disease characteristics live in `SUPPDM` | Simplification; a production implementation would use `MH`, `SU`, `CM` and a findings domain |
| `ADLB` includes local laboratory results | Retained deliberately; by-visit summaries use central records only, per the SAP |

:::why[Why would anyone ship a dataset with a known conformance finding?]
Because for some findings, the flagged state is the correct one and "fixing" it destroys information.

Take the local laboratory results. A rule that expects one result per test per visit sees duplicates. Deleting the local records would make the finding disappear and would also delete the only laboratory data that exists for subjects tested at a site during a central-lab outage. The right response is to keep them, restrict the by-visit summaries to central records with `ANL01FL`, and write one sentence saying so.

**The real test is not whether you have findings. It is whether you can write the sentence.**

- If the explanation is *"the standard could not anticipate this, and here is the specific reason"* — that is an explained finding, and it makes the package more trustworthy, not less.
- If the explanation is *"we did not have time"* or *"the previous study did it this way"* — that is a defect with a paragraph wrapped around it, and a reviewer will read it exactly that way.

**"We have no conformance findings" is a claim nobody believes**, and it is usually produced by not running the checks, by running them with the wrong configuration, or by suppressing categories. A reviewer who finds an unlisted finding now has a reason to doubt every other statement in the document.
:::

### Writing it exposes weaknesses in your own work

The dependency section is the one that hurts.

Writing "`ADTTE` depends on `ADRS`, `ADSL` and SDTM `CM`; programs run in the order ADSL → the BDS and OCCDS datasets → ADTTE → outputs" requires that such an order exists and is the one the programs actually use. Teams discover at this point that two programs read each other's output, that a dataset is built from a spreadsheet nobody owns, or that the run order lives in one person's memory.

The traceability section is the second. The claim is: *table cell → the analysis records the population and analysis flags selected → `SRCSEQ` → the SDTM record → the annotated CRF field*. Write that sentence and then try to walk one number along it.

::widget{name="trace-value" tlf="pfs-summary"}

:::number[The chain for one cell, and where it breaks]
Take "155 events" in the CBX-417 column of the PFS summary.

| Step | What you need | CBX417-301 |
|---|---|---|
| Cell → records | The population and the filter | `ADTTE`, `PARAMCD = "PFS"`, `CNSR = 0`, `TRTP = "CBX-417 + Docetaxel"` |
| Records → source | `SRCDOM`, `SRCVAR`, `SRCSEQ` on each | `RS` for 377 PFS records, `DS` for 43 |
| Source → collection | The annotated CRF | The tumour assessment page, or the death report |

**Two things are worth noticing, and both belong in the guide.**

First, `SRCDOM` takes more than one value in the same dataset, because a PFS analysis date can be a scan, a death or a randomization milestone. A reviewer who joins `SRCSEQ` to `RS` resolves 377 of 420 records and silently gets nulls for the rest. One sentence prevents that.

Second, the chain does not reach the CRF everywhere. Subject `CBX417-301-1002-0001`'s week-36 response is `PD` because of a new lesion, and this study's SDTM carries only the sum of diameters and the investigator's overall response — so a reviewer recomputing the response from `TR` gets stable disease. The simplification is documented; the point is that you find it by trying to walk the chain, not by thinking about it.
:::

## Worked example

The four reviewer questions, and the sentences that would have prevented them.

| # | Question | ADRG section | The sentence |
|---|---|---|---|
| 1 | 210 versus 209 | 4, conventions | Efficacy analyses use planned treatment, safety analyses use actual treatment; they differ for three subjects affected by dispensing errors, who therefore appear in different columns in efficacy and safety tables |
| 2 | 420 versus 468 | 3, overview | `ADSL` contains only randomized subjects; screening counts in the disposition table come from SDTM `DM` and `DS` |
| 3 | `STRAT1R` versus `ECOGBL` | 5.1, derivations | Stratified analyses use the IxRS values, matching how randomization was performed; reviewers comparing the two variables will find discordant subjects by design, and a CRF-based sensitivity analysis is reported separately |
| 4 | Derived records, no `DTYPE` | 5.7, derivations | `BOR` and `CBOR` are separate parameters rather than derived records within a parameter, so no parameter mixes observed and derived analysis values |

**Notice what the sentences have in common.** Each one names the thing the reviewer is looking at, states that it is intended, and gives the reason in the same breath. None of them explains ADaM, none restates the SAP, and none is longer than three lines.

**And notice what makes them possible.** Every one is a fact somebody on the team knew in the week the derivation was written. The ADRG is not hard to write; it is hard to write *six months later*, from memory, by a person who was not there — which is when most of them get written.

:::why[What happens to the ADRG when a derivation changes after it is drafted?]
It goes stale, and stale is worse than absent.

Suppose the SAP's censoring rules are clarified before lock and three subjects move from `CNSR = 4` to `CNSR = 0`. The ADRG's section 5.6 still describes the old rule order; its counts, if it quoted any, are now wrong.

A reviewer who reads a sentence that the data contradict does not conclude that the sentence is out of date. They conclude that the document was not checked, and they start verifying things they would otherwise have accepted.

**The defence is to generate every number in the document rather than typing it.** The dataset overview, the population counts, the censoring distribution — all of it comes out of a program that runs against the final data, and the document is assembled around that output. A count that was typed once is a count that will be wrong once.
:::

## Code

The numbers an ADRG quotes are claims about the data. Turn each claim into an assertion and run it on the final build, so the document cannot drift from what it describes.

::::tabs
:::tab[R]
```r
library(dplyr)

adam <- list(ADSL = adsl, ADAE = adae, ADLB = adlb, ADVS = advs,
             ADEG = adeg, ADRS = adrs, ADTR = adtr, ADTTE = adtte)

overview <- tibble::tibble(
  dataset  = names(adam),
  records  = vapply(adam, nrow, integer(1)),
  subjects = vapply(adam, function(d) dplyr::n_distinct(d$USUBJID), integer(1))
)

stopifnot(
  nrow(adsl) == 420,
  sum(adsl$TRT01A != "" & adsl$TRT01P != adsl$TRT01A) == 3,
  all(adsl$SAFFL %in% c("Y", "N")),
  all(adae$TRTEMFL %in% c("Y", "")),
  sum((adsl$STRAT1R == "ECOG 0") != (adsl$ECOGBL == 0)) == 16,
  identical(as.integer(table(adtte$CNSR[adtte$PARAMCD == "PFS"])),
            c(332L, 36L, 9L, 28L, 15L)),
  setequal(adtte$USUBJID[adtte$PARAMCD == "DOR"],
           adrs$USUBJID[adrs$PARAMCD == "CBOR" & adrs$AVALC %in% c("CR", "PR")])
)
```

:::lines
6-10: The dataset overview table of ADRG section 3, generated rather than typed. Re-run it on every build and assemble the document around the output.
13: Section 3's claim that `ADSL` holds only randomized subjects.
14: Section 4.1's claim that planned and actual treatment differ for **three** subjects. The `TRT01A != ""` guard matters: without it the four never-dosed subjects also count and the assertion reports 7.
15-16: Section 4.2's claim about flag conventions — subject-level `Y`/`N`, record-level `Y` or null. The second condition allows only `"Y"` and blank, which is what "never `N`" means in data.
17: Section 5.1's claim that `STRAT1R` and `ECOGBL` disagree for **16** subjects. The comparison is on the stratum definition — ECOG 0 against everything else — not on the raw values, because the 14 subjects with a baseline ECOG of 2 belong in the ECOG 1 stratum and are not discordant.
18-19: Section 5.6's claim about the PFS censoring distribution, as one ordered comparison.
20-21: Section 6's dependency claim, expressed as a consequence a reviewer can check: every confirmed responder in `ADRS` has a `DOR` record in `ADTTE`, and nobody else does.
:::
:::

:::tab[SAS]
```sas
proc sql;
  create table overview as
  select memname as dataset length=8,
         nobs    as records
  from   dictionary.tables
  where  libname = 'ADAM' and memname like 'AD%'
  order by memname;
quit;

proc sql noprint;
  select count(*) into :n_adsl   from adam.adsl;
  select count(*) into :n_disp   from adam.adsl
         where not missing(trt01a) and trt01p ne trt01a;
  select count(*) into :n_strat  from adam.adsl
         where (strat1r = 'ECOG 0') ne (ecogbl = 0);
  select count(*) into :n_badflg from adam.adsl
         where saffl not in ('Y', 'N');
quit;

%if &n_adsl ne 420 or &n_disp ne 3 or &n_strat ne 16 or &n_badflg ne 0
  %then %put ERROR: ADRG statements no longer match the data;
```

:::lines
1-7: `DICTIONARY.TABLES` gives the record count of every dataset in the library without reading any of them, which is the cheap half of the overview table. Subject counts still need one pass over each dataset.
6: `memname like 'AD%'` picks up any dataset added later, so a new analysis dataset appears in the overview without anyone remembering to add it.
12-13: The dispensing-error count behind ADRG section 4.1. `not missing(trt01a)` excludes the four never-dosed subjects, whose null actual treatment is not a discordance.
14-15: The mis-stratification count behind section 5.1, written as a comparison of two boolean expressions — SAS evaluates each to 0 or 1 and `ne` compares the results.
20-21: Failing the job rather than writing a note. A document that quietly stops matching its data is the failure mode this exists to prevent.
:::
:::
::::

## Output

```text
# A tibble: 8 × 3
  dataset records subjects
  <chr>     <int>    <int>
1 ADSL        420      420
2 ADAE       2466      414
3 ADLB      25443      420
4 ADVS      16965      420
5 ADEG       3734      420
6 ADRS       2768      420
7 ADTR       2736      420
8 ADTTE       929      420
```

Eight datasets, and one row that is a sentence on its own: **ADAE has 414 subjects, not 420.** Four subjects were never dosed and two dosed subjects reported no adverse event at all. A reviewer counting distinct subjects in ADAE and comparing it to the safety population of 416 finds a gap of two — so the guide says, in advance, that two subjects in the safety population have no adverse event record and still belong in the denominator.

## Common mistakes

:::mistake[Restating define.xml in prose]
A section that walks through every variable's derivation duplicates the machine-readable metadata, in a form nobody can query, that goes stale independently. The ADRG explains the *non-obvious* ones and says why, and points at define.xml for the rest.
:::

:::mistake[Restating the SAP]
The ADRG is not a summary of the statistical methods. The reviewer has the SAP. What they do not have is the mapping from the SAP's sentences onto this study's data — that the safety population is 416 subjects, that three of them are in a different column in the safety tables, that nine subjects were censored on day 1.
:::

:::mistake[Writing it after database lock, from memory]
Every fact in an ADRG was known by somebody in the week the derivation was written. Writing it six months later means reconstructing the reasons, and reconstructed reasons are the ones that turn out to be wrong. Draft it alongside the specifications and update it when they change.
:::

:::mistake["No conformance findings"]
Almost always means the checks were not run, were run with the wrong configuration, or had categories suppressed. A reviewer who finds an unlisted finding stops trusting the rest of the document, which costs far more than listing four explained ones.
:::

:::mistake[Typing the numbers]
Every count in the guide is a claim about the final data. Generate them, assert them on each build, and rebuild the document from the output. A typed number is right on the day it is typed.
:::

:::mistake[Putting a cross-dataset convention in a dataset section]
"There is no day 0" belongs in the conventions section, because it is true of `ADLB`, `ADVS`, `ADEG`, `ADRS`, `ADTR`, `ADAE` and `ADTTE`. Buried in the ADAE paragraph, it does not help the reviewer who is puzzled by a study day in `ADLB`.
:::

:::mistake[Claiming more than the document can support]
An ADRG describes analysis datasets; it does not certify them. "Submission-ready", "validated" and "FDA-approved" are not statements a sponsor's own reviewer guide can make about itself, and a document that opens with one reads as marketing rather than documentation.
:::

## Knowledge check

::quiz{ids="adam.adrg.three-documents,adam.adrg.explain-not-fix,adam.adrg.no-findings,adam.adrg.overclaim"}

## Hands-on exercise

::practice{ids="adam.adrg.route-the-facts,adam.adrg.write-the-sentence,adam.adrg.assert-code,adam.adrg.stale-count" title="Practice: routing facts to the right document"}

## Challenge exercise

::practice{ids="adam.adrg.dependency-audit,adam.adrg.open-inherit" title="Challenge: the dependency section you cannot write"}

## Industry note

**The ADRG is usually the last thing written and the first thing read.** A reviewer opening an unfamiliar analysis package reads the guide before the data, because it tells them what to expect. Being produced last, under schedule pressure, by whoever is free, is the single biggest quality problem with the artifact — and the fix is structural: draft it beside the specifications, not after the datasets.

**Writing it is the cheapest review your derivations will get.** The act of explaining a derivation to a stranger surfaces the ones you cannot explain. Teams routinely find, while drafting section 5, that a rule has two readings, or that the reason for a choice is "that is how the previous study did it". That is a better time to find it than during a reviewer's information request.

**It is also a career-visible piece of work.** Datasets are judged by programmers; the reviewer guide is read by statisticians, regulatory affairs and medical writers, and it is one of the few programming deliverables whose quality is legible to people outside the function. Being the person who can write a clear one is disproportionately valuable.

**Say what is true about requirements.** The TCG *recommends* an ADRG; FDA *prefers* but does not require the PHUSE templates; which standard versions apply depends on the Data Standards Catalog at the study's start date. Overstating any of these is the fastest way to lose credibility in an interview, and it is equally damaging in a sponsor meeting.

:::standard{kind=convention}
The section numbering used throughout this lesson — purpose, study in brief, dataset overview, conventions, derivations, dependencies, traceability, conformance, programs — follows the community template that most sponsors start from. It is a convention and a good one, not a requirement. Sponsors add sections for study-specific concerns, and an ADRG organised differently but clearly is a better document than one that fits the template and buries the answer.
:::

:::interview[What goes in an ADRG, and how is it different from define.xml?]
"Define.xml answers *what is this variable* — one entry per variable, with its origin, codelist and derivation method, machine-readable and exhaustive. The ADRG answers *why does this look wrong* — prose, organised around what a reviewer will stop at.

The way I'd test whether something belongs is: would a competent person who did not build this data be surprised by it? If yes, it goes in.

**On the study I worked with, four things met that test.** The demographics table says N = 210 and the adverse event table says 209, because efficacy uses planned treatment and safety uses actual, and three subjects received a kit they were not randomized to. ADSL has 420 subjects while the disposition table reports 468 screened, because screen failures are never in ADaM. The as-randomized stratification variable disagrees with the CRF baseline ECOG for 16 subjects, which is intended, and there is a separate sensitivity analysis on the CRF values. And the response dataset has derived records and no `DTYPE`, because the derived values were given their own parameter codes.

Each of those is one sentence. Without it, each is an information request and several weeks.

**Then the three things only the ADRG can carry.** Conventions that hold across every dataset — no day 0, subject-level flags `Y`/`N` and record-level flags `Y` or null, days converted to months with 30.4375, the data cutoff. Why a derivation is the way it is, as opposed to what it does, which define.xml already has. And the dependencies and build order, which nothing in the data records — time-to-event has to be built after the response dataset because it needs the progression dates.

**On conformance findings, the position I'd take** is that having none is not the goal and is not believable. Some findings are the correct state: licensed dictionary codes that cannot be submitted, local laboratory records kept deliberately and excluded from the by-visit summaries by an analysis flag. The test is whether you can write the sentence that explains it. 'The standard could not anticipate this, and here is why' is an explained finding. 'We ran out of time' is a defect with a paragraph around it, and a reviewer reads it that way.

**And the practical thing I'd insist on** is that every number in the document is generated by a program that runs on the final build, not typed. A guide whose counts contradict the data is worse than no guide, because the reviewer stops trusting the sentences too — and those sentences were the whole point.

One thing I'd be careful about in how I describe it: the Technical Conformance Guide *recommends* an ADRG and FDA *prefers* the PHUSE templates without requiring them. It is a sponsor deliverable that explains the data, not a certification of it."
:::
