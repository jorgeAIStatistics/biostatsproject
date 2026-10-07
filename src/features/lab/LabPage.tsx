import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import clsx from 'clsx';
import { Clock, CircleCheck, CircleDot, Circle, Dumbbell, BookOpen, Wrench } from 'lucide-react';
import { LAB_BY_ID, DOMAIN_BY_ID } from '../../content/labs';
import { modulesForLab, useItems, skillById } from '../../content/registry';
import type { LabId, ModeId } from '../../content/vocab';
import { usePage } from '../../components/layout/page';
import { Badge, ButtonLink, Card, EmptyState, ProgressBar } from '../../components/ui';
import { MasteryMeter } from '../../components/progress/MasteryMeter';
import { useProgress } from '../../state/progress';
import { useMastery } from '../../lib/useMastery';
import { MODE_LABELS } from '../../components/practice/types';
import { LAB_TOOLS } from './labTools';
import './lab.css';

const MODE_ORDER: ModeId[] = ['guided', 'independent', 'debug', 'qc', 'interview', 'speed', 'boss'];
const MODE_BLURB: Record<string, string> = {
  guided: 'Progressive hints',
  independent: 'Minimal help',
  debug: 'Broken code & logs',
  qc: 'Outputs disagree',
  interview: 'Answer withheld',
  speed: 'Quick recognition',
  boss: 'Integrated challenge',
};

export default function LabPage() {
  const { lab } = useParams<{ lab: LabId }>();
  const meta = lab ? LAB_BY_ID[lab] : undefined;
  usePage(meta?.title ?? 'Lab', [{ label: 'Labs' }], 'lab');
  const lessonsProgress = useProgress((s) => s.lessons);
  const attempts = useProgress((s) => s.attempts);
  const items = useItems();
  const mastery = useMastery();

  const mods = useMemo(() => (lab ? modulesForLab(lab) : []), [lab]);
  const labItems = useMemo(() => (items ? items.all.filter((i) => i.lab === lab) : []), [items, lab]);
  const best = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attempts) m.set(a.itemId, Math.max(m.get(a.itemId) ?? 0, a.score));
    return m;
  }, [attempts]);

  if (!meta) return <div className="page"><EmptyState title="Unknown lab" /></div>;

  const allLessons = mods.flatMap((m) => m.lessons);
  const minutes = allLessons.reduce((s, l) => s + l.minutes, 0);
  const completed = allLessons.filter((l) => lessonsProgress[l.id]?.completedAt).length;
  const solved = labItems.filter((i) => (best.get(i.id) ?? 0) >= 0.8).length;
  const labSkills = [...new Set(allLessons.flatMap((l) => l.skills))];
  const modeCounts = new Map<ModeId, number>();
  for (const it of labItems) for (const m of it.modes) modeCounts.set(m, (modeCounts.get(m) ?? 0) + 1);
  const tools = LAB_TOOLS[meta.id] ?? [];

  return (
    <div className="page">
      <header className="lab-hero">
        <div className="stack gap-2" style={{ minWidth: 0 }}>
          <div className="eyebrow">Lab</div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-lede">{meta.description}</p>
          <div className="row gap-2 wrap" style={{ marginTop: 4 }}>
            {meta.domains.map((d) => (
              <Badge key={d} tone="accent">
                {DOMAIN_BY_ID[d]?.title ?? d} · {Math.round((mastery.byDomain.get(d) ?? 0) * 100)}%
              </Badge>
            ))}
          </div>
        </div>
        <div className="lab-hero__stats">
          <div className="lab-stat">
            <span className="lab-stat__value num">{allLessons.length}</span>
            <span className="lab-stat__label">lessons</span>
          </div>
          <div className="lab-stat">
            <span className="lab-stat__value num">{Math.round(minutes / 60)}h</span>
            <span className="lab-stat__label">of study</span>
          </div>
          <div className="lab-stat">
            <span className="lab-stat__value num">{labItems.length}</span>
            <span className="lab-stat__label">exercises</span>
          </div>
          <div className="lab-stat">
            <span className="lab-stat__value num">
              {completed}/{allLessons.length}
            </span>
            <span className="lab-stat__label">read</span>
          </div>
          <div className="lab-stat">
            <span className="lab-stat__value num">
              {solved}/{labItems.length}
            </span>
            <span className="lab-stat__label">solved</span>
          </div>
        </div>
      </header>

      <div className="lab-grid">
        <div className="stack gap-6" style={{ minWidth: 0 }}>
          {mods.length === 0 && (
            <Card pad="md">
              <EmptyState icon={<BookOpen />} title="No lessons in this lab yet">
                Curriculum files for this lab have not been added to content/curriculum/.
              </EmptyState>
            </Card>
          )}
          {mods.map((m, mi) => {
            const done = m.lessons.filter((l) => lessonsProgress[l.id]?.completedAt).length;
            return (
              <section key={m.id} id={m.id} className="module">
                <div className="module__head">
                  <div className="module__index num">{String(mi + 1).padStart(2, '0')}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <h2 className="module__title">{m.title}</h2>
                    <p className="module__summary">{m.summary}</p>
                  </div>
                  <div className="module__progress">
                    <span className="muted num" style={{ fontSize: 12 }}>
                      {done}/{m.lessons.length}
                    </span>
                    <ProgressBar value={m.lessons.length ? done / m.lessons.length : 0} thin />
                  </div>
                </div>
                <ol className="module__lessons">
                  {m.lessons.map((l) => {
                    const p = lessonsProgress[l.id];
                    const li = labItems.filter((i) => i.lesson === l.id);
                    const ls = li.filter((i) => (best.get(i.id) ?? 0) >= 0.8).length;
                    const status = p?.completedAt ? 'done' : p ? 'started' : 'new';
                    return (
                      <li key={l.id}>
                        <Link to={`/learn/${m.lab}/${l.id}`} className={clsx('lesson-row', `is-${status}`)}>
                          <span className="lesson-row__status">
                            {status === 'done' ? <CircleCheck /> : status === 'started' ? <CircleDot /> : <Circle />}
                          </span>
                          <span className="lesson-row__main">
                            <span className="lesson-row__title">{l.title}</span>
                            <span className="lesson-row__summary">{l.summary}</span>
                          </span>
                          <span className="lesson-row__meta">
                            <span className="row gap-1">
                              <Clock size={12} /> {l.minutes}m
                            </span>
                            {li.length > 0 && (
                              <span className="row gap-1">
                                <Dumbbell size={12} /> {ls}/{li.length}
                              </span>
                            )}
                            <span className={clsx('diff-dot', `diff-dot--${l.difficulty}`)} title={l.difficulty} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>

        <aside className="stack gap-4">
          <Card>
            <div className="card__header">
              <div className="card__title">Practice by mode</div>
            </div>
            <div className="mode-grid">
              {MODE_ORDER.filter((m) => (modeCounts.get(m) ?? 0) > 0).map((m) => (
                <Link key={m} to={`/practice?lab=${meta.id}&mode=${m}&count=8`} className="mode-tile">
                  <span className="mode-tile__name">{MODE_LABELS[m]}</span>
                  <span className="mode-tile__blurb">{MODE_BLURB[m]}</span>
                  <span className="mode-tile__count num">{modeCounts.get(m)}</span>
                </Link>
              ))}
              {labItems.length === 0 && <div className="muted" style={{ padding: 12, fontSize: 13 }}>No exercises yet.</div>}
            </div>
          </Card>

          {tools.length > 0 && (
            <Card>
              <div className="card__header">
                <div className="card__title row gap-2">
                  <Wrench size={14} /> Lab tools
                </div>
              </div>
              <div className="stack" style={{ padding: 8 }}>
                {tools.map((t) => (
                  <Link key={t.to} to={t.to} className="link-row">
                    <span className="grow">
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560 }}>{t.label}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {labSkills.length > 0 && (
            <Card>
              <div className="card__header">
                <div className="card__title">Skills in this lab</div>
              </div>
              <ul className="list-reset" style={{ padding: 8 }}>
                {labSkills.map((s) => {
                  const m = mastery.bySkill.get(s);
                  return (
                    <li key={s}>
                      <Link to={`/progress/skill/${s}`} className="link-row" style={{ fontSize: 13 }}>
                        <span className="grow">{skillById.get(s)?.name ?? s}</span>
                        {m && <MasteryMeter level={m.level} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <ButtonLink to="/path" variant="ghost">
            View the full learning path →
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
