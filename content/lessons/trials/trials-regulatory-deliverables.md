## What problem are we trying to solve?

Imagine CBX417-301 were a real study heading into a marketing application. The lead programmer shares the deliverables checklist for the study data package:

> SDTM datasets (XPT) + define.xml + acrf.pdf + csdrg.pdf; ADaM datasets (XPT) + define.xml + adrg.pdf; ADaM and efficacy TLF programs as text; CSR with Section 14 tables and Appendix 16 listings.

A new team member asks the questions every programmer eventually needs to answer:

- Which of these are **required**, which are **recommended**, and which are just **how our company does it**?
- Why does the reviewer need define.xml *and* a reviewer's guide *and* an annotated CRF?
- The study started in 2022. Does it have to use SDTMIG v3.4?

Getting these right matters: regulators can reject a submission on technical grounds before anyone reads it, and misstatements about requirements ("FDA requires…") undermine credibility in interviews and on the job.

## Intuition

A regulatory reviewer receives your study as a package and must be able to (1) read the story, (2) find any data point, (3) understand every derivation, and (4) reproduce the key results — without calling you.

- The **CSR** tells the story (ICH E3 structure), with tables, figures and listings.
- **SDTM** lets the reviewer find what was collected; the **aCRF** shows where each CRF field went.
- **ADaM** lets the reviewer rerun the analyses; the **programs** show exactly how.
- **Define-XML** is the machine-readable data dictionary for both.
- **Reviewer's guides** (cSDRG, ADRG) explain in plain language what metadata cannot: special cases, conformance issues, design choices.

Each artifact answers a different reviewer question. Together they make the submission **traceable**: from a number in the CSR back to the raw collection.

## Clinical context

The deliverables of a study like CBX417-301 and who produces them:

| Deliverable | Content | Produced by |
|---|---|---|
| Clinical study report (CSR) | ICH E3 structure: synopsis, methods, results, discussion; Section 14 TLFs; Appendix 16 | Medical writing + statistics + programming |
| SDTM datasets (`.xpt`) | Tabulation of collected data | Programming |
| Annotated CRF (`acrf.pdf`) | Blank CRF annotated with SDTM variables | Programming / data management |
| SDTM define.xml | Metadata for SDTM datasets | Programming |
| cSDRG (`csdrg.pdf`) | Clinical Study Data Reviewer's Guide | Programming |
| ADaM datasets (`.xpt`) | Analysis datasets | Programming |
| ADaM define.xml | Metadata for ADaM, including derivations | Programming |
| ADRG (`adrg.pdf`) | Analysis Data Reviewer's Guide | Programming + statistics |
| Programs (ASCII text) | Code for ADaM datasets and primary/secondary efficacy TLFs | Programming |

The document library contains educational excerpts of several of these for CBX417-301:

::doc{id="adrg-excerpt" label="CBX417-301 ADRG excerpt"}

## Formal concept

### ICH E3: the CSR

:::standard{kind="official" source="ICH E3 Structure and Content of Clinical Study Reports"}
ICH E3 defines the CSR's structure. Main sections: 1 title page; 2 synopsis; 3 table of contents; 4 abbreviations; 5 ethics; 6 investigators and administrative structure; 7 introduction; 8 objectives; 9 investigational plan; 10 study patients; 11 efficacy evaluation; 12 safety evaluation; 13 discussion and conclusions; 14 tables, figures and graphs referred to but not included in the text; 15 references; 16 appendices — including 16.1 study information (for example 16.1.1 protocol, 16.1.2 sample CRF, 16.1.9 documentation of statistical methods) and 16.2 patient data listings (for example 16.2.7 adverse event listings).
:::

The TLF numbering in the CBX417-301 shells (14.1.x demographics, 14.2.x efficacy, 14.3.x safety, 16.2.x listings) follows this structure — a convention that makes cross-referencing between the CSR text and the outputs straightforward.

### eCTD and Module 5

The **Common Technical Document** (ICH M4) organizes an application into five modules; the electronic version (**eCTD**, ICH M8 and regional specifications) defines the folder structure and XML backbone:

| Module | Content |
|---|---|
| 1 | Regional administrative information (not part of the harmonized CTD) |
| 2 | Summaries (for example 2.5 clinical overview, 2.7 clinical summary) |
| 3 | Quality |
| 4 | Nonclinical study reports |
| 5 | Clinical study reports — **including the study data (datasets, define.xml, reviewer guides, programs)** |

FDA's Study Data Technical Conformance Guide (TCG) describes the folder structure for study data within Module 5, with separate locations for tabulation datasets (SDTM) and analysis datasets (ADaM) and their programs.

### FDA study data standards: the key documents

| Document | Role |
|---|---|
| **Guidance: Providing Regulatory Submissions in Electronic Format — Standardized Study Data** (eStudy Data guidance) | Implements the statutory requirement (FD&C Act section 745A(a)) for standardized study data in NDAs, ANDAs, certain BLAs and certain INDs |
| **FDA Data Standards Catalog** | Lists which standards and versions are supported or required, with dates |
| **Federal Register notices** | Announce when support and requirements begin or end for new standards and versions |
| **Study Data Technical Conformance Guide (TCG)** | Technical specifications and recommendations: file formats, dataset sizes, define.xml, reviewer guides, domain-specific expectations. Revised frequently (the June 2026 revision was current when this lesson was written) |

:::standard{kind="official" source="Federal Register 88 FR 86336 (December 13, 2023), FR Doc. 2023-27310, Docket FDA-2023-N-5022"}
FDA announced that support for CDISC SDTM v2.0 and SDTMIG v3.4 began on December 13, 2023, with a transition date of March 15, 2024, and that the requirement to use them begins March 15, 2025 for NDAs, ANDAs, certain BLAs and certain INDs. The same notice ended the requirement for SDTMIG v3.2 and said the Data Standards Catalog would be updated.
:::

:::standard{kind="official" source="FDA Guidance: Providing Regulatory Submissions in Electronic Format — Standardized Study Data (June 2021), Section II"}
Whether a standard is required depends on what the Catalog lists **at the time of study start**. For clinical studies, the study start date is the earliest informed-consent date of any enrolled subject (reported in the Trial Summary dataset as `TSPARMCD = "SSTDTC"`). Version updates to existing standards are required for studies that start 12 months after the transition date announced in the Federal Register — which is how SDTMIG v3.4 becomes required for studies starting after March 15, 2025. Where several versions are listed, sponsors may choose, and are encouraged to use the latest.
:::

### What the TCG specifies (selected)

- **Transport format:** SAS XPORT Version 5 is the file format for all submitted datasets. The format itself limits variable names to 8 characters, labels to 40 characters and character values to 200 bytes.
- **Dataset size:** datasets larger than 5 GB should be split into smaller datasets.
- **Define-XML** accompanies SDTM and ADaM datasets.
- **Annotated CRF:** `acrf.pdf` (previously called `blankcrf.pdf`).
- **Reviewer's guides:** the clinical SDRG is submitted as `csdrg.pdf` and the ADRG as `adrg.pdf`. The TCG recommends preparing an ADRG, and notes that FDA prefers but does not require the PHUSE templates.
- **Programs:** sponsors should provide the source code used to create all ADaM datasets and the tables and figures for primary and secondary efficacy analyses, as ASCII text.
- **Technical rejection criteria:** FDA validates study data on receipt; for example, the Trial Summary (`TS`) dataset must be present.

### Define-XML and reviewer's guides

**Define-XML** is the CDISC standard for dataset metadata: datasets, variables, labels, types, lengths, controlled terminology (codelists), value-level metadata (for example which unit applies to which `LBTESTCD`), origins (Collected, Derived, Assigned, Protocol, Predecessor) and derivation methods. It is machine-readable and rendered for humans with a stylesheet.

A **reviewer's guide** covers what metadata cannot: the study design in brief, how SDTM or ADaM were applied, sponsor-defined conventions, known conformance findings with explanations, special derivations (imputation, censoring), data dependencies, and how to reproduce key analyses.

### PHUSE's role

**PHUSE** is an independent, not-for-profit community of data scientists, statisticians and programmers. Its working groups — often with FDA participation — publish templates and guidance, including the cSDRG and ADRG templates, study data standardization plan (SDSP) templates, and papers on traceability and conformance. PHUSE deliverables are **not** regulations; FDA may reference, review or prefer them.

### Official vs convention: a summary

| Statement | Kind |
|---|---|
| SDTMIG v3.4 is required for studies starting after March 15, 2025 (NDA, ANDA, certain BLA, certain IND) | Official (Federal Register notice + eStudy Data guidance + Catalog) |
| Datasets are submitted as SAS XPORT v5 | Official (TCG) |
| An ADRG is recommended | Official recommendation (TCG) |
| Use the PHUSE ADRG/cSDRG templates | Preferred by FDA, not required |
| `t_14_2_1_1.rtf` style output names, TLF numbering by ICH E3 section | Convention |
| Unscheduled `VISITNUM` = previous visit + 0.01 | Convention |
| "CDISC-certified" or "FDA-approved" datasets | Neither — no such certification exists |

## Worked example

**Question:** Must CBX417-301 use SDTMIG v3.4?

**Step 1 — study start date.** The first randomization was on 2022-04-11, so the first informed consent was earlier in 2022 (screening lasts up to 28 days). The study start date (`SSTDTC`) is in early 2022.

**Step 2 — what the Catalog required at study start.** In early 2022, SDTMIG v3.4 was not yet FDA-supported (support began December 13, 2023). The SDTMIG versions the Catalog listed at that time applied; check the Catalog history for the exact list.

**Step 3 — conclusion.** SDTMIG v3.4 is **not required** for this study. Because it became supported before the submission, the sponsor **may** use it, and the eStudy Data guidance encourages the latest supported version. The synthetic CBX417-301 data use SDTMIG v3.4 structures.

**Step 4 — document the choice.** The cSDRG states the standards and versions used (SDTM v2.0 / SDTMIG v3.4, the CT version, the MedDRA version), and the define.xml records them.

:::number[What if a sister study, CBX417-302, first consented a subject on 2025-06-02?]
Its study start date is after March 15, 2025, so for an NDA, ANDA or the covered BLA/IND submissions it must use SDTM v2.0 / SDTMIG v3.4 (or a later version if the Catalog lists one as supported at that time). The requirement is tied to the study's start, not to the submission date.
:::

**Where the files go** (typical layout following the TCG's Module 5 directory description; confirm against the current TCG):

```text
m5/datasets/cbx417-301/
  tabulations/sdtm/            dm.xpt ae.xpt lb.xpt ... define.xml acrf.pdf csdrg.pdf
  analysis/adam/datasets/      adsl.xpt adae.xpt adlb.xpt adtte.xpt ... define.xml adrg.pdf
  analysis/adam/programs/      adsl.txt adtte.txt t_pfs.txt ...
```

## Interpretation

- **Required, recommended and conventional are different words.** In interviews and documents, say "the TCG recommends", "the Catalog lists", "our convention is" — precisely.
- **The package is designed for independent verification.** A reviewer with only your datasets, define.xml, guides and programs should be able to reproduce the primary analysis. That is also the standard for your internal QC.
- **Versions matter.** Standards, CT and dictionary versions determine what is valid; always record them.
- **This app is educational.** The CBX417-301 materials here are an educational implementation of a CDISC-style workflow with synthetic data — never describe such work as "FDA-ready" or "submission-ready".

## Common mistakes

:::mistake[Tying the SDTMIG requirement to the submission date]
The requirement follows the study start date and the Catalog at that time. A study that started in 2022 is not required to use SDTMIG v3.4, even if submitted in 2026.
:::

:::mistake[Calling templates requirements]
"FDA requires the PHUSE ADRG template" is wrong: the TCG recommends an ADRG and FDA prefers, but does not require, the PHUSE templates.
:::

:::mistake[Letting metadata and data drift apart]
A define.xml generated early and not refreshed after the final data will describe lengths, codelists or derivations that no longer match. Regenerate and revalidate metadata with the final datasets.
:::

:::mistake[Submitting programs that don't run standalone]
Programs with hard-coded network paths, company macros that are not included, or dependencies on unsubmitted files cannot be followed by a reviewer. Include or document dependencies; the ADRG describes them.
:::

## Knowledge check

::quiz{ids="trials.regulatory.module5,trials.regulatory.define-purpose,trials.regulatory.fr-date,trials.regulatory.acrf-name"}

## Hands-on exercise

::practice{ids="trials.regulatory.kind-classify,trials.regulatory.study-start,trials.regulatory.e3-map,trials.regulatory.folder-map" title="Practice: requirements, CSR structure and the data package"}

## Challenge exercise

::practice{ids="trials.regulatory.slide-review" title="Debug: correct a training slide about regulatory requirements"}

## Industry note

- **Submission work is senior work**, but every programmer contributes: clean define.xml metadata, clear reviewer-guide sections, runnable programs. Juniors who understand why these exist are trusted with them sooner.
- **Standards evolve.** SDTMIG v4.0 and SDTM v3.0 were in public review in 2026; the Catalog, the TCG and Federal Register notices tell you when anything changes for FDA. Other agencies (for example Japan's PMDA) have their own study data requirements.
- **Interview phrasing matters.** Say "the TCG recommends an ADRG" rather than "FDA requires an ADRG"; "SDTMIG v3.4 is required for studies starting after March 15, 2025" rather than "for submissions after 2025".

:::interview[What goes into the study data package for a submission, and why each piece?]
"For each study: SDTM datasets in XPORT v5 with a define.xml, the annotated CRF and a clinical Study Data Reviewer's Guide — so the reviewer can find any collected value and see how it was mapped. Then ADaM datasets with their define.xml, including derivation methods, and an Analysis Data Reviewer's Guide explaining special derivations, dependencies and conformance findings — so they can understand and reproduce analyses. The TCG also asks for the source code for ADaM datasets and primary and secondary efficacy tables and figures, as text files. Which standard versions are required depends on the Data Standards Catalog at the study's start date — for example, SDTMIG v3.4 for studies starting after March 15, 2025. All of it sits in Module 5 of the eCTD alongside the CSR."
:::
