/**
 * Weekly training plan generator.
 *
 * The plan is derived from the curriculum rather than hand-written, so it
 * grows automatically as lessons are added. Each week mixes theory, coding,
 * clinical-data work, review and one project task; every fourth week is an
 * integrated assessment week.
 */
import { lessons as allLessons, capstones, modules, type LessonInfo } from '../content/registry';
import type { LabId, TrackId } from '../content/vocab';

export const PHASES = [
  { level: 1, title: 'Foundations', focus: 'Trial basics, SAS/R/Python fundamentals, descriptive and inferential statistics, clean data habits.' },
  { level: 2, title: 'Core clinical programming', focus: 'Combining and reshaping data, dates and formats, SDTM, SQL, regression, safety data.' },
  { level: 3, title: 'Analysis datasets & modeling', focus: 'ADaM, TLFs, GLMs, mixed models, survival analysis, macros, PCA and predictive modeling.' },
  { level: 4, title: 'Integration & QC', focus: 'Trial methods, QC and validation, end-to-end case studies and capstones.' },
  { level: 5, title: 'Interview & portfolio readiness', focus: 'Capstone polish, portfolio artifacts, mock interviews and spaced review.' },
] as const;

/** Round-robin order of labs inside a phase: alternate clinical, coding and theory work. */
const LAB_ROTATION: LabId[] = ['trials', 'sas', 'stats', 'cdisc', 'r', 'python', 'tlf', 'sql', 'excel', 'qc', 'analytics', 'git'];

export interface PlanWeek {
  n: number;
  start: Date;
  end: Date;
  phase: (typeof PHASES)[number];
  lessons: LessonInfo[];
  assessment: boolean;
  /** Minutes budgeted: new material / practice & review / project. */
  budget: { lessons: number; practice: number; project: number };
  lessonMinutes: number;
  project?: { capstoneId: string; title: string; stepId: string; stepTitle: string };
}

export interface PlanOptions {
  hoursPerWeek: number;
  startDate: string;
  focus: TrackId[];
}

function orderLessons(focus: TrackId[]): LessonInfo[] {
  const out: LessonInfo[] = [];
  for (const phase of PHASES) {
    // Lessons of this level grouped by lab, keeping curriculum order inside each lab.
    const byLab = new Map<LabId, LessonInfo[]>();
    for (const l of allLessons) {
      const level = moduleLevel(l);
      if (level !== phase.level) continue;
      byLab.set(l.lab, [...(byLab.get(l.lab) ?? []), l]);
    }
    // Labs matching the learner's focus come first in the rotation.
    const labs = [...LAB_ROTATION].sort((a, b) => focusScore(byLab.get(b), focus) - focusScore(byLab.get(a), focus));
    let remaining = true;
    const cursors = new Map<LabId, number>();
    while (remaining) {
      remaining = false;
      for (const lab of labs) {
        const list = byLab.get(lab);
        const i = cursors.get(lab) ?? 0;
        if (list && i < list.length) {
          out.push(list[i]);
          cursors.set(lab, i + 1);
          remaining = true;
        }
      }
    }
  }
  return out;
}

const levelCache = new Map<string, number>();
for (const m of modules) for (const l of m.lessons) levelCache.set(l.id, m.level);
function moduleLevel(l: LessonInfo): number {
  return levelCache.get(l.id) ?? 1;
}

function focusScore(list: LessonInfo[] | undefined, focus: TrackId[]): number {
  if (!list?.length) return -1;
  return list.filter((l) => l.tracks.some((t) => focus.includes(t))).length / list.length;
}

export function buildPlan({ hoursPerWeek, startDate, focus }: PlanOptions): PlanWeek[] {
  const ordered = orderLessons(focus);
  const minutesPerWeek = Math.max(120, hoursPerWeek * 60);
  const weeks: PlanWeek[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  let i = 0;
  let n = 1;
  const capSteps = capstones.flatMap((c) => c.steps.map((s) => ({ capstoneId: c.id, title: c.title, stepId: s.id, stepTitle: s.title })));
  let capIdx = 0;
  while (i < ordered.length && n <= 120) {
    const assessment = n % 4 === 0;
    const lessonShare = assessment ? 0.3 : 0.55;
    const budget = {
      lessons: Math.round(minutesPerWeek * lessonShare),
      practice: Math.round(minutesPerWeek * (assessment ? 0.45 : 0.25)),
      project: Math.round(minutesPerWeek * (assessment ? 0.25 : 0.2)),
    };
    const wk: LessonInfo[] = [];
    let used = 0;
    while (i < ordered.length) {
      const l = ordered[i];
      if (wk.length > 0 && used + l.minutes > budget.lessons * 1.15) break;
      wk.push(l);
      used += l.minutes;
      i++;
      if (used >= budget.lessons) break;
    }
    const level = wk.length ? Math.max(...wk.map(moduleLevel)) : 1;
    const phase = PHASES.find((p) => p.level === level) ?? PHASES[0];
    const ws = new Date(start);
    ws.setDate(start.getDate() + (n - 1) * 7);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const project = level >= 2 && capSteps.length ? capSteps[Math.min(capIdx++, capSteps.length - 1)] : undefined;
    weeks.push({ n, start: ws, end: we, phase, lessons: wk, assessment, budget, lessonMinutes: used, project });
    n++;
  }
  return weeks;
}

export function currentWeekNumber(startDate: string, now = new Date()): number {
  const start = new Date(`${startDate}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

/** First lesson (in plan order) that is not yet completed. */
export function nextLesson(completed: Set<string>, focus: TrackId[]): LessonInfo | undefined {
  return orderLessons(focus).find((l) => !completed.has(l.id));
}
