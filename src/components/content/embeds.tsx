/**
 * Implementations of the leaf directives used in lessons:
 * ::dataset ::quiz ::practice ::widget ::doc ::lesson ::crosswalk
 */
import { Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Database, Maximize2, CirclePlay, FileText, BookOpen, ArrowRight, Shuffle } from 'lucide-react';
import { useDataset, parseFilter, applyFilter, sortRows } from '../../lib/datasets';
import { DataTable } from '../data/DataTable';
import { Badge, Button, ButtonLink, Drawer, Loading, EmptyState } from '../ui';
import { DatasetViewer } from '../data/DatasetViewer';
import { ItemView } from '../practice/ItemView';
import { FORMAT_LABELS, MODE_LABELS } from '../practice/types';
import { useItems, itemTitle, documentById, lessonById } from '../../content/registry';
import { useProgress } from '../../state/progress';
import { WidgetHost } from '../widgets/registry';
import { CrosswalkTaskView } from './CrosswalkTaskView';
import { useCrosswalk } from '../../content/registry';
import '../data/data.css';

function DatasetEmbed({ attrs }: { attrs: Record<string, string> }) {
  const { data, error, loading } = useDataset(attrs.id);
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    if (!data) return [];
    let r = applyFilter(data.rows, parseFilter(attrs.filter));
    if (attrs.sort) {
      const [col, dir] = attrs.sort.trim().split(/\s+/);
      r = sortRows(r, col, dir?.toLowerCase() === 'desc');
    }
    return r.slice(0, Math.min(200, Number(attrs.rows ?? 10) || 10));
  }, [data, attrs]);
  const cols = useMemo(() => {
    if (!data) return [];
    const wanted = attrs.cols ? attrs.cols.split(',').map((s) => s.trim()).filter(Boolean) : data.columns;
    return wanted.map((name) => {
      const c = data.meta.columns.find((x) => x.name === name);
      return { name, label: c?.label, type: c?.type };
    });
  }, [data, attrs]);

  if (loading) return <Loading label={`Loading ${attrs.id}…`} />;
  if (error || !data)
    return (
      <div className="callout callout--warning">
        <span className="callout__icon">
          <Database />
        </span>
        <div className="callout__body">
          <div className="callout__title">Dataset {attrs.id} is not available</div>
          <div className="callout__content">{error} Run <code>npm run data</code> to generate the synthetic datasets.</div>
        </div>
      </div>
    );
  return (
    <figure className="ds-embed">
      <div className="ds-embed__head">
        <Database size={15} style={{ color: 'var(--text-3)' }} />
        <span className="ds-embed__name">{data.meta.name}</span>
        <span className="ds-embed__label">{data.meta.label}</span>
        <span className="grow" />
        <Button size="sm" variant="ghost" icon={<Maximize2 />} onClick={() => setOpen(true)}>
          Open dataset
        </Button>
      </div>
      <DataTable columns={cols} rows={rows} maxHeight={420} virtualize={false} />
      <figcaption className="ds-embed__foot">
        {attrs.caption ? `${attrs.caption} · ` : ''}Showing {rows.length} of {data.rows.length.toLocaleString()} rows
        {attrs.filter ? ` where ${attrs.filter.replace(/;/g, ' and ')}` : ''}.
      </figcaption>
      <Drawer open={open} onClose={() => setOpen(false)} title={`${data.meta.name} — ${data.meta.label}`} size="lg">
        <DatasetViewer id={attrs.id} compact />
      </Drawer>
    </figure>
  );
}

function QuizEmbed({ attrs }: { attrs: Record<string, string> }) {
  const index = useItems();
  const ids = (attrs.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!index) return <Loading label="Loading questions…" />;
  const items = ids.map((id) => index.byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return null;
  return (
    <div className="quiz-embed">
      {items.map((it, i) => (
        <ItemView
          key={it.id}
          item={it}
          mode="check"
          inline
          headerExtra={
            <span className="muted num" style={{ fontSize: 12 }}>
              Question {i + 1} of {items.length}
            </span>
          }
        />
      ))}
    </div>
  );
}

function PracticeEmbed({ attrs }: { attrs: Record<string, string> }) {
  const index = useItems();
  const attempts = useProgress((s) => s.attempts);
  const ids = (attrs.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!index) return <Loading label="Loading practice…" />;
  const items = ids.map((id) => index.byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return null;
  const best = (id: string) => attempts.filter((a) => a.itemId === id).reduce((m, a) => Math.max(m, a.score), -1);
  const params = new URLSearchParams({ ids: items.map((i) => i.id).join(','), title: attrs.title ?? 'Practice' });
  if (attrs.mode) params.set('mode', attrs.mode);
  return (
    <div className="practice-embed">
      <div className="practice-embed__head">
        <div>
          <div className="practice-embed__title">{attrs.title ?? 'Practice'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {items.length} exercise{items.length === 1 ? '' : 's'} · about {Math.max(5, Math.round(items.reduce((s, i) => s + (i.minutes ?? 4), 0)))} min
          </div>
        </div>
        <ButtonLink to={`/practice?${params.toString()}`} variant="primary" icon={<CirclePlay />}>
          Start
        </ButtonLink>
      </div>
      <ul className="practice-embed__list">
        {items.map((it) => {
          const b = best(it.id);
          return (
            <li key={it.id}>
              <Link to={`/practice?ids=${it.id}`} className="practice-embed__row">
                <span className={`practice-dot ${b >= 0.8 ? 'is-done' : b >= 0 ? 'is-tried' : ''}`} aria-hidden="true" />
                <span className="grow">{itemTitle(it)}</span>
                <Badge tone="neutral">{FORMAT_LABELS[it.format]}</Badge>
                <Badge tone="accent" outline>
                  {MODE_LABELS[it.modes[0]]}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DocEmbed({ attrs }: { attrs: Record<string, string> }) {
  const doc = documentById.get(attrs.id);
  if (!doc) return null;
  return (
    <Link to={`/documents/${doc.id}${attrs.section ? `#${attrs.section}` : ''}`} className="link-card">
      <FileText />
      <div className="grow">
        <div className="link-card__title">{attrs.label ?? doc.title}</div>
        <div className="link-card__sub">{doc.summary}</div>
      </div>
      <ArrowRight />
    </Link>
  );
}

function LessonEmbed({ attrs }: { attrs: Record<string, string> }) {
  const l = lessonById.get(attrs.id);
  if (!l) return null;
  return (
    <Link to={`/learn/${l.lab}/${l.id}`} className="link-card">
      <BookOpen />
      <div className="grow">
        <div className="link-card__title">{attrs.label ?? l.title}</div>
        <div className="link-card__sub">{l.summary}</div>
      </div>
      <ArrowRight />
    </Link>
  );
}

function CrosswalkEmbed({ attrs }: { attrs: Record<string, string> }) {
  const tasks = useCrosswalk();
  if (!tasks) return <Loading />;
  const t = tasks.find((x) => x.id === attrs.id);
  if (!t) return null;
  return (
    <div className="crosswalk-embed">
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <Shuffle size={15} style={{ color: 'var(--text-3)' }} />
        <span style={{ fontWeight: 600 }}>Code crosswalk: {t.title}</span>
        <span className="grow" />
        <Link to={`/crosswalk/${t.id}`} style={{ fontSize: 12.5 }}>
          Open in crosswalk
        </Link>
      </div>
      <CrosswalkTaskView task={t} compact />
    </div>
  );
}

export default function Embed({ name, attrs }: { name: string; attrs: Record<string, string> }) {
  switch (name) {
    case 'dataset':
      return <DatasetEmbed attrs={attrs} />;
    case 'quiz':
      return <QuizEmbed attrs={attrs} />;
    case 'practice':
      return <PracticeEmbed attrs={attrs} />;
    case 'widget':
      return (
        <Suspense fallback={<Loading label="Loading interactive…" />}>
          <WidgetHost name={attrs.name} props={attrs} />
        </Suspense>
      );
    case 'doc':
      return <DocEmbed attrs={attrs} />;
    case 'lesson':
      return <LessonEmbed attrs={attrs} />;
    case 'crosswalk':
      return <CrosswalkEmbed attrs={attrs} />;
    default:
      return <EmptyState title={`Unknown embed "${name}"`} />;
  }
}
