/**
 * Global search index (MiniSearch). Built lazily the first time the command
 * palette opens: structural content immediately, then lesson bodies, items,
 * reference entries, crosswalk tasks, datasets and companion topics as they load.
 */
import MiniSearch from 'minisearch';
import {
  lessons,
  modules,
  skills,
  documents,
  cases,
  capstones,
  loadItems,
  loadReference,
  loadCrosswalk,
  loadCompanion,
  lessonBodyLoaders,
  itemTitle,
} from '../content/registry';
import { LABS } from '../content/labs';
import { NAV } from '../components/layout/nav';
import { loadManifests } from './datasets';

export type SearchKind =
  | 'page'
  | 'lab'
  | 'lesson'
  | 'module'
  | 'item'
  | 'reference'
  | 'dataset'
  | 'variable'
  | 'document'
  | 'crosswalk'
  | 'companion'
  | 'case'
  | 'capstone'
  | 'skill';

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  text: string;
  keywords: string;
  path: string;
}

let index: MiniSearch<SearchDoc> | null = null;
let building: Promise<MiniSearch<SearchDoc>> | null = null;
const docs = new Map<string, SearchDoc>();
const listeners = new Set<() => void>();

function add(ms: MiniSearch<SearchDoc>, d: SearchDoc) {
  if (docs.has(d.id)) return;
  docs.set(d.id, d);
  ms.add(d);
}

function stripMd(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/:{2,}[a-z]+(\[[^\]]*\])?(\{[^}]*\})?/g, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSearchDoc(id: string) {
  return docs.get(id);
}

export function onSearchIndexGrow(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const l of listeners) l();
}

export function buildSearchIndex(): Promise<MiniSearch<SearchDoc>> {
  if (index) return Promise.resolve(index);
  if (building) return building;
  building = (async () => {
    const ms = new MiniSearch<SearchDoc>({
      fields: ['title', 'keywords', 'subtitle', 'text'],
      storeFields: ['id'],
      searchOptions: { boost: { title: 4, keywords: 3, subtitle: 1.5 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
    });

    for (const g of NAV)
      for (const it of g.items)
        add(ms, { id: `page:${it.to}`, kind: 'page', title: it.label, subtitle: g.label ?? 'Navigation', text: '', keywords: '', path: it.to });
    for (const l of LABS)
      add(ms, { id: `lab:${l.id}`, kind: 'lab', title: l.title, subtitle: 'Lab', text: l.description, keywords: l.short, path: `/learn/${l.id}` });
    for (const m of modules)
      add(ms, {
        id: `module:${m.id}`,
        kind: 'module',
        title: m.title,
        subtitle: `${LABS.find((l) => l.id === m.lab)?.title ?? m.lab} · module`,
        text: m.summary,
        keywords: '',
        path: `/learn/${m.lab}#${m.id}`,
      });
    for (const l of lessons)
      add(ms, {
        id: `lesson:${l.id}`,
        kind: 'lesson',
        title: l.title,
        subtitle: `${LABS.find((x) => x.id === l.lab)?.title ?? l.lab} · ${l.moduleTitle}`,
        text: l.summary,
        keywords: l.keywords.join(' '),
        path: `/learn/${l.lab}/${l.id}`,
      });
    for (const s of skills)
      add(ms, { id: `skill:${s.id}`, kind: 'skill', title: s.name, subtitle: `Skill · ${s.domain}`, text: s.description, keywords: s.id, path: `/progress/skill/${s.id}` });
    for (const d of documents)
      add(ms, { id: `doc:${d.id}`, kind: 'document', title: d.title, subtitle: `Study document · ${d.type}`, text: d.summary, keywords: d.type, path: `/documents/${d.id}` });
    for (const c of cases)
      add(ms, { id: `case:${c.id}`, kind: 'case', title: c.title, subtitle: 'Case study', text: c.summary, keywords: '', path: `/cases/${c.id}` });
    for (const c of capstones)
      add(ms, { id: `cap:${c.id}`, kind: 'capstone', title: c.title, subtitle: `Capstone ${c.number}`, text: c.summary, keywords: '', path: `/capstones/${c.id}` });
    index = ms;
    notify();

    // Heavier sources, added as they load.
    void (async () => {
      const [items, ref, xw, comp, manifests] = await Promise.all([
        loadItems(),
        loadReference(),
        loadCrosswalk(),
        loadCompanion(),
        loadManifests().catch(() => []),
      ]);
      for (const c of ref.categories)
        for (const e of c.entries)
          add(ms, {
            id: `ref:${e.id}`,
            kind: 'reference',
            title: e.term,
            subtitle: `Reference · ${c.title}`,
            text: stripMd(`${e.summary} ${e.body ?? ''}`),
            keywords: e.aliases.join(' '),
            path: `/reference/${c.category}/${e.id}`,
          });
      for (const t of xw)
        add(ms, { id: `xw:${t.id}`, kind: 'crosswalk', title: t.title, subtitle: 'Code crosswalk', text: stripMd(t.summary), keywords: t.category, path: `/crosswalk/${t.id}` });
      for (const t of comp)
        add(ms, { id: `ms:${t.id}`, kind: 'companion', title: t.title, subtitle: `MS Companion · ${t.course}`, text: stripMd(t.academic), keywords: t.course, path: `/companion/${t.id}` });
      for (const m of manifests)
        for (const d of m.datasets) {
          add(ms, {
            id: `ds:${d.id}`,
            kind: 'dataset',
            title: `${d.name} — ${d.label}`,
            subtitle: `Dataset · ${m.title}`,
            text: d.description,
            keywords: `${d.id} ${d.layer}`,
            path: `/data/${d.id}`,
          });
          for (const c of d.columns)
            add(ms, {
              id: `var:${d.id}:${c.name}`,
              kind: 'variable',
              title: `${d.name}.${c.name}`,
              subtitle: c.label,
              text: c.derivation ?? '',
              keywords: `${c.name} ${c.role ?? ''}`,
              path: `/data/${d.id}?tab=vars`,
            });
        }
      for (const it of items.all)
        add(ms, {
          id: `item:${it.id}`,
          kind: 'item',
          title: itemTitle(it),
          subtitle: `Practice · ${it.format} · ${it.difficulty}`,
          text: stripMd(it.prompt).slice(0, 600),
          keywords: it.tags.join(' '),
          path: `/practice?ids=${it.id}`,
        });
      notify();
      // Lesson bodies last (largest).
      const loaders = lessonBodyLoaders();
      for (const l of lessons) {
        const loader = loaders[`/content/lessons/${l.lab}/${l.id}.md`];
        if (!loader) continue;
        const body = await loader();
        const d = docs.get(`lesson:${l.id}`);
        if (d) {
          ms.discard(d.id);
          docs.delete(d.id);
          add(ms, { ...d, text: `${l.summary} ${stripMd(body).slice(0, 20000)}` });
        }
      }
      notify();
    })();
    return ms;
  })();
  return building;
}

export function search(query: string, limit = 40): SearchDoc[] {
  if (!index || !query.trim()) return [];
  const res = index.search(query, { combineWith: 'AND' });
  const fallback = res.length ? res : index.search(query, { combineWith: 'OR' });
  return fallback
    .slice(0, limit)
    .map((r) => docs.get(r.id))
    .filter((d): d is SearchDoc => !!d);
}
