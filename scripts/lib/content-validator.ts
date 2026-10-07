/**
 * Node-side content validator. Loads every content file from disk, validates
 * it against src/content/schema.ts and checks cross-references (skills,
 * lessons, items, datasets, widgets, documents, LaTeX).
 *
 * Used by `npm run validate` and by src/content/content.test.ts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import katex from 'katex';
import type { z } from 'zod';
import {
  SkillFileSchema,
  CurriculumFileSchema,
  ItemFileSchema,
  ReferenceFileSchema,
  CrosswalkFileSchema,
  CompanionFileSchema,
  CaseFileSchema,
  CapstoneFileSchema,
  DocumentIndexSchema,
  SourceFileSchema,
  SheetFileSchema,
  EXCEL_FUNCTIONS,
  DatasetManifestSchema,
  LESSON_SECTIONS,
  CONTAINER_DIRECTIVES,
  LEAF_DIRECTIVES,
  TEXT_DIRECTIVES,
  FENCE_LANGUAGES,
  type Item,
  type LessonMeta,
} from '../../src/content/schema.ts';
import { WIDGET_NAMES } from '../../src/content/widgets.ts';
import { evaluateFormula, ExcelError, type CellValue } from '../../src/lib/excel/engine.ts';

export interface Issue {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

export interface ValidationResult {
  issues: Issue[];
  counts: Record<string, number>;
}

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..');
const CONTENT = join(ROOT, 'content');
const DATA = join(ROOT, 'data');

function walk(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name.startsWith('_')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out.sort();
}

type AnyNode = {
  type: string;
  name?: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  depth?: number;
  attributes?: Record<string, string | null | undefined> | null;
  children?: AnyNode[];
  data?: { directiveLabel?: boolean };
  position?: { start: { line: number } };
};

function nodeText(n: AnyNode): string {
  if (n.value) return n.value;
  return (n.children ?? []).map(nodeText).join('');
}

export function validateContent(): ValidationResult {
  const issues: Issue[] = [];
  const counts: Record<string, number> = {};
  const rel = (p: string) => relative(ROOT, p);
  const err = (file: string, message: string) => issues.push({ level: 'error', file: rel(file), message });
  const warn = (file: string, message: string) => issues.push({ level: 'warning', file: rel(file), message });

  function loadYaml<S extends z.ZodTypeAny>(file: string, schema: S): z.infer<S> | null {
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(file, 'utf8'), { prettyErrors: true });
    } catch (e) {
      err(file, `YAML parse error: ${(e as Error).message}`);
      return null;
    }
    const res = schema.safeParse(raw);
    if (!res.success) {
      for (const issue of res.error.issues.slice(0, 25)) {
        const path = issue.path.join('.');
        // Try to name the offending item for readability.
        let where = path;
        const m = path.match(/^(items|entries|tasks|topics|cases|capstones|skills|modules|documents|sources)\.(\d+)/);
        if (m && raw && typeof raw === 'object') {
          const arr = (raw as Record<string, unknown>)[m[1]];
          const el = Array.isArray(arr) ? (arr[Number(m[2])] as { id?: string } | undefined) : undefined;
          if (el?.id) where = `${path} (id: ${el.id})`;
        }
        err(file, `${where}: ${issue.message}`);
      }
      if (res.error.issues.length > 25) err(file, `…and ${res.error.issues.length - 25} more schema errors`);
      return null;
    }
    return res.data;
  }

  /* ---------------- Skills ---------------- */
  const skillIds = new Set<string>();
  for (const file of walk(join(CONTENT, 'skills'), /\.ya?ml$/)) {
    const data = loadYaml(file, SkillFileSchema);
    if (!data) continue;
    for (const s of data.skills) {
      if (skillIds.has(s.id)) err(file, `duplicate skill id "${s.id}"`);
      skillIds.add(s.id);
      const prefix = s.id.split('.')[0];
      if (prefix !== data.domain) err(file, `skill "${s.id}" must start with its domain "${data.domain}."`);
    }
  }
  counts.skills = skillIds.size;
  const checkSkills = (file: string, ids: string[], ctx: string) => {
    for (const id of ids) if (!skillIds.has(id)) err(file, `${ctx}: unknown skill "${id}" (add it to content/skills/*.yaml)`);
  };

  /* ---------------- Curriculum ---------------- */
  const lessons = new Map<string, LessonMeta & { lab: string; module: string }>();
  const moduleIds = new Set<string>();
  for (const file of walk(join(CONTENT, 'curriculum'), /\.ya?ml$/)) {
    const data = loadYaml(file, CurriculumFileSchema);
    if (!data) continue;
    const stem = basename(file).replace(/\.ya?ml$/, '');
    if (stem !== data.lab && !stem.startsWith(`${data.lab}.`))
      err(file, `file name must be "${data.lab}.yaml" or start with "${data.lab}." (e.g. ${data.lab}.2-advanced.yaml)`);
    for (const mod of data.modules) {
      if (moduleIds.has(mod.id)) err(file, `duplicate module id "${mod.id}"`);
      moduleIds.add(mod.id);
      for (const l of mod.lessons) {
        if (lessons.has(l.id)) err(file, `duplicate lesson id "${l.id}"`);
        lessons.set(l.id, { ...l, lab: data.lab, module: mod.id });
        checkSkills(file, l.skills, `lesson ${l.id}`);
        const mdPath = join(CONTENT, 'lessons', data.lab, `${l.id}.md`);
        if (!existsSync(mdPath)) err(file, `lesson "${l.id}" has no body file at ${rel(mdPath)}`);
      }
    }
  }
  for (const [id, l] of lessons) {
    for (const p of l.prerequisites) if (!lessons.has(p)) err(join(CONTENT, 'curriculum', `${l.lab}.yaml`), `lesson ${id}: unknown prerequisite "${p}"`);
  }
  counts.modules = moduleIds.size;
  counts.lessons = lessons.size;

  /* ---------------- Dataset manifests ---------------- */
  const datasetIds = new Set<string>();
  const datasetColumns = new Map<string, Set<string>>();
  let manifestsFound = 0;
  for (const file of walk(DATA, /^manifest\.json$/)) {
    manifestsFound++;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      err(file, `JSON parse error: ${(e as Error).message}`);
      continue;
    }
    const res = DatasetManifestSchema.safeParse(raw);
    if (!res.success) {
      for (const i of res.error.issues.slice(0, 10)) err(file, `${i.path.join('.')}: ${i.message}`);
      continue;
    }
    for (const d of res.data.datasets) {
      if (datasetIds.has(d.id)) err(file, `duplicate dataset id ${d.id}`);
      datasetIds.add(d.id);
      datasetColumns.set(d.id, new Set(d.columns.map((c) => c.name)));
      const csv = join(dirname(file), d.file);
      if (!existsSync(csv)) err(file, `dataset ${d.id}: file not found ${rel(csv)}`);
    }
  }
  counts.datasets = datasetIds.size;
  const checkDataset = (file: string, id: string, ctx: string) => {
    if (manifestsFound === 0) return; // data not generated yet
    if (!datasetIds.has(id)) {
      const study = id.split('/')[0];
      const hasStudy = [...datasetIds].some((d) => d.startsWith(`${study}/`));
      if (hasStudy) err(file, `${ctx}: unknown dataset "${id}"`);
      else warn(file, `${ctx}: dataset "${id}" not found (has its generator run yet?)`);
    }
  };

  /* ---------------- Items ---------------- */
  const items = new Map<string, Item & { file: string }>();
  for (const file of walk(join(CONTENT, 'items'), /\.ya?ml$/)) {
    const data = loadYaml(file, ItemFileSchema);
    if (!data) continue;
    for (const it of data.items) {
      if (items.has(it.id)) err(file, `duplicate item id "${it.id}" (also in ${rel(items.get(it.id)!.file)})`);
      items.set(it.id, { ...it, file });
      const ctx = `item ${it.id}`;
      checkSkills(file, it.skills, ctx);
      if (it.lesson && !lessons.has(it.lesson)) err(file, `${ctx}: unknown lesson "${it.lesson}"`);
      for (const d of it.datasets) checkDataset(file, d, ctx);
      const hard = it.difficulty === 'advanced' || it.difficulty === 'expert';
      const special = it.modes.some((m) => m === 'debug' || m === 'qc' || m === 'boss');
      if ((hard || special) && !it.explanation && it.format !== 'open')
        warn(file, `${ctx}: ${it.difficulty}/${it.modes.join(',')} items should include an explanation block`);
      if (!it.solution && !it.explanation && it.format !== 'open' && it.format !== 'mcq' && it.format !== 'multi')
        warn(file, `${ctx}: consider adding a solution write-up`);
      switch (it.format) {
        case 'mcq': {
          const n = it.choices.filter((c) => c.correct).length;
          if (n !== 1) err(file, `${ctx}: mcq must have exactly one correct choice (found ${n}); use format "multi" otherwise`);
          if (it.choices.some((c) => !c.feedback)) warn(file, `${ctx}: give every choice feedback explaining why it is right/wrong`);
          break;
        }
        case 'multi': {
          const n = it.choices.filter((c) => c.correct).length;
          if (n < 1) err(file, `${ctx}: multi must have at least one correct choice`);
          break;
        }
        case 'text':
          for (const p of it.acceptPatterns) {
            try {
              new RegExp(p, 'i');
            } catch {
              err(file, `${ctx}: invalid regex in acceptPatterns: ${p}`);
            }
          }
          break;
        case 'mapping': {
          const targets = it.targets ?? [...new Set(it.pairs.map((p) => p.target))];
          for (const p of it.pairs) if (!targets.includes(p.target)) err(file, `${ctx}: target "${p.target}" missing from targets list`);
          break;
        }
        case 'classify':
          for (const e of it.entries) if (!it.categories.includes(e.category)) err(file, `${ctx}: entry category "${e.category}" not in categories`);
          break;
        case 'code': {
          const stripped = stripComments(it.reference, it.language);
          for (const c of it.checks) {
            let re: RegExp;
            try {
              re = new RegExp(c.pattern, c.flags);
            } catch {
              err(file, `${ctx}: invalid check regex /${c.pattern}/`);
              continue;
            }
            const hit = re.test(stripped);
            if (hit === c.absent) err(file, `${ctx}: the reference solution fails its own check "${c.message}"`);
          }
          if (it.runnable && it.language !== 'python') err(file, `${ctx}: only python items can be runnable`);
          break;
        }
        case 'log': {
          const n = it.log.replace(/\n$/, '').split('\n').length;
          for (const l of it.issues) if (l > n) err(file, `${ctx}: issue line ${l} exceeds log length ${n}`);
          for (const ln of it.lineNotes) if (ln.line > n) err(file, `${ctx}: lineNote line ${ln.line} exceeds log length ${n}`);
          break;
        }
        case 'hotspot': {
          const n = it.code.replace(/\n$/, '').split('\n').length;
          for (const l of it.answerLines) if (l > n) err(file, `${ctx}: answer line ${l} exceeds code length ${n}`);
          break;
        }
        case 'diff': {
          const n = it.choices.filter((c) => c.correct).length;
          if (n < 1) err(file, `${ctx}: diff needs at least one correct root-cause choice`);
          for (const t of [it.left, it.right])
            for (const r of t.rows) if (r.length !== t.columns.length) err(file, `${ctx}: table "${t.title}" row length ${r.length} ≠ ${t.columns.length} columns`);
          break;
        }
        default:
          break;
      }
      checkMarkdownMath(file, ctx, [it.prompt, it.solution, ...(it.hints ?? []), ...Object.values(it.explanation ?? {})], err);
    }
  }
  counts.items = items.size;

  /* ---------------- Reference / crosswalk / companion / cases / capstones / documents / sources ---------------- */
  const refIds = new Set<string>();
  for (const file of walk(join(CONTENT, 'reference'), /\.ya?ml$/)) {
    const data = loadYaml(file, ReferenceFileSchema);
    if (!data) continue;
    for (const e of data.entries) {
      if (refIds.has(e.id)) err(file, `duplicate reference id "${e.id}"`);
      refIds.add(e.id);
      checkMarkdownMath(file, `reference ${e.id}`, [e.summary, e.body], err);
    }
  }
  counts.reference = refIds.size;

  const crosswalkIds = new Set<string>();
  for (const file of walk(join(CONTENT, 'crosswalk'), /\.ya?ml$/)) {
    const data = loadYaml(file, CrosswalkFileSchema);
    if (!data) continue;
    for (const t of data.tasks) {
      if (crosswalkIds.has(t.id)) err(file, `duplicate crosswalk id "${t.id}"`);
      crosswalkIds.add(t.id);
      checkSkills(file, t.skills, `crosswalk ${t.id}`);
      const n = [t.sas, t.r, t.python, t.sql].filter(Boolean).length;
      if (n < 2) err(file, `crosswalk ${t.id}: provide at least two implementations`);
      if (t.dataset) checkDataset(file, t.dataset, `crosswalk ${t.id}`);
    }
  }
  counts.crosswalk = crosswalkIds.size;

  let companionCount = 0;
  for (const file of walk(join(CONTENT, 'companion'), /\.ya?ml$/)) {
    const data = loadYaml(file, CompanionFileSchema);
    if (!data) continue;
    for (const t of data.topics) {
      companionCount++;
      checkSkills(file, t.skills, `companion ${t.id}`);
      for (const l of t.lessons) if (!lessons.has(l)) err(file, `companion ${t.id}: unknown lesson "${l}"`);
      checkMarkdownMath(file, `companion ${t.id}`, [t.academic, t.industry, t.clinicalExample, t.interview.question, t.interview.answer], err);
    }
  }
  counts.companion = companionCount;

  // Items reached from anywhere — a lesson directive, a case step, a capstone step or a document.
  // Declared here (rather than beside the lesson scan) so `checkItemRefs` can record them too;
  // otherwise an item used only by a document or capstone would still be reported as an orphan.
  const referencedItems = new Set<string>();
  const checkItemRefs = (file: string, ids: string[], ctx: string) => {
    for (const id of ids) {
      referencedItems.add(id);
      if (!items.has(id)) err(file, `${ctx}: unknown item "${id}"`);
    }
  };

  let caseCount = 0;
  for (const file of walk(join(CONTENT, 'cases'), /\.ya?ml$/)) {
    const data = loadYaml(file, CaseFileSchema);
    if (!data) continue;
    for (const c of data.cases) {
      caseCount++;
      checkSkills(file, c.skills, `case ${c.id}`);
      for (const d of c.datasets) checkDataset(file, d, `case ${c.id}`);
      for (const s of c.steps) checkItemRefs(file, s.items, `case ${c.id} step ${s.id}`);
    }
  }
  counts.cases = caseCount;

  let capCount = 0;
  for (const file of walk(join(CONTENT, 'capstones'), /\.ya?ml$/)) {
    const data = loadYaml(file, CapstoneFileSchema);
    if (!data) continue;
    for (const c of data.capstones) {
      capCount++;
      checkSkills(file, c.skills, `capstone ${c.id}`);
      for (const d of c.datasets) checkDataset(file, d, `capstone ${c.id}`);
      for (const s of c.steps) checkItemRefs(file, s.items, `capstone ${c.id} step ${s.id}`);
      if (c.starter && !existsSync(join(ROOT, c.starter))) warn(file, `capstone ${c.id}: starter folder ${c.starter} not found`);
      const claim = `${c.portfolio.tagline} ${c.portfolio.methods}`.toLowerCase();
      if (/fda[- ]ready|submission[- ]ready|certified|expert programmer/.test(claim))
        err(file, `capstone ${c.id}: portfolio text must not claim FDA-readiness/certification`);
    }
  }
  counts.capstones = capCount;

  const docIds = new Set<string>();
  const docIndex = join(CONTENT, 'documents', 'index.yaml');
  if (existsSync(docIndex)) {
    const data = loadYaml(docIndex, DocumentIndexSchema);
    if (data) {
      for (const d of data.documents) {
        if (docIds.has(d.id)) err(docIndex, `duplicate document id "${d.id}"`);
        docIds.add(d.id);
        if (!existsSync(join(CONTENT, 'documents', d.file))) err(docIndex, `document ${d.id}: file ${d.file} not found`);
        checkItemRefs(docIndex, d.items, `document ${d.id}`);
      }
    }
  }
  counts.documents = docIds.size;

  let sourceCount = 0;
  for (const file of walk(join(CONTENT, 'sources'), /\.ya?ml$/)) {
    const data = loadYaml(file, SourceFileSchema);
    if (data) sourceCount += data.sources.length;
  }
  counts.sources = sourceCount;

  /* ---------------- Spreadsheet sheets ---------------- */
  const sheetIds = new Set<string>();
  const fnSet = new Set<string>(EXCEL_FUNCTIONS);
  const checkFormula = (file: string, ctx: string, f: string) => {
    for (const m of f.matchAll(/([A-Z][A-Z0-9.]*)\s*\(/g)) {
      if (!fnSet.has(m[1])) err(file, `${ctx}: function ${m[1]}() is not supported by the sandbox engine`);
    }
  };
  for (const file of walk(join(CONTENT, 'excel'), /\.ya?ml$/)) {
    const data = loadYaml(file, SheetFileSchema);
    if (!data) continue;
    for (const sh of data.sheets) {
      if (sheetIds.has(sh.id)) err(file, `duplicate sheet id "${sh.id}"`);
      sheetIds.add(sh.id);
      sh.rows.forEach((r, i) => {
        if (r.length > sh.columns.length) err(file, `sheet ${sh.id}: row ${i + 2} has more cells than columns`);
        for (const c of r) if (typeof c === 'string' && c.startsWith('=')) checkFormula(file, `sheet ${sh.id} row ${i + 2}`, c);
      });

      // Evaluate every task's reference solution in the same engine the widget uses and compare it to
      // the stated `expected`. Checking that the functions exist is not enough: a solution that parses
      // cleanly and returns the wrong number would otherwise ship as an exercise nobody can pass.
      const data: CellValue[][] = [sh.columns as CellValue[], ...(sh.rows as CellValue[][])];
      const grid = {
        rows: data.length + 40,
        cols: sh.columns.length + 12,
        get: (r: number, c: number): CellValue => data[r]?.[c] ?? null,
      };
      for (const t of sh.tasks) {
        checkFormula(file, `sheet ${sh.id} task ${t.cell}`, t.solution);
        const ctx = `sheet ${sh.id} task ${t.cell}`;
        let got: unknown;
        try {
          got = evaluateFormula(t.solution, grid);
        } catch (e) {
          err(file, `${ctx}: solution threw (${e instanceof Error ? e.message : String(e)})`);
          continue;
        }
        if (got instanceof ExcelError) {
          err(file, `${ctx}: solution evaluates to ${got.code}, but expected ${JSON.stringify(t.expected)}`);
        } else if (typeof t.expected === 'number' && typeof got === 'number') {
          if (Math.abs(got - t.expected) > (t.tolerance || 0)) {
            err(file, `${ctx}: solution gives ${got}, expected ${t.expected}${t.tolerance ? ` (±${t.tolerance})` : ''}`);
          }
        } else if (String(got) !== String(t.expected)) {
          err(file, `${ctx}: solution gives ${JSON.stringify(got)}, expected ${JSON.stringify(t.expected)}`);
        }
      }
    }
  }
  counts.sheets = sheetIds.size;

  /* ---------------- Lesson markdown ---------------- */
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective);
  let words = 0;
  for (const [id, meta] of lessons) {
    const file = join(CONTENT, 'lessons', meta.lab, `${id}.md`);
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    words += src.split(/\s+/).length;
    if (src.startsWith('---')) err(file, 'lesson files must not have YAML frontmatter (metadata lives in content/curriculum/<lab>.yaml)');
    const tree = processor.parse(src) as unknown as AnyNode;
    const sectionOrder: number[] = [];
    const seenKinds = new Set<string>();
    let lastWasCode = false;
    /** Line count of the fenced code block immediately above, for ":::lines" range checks. */
    let lastCodeLineCount = 0;

    const visit = (node: AnyNode, parent: AnyNode | null, ancestors: string[]) => {
      const line = node.position?.start.line ?? 0;
      const at = `line ${line}`;
      if (node.type === 'heading') {
        if (node.depth === 1) err(file, `${at}: do not use H1 (#) — the lesson title comes from the curriculum`);
        if (node.depth === 2 && parent?.type === 'root') {
          const text = nodeText(node).trim().toLowerCase();
          const idx = LESSON_SECTIONS.findIndex((s) => (s.headings as readonly string[]).some((h) => h.toLowerCase() === text));
          if (idx === -1) warn(file, `${at}: non-standard section "${nodeText(node).trim()}"`);
          else {
            sectionOrder.push(idx);
            seenKinds.add(LESSON_SECTIONS[idx].kind);
          }
        }
      }
      if (node.type === 'code') {
        const lang = (node.lang ?? '').toLowerCase();
        if (!lang) warn(file, `${at}: fenced code block without a language (use \`\`\`text for plain text)`);
        else if (!(FENCE_LANGUAGES as readonly string[]).includes(lang)) err(file, `${at}: unsupported code language "${lang}"`);
      }
      if (node.type === 'math' || node.type === 'inlineMath') {
        try {
          katex.renderToString(node.value ?? '', { throwOnError: true, displayMode: node.type === 'math', strict: 'ignore' });
        } catch (e) {
          err(file, `${at}: LaTeX error: ${(e as Error).message.split('\n')[0]}`);
        }
      }
      if (node.type === 'containerDirective') {
        const name = node.name ?? '';
        const spec = (CONTAINER_DIRECTIVES as Record<string, { label: string }>)[name];
        if (!spec) err(file, `${at}: unknown container directive ":::${name}"`);
        else {
          const hasLabel = node.children?.[0]?.data?.directiveLabel === true;
          if (spec.label === 'required' && !hasLabel) err(file, `${at}: ":::${name}" needs a label, e.g. :::${name}[Your question here]`);
          if (spec.label === 'none' && hasLabel) warn(file, `${at}: ":::${name}" does not use a label`);
          if (name === 'tab' && !ancestors.includes('tabs')) err(file, `${at}: ":::tab" must be inside "::::tabs"`);
          if (name === 'col' && !ancestors.includes('columns')) err(file, `${at}: ":::col" must be inside "::::columns"`);
          if (name === 'lines' && !lastWasCode) err(file, `${at}: ":::lines" must immediately follow a fenced code block`);
          if (name === 'lines') {
            const body = nodeText({ type: 'x', children: node.children }).trim();
            // Line annotations point at a specific line of the code block above. An out-of-range or
            // out-of-order reference silently annotates the wrong line, which is worse than no
            // annotation at all — so check the numbers, not just the syntax.
            // CodeBlock keys each explanation by its LAST line (`explByLastLine` in
            // src/components/code/CodeBlock.tsx), so two entries ending on the same line silently
            // discard one of them. Nested ranges are fine — only a shared end line breaks.
            const endLines = new Map<number, string>();
            for (const row of body.split('\n').filter((r) => r.trim())) {
              const m = row.match(/^\s*(\d+)(?:\s*-\s*(\d+))?\s*:/);
              if (!m) {
                err(file, `${at}: each ":::lines" entry must look like "3: explanation" or "3-5: explanation" (got "${row.slice(0, 40)}")`);
                break;
              }
              const label = m[0].replace(/:$/, '').trim();
              const from = Number(m[1]);
              const to = m[2] ? Number(m[2]) : from;
              if (from < 1) {
                err(file, `${at}: ":::lines" entry "${label}" — line numbers start at 1`);
              } else if (m[2] && to < from) {
                err(file, `${at}: ":::lines" range "${label}" runs backwards`);
              } else if (lastCodeLineCount && to > lastCodeLineCount) {
                err(file, `${at}: ":::lines" entry "${label}" points past the end of the code block above (${lastCodeLineCount} lines) — it would never be shown`);
              } else if (endLines.has(to)) {
                err(
                  file,
                  `${at}: ":::lines" entries "${endLines.get(to)}" and "${label}" both end on line ${to}. ` +
                    'The renderer keys each explanation by its last line, so only one of them would ever be shown.',
                );
              }
              endLines.set(to, label);
            }
          }
          if (name === 'standard') {
            const kind = node.attributes?.kind;
            if (!kind || !['official', 'convention', 'simplification'].includes(kind))
              err(file, `${at}: ":::standard" needs kind="official|convention|simplification"`);
          }
        }
      }
      if (node.type === 'leafDirective') {
        const name = node.name ?? '';
        const spec = (LEAF_DIRECTIVES as Record<string, { required: readonly string[]; optional: readonly string[] }>)[name];
        const attrs = (node.attributes ?? {}) as Record<string, string>;
        if (!spec) err(file, `${at}: unknown leaf directive "::${name}"`);
        else {
          for (const r of spec.required) if (!attrs[r]) err(file, `${at}: "::${name}" requires attribute ${r}=""`);
          if (!spec.optional.includes('*'))
            for (const a of Object.keys(attrs)) if (!spec.required.includes(a) && !spec.optional.includes(a)) warn(file, `${at}: "::${name}" ignores attribute "${a}"`);
          const ids = (attrs.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          if (name === 'quiz' || name === 'practice') {
            for (const i of ids) {
              referencedItems.add(i);
              if (!items.has(i)) err(file, `${at}: "::${name}" references unknown item "${i}"`);
            }
            if (name === 'quiz')
              for (const i of ids) {
                const it = items.get(i);
                if (it && ['code', 'sql', 'log', 'hotspot', 'diff'].includes(it.format))
                  warn(file, `${at}: item "${i}" (${it.format}) is large — prefer ::practice for it`);
              }
          }
          if (name === 'widget' && attrs.name && !WIDGET_NAMES.includes(attrs.name)) err(file, `${at}: unknown widget "${attrs.name}"`);
          if (name === 'widget' && attrs.name === 'excel-grid' && attrs.sheet && !sheetIds.has(attrs.sheet)) err(file, `${at}: unknown sheet "${attrs.sheet}" (define it in content/excel/*.yaml)`);
          if (name === 'dataset' && attrs.id) {
            checkDataset(file, attrs.id, at);
            const cols = datasetColumns.get(attrs.id);
            if (cols && attrs.cols)
              for (const c of attrs.cols.split(',').map((s) => s.trim())) if (c && !cols.has(c)) err(file, `${at}: dataset ${attrs.id} has no column "${c}"`);
          }
          if (name === 'doc' && attrs.id && docIds.size > 0 && !docIds.has(attrs.id)) err(file, `${at}: unknown document "${attrs.id}"`);
          if (name === 'lesson' && attrs.id && !lessons.has(attrs.id)) err(file, `${at}: unknown lesson "${attrs.id}"`);
          if (name === 'crosswalk' && attrs.id && !crosswalkIds.has(attrs.id)) err(file, `${at}: unknown crosswalk task "${attrs.id}"`);
        }
      }
      if (node.type === 'textDirective') {
        const name = node.name ?? '';
        const looksIntentional = (node.children?.length ?? 0) > 0 || Object.keys(node.attributes ?? {}).length > 0;
        if (looksIntentional && !(name in TEXT_DIRECTIVES)) warn(file, `${at}: unknown inline directive ":${name}[…]" will render as text`);
      }
      const nextAncestors = node.type === 'containerDirective' ? [...ancestors, node.name ?? ''] : ancestors;
      const kids = node.children ?? [];
      for (const child of kids) {
        visit(child, node, nextAncestors);
        if (node.type === 'root' || node.type === 'containerDirective') {
          lastWasCode = child.type === 'code';
          if (lastWasCode) lastCodeLineCount = String((child as AnyNode).value ?? '').split('\n').length;
        }
      }
    };
    visit(tree, null, []);

    for (const s of LESSON_SECTIONS) if (s.required && !seenKinds.has(s.kind)) err(file, `missing required section "## ${s.headings[0]}"`);
    for (let i = 1; i < sectionOrder.length; i++)
      if (sectionOrder[i] < sectionOrder[i - 1]) {
        err(file, `sections out of order: "${LESSON_SECTIONS[sectionOrder[i]].headings[0]}" appears after "${LESSON_SECTIONS[sectionOrder[i - 1]].headings[0]}"`);
        break;
      }
  }
  counts.lessonWords = words;

  // Orphan items (not used by any lesson, case, capstone or document) are fine for
  // the interview/drill banks, but we report them so authors notice typos.
  let orphans = 0;
  for (const [id, it] of items) {
    if (referencedItems.has(id) || it.lesson) continue;
    if (it.modes.includes('interview') || it.modes.includes('speed') || it.modes.includes('boss') || it.modes.includes('case')) continue;
    orphans++;
  }
  counts.unlinkedItems = orphans;

  // Lessons referenced by item.lesson should list the item somewhere (warning only)
  for (const [id, it] of items) {
    if (it.lesson && !referencedItems.has(id) && !it.modes.includes('interview') && !it.modes.includes('speed'))
      warn(it.file, `item ${id} belongs to lesson ${it.lesson} but is not embedded via ::quiz/::practice`);
  }

  return { issues, counts };
}

/** Remove comments so structural checks cannot be satisfied by commented-out code. */
export function stripComments(code: string, language: string): string {
  switch (language) {
    case 'sas':
      // /* block */ comments and statement comments starting with * at statement start
      return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|;)\s*\*[^;]*;/g, '$1');
    case 'sql':
      return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
    case 'r':
    case 'python':
      return code.replace(/(^|[^'"\\])#[^\n]*/g, '$1');
    default:
      return code;
  }
}

function checkMarkdownMath(
  file: string,
  ctx: string,
  texts: (string | undefined)[],
  err: (file: string, message: string) => void,
) {
  for (const t of texts) {
    if (!t) continue;
    // Display math $$…$$ then inline $…$ (skip code spans)
    const noCode = t.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    const display = [...noCode.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => m[1]);
    const rest = noCode.replace(/\$\$[\s\S]+?\$\$/g, '');
    const inline = [...rest.matchAll(/(?<![\\$])\$([^$\n]+?)\$(?!\d)/g)].map((m) => m[1]);
    for (const [expr, displayMode] of [...display.map((d) => [d, true] as const), ...inline.map((d) => [d, false] as const)]) {
      try {
        katex.renderToString(expr, { throwOnError: true, displayMode, strict: 'ignore' });
      } catch (e) {
        err(file, `${ctx}: LaTeX error in "${expr.slice(0, 40)}": ${(e as Error).message.split('\n')[0]}`);
      }
    }
  }
}
