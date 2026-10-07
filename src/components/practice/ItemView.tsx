import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import {
  Lightbulb,
  Eye,
  RotateCcw,
  ArrowRight,
  BookmarkPlus,
  BookmarkCheck,
  CircleCheck,
  CircleX,
  CircleDot,
  Database,
  Timer,
  BookOpen,
} from 'lucide-react';
import { Markdown } from '../content/Markdown';
import { Badge, Button, Drawer, Tooltip } from '../ui';
import { useProgress } from '../../state/progress';
import { lessonById, skillById, type ItemInfo } from '../../content/registry';
import type { ModeId, Explanation } from '../../content/schema';
import { FORMAT_LABELS, MODE_LABELS, type CheckResult } from './types';
import { ChoiceFormat, NumericFormat, TextFormat, MappingFormat, OrderFormat, ClassifyFormat } from './formats/simple';
import { CodeFormat, SqlFormat, LineSelectFormat, DiffFormat, OpenFormat } from './formats/advanced';
import { DatasetViewer } from '../data/DatasetViewer';
import './practice.css';

const DIFF_TONE = { foundation: 'neutral', intermediate: 'info', advanced: 'violet', expert: 'danger' } as const;

const EXPLANATION_QUESTIONS: [keyof Explanation, string][] = [
  ['objective', 'What is the objective?'],
  ['given', 'What information was provided?'],
  ['relevant', 'What information matters?'],
  ['irrelevant', 'What information does not matter?'],
  ['calculating', 'What are we calculating?'],
  ['method', 'Why this method?'],
  ['numbers', 'Where does each number come from?'],
  ['assumptions', 'What assumptions are being made?'],
  ['computation', 'How do we compute it?'],
  ['interpretation', 'How should we interpret it?'],
  ['changes', 'What would change the answer?'],
  ['interviewer', 'What would an interviewer expect you to understand?'],
];

export function ExplanationPanel({ explanation }: { explanation: Explanation }) {
  const entries = EXPLANATION_QUESTIONS.filter(([k]) => explanation[k]);
  if (!entries.length) return null;
  return (
    <div className="explain">
      <div className="explain__title">Worked explanation</div>
      <dl className="explain__list">
        {entries.map(([k, q]) => (
          <div key={k} className="explain__row">
            <dt>{q}</dt>
            <dd>
              <Markdown source={explanation[k]!} compact />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function verdict(score: number) {
  if (score >= 0.8) return { tone: 'success', label: 'Correct', icon: <CircleCheck /> } as const;
  if (score >= 0.5) return { tone: 'warning', label: 'Partially correct', icon: <CircleDot /> } as const;
  return { tone: 'danger', label: 'Not quite', icon: <CircleX /> } as const;
}

interface ItemViewProps {
  item: ItemInfo;
  mode?: ModeId;
  /** Compact rendering inside lessons. */
  inline?: boolean;
  onFinished?: (score: number) => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Show a link back to the lesson. */
  showLessonLink?: boolean;
  headerExtra?: ReactNode;
}

export function ItemView({ item, mode: modeProp, inline, onFinished, onNext, nextLabel = 'Next', showLessonLink, headerExtra }: ItemViewProps) {
  const mode: ModeId = modeProp ?? item.modes[0] ?? 'check';
  const recordAttempt = useProgress((s) => s.recordAttempt);
  const reviewLater = useProgress((s) => !!s.reviewLater[item.id]);
  const toggleReviewLater = useProgress((s) => s.toggleReviewLater);
  const [hintsShown, setHintsShown] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [dataset, setDataset] = useState<string | null>(null);
  const started = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Reset when the item changes.
    setHintsShown(0);
    setResult(null);
    setRevealed(false);
    setAttemptKey((k) => k + 1);
    started.current = Date.now();
  }, [item.id]);

  useEffect(() => {
    if (mode !== 'speed' || result) return;
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [mode, result, attemptKey]);

  const locked = result !== null;

  const onCheck = (r: CheckResult) => {
    setResult(r);
    recordAttempt({
      itemId: item.id,
      score: r.score,
      hintsUsed: hintsShown,
      mode,
      seconds: Math.round((Date.now() - started.current) / 1000),
      revealed,
    });
    onFinished?.(r.score);
  };

  const reveal = () => {
    if (!revealed && !result) {
      recordAttempt({ itemId: item.id, score: 0, hintsUsed: hintsShown, mode, seconds: Math.round((Date.now() - started.current) / 1000), revealed: true });
    }
    setRevealed(true);
  };

  const retry = () => {
    setResult(null);
    setRevealed(false);
    setAttemptKey((k) => k + 1);
    started.current = Date.now();
  };

  const formatProps = { mode, locked, revealed, onCheck };
  let body: ReactNode = null;
  switch (item.format) {
    case 'mcq':
    case 'multi':
      body = <ChoiceFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'numeric':
      body = <NumericFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'text':
      body = <TextFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'mapping':
      body = <MappingFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'order':
      body = <OrderFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'classify':
      body = <ClassifyFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'code':
      body = <CodeFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'sql':
      body = <SqlFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'log':
    case 'hotspot':
      body = <LineSelectFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'diff':
      body = <DiffFormat key={attemptKey} item={item} {...formatProps} />;
      break;
    case 'open':
      body = <OpenFormat key={attemptKey} item={item} {...formatProps} />;
      break;
  }

  const hints = item.hints;
  const hintsAllowed = mode !== 'interview' && hints.length > 0;
  const v = result ? verdict(result.score) : null;
  const lesson = item.lesson ? lessonById.get(item.lesson) : undefined;

  return (
    <article className={clsx('item', inline && 'item--inline')} data-format={item.format}>
      <header className="item__head">
        <div className="item__meta">
          <Badge tone="neutral">{FORMAT_LABELS[item.format]}</Badge>
          {!inline && <Badge tone="accent">{MODE_LABELS[mode]}</Badge>}
          <Badge tone={DIFF_TONE[item.difficulty]} outline>
            {item.difficulty}
          </Badge>
          {mode === 'speed' && !result && (
            <Badge tone="warning" icon={<Timer />}>
              <span className="num">{elapsed}s</span>
            </Badge>
          )}
          {headerExtra}
        </div>
        <div className="row gap-1">
          <Tooltip content={reviewLater ? 'Remove from review queue' : 'Review later'}>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => toggleReviewLater(item.id)} aria-pressed={reviewLater} aria-label="Review later">
              {reviewLater ? <BookmarkCheck /> : <BookmarkPlus />}
            </button>
          </Tooltip>
        </div>
      </header>

      {!inline && item.title && <h3 className="item__title">{item.title}</h3>}
      <div className="item__prompt">
        <Markdown source={item.prompt} compact />
      </div>

      {item.datasets.length > 0 && (
        <div className="row gap-2 wrap item__datasets">
          {item.datasets.map((d) => (
            <Button key={d} size="sm" variant="subtle" icon={<Database />} onClick={() => setDataset(d)}>
              {d.split('/').slice(-1)[0].toUpperCase()}
            </Button>
          ))}
        </div>
      )}

      {hintsAllowed && hintsShown > 0 && (
        <ol className="hints">
          {hints.slice(0, hintsShown).map((h, i) => (
            <li key={i} className="hint">
              <span className="hint__label">Hint {i + 1}</span>
              <Markdown source={h} compact />
            </li>
          ))}
        </ol>
      )}

      <div className="item__body">{body}</div>

      {!result && (
        <div className="item__aux">
          {hintsAllowed && hintsShown < hints.length && (
            <Button size="sm" variant="ghost" icon={<Lightbulb />} onClick={() => setHintsShown((h) => h + 1)}>
              {hintsShown === 0 ? 'Show a hint' : 'Show a stronger hint'}
              <span className="muted num" style={{ marginLeft: 2 }}>
                {hintsShown + 1}/{hints.length}
              </span>
              {mode === 'independent' && <span className="muted"> · reduces mastery credit</span>}
            </Button>
          )}
          {item.format !== 'open' && !revealed && (item.solution || item.explanation) && (
            <Button size="sm" variant="ghost" icon={<Eye />} onClick={reveal}>
              Reveal solution
            </Button>
          )}
        </div>
      )}

      {v && result && (
        <div className={clsx('verdict', `verdict--${v.tone}`)} role="status">
          {v.icon}
          <div className="grow">
            <div className="verdict__label">
              {v.label}
              {result.score > 0 && result.score < 1 && <span className="verdict__score num"> · {Math.round(result.score * 100)}%</span>}
            </div>
            {result.detail && <div className="verdict__detail">{result.detail}</div>}
          </div>
          <div className="row gap-2">
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={retry}>
              Try again
            </Button>
            {onNext && (
              <Button size="sm" variant="primary" iconRight={<ArrowRight />} onClick={onNext}>
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      )}

      {(result || revealed) && (item.solution || item.explanation) && (
        <div className="item__solution">
          {item.solution && (
            <div className="solution">
              <div className="eyebrow">Solution</div>
              <Markdown source={item.solution} compact />
            </div>
          )}
          {item.explanation && <ExplanationPanel explanation={item.explanation} />}
        </div>
      )}

      {(result || revealed) && (
        <footer className="item__foot">
          <div className="row gap-2 wrap">
            {item.skills.map((s) => (
              <Link key={s} to={`/progress/skill/${s}`} className="tag">
                {skillById.get(s)?.name ?? s}
              </Link>
            ))}
          </div>
          {showLessonLink && lesson && (
            <Link to={`/learn/${lesson.lab}/${lesson.id}`} className="row gap-1" style={{ fontSize: 12.5 }}>
              <BookOpen size={14} /> {lesson.title}
            </Link>
          )}
        </footer>
      )}

      <Drawer open={!!dataset} onClose={() => setDataset(null)} title={dataset ?? ''} size="lg">
        {dataset && <DatasetViewer id={dataset} compact />}
      </Drawer>
    </article>
  );
}
