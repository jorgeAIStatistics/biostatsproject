/**
 * Mastery model — progress must correspond to demonstrated performance.
 *
 * Levels (per skill):
 *   0 Not started  – nothing opened or attempted
 *   1 Learning     – a lesson opened or any attempt made
 *   2 Practicing   – ≥3 distinct items answered correctly
 *   3 Competent    – ≥5 distinct correct items, recent accuracy ≥70%, at least one applied item
 *                    (code/SQL/numeric/mapping…) correct, and a debug/QC item correct when the
 *                    skill has any
 *   4 Strong       – competent, recent accuracy ≥80%, ≥2 intermediate+ items solved without hints
 *                    or reveal, and an explanation/interview item passed when the skill has any
 *   5 Mastered     – strong, plus an advanced/expert or case/boss item (or linked capstone step),
 *                    and a correct answer at least 7 days after first demonstrating the skill
 *
 * Reading lessons never moves a skill past "Learning".
 */
import type { Attempt, LessonProgress } from '../state/progress';
import type { ItemInfo, ItemIndex, SkillInfo, LessonInfo } from '../content/registry';
import type { DomainId, Difficulty } from '../content/schema';

export const LEVELS = ['Not started', 'Learning', 'Practicing', 'Competent', 'Strong', 'Mastered'] as const;
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

const CORRECT = 0.8;
const DAY = 86_400_000;
const APPLY_FORMATS = new Set(['code', 'sql', 'numeric', 'mapping', 'order', 'classify', 'hotspot', 'log', 'diff', 'text']);
const HARD: Difficulty[] = ['advanced', 'expert'];

export interface SkillMastery {
  skill: SkillInfo;
  level: Level;
  /** 0..1 continuous score used for aggregates (level / 5 plus partial progress). */
  score: number;
  attempts: number;
  distinctCorrect: number;
  recentAccuracy: number | null;
  /** What the learner still needs for the next level. */
  next: string[];
  evidence: {
    apply: boolean;
    debug: boolean | null; // null = no such items exist
    independent: number;
    explain: boolean | null;
    integration: boolean | null;
    spaced: boolean;
  };
  lastPracticed?: number;
}

export interface MasteryInputs {
  attempts: Attempt[];
  lessons: Record<string, LessonProgress>;
  items: ItemIndex | undefined;
  skills: SkillInfo[];
  lessonsBySkill: Map<string, LessonInfo[]>;
  /** Capstone/case steps completed that are linked to skills: skill → count */
  integrationBySkill?: Map<string, number>;
}

export function computeMastery(input: MasteryInputs): Map<string, SkillMastery> {
  const { attempts, lessons, items, skills, lessonsBySkill } = input;
  const bySkillAttempts = new Map<string, { a: Attempt; item: ItemInfo }[]>();
  if (items) {
    for (const a of attempts) {
      const item = items.byId.get(a.itemId);
      if (!item) continue;
      for (const s of item.skills) {
        const arr = bySkillAttempts.get(s);
        if (arr) arr.push({ a, item });
        else bySkillAttempts.set(s, [{ a, item }]);
      }
    }
  }

  const out = new Map<string, SkillMastery>();
  for (const skill of skills) {
    const list = (bySkillAttempts.get(skill.id) ?? []).sort((x, y) => x.a.ts - y.a.ts);
    const skillItems = items?.bySkill.get(skill.id) ?? [];
    const openedLesson = (lessonsBySkill.get(skill.id) ?? []).some((l) => lessons[l.id]);

    const correct = list.filter(({ a }) => a.score >= CORRECT);
    const distinctCorrect = new Set(correct.map(({ a }) => a.itemId)).size;
    const recent = list.slice(-10);
    const recentAccuracy = recent.length ? recent.reduce((s, { a }) => s + a.score, 0) / recent.length : null;

    const hasDebugItems = skillItems.some((i) => i.modes.includes('debug') || i.modes.includes('qc'));
    const hasExplainItems = skillItems.some((i) => i.format === 'open' || i.modes.includes('interview'));
    const hasIntegrationItems = skillItems.some(
      (i) => HARD.includes(i.difficulty) || i.modes.includes('boss') || i.modes.includes('case'),
    );

    const apply = correct.some(({ item }) => APPLY_FORMATS.has(item.format));
    const debug = hasDebugItems ? correct.some(({ item }) => item.modes.includes('debug') || item.modes.includes('qc')) : null;
    const independentSet = new Set(
      correct
        .filter(({ a, item }) => a.hintsUsed === 0 && !a.revealed && item.difficulty !== 'foundation')
        .map(({ a }) => a.itemId),
    );
    const independent = independentSet.size;
    const explain = hasExplainItems
      ? list.some(({ a, item }) => (item.format === 'open' || item.modes.includes('interview')) && a.score >= 0.5)
      : null;
    const integrationFromItems = correct.some(
      ({ item }) => HARD.includes(item.difficulty) || item.modes.includes('boss') || item.modes.includes('case'),
    );
    const integrationSteps = (input.integrationBySkill?.get(skill.id) ?? 0) > 0;
    const integration = hasIntegrationItems || integrationSteps ? integrationFromItems || integrationSteps : null;
    const firstCorrect = correct[0]?.a.ts;
    const spaced = firstCorrect !== undefined && correct.some(({ a }) => a.ts - firstCorrect >= 7 * DAY);

    let level: Level = 0;
    const next: string[] = [];
    if (openedLesson || list.length > 0) level = 1;
    if (level >= 1 && distinctCorrect >= 3) level = 2;
    const competent =
      distinctCorrect >= 5 && (recentAccuracy ?? 0) >= 0.7 && apply && (debug === null || debug === true);
    if (level >= 2 && competent) level = 3;
    const strong =
      (recentAccuracy ?? 0) >= 0.8 && independent >= 2 && (explain === null || explain === true);
    if (level >= 3 && strong) level = 4;
    const mastered = (integration === null ? integrationFromItems || integrationSteps : integration) && spaced;
    if (level >= 4 && mastered) level = 5;

    // Guidance for the next level
    if (level === 0) next.push('Open a lesson for this skill or attempt a practice item.');
    if (level === 1) next.push(`Answer ${Math.max(0, 3 - distinctCorrect)} more distinct items correctly.`);
    if (level === 2) {
      if (distinctCorrect < 5) next.push(`Solve ${5 - distinctCorrect} more distinct items.`);
      if ((recentAccuracy ?? 0) < 0.7) next.push('Raise recent accuracy to 70%.');
      if (!apply) next.push('Solve an applied item (code, SQL, calculation or mapping).');
      if (debug === false) next.push('Solve a debug or QC item.');
    }
    if (level === 3) {
      if ((recentAccuracy ?? 0) < 0.8) next.push('Raise recent accuracy to 80%.');
      if (independent < 2) next.push(`Solve ${2 - independent} intermediate+ items with no hints.`);
      if (explain === false) next.push('Pass an explanation / interview question.');
    }
    if (level === 4) {
      if (!(integrationFromItems || integrationSteps)) next.push('Solve an advanced, case-study or boss item (or a linked capstone step).');
      if (!spaced) next.push('Answer correctly again at least 7 days after first mastering it.');
    }

    // Continuous score: level plus partial progress toward the next level.
    let partial = 0;
    if (level === 1) partial = Math.min(1, distinctCorrect / 3);
    else if (level === 2) partial = Math.min(1, (distinctCorrect - 3) / 2) * 0.6 + (apply ? 0.4 : 0);
    else if (level === 3) partial = Math.min(1, independent / 2) * 0.7 + ((recentAccuracy ?? 0) >= 0.8 ? 0.3 : 0);
    else if (level === 4) partial = (integrationFromItems || integrationSteps ? 0.5 : 0) + (spaced ? 0.5 : 0);
    const score = level === 5 ? 1 : Math.min(0.999, (level + partial * 0.95) / 5);

    out.set(skill.id, {
      skill,
      level,
      score,
      attempts: list.length,
      distinctCorrect,
      recentAccuracy,
      next,
      evidence: { apply, debug, independent, explain, integration, spaced },
      lastPracticed: list.length ? list[list.length - 1].a.ts : undefined,
    });
  }
  return out;
}

/** Weighted mean of skill scores within a competency domain. */
export function domainMastery(m: Map<string, SkillMastery>, domain: DomainId): number {
  let num = 0;
  let den = 0;
  for (const s of m.values()) {
    if (s.skill.domain !== domain) continue;
    num += s.score * s.skill.weight;
    den += s.skill.weight;
  }
  return den ? num / den : 0;
}

export function domainLevelCounts(m: Map<string, SkillMastery>, domain: DomainId): number[] {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const s of m.values()) if (s.skill.domain === domain) counts[s.level]++;
  return counts;
}

/** Skills that are being practiced but not going well. */
export function weakSkills(m: Map<string, SkillMastery>, limit = 6): SkillMastery[] {
  return [...m.values()]
    .filter((s) => s.attempts >= 2 && (s.recentAccuracy ?? 1) < 0.7)
    .sort((a, b) => (a.recentAccuracy ?? 0) - (b.recentAccuracy ?? 0) || b.skill.weight - a.skill.weight)
    .slice(0, limit);
}

export function streak(activity: Record<string, { a: number; l: number; s: number }>, now = new Date()): number {
  const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const active = (k: string) => {
    const v = activity[k];
    return !!v && (v.a > 0 || v.l > 0 || v.s >= 300);
  };
  const d = new Date(now);
  let count = 0;
  if (!active(day(d))) d.setDate(d.getDate() - 1); // today not yet active: streak can still be alive
  while (active(day(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
