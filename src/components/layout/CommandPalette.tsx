import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import {
  Search,
  BookOpen,
  Layers,
  Dumbbell,
  Library,
  HardDrive,
  Columns3,
  FileText,
  ArrowLeftRight,
  GraduationCap,
  Briefcase,
  Milestone,
  Target,
  CornerDownLeft,
  History,
  Compass,
  FlaskConical,
} from 'lucide-react';
import { buildSearchIndex, search, onSearchIndexGrow, type SearchDoc, type SearchKind } from '../../lib/search';
import { useProgress } from '../../state/progress';
import { Kbd } from '../ui';

const KIND_META: Record<SearchKind, { label: string; icon: typeof Search }> = {
  page: { label: 'Page', icon: Compass },
  lab: { label: 'Lab', icon: FlaskConical },
  module: { label: 'Module', icon: Layers },
  lesson: { label: 'Lesson', icon: BookOpen },
  item: { label: 'Practice', icon: Dumbbell },
  reference: { label: 'Reference', icon: Library },
  dataset: { label: 'Dataset', icon: HardDrive },
  variable: { label: 'Variable', icon: Columns3 },
  document: { label: 'Document', icon: FileText },
  crosswalk: { label: 'Crosswalk', icon: ArrowLeftRight },
  companion: { label: 'MS Companion', icon: GraduationCap },
  case: { label: 'Case study', icon: Briefcase },
  capstone: { label: 'Capstone', icon: Milestone },
  skill: { label: 'Skill', icon: Target },
};

const FILTERS: { id: 'all' | SearchKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lesson', label: 'Lessons' },
  { id: 'reference', label: 'Reference' },
  { id: 'item', label: 'Practice' },
  { id: 'dataset', label: 'Datasets' },
  { id: 'variable', label: 'Variables' },
  { id: 'crosswalk', label: 'Crosswalk' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<'all' | SearchKind>('all');
  const [, setVersion] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const history = useProgress((s) => s.history);

  useEffect(() => {
    if (!open) return;
    void buildSearchIndex().then(() => setVersion((v) => v + 1));
    const off = onSearchIndexGrow(() => setVersion((v) => v + 1));
    window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      off();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results: SearchDoc[] = useMemo(() => {
    if (!query.trim()) {
      return history.slice(0, 8).map((h) => ({ id: `hist:${h.path}`, kind: 'page' as const, title: h.title, subtitle: 'Recently visited', text: '', keywords: '', path: h.path }));
    }
    const r = search(query, 80);
    return (filter === 'all' ? r : r.filter((d) => d.kind === filter)).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter, history, open, setVersion]);

  useEffect(() => setActive(0), [query, filter]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (d: SearchDoc) => {
    onClose();
    navigate(d.path);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const d = results[active];
      if (d) go(d);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const i = FILTERS.findIndex((f) => f.id === filter);
      setFilter(FILTERS[(i + (e.shiftKey ? FILTERS.length - 1 : 1)) % FILTERS.length].id);
    }
  };

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}>
        <div className="palette__input">
          <Search />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons, SAS procedures, SDTM variables, datasets, exercises…"
            aria-label="Search"
            spellCheck={false}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="palette__filters" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className="palette__filter" onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="palette__list" ref={listRef} role="listbox">
          {!query.trim() && results.length > 0 && (
            <div className="palette__section">
              <History size={12} /> Recent
            </div>
          )}
          {results.map((d, i) => {
            const meta = KIND_META[d.kind];
            const Icon = meta.icon;
            return (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-idx={i}
                className={clsx('palette__item', i === active && 'is-active')}
                onMouseMove={() => setActive(i)}
                onClick={() => go(d)}
              >
                <span className="palette__icon">
                  <Icon />
                </span>
                <span className="palette__text">
                  <span className="palette__title">{d.title}</span>
                  <span className="palette__sub">{d.subtitle}</span>
                </span>
                <span className="palette__kind">{meta.label}</span>
                {i === active && <CornerDownLeft className="palette__enter" />}
              </button>
            );
          })}
          {query.trim() && results.length === 0 && <div className="palette__empty">No results for “{query}”.</div>}
          {!query.trim() && results.length === 0 && (
            <div className="palette__empty">Type to search every lesson, exercise, dataset variable and reference entry.</div>
          )}
        </div>
        <div className="palette__foot">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>Tab</Kbd> filter
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
