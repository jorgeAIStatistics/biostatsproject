import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { CircleCheck, CircleDot, Circle, Clock, Search, Check } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { modules, lessons } from '../../content/registry';
import { LABS, LAB_BY_ID, TRACKS } from '../../content/labs';
import { PHASES } from '../../lib/plan';
import { useProgress } from '../../state/progress';
import { Badge, Segmented } from '../../components/ui';
import type { Difficulty, TrackId } from '../../content/vocab';
import './path.css';

export default function LearningPathPage() {
  usePage('Learning Path');
  const progress = useProgress((s) => s.lessons);
  const [track, setTrack] = useState<TrackId | 'all'>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [lab, setLab] = useState<string>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter(
      (l) =>
        (track === 'all' || l.tracks.includes(track)) &&
        (difficulty === 'all' || l.difficulty === difficulty) &&
        (lab === 'all' || l.lab === lab) &&
        (!q || `${l.title} ${l.summary} ${l.keywords.join(' ')}`.toLowerCase().includes(q)),
    );
  }, [track, difficulty, lab, query]);
  const visible = new Set(filtered.map((l) => l.id));

  const done = lessons.filter((l) => progress[l.id]?.completedAt).length;
  const totalMinutes = lessons.reduce((s, l) => s + l.minutes, 0);

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Curriculum</div>
        <h1 className="page-title">Learning path</h1>
        <p className="page-lede">
          {lessons.length} lessons across {LABS.length} labs (~{Math.round(totalMinutes / 60)} hours of instruction before practice), organized in five phases
          that follow the clinical data lifecycle. {done} read so far.
        </p>
      </div>

      <div className="path-filters">
        <div className="search-input" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <Search />
          <input className="input" placeholder="Filter lessons…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter lessons" />
        </div>
        <select className="select" style={{ width: 200 }} value={lab} onChange={(e) => setLab(e.target.value)} aria-label="Lab">
          <option value="all">All labs</option>
          {LABS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 240 }} value={track} onChange={(e) => setTrack(e.target.value as TrackId | 'all')} aria-label="Career track">
          <option value="all">All career tracks</option>
          {TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <Segmented
          ariaLabel="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'all', label: 'All' },
            { value: 'foundation', label: 'Foundation' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
            { value: 'expert', label: 'Expert' },
          ]}
        />
      </div>

      <div className="path">
        {PHASES.map((phase) => {
          const phaseModules = modules.filter((m) => m.level === phase.level && m.lessons.some((l) => visible.has(l.id)));
          if (phaseModules.length === 0) return null;
          const phaseLessons = phaseModules.flatMap((m) => m.lessons);
          const phaseDone = phaseLessons.filter((l) => progress[l.id]?.completedAt).length;
          // Phase state drives the rail, so the path reads as a progression
          // rather than a list: finished phases are solid, the one you are in is
          // ringed, and later phases recede.
          const complete = phaseDone === phaseLessons.length;
          const started = phaseDone > 0;
          const state = complete ? 'is-complete' : started ? 'is-current' : 'is-upcoming';
          return (
            <section key={phase.level} className={`phase ${state}`}>
              <div className="phase__rail">
                <span className="phase__num num">{complete ? <Check size={15} strokeWidth={3} /> : phase.level}</span>
              </div>
              <div className="phase__body">
                <div className="phase__head">
                  <div>
                    <h2 className="phase__title">{phase.title}</h2>
                    <p className="phase__focus">{phase.focus}</p>
                  </div>
                  <span className="muted num" style={{ fontSize: 12.5 }}>
                    {phaseDone}/{phaseLessons.length} read
                  </span>
                </div>
                <div className="phase__modules">
                  {phaseModules.map((m) => (
                    <div key={m.id} className="path-module">
                      <div className="path-module__head">
                        <Badge tone="accent">{LAB_BY_ID[m.lab]?.short}</Badge>
                        <Link to={`/learn/${m.lab}#${m.id}`} className="path-module__title">
                          {m.title}
                        </Link>
                      </div>
                      <ul className="list-reset">
                        {m.lessons
                          .filter((l) => visible.has(l.id))
                          .map((l) => {
                            const p = progress[l.id];
                            return (
                              <li key={l.id}>
                                <Link to={`/learn/${l.lab}/${l.id}`} className={clsx('path-lesson', p?.completedAt && 'is-done')}>
                                  {p?.completedAt ? <CircleCheck size={15} /> : p ? <CircleDot size={15} /> : <Circle size={15} />}
                                  <span className="grow">{l.title}</span>
                                  <span className="muted row gap-1" style={{ fontSize: 11.5 }}>
                                    <Clock size={11} />
                                    {l.minutes}m
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && <p className="muted">No lessons match these filters.</p>}
      </div>
    </div>
  );
}
