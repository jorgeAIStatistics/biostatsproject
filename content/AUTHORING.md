# Authoring conventions — read this before writing any lesson or item

This file exists so that work done in parallel produces **one** consistent body of content. Follow it
exactly. When it conflicts with your instinct, follow it anyway.

## The single rule that outranks everything

**Never write a number, formula, variable name, code output, denominator or assumption you have not
verified.** Not "probably", not "typically". Verify it, then write it.

- Numbers about the studies: compute them with `Rscript` against the CSVs in `data/oncology/`,
  `data/cardio/` and `data/manufacturing/`. Paste the value you got.
- `expectedOutput:` blocks: run the reference code and paste the **actual** output. Do not hand-write
  what you think R would print.
- CDISC rules: cite SDTMIG v3.4, ADaMIG v1.3 or NCI EVS controlled terminology. **Never invent a CDISC
  rule or an FDA requirement.** If it is a sponsor habit rather than a standard, label it as such.
- Statistics: if you state a test result, an estimate or an interval, compute it.

If you cannot verify something, leave it out. A shorter lesson that is entirely true is worth more than
a longer one with three fabricated numbers in it.

## Before you write anything

Read these, in this order:

1. `content/lessons/r/r-survival-package.md` — the style exemplar for a code-heavy lesson.
2. `content/lessons/stats/stats-ancova-covariate-adjustment.md` — the style exemplar for a stats lesson.
3. `content/items/r/r-survival-package.yaml` — the item-bank exemplar.
4. `src/content/schema.ts` — the zod schemas. They are `strictObject`, so an unknown key is an error.
5. `scripts/validate-content.ts` — the directive grammar and the checks that will run against you.

## Lesson bodies

Markdown with **no YAML frontmatter** — the metadata lives in `content/curriculum/*.yaml`, which already
has an entry for your lesson. Match its `title`, `summary` and `skills`; do not edit those files.

Open with `## What problem are we trying to solve?` and a concrete situation, not a definition. The
project's standing instruction is **teach the work, not the vocabulary**: the reader should meet a task
someone is actually paid to do, fail at it in a specific way, and then be shown why.

### Directives

```
:::why[Why this matters]          ...   :::
:::number[Where this number comes from] ...   :::
:::mistake[The mistake]           ...   :::
:::clinical                       ...   :::
:::standard{kind=official}        ...   :::     kind = official | convention | simplification
:::interview[What they are testing] ... :::
::::tabs
:::tab[SAS] ... :::
:::tab[R]   ... :::
::::
:::lines                          3: text      or   3-5: text
```

**`:::lines` numbers are checked against the code block above.** Three rules, all enforced:

- A line number must exist in that block. The block's last line is its last line — not one more. An
  entry past the end is never rendered, so the note you wrote is simply invisible.
- **No two entries may end on the same line.** The renderer keys each explanation by its last line, so
  `6: …` twice, or `22-24: …` followed by `24: …`, silently discards one of them. If you have two things
  to say about one line, say them in one entry.
- Nested ranges are fine (`1-5` then `2-3`), because their end lines differ.

Count the lines of the fenced block itself, not the fence.

`:::standard` is not decoration. Every claim about CDISC gets one:

- `kind=official` — it is in the IG or the CT. Name the document.
- `kind=convention` — common sponsor practice, not a requirement. Say so.
- `kind=simplification` — you have simplified for teaching. Say what you left out.

### Embeds

```
::dataset{id="oncology/sdtm/dm" rows="8"}
::quiz{ids="a,b,c"}
::practice{ids="a,b,c" title="..."}
::widget{name="study-day-calculator"}
::doc{id="..."}
```

Every id must exist. Widget names come from `src/content/widgets.ts`; dataset ids from the
`manifest.json` files. **Do not invent a widget.**

### Other rules

- Display maths uses `$$` alone on its own line, opening and closing. Inline maths uses `$…$`.
- Never fake SAS execution. SAS code is shown and explained, never "run". Outputs shown for SAS must be
  labelled as what SAS would print, and you must be able to justify every figure in them.
- Everything is synthetic. No PHI, no real sponsors, no real products.
- 1,500–3,500 words. Long enough to teach the work; no filler to hit a number.

## Item banks

One YAML file per lesson at `content/items/<lab>/<lesson-id>.yaml`, top-level key `items:`.

The ids you reference in `::quiz` / `::practice` must be exactly the ids you define. Mismatches are the
single most common validation failure.

### `explanation:` is an OBJECT, never a string

Keys (all optional except where the format needs them): `objective`, `given`, `relevant`, `irrelevant`,
`calculating`, `method`, `numbers`, `assumptions`, `computation`, `interpretation`, `changes`,
`interviewer`.

### `code` items

They **require** a `reference:` field, and the validator **runs your `checks:` regexes against your own
reference solution**. If your reference does not satisfy your checks, validation fails. Write the
reference first, then write checks that match it.

### Target shape per lesson

Roughly 4 quiz + 4 practice + 3 challenge items. Mix the formats: `mcq`, `numeric`, `code`, `hotspot`,
`open`. Interview-style `open` items carry `modelAnswer`, `rubric` and `redFlags`.

## When you are done

Run `npm run validate` and fix every error attributable to your files. Run `npx tsc --noEmit`. Do not
edit files outside your assigned list — in particular do not touch `src/`, other people's lessons, or
the curriculum YAML.
