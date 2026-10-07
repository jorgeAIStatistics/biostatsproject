## What problem are we trying to solve?

Your manager read something over the weekend and asks: *"Can we do the next study's ADaM in R? I gather the FDA accepts R now."*

Three things are wrong with the question, and answering it well is most of what this lesson is for.

**"The FDA accepts R"** is not a thing regulators say. FDA's published position is that it does not require any particular statistical software; what it requires is that the software produces reliable results and that the sponsor can supply the documentation and code behind them. That is a statement about evidence, not about a language.

**"Do ADaM in R"** understates the work. The ADaM *values* are dplyr, and you already know how to write them. What you do not get for free is everything around them: labels, lengths, types, formats, the define.xml metadata, and a SAS transport file that a reviewer's tools can open.

**"Can we"** is a question about your organisation, not about R. Which packages are installed on the validated environment, who signs off that they behave correctly, and what your SOP says.

This lesson is an honest map of the pharmaverse — what each package is for, how mature it is, and what the regulatory situation actually is.

## Intuition

The pharmaverse is **not a framework**. It is a set of independent R packages, contributed by several pharmaceutical companies and maintained in the open, that each cover one stage of the clinical reporting pipeline. You can adopt one and ignore the rest, and most organisations do exactly that.

::widget{name="lifecycle-map" highlight="adam"}

| Stage | Package | What it does |
|---|---|---|
| Example SDTM data | `pharmaversesdtm` | Public SDTM datasets to write examples and tests against |
| Read the spec | `metacore` | Loads dataset specifications into an R object you can query |
| Build to the spec | `metatools` | Uses that metadata to select variables, apply codelists and check conformance |
| Derive ADaM | `admiral` | A library of derivation functions for common ADaM patterns |
| Therapeutic extensions | `admiralonco`, `admiralophtha`, and others | Oncology-, ophthalmology- and other area-specific derivations |
| Write transport files | `xportr` | Applies labels, lengths, types and formats, then writes XPT v5 |
| Build tables | `rtables` + `tern`, or `Tplyr` | Two different families for counts and summary statistics |
| Format tables | `gt`, `tfrmt` | Rendering and format specifications |
| Assess package risk | `riskmetric` | Scores a package against maintenance and testing metrics |

:::why[Why is there a whole package just for writing a file?]
Because the file format is a 1990s one and it has hard limits that an R data frame knows nothing about.

FDA's *Study Data Technical Conformance Guide* specifies **SAS Transport Format (XPORT) Version 5** for study data submitted in eCTD. That format constrains:

| | Limit |
|---|---|
| Variable name | 8 characters |
| Variable label | 40 characters |
| Dataset name | 8 characters |
| Character variable value | 200 bytes |

An R data frame has none of those concepts. It has no variable labels at all, no declared character lengths, and no formats. `write_xpt()` will happily write a file from a data frame with none of that metadata, and the result passes as a file and fails as a submission dataset.

**`xportr` exists to be the step between the two**: it takes a specification, applies the label, length, type, format and variable order to each column, checks the limits, and then writes. What it is really doing is carrying your define.xml metadata into the file.
:::

## Clinical context

Where each package earns its place, and where it does not.

| Question | Honest answer |
|---|---|
| "Should we use admiral for ADaM?" | If your derivations are standard and your team is new to R, yes — it encodes patterns you would otherwise write and debug yourself. If your SAP is unusual, you will use dplyr for most of it anyway. |
| "Should we use xportr?" | If you are producing XPT for a submission or a partner, yes. It is the narrowest and least controversial of these packages. |
| "rtables or Tplyr?" | Different designs, both used in production. Choose one per organisation and stop, because the cost is retraining, not correctness. |
| "Is admiral validated?" | Not a meaningful question as asked. Packages are not validated in the abstract; **your use of them in your environment** is what gets qualified, under your SOP. |

:::mistake[Treating a package's popularity as validation]
"It's used by lots of big pharma companies" is not a validation argument and it will not survive an audit question.

What an inspector asks is: which version of which package was used, how do you know it does what you think, what evidence do you hold, and can you rebuild the result. That is answered by a **lockfile**, a **qualification record** and a **reproducible program**, not by a GitHub star count.

`riskmetric` exists to support the first half of that conversation. It scores a package against objective metrics — does it have unit tests, is it actively maintained, does it have documentation, how many reverse dependencies — so that the risk assessment is a document rather than an opinion. It does not tell you a package is correct; **it tells you how much evidence you have and where to spend your testing effort.**
:::

## Formal concept

### What `admiral` actually is

A function library over dplyr, not a framework. Its functions take a data frame and return a data frame, and they are named for the ADaM thing they derive:

```r
# conceptually, what admiral's derivation functions look like
adsl <- derive_vars_merged(adsl, dataset_add = ex, by_vars = exprs(USUBJID),
                           new_vars = exprs(TRTSDT = EXSTDT), mode = "first")

adlb <- derive_var_base(adlb, by_vars = exprs(USUBJID, PARAMCD))
adlb <- derive_var_chg(adlb)
```

:::standard{kind="convention"}
`admiral` is a **community-maintained open-source package**, not a CDISC deliverable and not a regulatory requirement. Nothing in ADaMIG v1.3 mentions it, and no regulator requires, endorses or prohibits it. Its function names follow ADaM concepts closely, which is helpful for traceability, but the mapping between a function name and an ADaM variable is the package's design choice rather than a standard.
:::

**The important property is not that it saves typing.** It is that a reviewer reading `derive_var_extreme_flag(..., mode = "last")` sees a named, documented pattern rather than an `arrange()` and a `slice_tail()` whose tie-breaking they have to work out. That is a traceability argument, and it is the strongest one for adopting it.

**The important limitation** is that it only helps where your derivation is one of the patterns it covers. A SAP with an unusual windowing rule or a study-specific censoring hierarchy still gets written by hand, and then the program is half admiral and half dplyr — which is fine, and which is what most real programs look like.

### `metacore` and `metatools` — metadata as an input

The idea is that the dataset specification is a machine-readable object, not a spreadsheet someone reads and then types from.

`metacore` loads a spec — from a define.xml, or from a specification workbook — into an R object with the variables, labels, types, lengths, codelists and derivations. `metatools` then uses it: selecting only the specified variables, checking that every specified variable exists, applying codelists to create decoded columns.

**The value is that the spec and the program cannot drift.** If the spec adds a variable and the program does not produce it, the check fails. If the program produces a variable the spec does not list, you find out at build time rather than at define.xml generation time.

**The cost is that your specification has to be machine-readable in the first place**, which for many organisations is the actual project.

### Two families of table packages

| | `rtables` + `tern` | `Tplyr` |
|---|---|---|
| Model | A table is a tree of splits and analysis functions | A table is a stack of typed layers (count, descriptive statistics, shift) |
| Output | Its own table object, rendered to text/RTF/HTML | A tidy data frame of results, rendered by something else |
| Fits | Teams wanting one object that owns structure and rendering | Teams wanting the numbers as data, then formatted separately |

Neither is more correct. **The `Tplyr` shape — numbers first, formatting second — matches the habit this curriculum keeps pushing**: compute a summary you can QC against, then render it. `gt` and `tfrmt` sit on that side too, with `tfrmt` letting the format itself be a specification rather than code.

`gtsummary` is worth knowing separately: it makes a presentable summary table in one call and is excellent for exploratory work and for a QC document. It is not designed around CSR shells, so it is rarely the tool for a deliverable.

## Worked example

**Check what you actually have before you plan anything around it.**

```r
pkgs <- c("dplyr", "ggplot2", "survival", "admiral", "metacore", "metatools",
          "xportr", "pharmaversesdtm", "Tplyr", "rtables", "tern", "gt",
          "gtsummary", "tfrmt", "riskmetric", "haven")

for (p in pkgs) cat(sprintf("%-16s %s\n", p, requireNamespace(p, quietly = TRUE)))
```

```text
dplyr            TRUE
ggplot2          TRUE
survival         TRUE
admiral          FALSE
metacore         FALSE
metatools        FALSE
xportr           FALSE
pharmaversesdtm  FALSE
Tplyr            FALSE
rtables          FALSE
tern             FALSE
gt               FALSE
gtsummary        FALSE
tfrmt            FALSE
riskmetric       FALSE
haven            FALSE
```

**That output is the normal situation, not an unusual one.** A validated clinical R installation contains what the organisation has qualified, and that is typically a small, slow-moving set. `dplyr`, `ggplot2` and `survival` are there; the pharmaverse packages are a request, a risk assessment and an installation ticket away.

**Which is why the first thing to know about the pharmaverse is how to work without it.** Every derivation admiral performs can be written in dplyr, and the metadata step — the genuinely awkward part — is a few dozen lines of base R.

### Applying a specification by hand

What `metatools` and `xportr` do between them, in base R, on the CBX417-301 ADSL:

```r
spec <- data.frame(
  variable = c("USUBJID", "AGE", "SEX", "TRT01P", "SAFFL"),
  label    = c("Unique Subject Identifier", "Age", "Sex",
               "Planned Treatment for Period 01", "Safety Population Flag"),
  type     = c("text", "integer", "text", "text", "text"),
  length   = c(30L, 8L, 1L, 30L, 1L),
  stringsAsFactors = FALSE
)

apply_spec <- function(d, spec) {
  stopifnot(all(spec$variable %in% names(d)))

  out <- d[, spec$variable, drop = FALSE]
  for (i in seq_len(nrow(spec))) {
    v <- spec$variable[i]
    attr(out[[v]], "label") <- spec$label[i]
    attr(out[[v]], "width") <- spec$length[i]
  }

  list(
    data           = out,
    dropped        = setdiff(names(d), spec$variable),
    name_too_long  = spec$variable[nchar(spec$variable) > 8],
    label_too_long = spec$variable[nchar(spec$label)    > 40]
  )
}
```

```text
> r <- apply_spec(adsl, spec)
> cat("kept:", ncol(r$data), " dropped:", length(r$dropped), "\n")
kept: 5  dropped: 50

> str(r$data$AGE)
 int [1:420] 59 54 63 55 56 47 64 60 52 66 ...
 - attr(*, "label")= chr "Age"
 - attr(*, "width")= int 8

> nchar(attr(r$data$TRT01P, "label"))
[1] 31
```

**Fifty variables were dropped**, because the spec names five. That is `metatools::drop_unspec_vars()`'s behaviour and it is the right default — the spec decides what is in the dataset. It is also the single most dangerous line in this style of program, which is why `dropped` is returned rather than discarded. **A variable silently missing from the delivery is worse than a build failure.**

:::number[Do the CBX417-301 datasets already satisfy the XPT v5 limits?]
On the values, yes; on the metadata, not at all.

| Dataset | Variables | Names > 8 chars | Longest character value |
|---|---:|---:|---:|
| ADSL | 55 | 0 | 45 (`DCTREAS`) |
| ADAE | 46 | 0 | 52 (`AEBODSYS`) |
| ADTTE | 30 | 0 | 73 (`CNSDTDSC`) |
| ADLB | 30 | 0 | 32 (`PARAM`) |

Every variable name is within 8 characters and no character value approaches the 200-byte limit — which is unsurprising, because the variable names come from ADaM and ADaM was designed with the transport format in mind.

**The gap is entirely metadata.** A CSV carries no labels at all:

```r
attributes(adsl$AGE)
#> NULL
```

So a data frame read from CSV has correct values and zero submission metadata. That is the whole job `xportr` automates: labels, lengths, types, formats and variable order, applied from a spec, then written. Nothing about it is conceptually hard, and doing it by hand across forty datasets is exactly the kind of work a package should do.
:::

## Data example

::dataset{id="oncology/adam/adsl" cols="USUBJID,AGE,SEX,TRT01P,SAFFL,ITTFL,EFFFL" rows="6" caption="ADSL — correct values, no labels, no declared lengths"}

## Code

::::tabs
:::tab[R — no pharmaverse]
```r
library(dplyr)

trt_dates <- ex |>
  filter(!is.na(EXSTDTC), EXDOSE > 0) |>
  summarise(TRTSDT = min(as.Date(EXSTDTC)),
            TRTEDT = max(as.Date(EXENDTC), na.rm = TRUE),
            .by = USUBJID)

adsl <- dm |>
  left_join(trt_dates, by = "USUBJID", relationship = "one-to-one") |>
  mutate(TRTDURD = as.integer(TRTEDT - TRTSDT) + 1,
         SAFFL   = if_else(!is.na(TRTSDT), "Y", "N"))

stopifnot(nrow(adsl) == nrow(dm),
          all(adsl$SAFFL %in% c("Y", "N")))
```

:::lines
4: The exposure records that count toward a treatment start — non-missing date and a non-zero dose. Which records qualify is a SAP decision, and writing it as a filter puts it where a reviewer can check it.
10: `relationship = "one-to-one"` turns an unexpected duplicate into an error rather than a silently inflated ADSL.
11: `+ 1` because treatment duration counts both endpoints — the same no-day-zero convention as study day.
14: The assertions. One row per subject in DM, and a flag with only the two values the codelist allows.
:::
:::

:::tab[R — pharmaverse]
```r
library(admiral); library(metatools); library(xportr)

adsl <- dm |>
  derive_vars_merged(
    dataset_add = ex,
    filter_add  = !is.na(EXSTDTC) & EXDOSE > 0,
    by_vars     = exprs(USUBJID),
    new_vars    = exprs(TRTSDT = convert_dtc_to_dt(EXSTDTC)),
    order       = exprs(EXSTDTC),
    mode        = "first"
  ) |>
  derive_var_merged_exist_flag(
    dataset_add = ex, by_vars = exprs(USUBJID),
    new_var = SAFFL, condition = EXDOSE > 0
  )

adsl |>
  drop_unspec_vars(metacore) |>
  xportr_type(metacore)  |> xportr_length(metacore) |>
  xportr_label(metacore) |> xportr_order(metacore)  |>
  xportr_write("adsl.xpt", label = "Subject-Level Analysis Dataset")
```

:::lines
1: **These packages are not installed in this environment**, so this block is shown and explained rather than run. No output is claimed for it.
4-11: `derive_vars_merged()` is the "look something up from another dataset and bring it back" pattern, with the filter, the sort and the first/last choice as named arguments. That is its real contribution: the tie-breaking and the record-selection rule are arguments a reviewer reads, not an `arrange()` they have to reconstruct.
7: `exprs()` wraps unevaluated expressions — admiral's way of passing column references, the same problem embracing solves in a plain dplyr helper.
18: `drop_unspec_vars()` keeps only the variables the specification lists. Powerful and unforgiving: a variable missing from the spec is silently absent from the delivery, so the spec has to be right.
19-20: Each `xportr_*` step applies one piece of metadata from the same spec object — type, length, label, order — and warns where the data and the spec disagree.
21: `xportr_write()` produces the XPT v5 file. This is the step with no reasonable hand-written alternative, and the narrowest reason to adopt any of this.
:::
:::

:::tab[SAS]
```sas
proc sort data=sdtm.ex out=ex_nz;
  where not missing(exstdtc) and exdose > 0;
  by usubjid exstdtc;
run;

data adsl;
  merge sdtm.dm (in=d) ex_nz (in=e keep=usubjid exstdtc rename=(exstdtc=trtsdtc));
  by usubjid;
  if d;
  if first.usubjid;
  trtsdt = input(trtsdtc, yymmdd10.);
  saffl  = ifc(e, 'Y', 'N');
  label trtsdt = 'Date of First Exposure to Treatment'
        saffl  = 'Safety Population Flag';
  format trtsdt yymmdd10.;
run;

libname xptout xport 'adsl.xpt';
proc copy in=work out=xptout memtype=data; select adsl; run;
```

:::lines
9: `if d;` makes it a left join from DM. Without it the step is a full join and subjects with exposure but no DM record would appear.
10: `if first.usubjid;` takes the earliest qualifying exposure, relying on the sort above. A subsetting `IF` after the `BY` is exactly the construct that corrupts `FIRST.`/`LAST.` when it removes records — here it is safe only because the restriction was done in the `WHERE` of the PROC SORT.
13-14: **Labels are a statement in the language.** This is the whole difference: in SAS the submission metadata lives with the data by default, and in R it has to be attached deliberately. That asymmetry is most of why `xportr` exists.
18-19: The `XPORT` libname engine writes transport files natively. There is nothing to install and nothing to qualify, which is a real advantage of SAS in this specific step.
:::
:::
::::

## Interpretation

> The pharmaverse is a set of independent, community-maintained R packages covering the clinical reporting pipeline. Their value is highest at the two ends — **metadata and transport files**, where R genuinely lacks what SAS has by default, and **derivation patterns**, where a named function is more traceable than equivalent hand-written dplyr. In the middle, where the analysis actually happens, R needed no help.

:::clinical
**What the regulatory position actually is**, stated carefully.

FDA has published a clarifying statement on statistical software saying that it does not require the use of any specific software, and that what matters is that the software can produce reliable results and that the sponsor supplies the code and documentation behind the analyses. That is the sentence people compress into "FDA accepts R", and the compression loses the part that matters: **the obligation is on the sponsor to evidence the result, not on the tool to be blessed.**

Separately, the *Study Data Technical Conformance Guide* does impose a concrete technical requirement: study data submitted in eCTD go in SAS Transport (XPORT) Version 5 format. That is a **file format** requirement, not a software requirement — R can write it, which is what `xportr` and `haven::write_xpt()` do.

**Submissions containing R-based analyses have been made.** The R Consortium's R Submissions Working Group has run a series of public pilot submissions to the FDA specifically to demonstrate that it works end to end, and the materials and correspondence are published. What those pilots establish is that **the mechanics are viable** — the files transfer, the code runs, reviewers can reproduce the results. They are not an approval of a language, and they do not remove any of your organisation's obligations.

The practical constraint in almost every organisation is not the regulator. It is the validated environment, the SOP, and who is qualified to review the code.
:::

## Common mistakes

:::mistake[Saying "FDA accepts R"]
No regulator endorses a statistical language. FDA's published position is that it does not require specific software and that the sponsor must be able to supply reliable results with the code and documentation behind them. Saying otherwise in an interview signals that you have read a headline rather than the source.
:::

:::mistake[Assuming the pharmaverse packages are installed]
On a validated clinical installation they usually are not. Check with `requireNamespace()` before designing anything around them, and expect the answer to be a risk assessment and a ticket rather than an `install.packages()` call.
:::

:::mistake[Treating a package's adoption as its validation]
Who uses it is not evidence about whether it is correct. `riskmetric` gives you objective metrics — tests, maintenance, documentation — to build a risk assessment with; your qualification of your use of it in your environment is what an auditor asks about.
:::

:::mistake[Using `drop_unspec_vars()` without checking what was dropped]
Keeping only the specified variables is the right default and it makes a spec error into a silently missing variable in the delivery. Return and review the dropped list; here a five-variable spec dropped fifty columns without complaint.
:::

:::mistake[Reaching for admiral before you can write the derivation]
admiral encodes patterns. If you cannot write the pattern in dplyr, you cannot tell whether the function did what the SAP asked, and a QC programmer's first question will be which records `mode = "first"` selected and how ties were broken.
:::

## Knowledge check

::quiz{ids="r.pharma.fda-position,r.pharma.xportr-why,r.pharma.package-roles,r.pharma.validation"}

## Hands-on exercise

::practice{ids="r.pharma.xpt-limits,r.pharma.metadata-gap,r.pharma.spec-apply,r.pharma.admiral-equivalent" title="Practice: metadata, limits and the dplyr equivalent"}

## Challenge exercise

::practice{ids="r.pharma.adoption-case,r.pharma.open" title="Challenge: making the case, honestly"}

## Industry note

**Adoption is uneven and mostly partial.** The common pattern is not "we moved to R" — it is a group using R for figures and exploratory work while ADaM and TLFs stay in SAS, or a group using R for QC against SAS production. Full R-based delivery exists and is a minority. Anyone describing the industry as having switched is describing their own team.

**The narrow, uncontroversial entry points** are figures, QC programming and exploratory analysis. None of them produce a submission artefact directly, so none of them require a validated pipeline to start, and all of them build the skills and the evidence that a wider adoption argument needs.

:::standard{kind="official"}
FDA's *Statistical Software Clarifying Statement* sets out that the agency does not require the use of any specific software for statistical analysis, and that the software used must be able to produce reliable results with the sponsor supplying the supporting code and documentation. FDA's *Study Data Technical Conformance Guide* separately specifies SAS Transport (XPORT) Version 5 as the format for study data in eCTD submissions. Neither document endorses or prohibits R, SAS or any other language. Check the current version of both before quoting them; guidance documents are revised.
:::

**The R Validation Hub** is the cross-industry effort on this problem. Its output is a risk-based framework for assessing R packages — the argument being that a package with unit tests, active maintenance, documentation and wide reverse-dependency use carries less risk than one without, and that this can be assessed systematically rather than case by case. `riskmetric` is its implementation. This is the material to read before you have the conversation with quality assurance, because it gives you their vocabulary.

:::interview[Would you recommend we move our ADaM programming to R?]
"I'd want to separate the question into three, because they have different answers.

**Can it be done?** Yes, and it is being done. The derivations are dplyr and you already have them. The part R does not give you for free is the submission metadata — labels, lengths, types, formats — which SAS attaches by default and R has no native concept of. `xportr` covers that, and it is the narrowest and least controversial of the pharmaverse packages. FDA's Study Data Technical Conformance Guide requires XPORT v5 for study data in eCTD, which R can write, and FDA's own clarifying statement on software says the agency does not require any specific software — what it requires is reliable results with the code and documentation behind them. So the obligation is on us to evidence the output, not on the tool to be approved.

**Should we?** That depends on things that have nothing to do with R. What is on the validated environment, who can review the code, what the SOP says about qualifying a package, and whether we have enough R-fluent programmers that this is not a single-person dependency. I would not start with ADaM. I would start with figures and QC programming, because neither produces a submission artefact directly, both build the skill base, and both generate the evidence for a wider case.

**What would it cost?** Mostly the metadata work. If our specifications are spreadsheets that a person reads and types from, then `metacore` and `metatools` do not help until the specs are machine-readable, and making them machine-readable is the actual project. That is worth doing on its own merits, and it is a bigger piece of work than learning admiral.

One thing I would push back on. I would not claim that admiral being widely used is a validation argument, because it is not one an auditor will accept. The question they ask is which version we used, what evidence we hold that it behaves correctly, and whether we can rebuild the result. That is a lockfile, a risk assessment — `riskmetric` and the R Validation Hub framework give a defensible way to do that — and a reproducible program. The language is the least interesting part of the answer."
:::
