# Brief for curriculum-content agents

You are one of several specialists writing curriculum content, in parallel, for **Clinical Biometrics
Mastery OS** — an interactive training platform (Vite + React + TypeScript, static, runs locally) for
an MS Biostatistics student preparing for pharma / biotech / CRO roles: statistical programmer,
biostatistician, clinical data scientist, biotech data analyst. The student will use it for 18–24
months alongside the degree. The goal: when an interviewer puts a clinical dataset, SAS program, SAP,
regression output, KM curve, SQL query or messy CSV in front of them, it feels familiar — and they
genuinely understand it.

Project root: `/Users/jorgerodriguez/Desktop/Biostats/clinical-biometrics-mastery-os`

## Read before writing anything

1. `CONTENT_GUIDE.md` — the authoring contract (formats, directives, quality bar). Follow it exactly.
2. `content/lessons/sas/sas-by-group-processing.md` and `content/items/sas/by-group.yaml` — the
   **exemplar**. Match its depth, voice, structure, use of `:::number` / `:::why` / `:::lines` /
   `:::mistake` / `:::standard`, and item quality (feedback on every choice, real hints, explanation
   blocks on hard items). Do not produce thinner content than this.
3. `src/content/schema.ts` (exact YAML schemas) and `src/content/widgets.ts` (the only widget names you
   may embed; props are listed there).
4. `content/skills/*.yaml` — the skill taxonomy. Tag lessons/items only with skill ids that exist.
   If you truly need a new skill, add it **only to the skill file(s) of your own domain(s)** and list it
   in your report.
5. `docs/specs/oncology-study-spec.md` — the flagship synthetic study CBX417-301 (design, variables,
   dataset ids such as `oncology/sdtm/dm`, `oncology/adam/adsl`). Another agent is generating these
   data right now. When `data/oncology/manifest.json` and `data/oncology/STUDY_FACTS.md` exist, use them
   as the source of truth for columns and numbers. Until then, only reference columns named in the
   spec, and do not quote result numbers (medians, HRs, counts) that you have not computed from data.

## Rules

- **Only create or edit the files/directories assigned to you** in your task. Other agents are writing
  other labs simultaneously. Never edit `src/`, `scripts/` (except where assigned), `package.json`,
  other labs' curriculum/lesson/item files, or shared config. Never run `npm install`.
- Curriculum metadata goes in your assigned `content/curriculum/<lab>.<n>-<name>.yaml` file(s); lesson
  bodies in `content/lessons/<lab>/<lesson-id>.md`; items in `content/items/<lab>/<topic>.yaml`.
- Item ids must be globally unique: prefix them `<lab>.<topic>.` (e.g. `stats.cox.hr-interpretation`).
- Every lesson needs: the required sections (see guide §4.1), at least one `::quiz` (2–5 check items),
  at least one `::practice` (hands-on), and — where the skill allows — debug/qc items, an interview
  item (`format: open`, `modes: [interview]`), and speed items. Aim for **8–14 items per lesson**
  across modes. Hard items (advanced/expert, debug, qc, boss) need an `explanation` block.
- **Correctness is paramount.** Verify every statistical number by computing it (R: `Rscript`; Python
  verification venv: see guide §9). If you show expected output for SAS, compute the values
  independently and call it expected output. Never claim SAS was executed.
- Label standards claims as official / convention / simplification (`:::standard{kind=…}`). Never
  invent CDISC rules or FDA requirements. Verify CDISC codelist values with
  `python3 scripts/tools/ct_lookup.py`.
- Original writing only. No emoji, no hype, no filler, no "coming soon".
- Companion code files you create must be runnable (R/Python: actually run them; SAS: write carefully
  and mark as not executed in this environment in a header comment).

## Process

1. Draft the curriculum YAML for your modules first (ids, titles, summaries, skills, minutes, difficulty).
2. Write lessons one at a time, each followed immediately by its items file.
3. Run `npm run validate -- --only <your path fragment>` after each lesson and fix **all errors**.
   Resolve warnings unless they are about datasets not yet generated.
4. At the end run `npm run validate` and confirm zero errors in your files.

## Final report (reply format)

Reply with at most ~40 lines: files created (counts of lessons/items/words), any skills you added, any
widget or dataset you wished existed, anything you were unsure about (so the integrator can check it),
and the final validator status for your files. Do not paste file contents.
