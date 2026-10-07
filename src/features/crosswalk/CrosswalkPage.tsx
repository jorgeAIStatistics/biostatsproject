import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import clsx from 'clsx';
import { ArrowLeftRight, Search } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useCrosswalk } from '../../content/registry';
import { Badge, Card, EmptyState, Loading } from '../../components/ui';
import { CrosswalkTaskView } from '../../components/content/CrosswalkTaskView';
import '../reference/reference.css';

const CATEGORY_LABELS: Record<string, string> = {
  data: 'Data handling',
  reshape: 'Reshaping',
  derivation: 'Derivations',
  summary: 'Summaries',
  model: 'Models',
  io: 'Input / output',
  qc: 'QC & comparison',
};

export default function CrosswalkPage() {
  const { taskId } = useParams<{ taskId?: string }>();
  const tasks = useCrosswalk();
  const [q, setQ] = useState('');
  const task = tasks?.find((t) => t.id === taskId);
  usePage(task?.title ?? 'Code Crosswalk', task ? [{ label: 'Crosswalk', to: '/crosswalk' }] : [], 'crosswalk');
  const groups = useMemo(() => {
    const list = (tasks ?? []).filter((t) => !q || `${t.title} ${t.summary}`.toLowerCase().includes(q.toLowerCase()));
    const map = new Map<string, typeof list>();
    for (const t of list) map.set(t.category, [...(map.get(t.category) ?? []), t]);
    return [...map.entries()];
  }, [tasks, q]);

  if (!tasks) return <div className="page"><Loading /></div>;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">SAS · R · Python · SQL</div>
        <h1 className="page-title">Code crosswalk</h1>
        <p className="page-lede">
          The same task in each language — and, more importantly, the semantic differences that make “equivalent” code produce different answers: missing
          values, sort stability, rounding, quantile definitions, NULL logic, ties handling and default confidence intervals.
        </p>
      </div>
      <div className="ref-layout">
        <nav className="ref-nav" aria-label="Crosswalk tasks">
          <div className="search-input" style={{ marginBottom: 8 }}>
            <Search />
            <input className="input" placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tasks" />
          </div>
          {groups.map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div className="eyebrow" style={{ padding: '6px 10px 2px' }}>
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {list.map((t) => (
                <Link key={t.id} to={`/crosswalk/${t.id}`} className={clsx('ref-nav__item', t.id === taskId && 'is-active')}>
                  {t.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {task ? (
            <Card pad="md">
              <div className="stack gap-2">
                <div className="row gap-2">
                  <Badge tone="accent">{CATEGORY_LABELS[task.category] ?? task.category}</Badge>
                </div>
                <h2 style={{ fontSize: 21 }}>{task.title}</h2>
                <CrosswalkTaskView task={task} />
              </div>
            </Card>
          ) : tasks.length === 0 ? (
            <Card pad="md">
              <EmptyState icon={<ArrowLeftRight />} title="No crosswalk tasks yet">Tasks live in content/crosswalk/*.yaml.</EmptyState>
            </Card>
          ) : (
            <div className="grid grid-auto">
              {tasks.map((t) => (
                <Link key={t.id} to={`/crosswalk/${t.id}`} className="card card--interactive card--pad">
                  <div style={{ fontWeight: 620 }}>{t.title}</div>
                  <div className="row gap-1 wrap" style={{ marginTop: 8 }}>
                    {(['sas', 'r', 'python', 'sql'] as const)
                      .filter((l) => t[l])
                      .map((l) => (
                        <Badge key={l} tone="neutral">
                          {l === 'sas' ? 'SAS' : l === 'r' ? 'R' : l === 'python' ? 'Python' : 'SQL'}
                        </Badge>
                      ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
