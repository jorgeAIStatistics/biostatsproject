import { Link, useParams } from 'react-router';
import { Briefcase, Clock } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { cases, caseById } from '../../content/registry';
import { LAB_BY_ID } from '../../content/labs';
import { Badge, Card, EmptyState } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { useProgress } from '../../state/progress';
import { ProjectSteps } from './ProjectSteps';
import './projects.css';

export default function CasesPage() {
  const { caseId } = useParams<{ caseId?: string }>();
  const cs = caseId ? caseById.get(caseId) : undefined;
  usePage(cs?.title ?? 'Case Studies', cs ? [{ label: 'Case studies', to: '/cases' }] : [], 'case');
  const steps = useProgress((s) => s.steps);

  if (cs) {
    const done = cs.steps.filter((s) => steps[`${cs.id}:${s.id}`]).length;
    return (
      <div className="page">
        <div className="page-header">
          <div className="row gap-2 wrap">
            {cs.labs.map((l) => (
              <Badge key={l} tone="accent">
                {LAB_BY_ID[l]?.short}
              </Badge>
            ))}
            <Badge outline>{cs.difficulty}</Badge>
            <span className="muted row gap-1" style={{ fontSize: 12.5 }}>
              <Clock size={13} /> ~{cs.minutes} min
            </span>
          </div>
          <h1 className="page-title">{cs.title}</h1>
          <p className="page-lede">{cs.summary}</p>
        </div>
        <div className="project-layout">
          <div className="stack gap-5" style={{ minWidth: 0 }}>
            <Card pad="md">
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Scenario
              </div>
              <Markdown source={cs.scenario} />
            </Card>
            <ProjectSteps projectId={cs.id} steps={cs.steps} />
            {done === cs.steps.length && (
              <Card pad="md">
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Debrief
                </div>
                <Markdown source={cs.debrief} />
              </Card>
            )}
          </div>
          <aside className="stack gap-3">
            <Card pad="md">
              <div className="card__title">Progress</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 650, marginTop: 4 }}>
                {done}/{cs.steps.length}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                steps complete{done < cs.steps.length ? ' — the debrief unlocks at the end' : ''}
              </div>
            </Card>
            {cs.datasets.length > 0 && (
              <Card pad="md">
                <div className="card__title" style={{ marginBottom: 6 }}>
                  Datasets
                </div>
                {cs.datasets.map((d) => (
                  <Link key={d} to={`/data/${d}`} className="link-row mono" style={{ fontSize: 12.5 }}>
                    {d}
                  </Link>
                ))}
              </Card>
            )}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Multi-step, realistic</div>
        <h1 className="page-title">Case studies</h1>
        <p className="page-lede">
          Shorter than capstones, longer than exercises: a realistic situation on the CBX417-301 study or the manufacturing process, worked through in steps
          that combine several skills, with a debrief at the end.
        </p>
      </div>
      {cases.length === 0 ? (
        <Card pad="md">
          <EmptyState icon={<Briefcase />} title="No case studies yet">Case studies live in content/cases/*.yaml.</EmptyState>
        </Card>
      ) : (
        <div className="grid grid-auto">
          {cases.map((c) => {
            const done = c.steps.filter((s) => steps[`${c.id}:${s.id}`]).length;
            return (
              <Link key={c.id} to={`/cases/${c.id}`} className="card card--interactive card--pad">
                <div className="row gap-2 wrap">
                  {c.labs.map((l) => (
                    <Badge key={l} tone="accent">
                      {LAB_BY_ID[l]?.short}
                    </Badge>
                  ))}
                </div>
                <div style={{ fontWeight: 620, fontSize: 15, marginTop: 8 }}>{c.title}</div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                  {c.summary}
                </p>
                <div className="muted num" style={{ fontSize: 12, marginTop: 8 }}>
                  {done}/{c.steps.length} steps · ~{c.minutes} min
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
