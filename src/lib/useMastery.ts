import { useMemo } from 'react';
import { useProgress } from '../state/progress';
import { useItems, skills, lessons, capstones, cases, type LessonInfo } from '../content/registry';
import { computeMastery, domainMastery, type SkillMastery } from './mastery';
import { DOMAINS, ROLES } from '../content/labs';
import type { DomainId } from '../content/schema';

const lessonsBySkill = new Map<string, LessonInfo[]>();
for (const l of lessons) for (const s of l.skills) lessonsBySkill.set(s, [...(lessonsBySkill.get(s) ?? []), l]);

export function useMastery() {
  const attempts = useProgress((s) => s.attempts);
  const lessonProgress = useProgress((s) => s.lessons);
  const steps = useProgress((s) => s.steps);
  const items = useItems();

  return useMemo(() => {
    // Completed capstone/case steps count as integration evidence for the project's skills.
    const integrationBySkill = new Map<string, number>();
    for (const p of [...capstones, ...cases]) {
      const done = p.steps.filter((s) => steps[`${p.id}:${s.id}`]).length;
      if (done > 0) for (const sk of p.skills) integrationBySkill.set(sk, (integrationBySkill.get(sk) ?? 0) + done);
    }
    const bySkill = computeMastery({ attempts, lessons: lessonProgress, items, skills, lessonsBySkill, integrationBySkill });
    const byDomain = new Map<DomainId, number>(DOMAINS.map((d) => [d.id, domainMastery(bySkill, d.id)]));
    const roles = ROLES.map((r) => {
      let v = 0;
      let w = 0;
      for (const [d, weight] of Object.entries(r.weights) as [DomainId, number][]) {
        v += (byDomain.get(d) ?? 0) * weight;
        w += weight;
      }
      return { ...r, readiness: w ? v / w : 0 };
    });
    const overall = [...byDomain.values()].reduce((a, b) => a + b, 0) / Math.max(1, byDomain.size);
    return { bySkill, byDomain, roles, overall, ready: !!items };
  }, [attempts, lessonProgress, steps, items]);
}

export type MasterySnapshot = ReturnType<typeof useMastery>;
export type { SkillMastery };
export { lessonsBySkill };
