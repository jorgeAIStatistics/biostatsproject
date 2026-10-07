import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { scaleBand, scaleLinear } from 'd3-scale';
import {
  ArrowRight,
  Flame,
  Clock,
  Repeat,
  Target,
  CircleCheck,
  CircleX,
  CircleDot,
  Milestone,
  FlaskConical,
  Sparkles,
  TriangleAlert,
  BookOpen,
} from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { Badge, ButtonLink, Card, CardHeader, ProgressBar } from '../../components/ui';
import { MasteryMeter } from '../../components/progress/MasteryMeter';
import { useProgress, localDay } from '../../state/progress';
import { useSettings } from '../../state/settings';
import { useMastery } from '../../lib/useMastery';
import { weakSkills, streak, LEVELS } from '../../lib/mastery';
import { buildPlan, currentWeekNumber, nextLesson } from '../../lib/plan';
import { lessonById, capstoneById, capstones, useItems, itemTitle, lessons, lessonsForSkill } from '../../content/registry';
import { DOMAINS, LAB_BY_ID } from '../../content/labs';
import { barPath, ChartTooltip, hbarPath, useWidth, type TooltipState } from '../../components/charts/core';
import './dashboard.css';

function ActivityChart({ days }: { days: { key: string; label: string; minutes: number; attempts: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(520);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const h = 150;
  const m = { top: 12, right: 8, bottom: 22, left: 30 };
  const x = scaleBand<string>()
    .domain(days.map((d) => d.key))
    .range([m.left, width - m.right])
    .paddingInner(0.18);
  const max = Math.max(30, ...days.map((d) => d.minutes));
  const y = scaleLinear().domain([0, max]).nice().range([h - m.bottom, m.top]);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="Study minutes per day, last 14 days">
        {y.ticks(3).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x1={m.left} x2={width - m.right} className="axis__grid" />
            <text x={m.left - 6} dy="0.32em" textAnchor="end" className="axis__label">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const bx = x(d.key) ?? 0;
          const by = y(d.minutes);
          const bh = y(0) - by;
          return (
            <g key={d.key}>
              <path d={barPath(bx, by, x.bandwidth(), bh)} fill={i === days.length - 1 ? 'var(--viz-1)' : 'var(--viz-seq-2)'} />
              <rect
                className="chart-hit"
                x={bx - 1}
                y={m.top}
                width={x.bandwidth() + 2}
                height={h - m.bottom - m.top}
                onMouseMove={() =>
                  setTip({
                    x: bx + x.bandwidth() / 2,
                    y: Math.max(by, m.top + 10),
                    content: (
                      <>
                        <b>{d.label}</b>
                        <br />
                        {d.minutes} min · {d.attempts} exercise{d.attempts === 1 ? '' : 's'}
                      </>
                    ),
                  })
                }
              />
              {(i % 2 === days.length % 2 || days.length <= 8) && (
                <text x={bx + x.bandwidth() / 2} y={h - 6} textAnchor="middle" className="axis__label">
                  {d.label.split(' ')[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip state={tip} />
    </div>
  );
}

function ReadinessBars({ roles }: { roles: { id: string; title: string; readiness: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const rowH = 34;
  const labelW = Math.min(170, width * 0.46);
  const x = scaleLinear().domain([0, 1]).range([0, Math.max(40, width - labelW - 44)]);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={roles.length * rowH} role="img" aria-label="Career readiness by role">
        {roles.map((r, i) => (
          <g key={r.id} transform={`translate(0,${i * rowH})`}>
            <text x={0} y={rowH / 2} dy="0.32em" className="readiness__label">
              {r.title}
            </text>
            <rect x={labelW} y={rowH / 2 - 5} width={x(1)} height={10} rx={5} fill="var(--surface-3)" />
            <path d={hbarPath(labelW, rowH / 2 - 5, Math.max(r.readiness > 0 ? 4 : 0, x(r.readiness)), 10, 5)} fill="var(--viz-1)" />
            <text x={labelW + x(1) + 8} y={rowH / 2} dy="0.32em" className="readiness__value">
              {Math.round(r.readiness * 100)}%
            </text>
            <rect
              className="chart-hit"
              x={0}
              y={0}
              width={width}
              height={rowH}
              onMouseMove={() => setTip({ x: labelW + x(r.readiness), y: i * rowH + 6, content: <><b>{r.title}</b>: {Math.round(r.readiness * 100)}% weighted mastery</> })}
            />
          </g>
        ))}
      </svg>
      <ChartTooltip state={tip} />
    </div>
  );
}

export default function DashboardPage() {
  usePage('Dashboard');
  const attempts = useProgress((s) => s.attempts);
  const activity = useProgress((s) => s.activity);
  const lessonProgress = useProgress((s) => s.lessons);
  const reviews = useProgress((s) => s.reviews);
  const reviewLater = useProgress((s) => s.reviewLater);
  const currentProject = useProgress((s) => s.currentProject);
  const steps = useProgress((s) => s.steps);
  const settings = useSettings();
  const mastery = useMastery();
  const items = useItems();

  const completed = useMemo(() => new Set(Object.entries(lessonProgress).filter(([, p]) => p.completedAt).map(([id]) => id)), [lessonProgress]);
  const next = useMemo(() => nextLesson(completed, settings.focus), [completed, settings.focus]);
  const plan = useMemo(() => buildPlan({ hoursPerWeek: settings.hoursPerWeek, startDate: settings.startDate, focus: settings.focus }), [settings.hoursPerWeek, settings.startDate, settings.focus]);
  const weekN = currentWeekNumber(settings.startDate);
  const week = plan[Math.min(weekN, plan.length) - 1];

  const days = useMemo(() => {
    const out: { key: string; label: string; minutes: number; attempts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDay(d.getTime());
      const a = activity[key];
      out.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        minutes: Math.round((a?.s ?? 0) / 60),
        attempts: a?.a ?? 0,
      });
    }
    return out;
  }, [activity]);
  const weekMinutes = days.slice(-7).reduce((s, d) => s + d.minutes, 0);
  const st = streak(activity);
  const due = Object.values(reviews).filter((r) => r.due <= Date.now() && r.lastResult < 1).length + Object.keys(reviewLater).length;
  const skillsCompetent = [...mastery.bySkill.values()].filter((s) => s.level >= 3).length;
  const weak = weakSkills(mastery.bySkill, 5);
  const recent = [...attempts].reverse().slice(0, 7);
  const project = currentProject ? capstoneById.get(currentProject) : capstones[0];
  const projectDone = project ? project.steps.filter((s) => steps[`${project.id}:${s.id}`]).length : 0;
  const domainsSorted = [...DOMAINS].map((d) => ({ ...d, v: mastery.byDomain.get(d.id) ?? 0 })).sort((a, b) => b.v - a.v);
  const fresh = attempts.length === 0 && Object.keys(lessonProgress).length === 0;
  const overallLevel = Math.min(5, Math.floor(mastery.overall * 5)) as 0 | 1 | 2 | 3 | 4 | 5;

  return (
    <div className="page page--wide dash">
      <header className="dash__header">
        <div>
          <div className="eyebrow">
            Week {weekN}
            {week ? ` · ${week.phase.title}` : ''}
          </div>
          <h1 className="page-title">Your biometrics training</h1>
          <p className="page-lede">
            {week
              ? `This week: ${week.phase.focus}`
              : 'Work through the lifecycle — protocol, raw data, SDTM, ADaM, analysis, TLFs, QC — until it feels normal.'}
          </p>
        </div>
        <div className="dash__level">
          <span className="eyebrow">Overall level</span>
          <MasteryMeter level={overallLevel} large showLabel />
          <span className="muted num" style={{ fontSize: 12 }}>
            {Math.round(mastery.overall * 100)}% weighted mastery
          </span>
        </div>
      </header>

      {fresh && (
        <Card className="dash__welcome" pad="md">
          <div className="dash__welcome-grid">
            <div className="stack gap-2">
              <Badge tone="accent" icon={<Sparkles />}>
                Start here
              </Badge>
              <h2 style={{ fontSize: 20 }}>Welcome. Your progress here is earned, not clicked.</h2>
              <p className="subtle" style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                Every skill moves from <i>Not started</i> to <i>Mastered</i> only through performance: solving exercises, debugging broken programs, resolving QC
                discrepancies, explaining concepts, and applying them in projects. Reading a lesson marks it as read — nothing more.
              </p>
              <div className="row gap-2 wrap" style={{ marginTop: 6 }}>
                <ButtonLink variant="primary" to={next ? `/learn/${next.lab}/${next.id}` : '/path'} iconRight={<ArrowRight />}>
                  Begin with “{next?.title ?? 'the learning path'}”
                </ButtonLink>
                <ButtonLink to="/settings">Set weekly hours & start date</ButtonLink>
                <ButtonLink to="/trial" variant="ghost" icon={<FlaskConical />}>
                  Tour the trial simulator
                </ButtonLink>
              </div>
            </div>
            <ol className="dash__steps">
              <li>
                <b>Learn</b> — lessons start from the problem, then intuition, clinical context, formal concept, worked example, code and output.
              </li>
              <li>
                <b>Practice</b> — guided, independent, debug, QC, interview, speed drill and boss-battle modes.
              </li>
              <li>
                <b>Build</b> — case studies and eight capstones on a synthetic oncology trial and a manufacturing process.
              </li>
              <li>
                <b>Prove it</b> — the skill matrix and career-readiness model only move with demonstrated performance.
              </li>
            </ol>
          </div>
        </Card>
      )}

      <div className="dash__stats">
        <div className="kpi">
          <span className="kpi__icon"><Target /></span>
          <div style={{ minWidth: 0 }}>
            <div className="kpi__value">{skillsCompetent}</div>
            <div className="kpi__label muted">skills at Competent or above</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Clock /></span>
          <div style={{ minWidth: 0 }}>
            <div className="kpi__value">
              {(weekMinutes / 60).toFixed(1)}
              <span className="kpi__unit"> / {settings.hoursPerWeek} h</span>
            </div>
            <div className="kpi__label muted">studied in the last 7 days</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon"><Flame /></span>
          <div style={{ minWidth: 0 }}>
            <div className="kpi__value">{st}</div>
            <div className="kpi__label muted">day streak</div>
          </div>
        </div>
        <Link to="/review" className="kpi">
          <span className="kpi__icon"><Repeat /></span>
          <div style={{ minWidth: 0 }}>
            <div className="kpi__value">{due}</div>
            <div className="kpi__label muted">items due for review</div>
          </div>
        </Link>
      </div>

      {next && (
        <Card tone="feature" className="dash__continue">
          <div className="dash__continue-main">
            <div style={{ minWidth: 0 }}>
              <div className="dash__continue-eyebrow">
                <Badge tone="accent" icon={<BookOpen />}>
                  Continue training
                </Badge>
                <span className="eyebrow">
                  {LAB_BY_ID[next.lab]?.title} · {next.moduleTitle}
                </span>
              </div>
              <Link to={`/learn/${next.lab}/${next.id}`} className="dash__continue-title">
                {next.title}
              </Link>
              <p className="dash__continue-summary">{next.summary}</p>
              <div className="dash__continue-meta">
                <span className="row gap-1">
                  <Clock size={13} /> {next.minutes} min
                </span>
                <span>{next.difficulty}</span>
                <span>Next in your plan order, weighted toward your career focus</span>
              </div>
            </div>
            <div className="dash__continue-cta">
              <ButtonLink to={`/learn/${next.lab}/${next.id}`} variant="primary" size="lg" iconRight={<ArrowRight />}>
                Continue
              </ButtonLink>
              <Link to="/path" style={{ fontSize: 12.5 }}>
                See the full path →
              </Link>
            </div>
          </div>
          {week && (
            <div className="dash__continue-plan">
              <div className="row gap-2" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span className="eyebrow">
                  Week {week.n} plan{week.assessment ? ' · integrated assessment' : ''}
                </span>
                <Link to="/plan" style={{ fontSize: 12.5 }}>
                  Full plan →
                </Link>
              </div>
              <ul className="list-reset week-strip__list">
                {week.lessons.map((l) => (
                  <li key={l.id}>
                    <Link to={`/learn/${l.lab}/${l.id}`} className="week-strip__item">
                      {completed.has(l.id) ? <CircleCheck size={15} color="var(--success)" /> : <CircleDot size={15} color="var(--text-4)" />}
                      <span className="grow">{l.title}</span>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {LAB_BY_ID[l.lab]?.short} · {l.minutes}m
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="dash__grid">
        <div className="stack gap-5" style={{ minWidth: 0 }}>
          <Card>
            <CardHeader title="Weekly activity" subtitle="Minutes of active study per day (last 14 days)" />
            <div className="card__body">
              {days.some((d) => d.minutes > 0) ? (
                <ActivityChart days={days} />
              ) : (
                <p className="muted" style={{ fontSize: 13.5 }}>
                  No study time recorded yet. Time is counted while a lesson is open and visible, and while you work on exercises.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Mastery by competency" subtitle="Weighted by skill importance; only performance moves these" />
            <div className="card__body">
              <div className="domain-bars">
                {domainsSorted.map((d) => (
                  <Link key={d.id} to={`/progress#${d.id}`} className="domain-bar">
                    <span className="domain-bar__label">{d.title}</span>
                    <ProgressBar value={d.v} thin />
                    <span className="domain-bar__value num">{Math.round(d.v * 100)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent exercises" subtitle="Your last attempts" />
            <div className="card__body" style={{ paddingTop: 8 }}>
              {recent.length === 0 && <p className="muted" style={{ fontSize: 13.5 }}>No attempts yet.</p>}
              <ul className="list-reset">
                {recent.map((a, i) => {
                  const it = items?.byId.get(a.itemId);
                  return (
                    <li key={`${a.itemId}-${a.ts}-${i}`}>
                      <Link to={`/practice?ids=${a.itemId}`} className="link-row" style={{ fontSize: 13.5 }}>
                        {a.score >= 0.8 ? <CircleCheck size={15} color="var(--success)" /> : a.score >= 0.5 ? <CircleDot size={15} color="var(--warning)" /> : <CircleX size={15} color="var(--danger)" />}
                        <span className="grow" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it ? itemTitle(it) : a.itemId}
                        </span>
                        <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {new Date(a.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        </div>

        <div className="stack gap-5" style={{ minWidth: 0 }}>
          <Card>
            <CardHeader title="Career readiness" subtitle="Competency mastery weighted per role" />
            <div className="card__body">
              <ReadinessBars roles={mastery.roles} />
              <p className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                Readiness reflects demonstrated skill in this app only — a guide for where to focus, not a credential.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Weak topics" subtitle="Practiced, but recent accuracy is below 70%" icon={<TriangleAlert size={15} />} />
            <div className="card__body" style={{ paddingTop: 8 }}>
              {weak.length === 0 ? (
                <p className="muted" style={{ fontSize: 13.5 }}>Nothing flagged. Weak topics appear after a few attempts on a skill.</p>
              ) : (
                <ul className="list-reset">
                  {weak.map((w) => {
                    const l = lessonsForSkill(w.skill.id)[0];
                    return (
                      <li key={w.skill.id} className="weak-row">
                        <Link to={`/progress/skill/${w.skill.id}`} className="grow" style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text)' }}>
                          {w.skill.name}
                        </Link>
                        <span className="muted num" style={{ fontSize: 12 }}>
                          {Math.round((w.recentAccuracy ?? 0) * 100)}%
                        </span>
                        {l && (
                          <Link to={`/practice?skill=${w.skill.id}&count=6&title=${encodeURIComponent(w.skill.name)}`} style={{ fontSize: 12 }}>
                            Practice
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {project && (
            <Card>
              <CardHeader title="Current project" subtitle={`Capstone ${project.number}`} icon={<Milestone size={15} />} />
              <div className="card__body">
                <Link to={`/capstones/${project.id}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {project.title}
                </Link>
                <p className="subtle" style={{ fontSize: 13, margin: '4px 0 10px', lineHeight: 1.5 }}>
                  {project.summary}
                </p>
                <ProgressBar value={project.steps.length ? projectDone / project.steps.length : 0} />
                <span className="muted num" style={{ fontSize: 12 }}>
                  {projectDone} of {project.steps.length} steps
                </span>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Skill matrix" subtitle="Skills per competency at each level" />
            <div className="card__body">
              <table className="skill-matrix">
                <thead>
                  <tr>
                    <th />
                    {LEVELS.map((l, i) => (
                      <th key={l} title={l}>
                        {i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DOMAINS.map((d) => {
                    const counts = [0, 0, 0, 0, 0, 0];
                    for (const s of mastery.bySkill.values()) if (s.skill.domain === d.id) counts[s.level]++;
                    return (
                      <tr key={d.id}>
                        <td className="skill-matrix__name">{d.short}</td>
                        {counts.map((c, i) => (
                          <td key={i} title={`${d.title}: ${c} skill(s) ${LEVELS[i]}`}>
                            <span className="skill-matrix__cell" style={{ background: c ? `var(--mastery-${Math.max(1, i)})` : 'transparent', color: i >= 3 && c ? '#fff' : undefined }}>
                              {c || ''}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                0 Not started · 1 Learning · 2 Practicing · 3 Competent · 4 Strong · 5 Mastered — <Link to="/progress">details</Link>
              </p>
            </div>
          </Card>

          <Card pad="md" flat>
            <div className="stack gap-2">
              <span className="eyebrow">Curriculum</span>
              <span style={{ fontSize: 13.5 }}>
                <b className="num">{lessons.length}</b> lessons · <b className="num">{items?.all.length ?? '…'}</b> exercises · <b className="num">{capstones.length}</b> capstones
              </span>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {lessonById.size ? 'All content is synthetic and fictional — CBX-417 and VTX-221 are invented for teaching.' : ''}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
