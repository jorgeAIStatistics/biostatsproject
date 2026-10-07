import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Search, MessagesSquare, Play, Shuffle } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useItems, itemTitle, type ItemInfo } from '../../content/registry';
import { useProgress } from '../../state/progress';
import { ItemView } from '../../components/practice/ItemView';
import { Badge, Button, Card, EmptyState, Loading, Segmented } from '../../components/ui';
import { seededShuffle } from '../../components/practice/types';
import './interview.css';

/** Interview categories derive from the item's skill domains / lab. */
const CATEGORIES: { id: string; label: string; match: (i: ItemInfo) => boolean }[] = [
  { id: 'sas', label: 'SAS', match: (i) => i.skills.some((s) => s.startsWith('sas.')) },
  { id: 'stats', label: 'Statistics', match: (i) => i.skills.some((s) => s.startsWith('stats.')) && !i.skills.some((s) => ['stats.survival', 'stats.cox', 'stats.ph-assumption', 'stats.linear-regression', 'stats.logistic'].includes(s)) },
  { id: 'regression', label: 'Regression', match: (i) => i.skills.some((s) => ['stats.linear-regression', 'stats.logistic', 'stats.diagnostics', 'stats.interactions', 'analytics.regression'].includes(s)) },
  { id: 'survival', label: 'Survival analysis', match: (i) => i.skills.some((s) => ['stats.survival', 'stats.cox', 'stats.ph-assumption', 'adam.adtte'].includes(s)) },
  { id: 'trials', label: 'Clinical trials', match: (i) => i.skills.some((s) => s.startsWith('trials.')) },
  { id: 'cdisc', label: 'CDISC', match: (i) => i.skills.some((s) => s.startsWith('regulatory.')) },
  { id: 'sdtm', label: 'SDTM', match: (i) => i.skills.some((s) => s.startsWith('sdtm.')) },
  { id: 'adam', label: 'ADaM', match: (i) => i.skills.some((s) => s.startsWith('adam.')) },
  { id: 'tlf', label: 'TLFs', match: (i) => i.skills.some((s) => s.startsWith('tlf.')) },
  { id: 'qc', label: 'QC', match: (i) => i.skills.some((s) => s.startsWith('qc.')) },
  { id: 'debugging', label: 'Debugging', match: (i) => i.modes.includes('debug') || i.skills.includes('sas.debugging') },
  { id: 'sql', label: 'SQL', match: (i) => i.skills.some((s) => s.startsWith('sql.')) },
  { id: 'python', label: 'Python', match: (i) => i.skills.some((s) => s.startsWith('python.')) },
  { id: 'r', label: 'R', match: (i) => i.skills.some((s) => s.startsWith('r.')) },
  { id: 'excel', label: 'Excel', match: (i) => i.skills.some((s) => s.startsWith('excel.')) },
  { id: 'analytics', label: 'Analytics', match: (i) => i.skills.some((s) => s.startsWith('analytics.')) },
  { id: 'behavioral', label: 'Behavioral', match: (i) => i.lab === 'interview' || i.skills.includes('communication.interviewing') },
];

export default function InterviewPage() {
  usePage('Interview Center');
  const index = useItems();
  const attempts = useProgress((s) => s.attempts);
  const [query, setQuery] = useState('');
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<'all' | 'foundation' | 'intermediate' | 'advanced' | 'expert'>('all');
  const [session, setSession] = useState<ItemInfo[] | null>(null);
  const [pos, setPos] = useState(0);

  const bank = useMemo(() => (index ? index.all.filter((i) => i.modes.includes('interview')) : []), [index]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bank.filter(
      (i) =>
        (difficulty === 'all' || i.difficulty === difficulty) &&
        (cats.size === 0 || CATEGORIES.some((c) => cats.has(c.id) && c.match(i))) &&
        (!q || `${itemTitle(i)} ${i.prompt}`.toLowerCase().includes(q)),
    );
  }, [bank, query, cats, difficulty]);

  if (!index) return <div className="page"><Loading /></div>;

  if (session) {
    const current = session[Math.min(pos, session.length - 1)];
    return (
      <div className="page" style={{ maxWidth: 980 }}>
        <div className="row gap-3" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="eyebrow">Mock interview</div>
            <h1 className="page-title" style={{ fontSize: 22 }}>
              Question {Math.min(pos + 1, session.length)} of {session.length}
            </h1>
          </div>
          <Button variant="ghost" onClick={() => setSession(null)}>
            End interview
          </Button>
        </div>
        {pos >= session.length ? (
          <Card pad="md">
            <EmptyState icon={<MessagesSquare />} title="Interview complete" action={<Button onClick={() => setSession(null)}>Back to the bank</Button>}>
              Questions you rated “Missed” or “Partially” return in your review queue. Practise saying the strong answers out loud.
            </EmptyState>
          </Card>
        ) : (
          <ItemView key={current.id} item={current} mode="interview" showLessonLink onNext={() => setPos((p) => p + 1)} nextLabel={pos < session.length - 1 ? 'Next question' : 'Finish'} />
        )}
      </div>
    );
  }

  const answered = new Set(attempts.map((a) => a.itemId));
  const counts = new Map(CATEGORIES.map((c) => [c.id, bank.filter(c.match).length]));
  const start = (list: ItemInfo[]) => {
    setSession(seededShuffle(list, String(Date.now())).slice(0, 8));
    setPos(0);
  };

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Interview Center</div>
        <h1 className="page-title">Interview question bank</h1>
        <p className="page-lede">
          {bank.length} questions from real statistical-programming, biostatistics and data-science interviews — technical, scenario and behavioral. Answers are
          withheld until you commit to yours; then compare with a strong answer, tick the rubric points you hit, and rate yourself. Missed questions return via
          spaced repetition.
        </p>
      </div>
      <div className="interview-toolbar">
        <div className="search-input" style={{ flex: '1 1 260px', maxWidth: 400 }}>
          <Search />
          <input className="input" placeholder="Search questions…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search questions" />
        </div>
        <Segmented
          ariaLabel="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'all', label: 'All' },
            { value: 'foundation', label: 'Easy' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Hard' },
            { value: 'expert', label: 'Expert' },
          ]}
        />
        <Button variant="primary" icon={<Play />} onClick={() => start(filtered)} disabled={!filtered.length}>
          Mock interview (8)
        </Button>
        <Button icon={<Shuffle />} onClick={() => start(bank)} disabled={!bank.length}>
          Random mix
        </Button>
      </div>
      <div className="interview-cats">
        {CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => (
          <button
            key={c.id}
            type="button"
            className={clsx('interview-cat', cats.has(c.id) && 'is-on')}
            onClick={() =>
              setCats((prev) => {
                const n = new Set(prev);
                if (n.has(c.id)) n.delete(c.id);
                else n.add(c.id);
                return n;
              })
            }
          >
            {c.label} <span className="num">{counts.get(c.id)}</span>
          </button>
        ))}
      </div>
      <Card>
        <ul className="list-reset interview-list">
          {filtered.map((it) => (
            <li key={it.id}>
              <button type="button" className="interview-row" onClick={() => { setSession([it]); setPos(0); }}>
                <span className={clsx('practice-dot', answered.has(it.id) && 'is-tried')} />
                <span className="grow">{itemTitle(it)}</span>
                <Badge tone={it.difficulty === 'foundation' ? 'neutral' : it.difficulty === 'intermediate' ? 'info' : it.difficulty === 'advanced' ? 'violet' : 'danger'} outline>
                  {it.difficulty}
                </Badge>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted" style={{ padding: 20, fontSize: 13.5 }}>No questions match.</li>}
        </ul>
      </Card>
    </div>
  );
}
