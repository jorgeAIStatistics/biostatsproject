/**
 * Content registry.
 *
 * Small, structural content (skills, curriculum, documents, cases, capstones,
 * sources) is bundled eagerly. Large collections (practice items, reference
 * entries, crosswalk, companion topics, sheets, lesson bodies) are loaded
 * lazily and cached. YAML is converted to JSON at build time (vite.config.ts),
 * and schema defaults are applied here so the rest of the app can trust the
 * types exported from schema.ts.
 */
import { useSyncExternalStore } from 'react';
import type {
  SkillFile,
  Skill,
  CurriculumFile,
  Module,
  LessonMeta,
  LabId,
  DomainId,
  Item,
  ReferenceEntry,
  ReferenceCategory,
  CrosswalkTask,
  CompanionTopic,
  CaseStudy,
  Capstone,
  DocumentMeta,
  Source,
  Sheet,
} from './schema';
import { LABS } from './labs';

/* ------------------------------------------------------------------ */
/* Eager structural content                                             */
/* ------------------------------------------------------------------ */

const skillFiles = import.meta.glob<SkillFile>('/content/skills/*.yaml', { eager: true, import: 'default' });
const curriculumFiles = import.meta.glob<CurriculumFile>('/content/curriculum/*.yaml', { eager: true, import: 'default' });
const documentIndex = import.meta.glob<{ documents: DocumentMeta[] }>('/content/documents/index.yaml', { eager: true, import: 'default' });
const caseFiles = import.meta.glob<{ cases: CaseStudy[] }>('/content/cases/*.yaml', { eager: true, import: 'default' });
const capstoneFiles = import.meta.glob<{ capstones: Capstone[] }>('/content/capstones/*.yaml', { eager: true, import: 'default' });
const sourceFiles = import.meta.glob<{ sources: Source[] }>('/content/sources/*.yaml', { eager: true, import: 'default' });

export interface SkillInfo extends Skill {
  domain: DomainId;
}

export interface LessonInfo extends LessonMeta {
  lab: LabId;
  moduleId: string;
  moduleTitle: string;
  /** Global order across the curriculum (for next/previous). */
  order: number;
}

export interface ModuleInfo extends Omit<Module, 'lessons'> {
  lab: LabId;
  lessons: LessonInfo[];
}

function sortedEntries<T>(rec: Record<string, T>): [string, T][] {
  return Object.entries(rec).sort(([a], [b]) => a.localeCompare(b));
}

export const skills: SkillInfo[] = [];
export const skillById = new Map<string, SkillInfo>();
for (const [, file] of sortedEntries(skillFiles)) {
  for (const s of file.skills ?? []) {
    const info: SkillInfo = { ...s, weight: s.weight ?? 2, domain: file.domain };
    skills.push(info);
    skillById.set(s.id, info);
  }
}

export const modules: ModuleInfo[] = [];
export const lessons: LessonInfo[] = [];
export const lessonById = new Map<string, LessonInfo>();
{
  const labOrder = new Map(LABS.map((l, i) => [l.id, i]));
  const files = sortedEntries(curriculumFiles).sort(
    ([pa, a], [pb, b]) => (labOrder.get(a.lab) ?? 99) - (labOrder.get(b.lab) ?? 99) || pa.localeCompare(pb),
  );
  let order = 0;
  for (const [, file] of files) {
    for (const m of file.modules ?? []) {
      const mod: ModuleInfo = { id: m.id, title: m.title, summary: m.summary, level: m.level, lab: file.lab, lessons: [] };
      for (const l of m.lessons ?? []) {
        const info: LessonInfo = {
          ...l,
          prerequisites: l.prerequisites ?? [],
          keywords: l.keywords ?? [],
          lab: file.lab,
          moduleId: m.id,
          moduleTitle: m.title,
          order: order++,
        };
        mod.lessons.push(info);
        lessons.push(info);
        lessonById.set(l.id, info);
      }
      modules.push(mod);
    }
  }
}

export function modulesForLab(lab: LabId): ModuleInfo[] {
  return modules.filter((m) => m.lab === lab);
}

export function lessonsForLab(lab: LabId): LessonInfo[] {
  return lessons.filter((l) => l.lab === lab);
}

export function lessonsForSkill(skill: string): LessonInfo[] {
  return lessons.filter((l) => l.skills.includes(skill));
}

export const documents: DocumentMeta[] = Object.values(documentIndex).flatMap((d) =>
  (d.documents ?? []).map((doc) => ({ ...doc, items: doc.items ?? [] })),
);
export const documentById = new Map(documents.map((d) => [d.id, d]));

export const cases: CaseStudy[] = sortedEntries(caseFiles).flatMap(([, f]) =>
  (f.cases ?? []).map((c) => ({ ...c, datasets: c.datasets ?? [], steps: c.steps.map((s) => ({ ...s, items: s.items ?? [] })) })),
);
export const caseById = new Map(cases.map((c) => [c.id, c]));

export const capstones: Capstone[] = sortedEntries(capstoneFiles)
  .flatMap(([, f]) =>
    (f.capstones ?? []).map((c) => ({ ...c, datasets: c.datasets ?? [], steps: c.steps.map((s) => ({ ...s, items: s.items ?? [] })) })),
  )
  .sort((a, b) => a.number - b.number);
export const capstoneById = new Map(capstones.map((c) => [c.id, c]));

export const sources: Source[] = sortedEntries(sourceFiles).flatMap(([, f]) => (f.sources ?? []).map((s) => ({ ...s, topics: s.topics ?? [] })));

/* ------------------------------------------------------------------ */
/* Lazy collections                                                     */
/* ------------------------------------------------------------------ */

const itemLoaders = import.meta.glob<{ items: Item[] }>('/content/items/**/*.yaml', { import: 'default' });
const referenceLoaders = import.meta.glob<{ category: ReferenceCategory; title: string; description: string; entries: ReferenceEntry[] }>(
  '/content/reference/*.yaml',
  { import: 'default' },
);
const crosswalkLoaders = import.meta.glob<{ tasks: CrosswalkTask[] }>('/content/crosswalk/*.yaml', { import: 'default' });
const companionLoaders = import.meta.glob<{ topics: CompanionTopic[] }>('/content/companion/*.yaml', { import: 'default' });
const sheetLoaders = import.meta.glob<{ sheets: Sheet[] }>('/content/excel/*.yaml', { import: 'default' });
const lessonLoaders = import.meta.glob<string>('/content/lessons/**/*.md', { query: '?raw', import: 'default' });
const documentLoaders = import.meta.glob<string>('/content/documents/*.md', { query: '?raw', import: 'default' });

/** Item enriched with its source lab (from the folder name). */
export type ItemInfo = Item & { lab: string; file: string };

function normalizeItem(raw: Item, file: string): ItemInfo {
  const lab = file.split('/')[3] ?? 'misc';
  // Apply the defaults declared in schema.ts (zod does not run in the browser).
  const base = {
    ...raw,
    hints: raw.hints ?? [],
    datasets: raw.datasets ?? [],
    tags: raw.tags ?? [],
    lab,
    file,
  } as ItemInfo;
  switch (base.format) {
    case 'mcq':
    case 'multi':
      return { ...base, shuffle: base.shuffle ?? true, choices: base.choices.map((c) => ({ ...c, correct: c.correct ?? false })) };
    case 'numeric':
      return { ...base, tolerance: base.tolerance ?? 0 };
    case 'text':
      return { ...base, acceptPatterns: base.acceptPatterns ?? [], monospace: base.monospace ?? false };
    case 'mapping':
      return { ...base, sourceLabel: base.sourceLabel ?? 'Source', targetLabel: base.targetLabel ?? 'Target' };
    case 'code':
      return {
        ...base,
        starter: base.starter ?? '',
        runnable: base.runnable ?? false,
        checks: base.checks.map((c) => ({ ...c, flags: c.flags ?? 'i', absent: c.absent ?? false })),
      };
    case 'sql':
      return { ...base, starter: base.starter ?? '', orderMatters: base.orderMatters ?? false, compareColumns: base.compareColumns ?? false };
    case 'log':
      return { ...base, lineNotes: base.lineNotes ?? [] };
    case 'hotspot':
      return { ...base, lineNotes: base.lineNotes ?? [] };
    case 'diff':
      return { ...base, choices: base.choices.map((c) => ({ ...c, correct: c.correct ?? false })) };
    case 'open':
      return { ...base, redFlags: base.redFlags ?? [], followUps: base.followUps ?? [] };
    default:
      return base;
  }
}

export interface ItemIndex {
  all: ItemInfo[];
  byId: Map<string, ItemInfo>;
  byLesson: Map<string, ItemInfo[]>;
  bySkill: Map<string, ItemInfo[]>;
}

export interface ReferenceIndex {
  categories: { category: ReferenceCategory; title: string; description: string; entries: ReferenceEntry[] }[];
  byId: Map<string, ReferenceEntry & { category: ReferenceCategory }>;
}

type Cache = {
  items?: ItemIndex;
  reference?: ReferenceIndex;
  crosswalk?: CrosswalkTask[];
  companion?: CompanionTopic[];
  sheets?: Map<string, Sheet>;
};

const cache: Cache = {};
const inflight: Partial<Record<keyof Cache, Promise<unknown>>> = {};
const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version++;
  for (const l of listeners) l();
}

async function loadAll<T>(loaders: Record<string, () => Promise<T>>): Promise<[string, T][]> {
  const entries = Object.entries(loaders).sort(([a], [b]) => a.localeCompare(b));
  return Promise.all(entries.map(async ([path, load]) => [path, await load()] as [string, T]));
}

export function loadItems(): Promise<ItemIndex> {
  if (cache.items) return Promise.resolve(cache.items);
  inflight.items ??= loadAll(itemLoaders).then((files) => {
    const all: ItemInfo[] = [];
    for (const [path, f] of files) for (const it of f.items ?? []) all.push(normalizeItem(it, path));
    const byId = new Map(all.map((i) => [i.id, i]));
    const byLesson = new Map<string, ItemInfo[]>();
    const bySkill = new Map<string, ItemInfo[]>();
    for (const it of all) {
      if (it.lesson) byLesson.set(it.lesson, [...(byLesson.get(it.lesson) ?? []), it]);
      for (const s of it.skills) bySkill.set(s, [...(bySkill.get(s) ?? []), it]);
    }
    cache.items = { all, byId, byLesson, bySkill };
    emit();
    return cache.items;
  });
  return inflight.items as Promise<ItemIndex>;
}

export function loadReference(): Promise<ReferenceIndex> {
  if (cache.reference) return Promise.resolve(cache.reference);
  inflight.reference ??= loadAll(referenceLoaders).then((files) => {
    const categories = files.map(([, f]) => ({ ...f, entries: f.entries.map((e) => ({ ...e, aliases: e.aliases ?? [], related: e.related ?? [] })) }));
    const byId = new Map<string, ReferenceEntry & { category: ReferenceCategory }>();
    for (const c of categories) for (const e of c.entries) byId.set(e.id, { ...e, category: c.category });
    cache.reference = { categories, byId };
    emit();
    return cache.reference;
  });
  return inflight.reference as Promise<ReferenceIndex>;
}

export function loadCrosswalk(): Promise<CrosswalkTask[]> {
  if (cache.crosswalk) return Promise.resolve(cache.crosswalk);
  inflight.crosswalk ??= loadAll(crosswalkLoaders).then((files) => {
    cache.crosswalk = files.flatMap(([, f]) => f.tasks.map((t) => ({ ...t, skills: t.skills ?? [], pitfalls: t.pitfalls ?? [] })));
    emit();
    return cache.crosswalk;
  });
  return inflight.crosswalk as Promise<CrosswalkTask[]>;
}

export function loadCompanion(): Promise<CompanionTopic[]> {
  if (cache.companion) return Promise.resolve(cache.companion);
  inflight.companion ??= loadAll(companionLoaders).then((files) => {
    cache.companion = files.flatMap(([, f]) => f.topics.map((t) => ({ ...t, lessons: t.lessons ?? [], skills: t.skills ?? [] })));
    emit();
    return cache.companion;
  });
  return inflight.companion as Promise<CompanionTopic[]>;
}

export function loadSheets(): Promise<Map<string, Sheet>> {
  if (cache.sheets) return Promise.resolve(cache.sheets);
  inflight.sheets ??= loadAll(sheetLoaders).then((files) => {
    const map = new Map<string, Sheet>();
    for (const [, f] of files) for (const s of f.sheets) map.set(s.id, { ...s, formats: s.formats ?? {}, tasks: (s.tasks ?? []).map((t) => ({ ...t, tolerance: t.tolerance ?? 0 })) });
    cache.sheets = map;
    emit();
    return map;
  });
  return inflight.sheets as Promise<Map<string, Sheet>>;
}

const lessonCache = new Map<string, string>();
export async function loadLessonBody(lab: string, id: string): Promise<string> {
  const key = `/content/lessons/${lab}/${id}.md`;
  const cached = lessonCache.get(key);
  if (cached !== undefined) return cached;
  const loader = lessonLoaders[key];
  if (!loader) throw new Error(`Lesson body not found: ${key}`);
  const body = await loader();
  lessonCache.set(key, body);
  return body;
}

export function lessonBodyLoaders() {
  return lessonLoaders;
}

export async function loadDocumentBody(file: string): Promise<string> {
  const loader = documentLoaders[`/content/documents/${file}`];
  if (!loader) throw new Error(`Document not found: ${file}`);
  return loader();
}

/* ------------------------------------------------------------------ */
/* React hooks                                                          */
/* ------------------------------------------------------------------ */

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useCacheVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function useItems(): ItemIndex | undefined {
  useCacheVersion();
  if (!cache.items) void loadItems();
  return cache.items;
}

export function useReference(): ReferenceIndex | undefined {
  useCacheVersion();
  if (!cache.reference) void loadReference();
  return cache.reference;
}

export function useCrosswalk(): CrosswalkTask[] | undefined {
  useCacheVersion();
  if (!cache.crosswalk) void loadCrosswalk();
  return cache.crosswalk;
}

export function useCompanion(): CompanionTopic[] | undefined {
  useCacheVersion();
  if (!cache.companion) void loadCompanion();
  return cache.companion;
}

export function useSheets(): Map<string, Sheet> | undefined {
  useCacheVersion();
  if (!cache.sheets) void loadSheets();
  return cache.sheets;
}

/** Title for an item (explicit title or first line of the prompt, stripped of markdown). */
export function itemTitle(it: Pick<Item, 'title' | 'prompt'>): string {
  if (it.title) return it.title;
  const first = it.prompt
    .split('\n')
    .find((l) => l.trim())!
    .replace(/[`*_#>]/g, '')
    .replace(/\$[^$]*\$/g, '…')
    .trim();
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
}

export const contentStats = () => ({
  lessons: lessons.length,
  modules: modules.length,
  skills: skills.length,
  documents: documents.length,
  cases: cases.length,
  capstones: capstones.length,
});
