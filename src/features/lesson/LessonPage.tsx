import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Circle,
  Dumbbell,
  Target,
  Lightbulb,
  Stethoscope,
  Sigma,
  PencilRuler,
  Database,
  Code,
  Terminal,
  MessageSquareText,
  TriangleAlert,
  ListChecks,
  Hammer,
  Mountain,
  Building,
  BookOpen,
} from 'lucide-react';
import { lessonById, lessons, loadLessonBody, useItems, skillById } from '../../content/registry';
import { LAB_BY_ID, TRACKS } from '../../content/labs';
import { LESSON_SECTIONS, type LabId } from '../../content/vocab';
import { usePage } from '../../components/layout/page';
import { Markdown, slugify } from '../../components/content/Markdown';
import { Badge, Button, ButtonLink, Loading, EmptyState } from '../../components/ui';
import { MasteryMeter } from '../../components/progress/MasteryMeter';
import { useProgress } from '../../state/progress';
import { useMastery } from '../../lib/useMastery';
import { FORMAT_LABELS, MODE_LABELS } from '../../components/practice/types';
import { itemTitle } from '../../content/registry';
import './lesson.css';

const SECTION_ICONS: Record<string, typeof Target> = {
  problem: Target,
  intuition: Lightbulb,
  context: Stethoscope,
  formal: Sigma,
  worked: PencilRuler,
  data: Database,
  code: Code,
  output: Terminal,
  interpretation: MessageSquareText,
  mistakes: TriangleAlert,
  check: ListChecks,
  exercise: Hammer,
  challenge: Mountain,
  industry: Building,
};

function sectionKind(heading: string): string | undefined {
  const h = heading.trim().toLowerCase();
  return LESSON_SECTIONS.find((s) => (s.headings as readonly string[]).some((x) => x.toLowerCase() === h))?.kind;
}

function extractToc(md: string) {
  const out: { id: string; text: string; kind?: string }[] = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      const text = m[1].replace(/[`*_]/g, '');
      out.push({ id: slugify(text), text, kind: sectionKind(text) });
    }
  }
  return out;
}

const DIFF_TONE = { foundation: 'neutral', intermediate: 'info', advanced: 'violet', expert: 'danger' } as const;

export default function LessonPage() {
  const { lab, lessonId } = useParams<{ lab: LabId; lessonId: string }>();
  const lesson = lessonId ? lessonById.get(lessonId) : undefined;
  const labMeta = lab ? LAB_BY_ID[lab] : undefined;
  const navigate = useNavigate();
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openLesson = useProgress((s) => s.openLesson);
  const addLessonTime = useProgress((s) => s.addLessonTime);
  const completeLesson = useProgress((s) => s.completeLesson);
  const progress = useProgress((s) => (lessonId ? s.lessons[lessonId] : undefined));
  const attempts = useProgress((s) => s.attempts);
  const items = useItems();
  const mastery = useMastery();
  const [activeId, setActiveId] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  usePage(lesson?.title ?? 'Lesson', [{ label: labMeta?.title ?? 'Labs', to: `/learn/${lab}` }, ...(lesson ? [{ label: lesson.moduleTitle, to: `/learn/${lab}#${lesson.moduleId}` }] : [])], 'lesson');

  useEffect(() => {
    if (!lesson) return;
    let alive = true;
    setBody(null);
    setError(null);
    loadLessonBody(lesson.lab, lesson.id)
      .then((b) => alive && setBody(b))
      .catch((e: Error) => alive && setError(e.message));
    openLesson(lesson.id);
    return () => {
      alive = false;
    };
  }, [lesson, openLesson]);

  // Active reading time (only while the tab is visible).
  useEffect(() => {
    if (!lesson) return;
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState === 'visible') {
        const secs = Math.round((Date.now() - last) / 1000);
        if (secs > 0 && secs < 120) addLessonTime(lesson.id, secs);
      }
      last = Date.now();
    };
    const t = window.setInterval(tick, 30_000);
    return () => {
      window.clearInterval(t);
      tick();
    };
  }, [lesson, addLessonTime]);

  const toc = useMemo(() => (body ? extractToc(body) : []), [body]);

  useEffect(() => {
    if (!toc.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    const t = window.setTimeout(() => {
      for (const s of toc) {
        const el = document.getElementById(s.id);
        if (el) obs.observe(el);
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      obs.disconnect();
    };
  }, [toc]);

  const labLessons = useMemo(() => lessons.filter((l) => l.lab === lesson?.lab), [lesson]);
  const idx = lesson ? labLessons.findIndex((l) => l.id === lesson.id) : -1;
  const prev = idx > 0 ? labLessons[idx - 1] : undefined;
  const next = idx >= 0 && idx < labLessons.length - 1 ? labLessons[idx + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest('.cm-editor') || e.metaKey || e.ctrlKey) return;
      if (e.key === '[' && prev) navigate(`/learn/${prev.lab}/${prev.id}`);
      if (e.key === ']' && next) navigate(`/learn/${next.lab}/${next.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, navigate]);

  if (!lesson || !labMeta || lesson.lab !== lab) {
    return (
      <div className="page">
        <EmptyState icon={<BookOpen />} title="Lesson not found" action={<ButtonLink to="/path">Go to the learning path</ButtonLink>}>
          This lesson id does not exist in the curriculum.
        </EmptyState>
      </div>
    );
  }

  const lessonItems = items?.byLesson.get(lesson.id) ?? [];
  const byMode = new Map<string, typeof lessonItems>();
  for (const it of lessonItems) {
    const m = it.modes[0];
    byMode.set(m, [...(byMode.get(m) ?? []), it]);
  }
  const bestScore = (id: string) => attempts.filter((a) => a.itemId === id).reduce((m, a) => Math.max(m, a.score), -1);
  const solved = lessonItems.filter((i) => bestScore(i.id) >= 0.8).length;
  const done = !!progress?.completedAt;

  return (
    <div className="lesson-layout">
      <article className="lesson" ref={contentRef}>
        <header className="lesson__header">
          <div className="eyebrow">
            <Link to={`/learn/${lab}`}>{labMeta.title}</Link> · {lesson.moduleTitle}
          </div>
          <h1 className="lesson__title">{lesson.title}</h1>
          <p className="lesson__summary">{lesson.summary}</p>
          <div className="lesson__meta">
            <span className="row gap-1 muted">
              <Clock size={14} /> {lesson.minutes} min
            </span>
            <Badge tone={DIFF_TONE[lesson.difficulty]} outline>
              {lesson.difficulty}
            </Badge>
            {lesson.tracks.map((t) => (
              <Badge key={t} tone="neutral">
                {TRACKS.find((x) => x.id === t)?.title ?? t}
              </Badge>
            ))}
          </div>
          <div className="lesson__skills">
            {lesson.skills.map((s) => {
              const m = mastery.bySkill.get(s);
              return (
                <Link key={s} to={`/progress/skill/${s}`} className="lesson__skill">
                  <span>{skillById.get(s)?.name ?? s}</span>
                  {m && <MasteryMeter level={m.level} />}
                </Link>
              );
            })}
          </div>
        </header>

        {error && <EmptyState title="Could not load this lesson">{error}</EmptyState>}
        {!body && !error && <Loading label="Loading lesson…" />}
        {body && <Markdown source={body} className="lesson__body" />}

        {body && lessonItems.length > 0 && (
          <section className="lesson__practice" aria-labelledby="all-practice">
            <h2 id="all-practice" className="lesson__practice-title">
              <Dumbbell size={18} /> All practice for this lesson
            </h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
              {solved} of {lessonItems.length} solved. Mastery comes from these — reading the lesson only moves a skill to “Learning”.
            </p>
            <div className="lesson__modes">
              {[...byMode.entries()].map(([mode, list]) => (
                <div key={mode} className="lesson__mode">
                  <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                    <span className="lesson__mode-name">{MODE_LABELS[mode as keyof typeof MODE_LABELS] ?? mode}</span>
                    <ButtonLink size="sm" to={`/practice?ids=${list.map((i) => i.id).join(',')}&mode=${mode}&title=${encodeURIComponent(`${lesson.title} — ${MODE_LABELS[mode as keyof typeof MODE_LABELS] ?? mode}`)}`}>
                      Start {list.length}
                    </ButtonLink>
                  </div>
                  <ul className="list-reset">
                    {list.map((it) => {
                      const b = bestScore(it.id);
                      return (
                        <li key={it.id}>
                          <Link to={`/practice?ids=${it.id}&mode=${mode}`} className="lesson__item-row">
                            <span className={`practice-dot ${b >= 0.8 ? 'is-done' : b >= 0 ? 'is-tried' : ''}`} />
                            <span className="grow">{itemTitle(it)}</span>
                            <span className="muted" style={{ fontSize: 11.5 }}>
                              {FORMAT_LABELS[it.format]}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {body && (
          <footer className="lesson__footer">
            <Button
              variant={done ? 'success' : 'primary'}
              icon={done ? <CircleCheck /> : <Circle />}
              onClick={() => completeLesson(lesson.id, !done)}
            >
              {done ? 'Marked as read' : 'Mark as read'}
            </Button>
            <div className="lesson__nav">
              {prev ? (
                <Link to={`/learn/${prev.lab}/${prev.id}`} className="lesson__nav-link">
                  <ArrowLeft size={15} />
                  <span>
                    <span className="lesson__nav-dir">Previous</span>
                    <span className="lesson__nav-title">{prev.title}</span>
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={`/learn/${next.lab}/${next.id}`} className="lesson__nav-link lesson__nav-link--next">
                  <span>
                    <span className="lesson__nav-dir">Next</span>
                    <span className="lesson__nav-title">{next.title}</span>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </footer>
        )}
      </article>

      <aside className="lesson-rail" aria-label="On this page">
        <div className="lesson-rail__inner">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            On this page
          </div>
          <nav className="toc">
            {toc.map((s) => {
              const Icon = (s.kind && SECTION_ICONS[s.kind]) || BookOpen;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={clsx('toc__item', activeId === s.id && 'is-active')}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <Icon />
                  <span>{s.text}</span>
                </a>
              );
            })}
          </nav>
          <div className="lesson-rail__card">
            <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Practice</span>
              <span className="muted num" style={{ fontSize: 12 }}>
                {solved}/{lessonItems.length}
              </span>
            </div>
            <div className="progress progress--thin" style={{ marginTop: 6 }}>
              <div className="progress__bar" style={{ width: `${lessonItems.length ? (solved / lessonItems.length) * 100 : 0}%` }} />
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
              Press <kbd className="kbd">[</kbd> / <kbd className="kbd">]</kbd> for previous/next lesson, <kbd className="kbd">n</kbd> for notes.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
