import { Link, useParams } from 'react-router';
import { CircleCheck, Circle, CircleMinus } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useMastery } from '../../lib/useMastery';
import { LEVELS } from '../../lib/mastery';
import { skillById, lessonsForSkill, useItems, itemTitle } from '../../content/registry';
import { DOMAIN_BY_ID, LAB_BY_ID } from '../../content/labs';
import { Badge, ButtonLink, Card, CardHeader, EmptyState } from '../../components/ui';
import { MasteryMeter } from '../../components/progress/MasteryMeter';
import { useProgress } from '../../state/progress';
import { FORMAT_LABELS, MODE_LABELS } from '../../components/practice/types';
import './progress.css';

function Evidence({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <li className="evidence">
      {ok === null ? <CircleMinus size={15} color="var(--text-4)" /> : ok ? <CircleCheck size={15} color="var(--success)" /> : <Circle size={15} color="var(--text-4)" />}
      <span style={{ color: ok === null ? 'var(--text-4)' : undefined }}>
        {label}
        {ok === null ? ' (no such exercises yet — waived)' : ''}
      </span>
    </li>
  );
}

export default function SkillPage() {
  const { skillId } = useParams<{ skillId: string }>();
  const skill = skillId ? skillById.get(skillId) : undefined;
  usePage(skill?.name ?? 'Skill', [{ label: 'Progress', to: '/progress' }], 'skill');
  const mastery = useMastery();
  const items = useItems();
  const attempts = useProgress((s) => s.attempts);
  if (!skill) return <div className="page"><EmptyState title="Unknown skill" /></div>;
  const m = mastery.bySkill.get(skill.id)!;
  const lessons = lessonsForSkill(skill.id);
  const skillItems = items?.bySkill.get(skill.id) ?? [];
  const best = (id: string) => attempts.filter((a) => a.itemId === id).reduce((mx, a) => Math.max(mx, a.score), -1);

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">{DOMAIN_BY_ID[skill.domain]?.title} · skill</div>
        <h1 className="page-title">{skill.name}</h1>
        <p className="page-lede">{skill.description}</p>
        <div className="row gap-3" style={{ marginTop: 6 }}>
          <MasteryMeter level={m.level} large showLabel />
          <Badge tone={skill.weight === 3 ? 'accent' : 'neutral'}>{skill.weight === 3 ? 'Critical' : skill.weight === 2 ? 'Core' : 'Supporting'}</Badge>
        </div>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Evidence" subtitle={`${m.attempts} attempts · ${m.distinctCorrect} distinct correct · recent accuracy ${m.recentAccuracy === null ? '—' : `${Math.round(m.recentAccuracy * 100)}%`}`} />
          <div className="card__body">
            <ul className="list-reset stack gap-2">
              <Evidence ok={m.distinctCorrect >= 3} label="3+ distinct exercises solved (Practicing)" />
              <Evidence ok={m.evidence.apply} label="An applied exercise solved (code, SQL, calculation, mapping)" />
              <Evidence ok={m.evidence.debug} label="A debug or QC exercise solved" />
              <Evidence ok={m.evidence.independent >= 2} label={`Two intermediate+ exercises solved without hints (${m.evidence.independent}/2)`} />
              <Evidence ok={m.evidence.explain} label="An explanation / interview question passed" />
              <Evidence ok={m.evidence.integration} label="Applied in an advanced, case-study, boss or capstone task" />
              <Evidence ok={m.evidence.spaced} label="Still correct ≥ 7 days after first demonstrating it" />
            </ul>
            {m.next.length > 0 && (
              <div className="next-steps">
                <div className="eyebrow">To reach {LEVELS[Math.min(5, m.level + 1)]}</div>
                <ul>
                  {m.next.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="row gap-2" style={{ marginTop: 14 }}>
              <ButtonLink variant="primary" to={`/practice?skill=${skill.id}&count=8&title=${encodeURIComponent(skill.name)}`}>
                Practice this skill
              </ButtonLink>
            </div>
          </div>
        </Card>
        <div className="stack gap-4">
          <Card>
            <CardHeader title="Lessons" subtitle={`${lessons.length} lesson(s) teach this skill`} />
            <ul className="list-reset" style={{ padding: 8 }}>
              {lessons.map((l) => (
                <li key={l.id}>
                  <Link to={`/learn/${l.lab}/${l.id}`} className="link-row" style={{ fontSize: 13.5 }}>
                    <span className="grow">{l.title}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {LAB_BY_ID[l.lab]?.short}
                    </span>
                  </Link>
                </li>
              ))}
              {lessons.length === 0 && <li className="muted" style={{ padding: 8, fontSize: 13 }}>No lesson yet.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Exercises" subtitle={`${skillItems.length} exercise(s) assess this skill`} />
            <ul className="list-reset" style={{ padding: 8, maxHeight: 420, overflow: 'auto' }}>
              {skillItems.map((it) => {
                const b = best(it.id);
                return (
                  <li key={it.id}>
                    <Link to={`/practice?ids=${it.id}`} className="link-row" style={{ fontSize: 13 }}>
                      <span className={`practice-dot ${b >= 0.8 ? 'is-done' : b >= 0 ? 'is-tried' : ''}`} />
                      <span className="grow">{itemTitle(it)}</span>
                      <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        {FORMAT_LABELS[it.format]} · {MODE_LABELS[it.modes[0]]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
