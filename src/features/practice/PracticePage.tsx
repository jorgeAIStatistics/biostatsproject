import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Flag, RotateCcw, CircleCheck, CircleDot, CircleX } from 'lucide-react';
import { useItems, itemTitle, type ItemInfo } from '../../content/registry';
import { LABS } from '../../content/labs';
import type { ModeId, Difficulty } from '../../content/vocab';
import { usePage } from '../../components/layout/page';
import { ItemView } from '../../components/practice/ItemView';
import { MODE_LABELS, seededShuffle } from '../../components/practice/types';
import { Badge, Button, Card, EmptyState, Loading, ProgressBar } from '../../components/ui';
import { useProgress } from '../../state/progress';
import './practice-page.css';

const MODES: { id: ModeId; title: string; description: string }[] = [
  { id: 'guided', title: 'Guided practice', description: 'Work through problems with progressively stronger hints. Best when a topic is new.' },
  { id: 'independent', title: 'Independent practice', description: 'Minimal assistance. Hints are available but reduce mastery credit.' },
  { id: 'debug', title: 'Debug mode', description: 'Broken programs, misleading logs, invalid derivations and questionable interpretations. Diagnose them.' },
  { id: 'qc', title: 'QC mode', description: 'Two independently produced outputs disagree. Determine why — denominators, populations, joins, windows…' },
  { id: 'interview', title: 'Interview mode', description: 'Realistic questions. The answer is withheld until you commit to yours.' },
  { id: 'speed', title: 'Speed drill', description: 'Short, timed recognition and syntax items to build fluency.' },
  { id: 'boss', title: 'Boss battle', description: 'Difficult, integrated exercises that combine several skills.' },
];

function selectItems(all: ItemInfo[], params: URLSearchParams): ItemInfo[] {
  const ids = params.get('ids');
  if (ids) {
    const map = new Map(all.map((i) => [i.id, i]));
    return ids
      .split(',')
      .map((s) => map.get(s.trim()))
      .filter((x): x is ItemInfo => !!x);
  }
  const lab = params.get('lab');
  const mode = params.get('mode') as ModeId | null;
  const format = params.get('format');
  const skill = params.get('skill');
  const tag = params.get('tag');
  const diff = params.get('difficulty') as Difficulty | null;
  const count = Number(params.get('count') ?? 10);
  let pool = all.filter(
    (i) =>
      (!lab || i.lab === lab) &&
      (!mode || i.modes.includes(mode)) &&
      (!format || i.format === format) &&
      (!skill || i.skills.includes(skill)) &&
      (!tag || i.tags.includes(tag)) &&
      (!diff || i.difficulty === diff),
  );
  // A fresh-but-stable order for the day, so refreshing does not reshuffle mid-session.
  pool = seededShuffle(pool, `${params.toString()}:${new Date().toDateString()}`);
  return pool.slice(0, count);
}

export default function PracticePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const index = useItems();
  const attempts = useProgress((s) => s.attempts);
  const title = params.get('title') ?? (params.get('mode') ? MODE_LABELS[params.get('mode') as ModeId] : params.get('ids') ? 'Practice' : 'Practice modes');
  usePage(title, [{ label: 'Practice', to: '/practice' }], 'practice');

  const items = useMemo(() => (index ? selectItems(index.all, params) : []), [index, params]);
  const [pos, setPos] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const modeParam = params.get('mode') as ModeId | null;

  const hasSelection = ['ids', 'lab', 'mode', 'format', 'skill', 'tag'].some((k) => params.get(k));

  if (!index) return <div className="page"><Loading label="Loading exercises…" /></div>;

  if (!hasSelection) return <ModePicker counts={index.all} />;

  if (items.length === 0) {
    return (
      <div className="page page--narrow">
        <EmptyState title="No exercises match this selection" action={<Button onClick={() => navigate('/practice')}>Choose a practice mode</Button>}>
          Try a different lab, mode or difficulty.
        </EmptyState>
      </div>
    );
  }

  const current = items[Math.min(pos, items.length - 1)];
  const solvedCount = Object.values(scores).filter((s) => s >= 0.8).length;

  if (finished) {
    const total = items.length;
    const avg = total ? items.reduce((s, i) => s + (scores[i.id] ?? 0), 0) / total : 0;
    return (
      <div className="page page--narrow">
        <Card pad="md">
          <div className="stack gap-4">
            <div>
              <div className="eyebrow">Session complete</div>
              <h1 className="page-title" style={{ marginTop: 4 }}>
                {title}
              </h1>
            </div>
            <div className="grid grid-3">
              <div className="w-stat">
                <div className="w-stat__label">Solved</div>
                <div className="w-stat__value">
                  {solvedCount}/{total}
                </div>
              </div>
              <div className="w-stat">
                <div className="w-stat__label">Average score</div>
                <div className="w-stat__value">{Math.round(avg * 100)}%</div>
              </div>
              <div className="w-stat">
                <div className="w-stat__label">Attempted</div>
                <div className="w-stat__value">{Object.keys(scores).length}</div>
              </div>
            </div>
            <ul className="list-reset session-summary">
              {items.map((it) => {
                const s = scores[it.id];
                return (
                  <li key={it.id} className="row gap-3">
                    {s === undefined ? <CircleDot className="muted" size={16} /> : s >= 0.8 ? <CircleCheck size={16} color="var(--success)" /> : <CircleX size={16} color="var(--danger)" />}
                    <span className="grow">{itemTitle(it)}</span>
                    <span className="muted num" style={{ fontSize: 12 }}>
                      {s === undefined ? 'skipped' : `${Math.round(s * 100)}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="muted" style={{ fontSize: 13 }}>
              Missed items are scheduled in your review queue automatically (spaced repetition: 1, 3, 7, 16, 35 days as you get them right).
            </p>
            <div className="row gap-2 wrap">
              <Button
                icon={<RotateCcw />}
                onClick={() => {
                  setScores({});
                  setPos(0);
                  setFinished(false);
                }}
              >
                Repeat session
              </Button>
              <Button variant="primary" onClick={() => navigate('/review')}>
                Go to review queue
              </Button>
              <Button variant="ghost" onClick={() => navigate('/practice')}>
                Choose another mode
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const prevBest = (id: string) => attempts.filter((a) => a.itemId === id).reduce((m, a) => Math.max(m, a.score), -1);

  return (
    <div className="page practice-page">
      <div className="practice-head">
        <div className="stack gap-1" style={{ minWidth: 0 }}>
          <div className="eyebrow">{modeParam ? MODE_LABELS[modeParam] : 'Practice'}</div>
          <h1 className="practice-head__title">{title}</h1>
        </div>
        <div className="practice-head__progress">
          <span className="muted num" style={{ fontSize: 12.5 }}>
            {Math.min(pos + 1, items.length)} of {items.length}
          </span>
          <ProgressBar value={(pos + (scores[current.id] !== undefined ? 1 : 0)) / items.length} />
        </div>
      </div>

      {items.length > 1 && (
        <div className="practice-dots" role="tablist" aria-label="Exercises in this session">
          {items.map((it, i) => {
            const s = scores[it.id];
            const pb = prevBest(it.id);
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === pos}
                title={itemTitle(it)}
                className={clsx('practice-dots__dot', i === pos && 'is-current', s !== undefined && (s >= 0.8 ? 'is-right' : 'is-wrong'), s === undefined && pb >= 0.8 && 'is-known')}
                onClick={() => setPos(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      <ItemView
        key={current.id}
        item={current}
        mode={modeParam ?? undefined}
        showLessonLink
        onFinished={(score) => setScores((s) => ({ ...s, [current.id]: score }))}
        onNext={pos < items.length - 1 ? () => setPos((p) => p + 1) : () => setFinished(true)}
        nextLabel={pos < items.length - 1 ? 'Next exercise' : 'Finish session'}
      />

      <div className="practice-nav">
        <Button variant="ghost" icon={<ArrowLeft />} disabled={pos === 0} onClick={() => setPos((p) => Math.max(0, p - 1))}>
          Previous
        </Button>
        <span className="grow" />
        {pos < items.length - 1 ? (
          <Button variant="ghost" iconRight={<ArrowRight />} onClick={() => setPos((p) => p + 1)}>
            Skip
          </Button>
        ) : (
          <Button variant="subtle" icon={<Flag />} onClick={() => setFinished(true)}>
            End session
          </Button>
        )}
      </div>
    </div>
  );
}

function ModePicker({ counts }: { counts: ItemInfo[] }) {
  const [lab, setLab] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const pool = counts.filter((i) => (!lab || i.lab === lab) && (!difficulty || i.difficulty === difficulty));
  const q = (mode: ModeId) => {
    const p = new URLSearchParams({ mode, count: mode === 'speed' ? '15' : '8' });
    if (lab) p.set('lab', lab);
    if (difficulty) p.set('difficulty', difficulty);
    return `/practice?${p.toString()}`;
  };
  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Learning modes</div>
        <h1 className="page-title">Practice</h1>
        <p className="page-lede">
          Mastery is earned by performance. Pick a mode; sessions draw from {counts.length.toLocaleString()} exercises across every lab. Your answers feed
          the skill matrix and the spaced-repetition review queue.
        </p>
      </div>
      <div className="row gap-3 wrap" style={{ marginBottom: 20 }}>
        <select className="select" style={{ width: 220 }} value={lab} onChange={(e) => setLab(e.target.value)} aria-label="Lab">
          <option value="">All labs</option>
          {LABS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
          <option value="interview">Interview bank</option>
        </select>
        <select className="select" style={{ width: 180 }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          <option value="foundation">Foundation</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>
      </div>
      <div className="grid grid-auto">
        {MODES.map((m) => {
          const n = pool.filter((i) => i.modes.includes(m.id)).length;
          return (
            <Link key={m.id} to={q(m.id)} className={clsx('card card--interactive card--pad mode-card', n === 0 && 'is-empty')}>
              <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{m.title}</span>
                <Badge tone={n ? 'accent' : 'neutral'}>{n}</Badge>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                {m.description}
              </p>
            </Link>
          );
        })}
        <Link to="/cases" className="card card--interactive card--pad mode-card">
          <span style={{ fontWeight: 600 }}>Case studies</span>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            Multi-step realistic projects on the CBX417-301 study and the manufacturing process.
          </p>
        </Link>
      </div>
    </div>
  );
}
