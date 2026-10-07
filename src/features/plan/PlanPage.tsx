import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { CircleCheck, CircleDot, ClipboardCheck, Hammer, Repeat, BookOpen, Swords } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useSettings } from '../../state/settings';
import { useProgress } from '../../state/progress';
import { buildPlan, currentWeekNumber, PHASES } from '../../lib/plan';
import { useMastery } from '../../lib/useMastery';
import { weakSkills } from '../../lib/mastery';
import { Badge, ButtonLink, Card, Field } from '../../components/ui';
import { LAB_BY_ID } from '../../content/labs';
import './plan.css';

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function PlanPage() {
  usePage('Weekly Plan');
  const settings = useSettings();
  const lessonsProgress = useProgress((s) => s.lessons);
  const steps = useProgress((s) => s.steps);
  const mastery = useMastery();
  const plan = useMemo(
    () => buildPlan({ hoursPerWeek: settings.hoursPerWeek, startDate: settings.startDate, focus: settings.focus }),
    [settings.hoursPerWeek, settings.startDate, settings.focus],
  );
  const current = currentWeekNumber(settings.startDate);
  const [showAll, setShowAll] = useState(false);
  const weak = weakSkills(mastery.bySkill, 4);
  const visible = showAll ? plan : plan.filter((w) => w.n >= current - 1 && w.n <= current + 6);

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Weekly training system</div>
        <h1 className="page-title">Your plan</h1>
        <p className="page-lede">
          Built from the curriculum for {settings.hoursPerWeek} hours per week starting {new Date(`${settings.startDate}T00:00:00`).toLocaleDateString()}.
          Each week mixes new material (~55%), practice and review (~25%) and one project task (~20%). Every fourth week is an integrated assessment:
          fewer new lessons, a boss battle, and review of the previous three weeks. The plan currently spans {plan.length} weeks and grows as lessons are
          added.
        </p>
      </div>

      <Card pad="md" className="plan-settings">
        <div className="plan-settings__row">
          <Field label="Hours per week">
            <input
              className="input"
              type="number"
              min={2}
              max={20}
              value={settings.hoursPerWeek}
              onChange={(e) => settings.set({ hoursPerWeek: Math.max(2, Math.min(20, Number(e.target.value) || 6)) })}
            />
          </Field>
          <Field label="Start date (week 1)">
            <input className="input" type="date" value={settings.startDate} onChange={(e) => e.target.value && settings.set({ startDate: e.target.value })} />
          </Field>
          <div className="stack gap-1" style={{ minWidth: 0 }}>
            <span className="field__label">Emphasis this week (from your weak skills)</span>
            {weak.length === 0 ? (
              <span className="muted" style={{ fontSize: 13 }}>
                None yet — weak skills are detected from your practice accuracy.
              </span>
            ) : (
              <div className="row gap-2 wrap">
                {weak.map((w) => (
                  <Link key={w.skill.id} to={`/practice?skill=${w.skill.id}&count=6&title=${encodeURIComponent(w.skill.name)}`} className="tag">
                    {w.skill.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="plan-phases">
        {PHASES.map((p) => {
          const weeks = plan.filter((w) => w.phase.level === p.level);
          if (!weeks.length) return null;
          return (
            <div key={p.level} className={clsx('plan-phase', weeks.some((w) => w.n === current) && 'is-current')}>
              <span className="plan-phase__name">{p.title}</span>
              <span className="muted num" style={{ fontSize: 11.5 }}>
                weeks {weeks[0].n}–{weeks[weeks.length - 1].n}
              </span>
            </div>
          );
        })}
      </div>

      <div className="stack gap-4">
        {visible.map((w) => {
          const doneCount = w.lessons.filter((l) => lessonsProgress[l.id]?.completedAt).length;
          const isCurrent = w.n === current;
          return (
            <Card key={w.n} className={clsx('plan-week', isCurrent && 'is-current', w.n < current && 'is-past')}>
              <div className="plan-week__head">
                <div className="row gap-3">
                  <span className="plan-week__n num">W{w.n}</span>
                  <div>
                    <div style={{ fontWeight: 620 }}>
                      {fmtDate(w.start)} – {fmtDate(w.end)}
                      {isCurrent && (
                        <Badge tone="accent" className="plan-week__now">
                          This week
                        </Badge>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {w.phase.title}
                    </div>
                  </div>
                </div>
                {w.assessment && (
                  <Badge tone="violet" icon={<ClipboardCheck />}>
                    Integrated assessment
                  </Badge>
                )}
              </div>
              <div className="plan-week__body">
                <div className="plan-block">
                  <div className="plan-block__title">
                    <BookOpen size={14} /> Theory & coding · {w.lessonMinutes} min
                  </div>
                  <ul className="list-reset">
                    {w.lessons.map((l) => (
                      <li key={l.id}>
                        <Link to={`/learn/${l.lab}/${l.id}`} className="plan-lesson">
                          {lessonsProgress[l.id]?.completedAt ? <CircleCheck size={14} color="var(--success)" /> : <CircleDot size={14} color="var(--text-4)" />}
                          <span className="grow">{l.title}</span>
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            {LAB_BY_ID[l.lab]?.short}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <span className="muted num" style={{ fontSize: 11.5 }}>
                    {doneCount}/{w.lessons.length} read
                  </span>
                </div>
                <div className="plan-block">
                  <div className="plan-block__title">
                    <Repeat size={14} /> Practice & review · {w.budget.practice} min
                  </div>
                  <p className="plan-block__text">
                    Complete the knowledge checks and hands-on exercises for this week's lessons, then clear your review queue.
                    {w.assessment ? ' Assessment week: attempt a boss battle and an interview session covering the last three weeks.' : ''}
                  </p>
                  <div className="row gap-2 wrap">
                    <ButtonLink size="sm" to={`/practice?ids=${w.lessons.map((l) => l.id).join(',')}&title=Week%20${w.n}`} variant="subtle">
                      Week {w.n} practice
                    </ButtonLink>
                    {w.assessment && (
                      <ButtonLink size="sm" to="/practice?mode=boss&count=4&title=Boss%20battle" icon={<Swords />}>
                        Boss battle
                      </ButtonLink>
                    )}
                  </div>
                </div>
                <div className="plan-block">
                  <div className="plan-block__title">
                    <Hammer size={14} /> Project task · {w.budget.project} min
                  </div>
                  {w.project ? (
                    <Link to={`/capstones/${w.project.capstoneId}`} className="plan-block__text" style={{ display: 'block', color: 'var(--text)' }}>
                      <b>{w.project.title}</b> — {w.project.stepTitle}
                      {steps[`${w.project.capstoneId}:${w.project.stepId}`] ? ' ✓ done' : ''}
                    </Link>
                  ) : (
                    <p className="plan-block__text">Foundations weeks: explore the trial simulator and the raw datasets to build intuition for later projects.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {!showAll && plan.length > visible.length && (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setShowAll(true)}>
            Show all {plan.length} weeks
          </button>
        </div>
      )}
    </div>
  );
}
