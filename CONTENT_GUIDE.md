# Content Authoring Guide

This guide is the contract for everyone who writes curriculum content for Clinical Biometrics
Mastery OS — lessons, practice items, reference entries, crosswalk tasks, documents, case studies
and capstones. The UI renders whatever the content files describe, so **content never requires
changing React components**. Run `npm run validate` after every change.

---

## 1. The quality bar

**Teach the work, not the definitions.** A learner should finish a lesson able to *do* something an
employer pays for: derive a variable, write the program, read the log, check the table, explain the
model, defend the decision.

Non-negotiables:

1. **No magic.** Never introduce a number, formula, variable, denominator, code line or assumption
   without saying where it came from. If a denominator is 210, say it is the number of subjects in the
   CBX+DOC arm of the safety population. If a test has 2 degrees of freedom, show why. If code uses
   `first.USUBJID`, explain BY-group processing (or link to the lesson that does). Use the `:::number`
   and `:::why` directives liberally.
2. **Connect theory to clinical decisions.** Every statistical idea answers a question a clinical
   team, regulator or scientist actually has.
3. **Accuracy over breadth.** Statistics must be correct. Numbers quoted from the synthetic datasets
   must be computed from the generated files (R and Python are available locally — see §9), never
   guessed or "illustrative".
4. **Label standards claims.** Distinguish, explicitly:
   - **official** — a requirement stated in a CDISC standard, FDA/EMA/ICH document (cite it: document
     name + version + section when known);
   - **convention** — common industry practice that is not a requirement;
   - **simplification** — something this app simplifies for teaching.
   Use `:::standard{kind="official" source="SDTMIG v3.4"}` blocks for important claims. **Never invent a
   CDISC rule or FDA requirement.** If unsure, call it a convention or leave it out.
5. **Never fake SAS execution.** SAS cannot run in a browser. Show SAS code, and show *expected* output
   or logs — say "expected output" and never imply SAS ran. Values in expected output must be correct
   for the data (compute them in R/Python).
6. **Original writing.** Do not copy text from training courses, books, or standards documents. Short
   quotations (< 15 words) with attribution only when essential.
7. **No filler.** No lorem ipsum, no "coming soon", no repeated boilerplate paragraphs, no emoji, no hype.
8. **Interview relevance.** Each lesson should leave the learner able to answer the questions an
   interviewer would ask about the topic.

Voice: a senior statistical programmer / biostatistician mentoring a sharp graduate student.
Direct, precise, warm, never condescending. US spelling. Second person ("you") is fine.

---

## 2. Where content lives

```
content/
  skills/<domain>.yaml          skill taxonomy (one file per competency domain)
  curriculum/<lab>.yaml         modules and lesson metadata for a lab
  lessons/<lab>/<lesson-id>.md  lesson bodies (markdown + directives)
  items/<lab>/<topic>.yaml      practice items: knowledge checks, exercises, drills, interview Qs
  reference/<category>.yaml     reference library entries
  crosswalk/<topic>.yaml        SAS / R / Python / SQL crosswalk tasks
  companion/<course>.yaml       MS Companion topics
  documents/index.yaml + *.md   clinical documents (protocol synopsis, SAP, specs …)
  cases/<name>.yaml             case studies
  capstones/capstones.yaml      capstone projects
  sources/sources.yaml          official references (FDA, CDISC, ICH, NCI …)
data/<study>/                   synthetic datasets + manifest.json (written by generators)
sas/ r/ python/                 runnable companion programs
```

Lab ids: `trials`, `sas`, `cdisc`, `tlf`, `stats`, `r`, `python`, `sql`, `excel`, `analytics`, `qc`, `git`.
Track ids: `programmer`, `biostatistician`, `analytics`, `computing`, `excel`.
Difficulty: `foundation`, `intermediate`, `advanced`, `expert`.

IDs are lowercase with hyphens/dots: lessons `sas-by-group-processing`, items `sas.by-group.first-last-mcq`.
**Prefix item ids with the lab and topic** so they stay globally unique.

---

## 3. Curriculum files — `content/curriculum/<lab>.yaml`

```yaml
lab: sas
modules:
  - id: sas-combining-data
    title: Combining and reshaping data
    summary: MERGE, BY-group processing, PROC SQL joins, RETAIN, arrays and PROC TRANSPOSE.
    level: 2                      # 1..5 = position in the 18–24 month journey
    lessons:
      - id: sas-by-group-processing
        title: BY-group processing and FIRST./LAST.
        summary: How SAS flags the first and last record of each BY group, and how clinical programmers use it.
        minutes: 50
        difficulty: intermediate
        tracks: [programmer, biostatistician]
        skills: [sas.by-group, sas.sort, sas.retain]
        prerequisites: [sas-merge]   # lesson ids (optional)
        keywords: [FIRST., LAST., BY statement, baseline record]
```

Metadata lives **only** here; the markdown body has no frontmatter. Every lesson listed must have a body
at `content/lessons/<lab>/<id>.md`.

---

## 4. Lesson bodies — `content/lessons/<lab>/<id>.md`

### 4.1 Required structure

Use these H2 headings, in this order (headings match case-insensitively). Required ones are marked ★.

| Heading | Purpose |
|---|---|
| `## What problem are we trying to solve?` ★ | A concrete work situation. Start here, always. |
| `## Intuition` ★ | The idea in plain language, before notation or syntax. |
| `## Clinical context` ★ (or `## Industry context` for analytics/Excel/Git) | Where this shows up in a real study/team. |
| `## Formal concept` | Definitions, notation, rules, syntax. |
| `## Worked example` ★ | Step by step, every number explained. |
| `## Data example` | The concept on real (synthetic) study data — use `::dataset`. |
| `## Code` | Program(s) with line explanations (`:::lines`). |
| `## Output` | Expected output/log, annotated. |
| `## Interpretation` | What the result means and does **not** mean. |
| `## Common mistakes` ★ | Real failure modes, how to detect them. |
| `## Knowledge check` ★ | `::quiz{ids="…"}` with 2–5 items. |
| `## Hands-on exercise` ★ | `::practice{ids="…"}` — the learner produces something. |
| `## Challenge exercise` | Harder, integrated, or debug/QC item. |
| `## Industry note` ★ | How this is done/judged in industry; interview angle. |

Do **not** use `#` (H1); the page title comes from the curriculum. Use `###` for sub-sections.
Typical lesson length: 1,500–4,000 words plus code. Depth beats length — but a one-paragraph section
is a sign something is missing.

### 4.2 Markdown basics

- GitHub-flavored markdown: tables, lists, footnotes, `inline code`, **bold**, *italic*, links.
- **Math**: `$…$` inline, `$$…$$` display (put `$$` blocks on their own lines). KaTeX syntax. Every
  formula is validated by KaTeX — broken LaTeX fails validation.
- A literal dollar sign in prose must be escaped `\$` or placed in code: SAS character formats such as
  `$20.` or `$sexf.` **always go in backticks**.
- Variable names, dataset names, functions and options go in backticks: `USUBJID`, `ADSL`, `PROC SORT`,
  `first.USUBJID`, `pivot_longer()`. Or use the inline directive `:var[TRT01P]`.
- Keyboard keys: `:kbd[Ctrl+Enter]`.

### 4.3 Code blocks

````markdown
```sas title="derive_first_ae.sas"
proc sort data=sdtm.ae out=ae;
  by USUBJID AESTDTC AESEQ;
run;
```
````

Languages: `sas`, `r`, `python`, `sql`, `bash`, `yaml`, `json`, `csv`, `text`, `output` (listing-style
output), `log` (SAS log — ERROR/WARNING/NOTE lines are colour-coded), `excel` (formulas), `diff`, `xml`.
Meta options: `title="file.sas"`, `highlight="3,5-7"`.

**SAS style**: lowercase keywords and dataset names; UPPERCASE CDISC variable names
(`if TRTEMFL = 'Y' then …`); 2-space indentation; `run;`/`quit;` on their own lines.

### 4.4 "Explain this line" — `:::lines`

Immediately after a code block, add line-by-line explanations. Each entry is `N: text` or `N-M: text`.

````markdown
```sas
data first_ae;
  set ae;
  by USUBJID;
  if first.USUBJID;
run;
```

:::lines
1: Starts a DATA step that creates `WORK.FIRST_AE`.
2: Reads `AE` one observation at a time into the Program Data Vector.
3: Because of `BY USUBJID`, SAS creates temporary variables `first.USUBJID` and `last.USUBJID` (1/0). The data must already be sorted by `USUBJID`.
4: A subsetting IF: only the first record of each subject is written out.
:::
````

**Three rules the validator enforces**, because a wrong line number silently annotates the wrong line —
or nothing at all — and that is worse than no annotation:

1. **The number must exist in the block above.** A five-line block has a line 5, not a line 6. Count the
   code, not the fence.
2. **No two entries may end on the same line.** `CodeBlock` keys each explanation by its last line, so
   `6: …` twice — or `22-24: …` followed by `24: …` — silently discards one of them. If you have two
   things to say about one line, say them in a single entry.
3. **Nested ranges are fine** (`1-5` then `2-3`), because their end lines differ.

### 4.5 Explanations, callouts, and standards labels

Collapsible (collapsed by default — the learner opens them when needed):

```markdown
:::number[Where did n = 210 come from?]
There are 210 subjects with `TRT01A = "CBX-417 + Docetaxel"` and `SAFFL = "Y"` in ADSL …
:::

:::why[Why sort before MERGE?]
…
:::

:::math
Full derivation of the Greenwood variance …
:::

:::intuition
…
:::

:::clinical
What an oncologist would conclude from HR = 0.71 …
:::

:::interview[How would you QC an adverse-event table?]
Model answer …
:::

:::mistake[Counting events instead of subjects]
…
:::

:::line[What does `nodupkey` actually remove?]
…
:::

:::deeper[Why the log-log transformation for the median CI?]
…
:::
```

Visible callouts:

```markdown
:::note
…
:::

:::tip[Keyboard shortcut]
…
:::

:::warning[This silently changes your data]
…
:::

:::industry
How sponsors/CROs actually handle this …
:::

:::ai[If an AI assistant writes this merge for you…]
What to check before trusting it.
:::

:::standard{kind="official" source="SDTMIG v3.4, Section 4.4.4"}
Study day values are never 0: the day before the reference start date is Day −1 …
:::

:::standard{kind="convention"}
Many sponsors use VISITNUM + 0.01 for unscheduled visits. This is a convention, not a CDISC rule.
:::

:::standard{kind="simplification"}
The TR domain here contains only the sum of diameters; real studies also include TU and per-lesion TR records.
:::
```

Tabs and columns (nest with an extra colon on the outer fence):

```markdown
::::tabs
:::tab[SAS]
```sas
proc freq data=adsl; tables SEX*TRT01P; run;
```
:::
:::tab[R]
```r
table(adsl$SEX, adsl$TRT01P)
```
:::
::::

::::columns
:::col[Raw (EDC)]
…
:::
:::col[SDTM]
…
:::
::::
```

### 4.6 Embeds (leaf directives, on their own line)

```markdown
::dataset{id="oncology/sdtm/dm" cols="USUBJID,AGE,SEX,ARMCD" rows="8" filter="ARMCD=CBX+DOC" sort="AGE desc" caption="First rows of DM"}
::quiz{ids="sas.by-group.q1,sas.by-group.q2"}
::practice{ids="sas.by-group.ex1,sas.by-group.debug1" title="Practice: first and last records"}
::widget{name="pdv-stepper" example="first-last"}
::doc{id="sap" section="9.4" label="SAP §9.4 — PFS censoring rules"}
::lesson{id="sas-merge" label="Review: DATA step MERGE"}
::crosswalk{id="first-record-per-subject"}
```

- `::dataset` filter syntax: `COL=VALUE`, `COL!=VALUE`, `COL>N`, `COL>=N`, `COL<N`, `COL<=N`, joined by `;`
  (AND). `sort="COL"` or `sort="COL desc"`. Dataset ids come from `data/<study>/manifest.json`.
- `::quiz` renders items inline (use small formats: mcq, multi, numeric, text, order, mapping, classify).
- `::practice` renders a launcher for larger items (code, sql, log, hotspot, diff, open).
- Widget names and props: see `src/content/widgets.ts`.

---

## 5. Practice items — `content/items/<lab>/<topic>.yaml`

One file holds many items: `items: [ … ]`. Common fields:

```yaml
items:
  - id: sas.by-group.q1          # globally unique: <lab>.<topic>.<name>
    format: mcq                  # see formats below
    modes: [check, speed]        # check | guided | independent | debug | qc | interview | speed | case | boss
    difficulty: intermediate
    skills: [sas.by-group]       # must exist in content/skills/*.yaml
    lesson: sas-by-group-processing   # optional back-link
    title: FIRST. requires sorted data   # optional short label
    prompt: |
      Markdown prompt. Code fences, tables and $math$ are fine.
    hints:                       # progressive: weakest first
      - Think about what SAS compares to decide a group has started.
      - It compares the current BY value with the previous observation's BY value.
    solution: |
      Worked answer in markdown.
    explanation:                 # the explanation engine — use for advanced/expert/debug/qc/boss items
      objective: …               # What is the objective?
      given: …                   # What information was provided?
      relevant: …                # What information matters?
      irrelevant: …              # What information does not matter?
      calculating: …             # What are we calculating?
      method: …                  # Why are we using this method?
      numbers: …                 # Where does each number come from?
      assumptions: …             # What assumptions are being made?
      computation: …             # How do we compute the result?
      interpretation: …          # How should we interpret it?
      changes: …                 # What would change the answer?
      interviewer: …             # What would an interviewer expect me to understand?
    datasets: [oncology/sdtm/ae] # optional context drawers
    minutes: 3
    tags: [baseline]
```

Mode guidance: every lesson should have `check` items; add `guided` (with 2–4 real hints),
`independent` (the same skill without scaffolding), `debug` and `qc` wherever the skill allows,
`interview` open questions, and `speed` items for syntax recognition. Hints must genuinely help —
the last hint should nearly give the method, never just the answer.

### Formats

```yaml
# mcq — exactly one correct; every choice gets feedback explaining why it is right or wrong
  - id: …
    format: mcq
    choices:
      - text: "`first.USUBJID` equals 1"
        correct: true
        feedback: "The first observation of each BY group sets FIRST. to 1."
      - text: "…"
        feedback: "…"

# multi — one or more correct (all-or-nothing scoring)
    format: multi
    choices: [ … ]

# numeric — absolute tolerance
    format: numeric
    answer: 62.4
    tolerance: 0.05
    unit: "%"

# text — case-insensitive, whitespace-collapsed exact matches, plus optional regexes
    format: text
    accept: ["TRT01A", "trt01a"]
    acceptPatterns: ["^trt01a$"]
    monospace: true

# mapping — map each source to a target (dropdowns); include distractor targets
    format: mapping
    sourceLabel: Raw SEX value
    targetLabel: SDTM SEX
    pairs:
      - { source: "Male", target: "M" }
      - { source: "f ", target: "F", note: "Trim whitespace first." }
    targets: ["M", "F", "U", "UNDIFFERENTIATED"]

# order — steps listed in the CORRECT order (they are shuffled for the learner)
    format: order
    steps: ["Sort by USUBJID ADT", "…", "…"]

# classify — sort entries into categories
    format: classify
    categories: [Identifier, Topic, Timing, Qualifier]
    entries:
      - { text: "`USUBJID`", category: Identifier }
      - { text: "`AETERM`", category: Topic }

# code — structural checks; SAS/R are never executed. The validator runs your checks
# against `reference` (comments stripped) and fails if the reference does not pass.
    format: code
    language: sas          # sas | r | python | sql
    starter: |
      data first_ae;
        /* your code */
      run;
    checks:
      - pattern: "\\bby\\s+usubjid\\b"
        message: Uses a BY statement on USUBJID
      - pattern: "first\\.usubjid"
        message: Uses FIRST.USUBJID to keep the first record
      - pattern: "\\bmerge\\b"
        absent: true
        message: Does not need a MERGE for this task
    reference: |
      …
    expectedOutput: |
      (expected listing/log — computed independently, never claimed as real SAS output)
    runnable: false        # python only: true enables optional in-browser Pyodide execution
    tests: |               # python only: assertions appended after learner code when runnable
      assert result.shape[0] == 420

# sql — executed in the browser (SQLite via sql.js) and compared to the reference result set
    format: sql
    db: oncology           # oncology | cardio | manufacturing
    starter: "SELECT …"
    reference: |
      SELECT ARMCD, COUNT(*) AS n FROM dm WHERE ARMCD IS NOT NULL GROUP BY ARMCD;
    orderMatters: false
    compareColumns: false

# log — learner clicks the lines that signal a problem
    format: log
    program: |             # optional
      …
    log: |
      1    data both;
      2      merge a b;
      3      by USUBJID;
      4    run;
      NOTE: MERGE statement has more than one data set with repeats of BY values.
    issues: [5]            # 1-based line numbers within `log`
    lineNotes:
      - { line: 5, note: "A many-to-many merge: SAS does not create a Cartesian product…" }

# hotspot — learner clicks the defective line(s) of code
    format: hotspot
    language: r            # sas | r | python | sql | text
    code: |
      …
    answerLines: [4]
    lineNotes: [ { line: 4, note: "…" } ]
    fixed: |
      corrected code

# diff — QC: two outputs disagree; choose the root cause(s)
    format: diff
    left:  { title: "Production (Programmer A)", columns: [...], rows: [[...], ...], footnote: "…" }
    right: { title: "QC (Programmer B)",         columns: [...], rows: [[...], ...] }
    leftCode: |            # optional
    rightCode: |           # optional
    codeLanguage: sas
    choices: [ { text: …, correct: true, feedback: … }, … ]

# open — interview / explanation; self-assessed against a rubric
    format: open
    modelAnswer: |
      …
    rubric:
      - Distinguishes tabulation (SDTM) from analysis (ADaM)
      - Mentions traceability
    redFlags: ["Says ADaM replaces SDTM"]
    followUps: ["How would you trace an ADaM value back to SDTM?"]
```

Advanced/expert items and all debug/qc/boss items must include an `explanation` block. Prefer
realistic clinical scenarios over abstract puzzles.

---

## 6. Other content types

See `src/content/schema.ts` for the exact schemas (`ReferenceFileSchema`, `CrosswalkFileSchema`,
`CompanionFileSchema`, `CaseFileSchema`, `CapstoneFileSchema`, `DocumentIndexSchema`, `SourceFileSchema`).

- **Reference entries** are fast lookups: a one-sentence `summary`, optional `body`, `syntax`,
  `example`, `related` ids, `standard` label and `source`.
- **Crosswalk tasks** show the same task in ≥2 of SAS/R/Python/SQL. The `semantics` field is the heart:
  explain *semantic* differences (missing values, sort stability, defaults, types, rounding, NULL logic),
  not just syntax.
- **Companion topics** pair the academic view with the industry view for one MS course topic.
- **Documents** are markdown files registered in `content/documents/index.yaml`.
- **Cases / capstones** are multi-step projects; steps can reference items that verify them.
  Portfolio text must be accurate: "Educational implementation of a CDISC-style clinical programming
  workflow using synthetic data" — never "FDA-ready", "submission-ready" or "certified".

---

## 7. Datasets you can reference

Read `docs/specs/oncology-study-spec.md` for the flagship study (CBX417-301). After generation, every
dataset id and column is listed in `data/<study>/manifest.json`, and key computed numbers are in
`data/oncology/STUDY_FACTS.md`. Quote numbers from STUDY_FACTS.md or compute them yourself — never
estimate.

Three studies are available, each with a `README.md` stating its simulation model and its
simplifications:

| Study | What it is | Good for |
|---|---|---|
| `oncology/` | CBX417-301 — a synthetic oncology trial with full **raw → SDTM → ADaM** layers | SDTM/ADaM mapping, survival, AE and lab tables, traceability |
| `cardio/` | VTX221-201 — a 12-week antihypertensive trial (ADSL, ADVS, AE) | ANCOVA, change from baseline, repeated measures, missing data |
| `manufacturing/` | HBX-14 — 240 biologics batches, a 6-hourly sensor series and NIR spectra | PCA, multicollinearity, control charts, leakage-safe validation |

The manufacturing study also ships `data/manufacturing/raw/` — twelve deliberately messy instrument
exports (different header spellings, delimiters, units, date formats and missing-value markers) that
**reconcile exactly to `process/batches.csv`**. That reconciliation is the answer key for capstone 7,
and `raw/README.md` documents every planted anomaly.

Its batch summaries are computed from its own sensor series, so any summary column can be recomputed
and checked. `Rscript scripts/data/manufacturing/verify.R` asserts that, the reconciliation, the two
planted process excursions and the cross-validation leakage gap; it runs automatically after
`npm run data`.

---

## 8. Validation

```bash
npm run validate                          # everything
npm run validate -- --only content/lessons/sas   # issues for matching files only
npm run validate -- --quiet               # errors only
```

The validator checks schemas, duplicate ids, unknown skills/lessons/items/datasets/widgets/documents,
required lesson sections and order, directive syntax, code-fence languages, LaTeX (via KaTeX), mcq
correctness counts and regexes. **Zero errors is required.** Warnings deserve attention.

Three of its checks do real work rather than shape-checking, and are worth knowing about because they
fail on content that looks perfectly fine:

- **Code items.** Each item's `reference` solution is run against that item's own `checks` (comments
  stripped). A reference that does not satisfy its own checks fails the build.
- **Spreadsheet tasks.** Every sheet task's `solution` is evaluated in the same formula engine the
  `excel-grid` widget uses, and compared with the stated `expected` (within `tolerance`). An exercise
  whose answer is wrong cannot ship. Only functions in `EXCEL_FUNCTIONS` (`src/content/vocab.ts`) exist.
- **`:::lines` numbers.** Placement, range bounds and duplicate end lines, per section 4.4.

---

## 9. Local tools for verifying numbers

- R 4.6: `Rscript` with survival, dplyr, tidyr, readr, broom, nlme, lme4, MASS, purrr, stringr, jsonlite
  (not installed: lubridate, haven, mmrm, emmeans, gt, testthat — mention them conceptually only).
- Python 3.14 system install with numpy/pandas/scipy; a verification venv with statsmodels,
  scikit-learn, lifelines, matplotlib, pytest, openpyxl:
  `/private/tmp/claude-501/-Users-jorgerodriguez-Desktop-Clarity-Project/1c0239a3-249b-43dd-a7eb-dabf3ea32e6a/scratchpad/pyverify/bin/python`
- SQLite: `/usr/bin/sqlite3`.
- CDISC CT lookup: `python3 scripts/tools/ct_lookup.py <CODELIST>` / `--term VALUE` / `--search text`.
- SAS is **not** available. Write SAS carefully; label outputs as expected output.
