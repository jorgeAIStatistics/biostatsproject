import { Link, useParams } from 'react-router';
import { Milestone, Clock, FolderGit2, Target } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { capstones, capstoneById, skillById } from '../../content/registry';
import { Badge, Button, ButtonLink, Card, EmptyState, ProgressBar } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { useProgress } from '../../state/progress';
import { ProjectSteps } from './ProjectSteps';
import './projects.css';

export default function CapstonesPage() {
  const { capstoneId } = useParams<{ capstoneId?: string }>();
  const cap = capstoneId ? capstoneById.get(capstoneId) : undefined;
  usePage(cap ? `Capstone ${cap.number}: ${cap.title}` : 'Capstones', cap ? [{ label: 'Capstones', to: '/capstones' }] : [], 'capstone');
  const steps = useProgress((s) => s.steps);
  const current = useProgress((s) => s.currentProject);
  const setCurrent = useProgress((s) => s.setCurrentProject);

  if (cap) {
    const done = cap.steps.filter((s) => steps[`${cap.id}:${s.id}`]).length;
    return (
      <div className="page">
        <div className="page-header">
          <div className="row gap-2 wrap">
            <Badge tone="accent">Capstone {cap.number}</Badge>
            <Badge outline>{cap.difficulty}</Badge>
            <span className="muted row gap-1" style={{ fontSize: 12.5 }}>
              <Clock size={13} /> ~{cap.hours} h
            </span>
          </div>
          <h1 className="page-title">{cap.title}</h1>
          <p className="page-lede">{cap.summary}</p>
        </div>
        <div className="project-layout">
          <div className="stack gap-5" style={{ minWidth: 0 }}>
            <Card pad="md">
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Objective
              </div>
              <Markdown source={cap.objective} />
            </Card>
            <Card pad="md">
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Why employers care
              </div>
              <Markdown source={cap.relevance} compact />
            </Card>
            <Card pad="md">
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Deliverables
              </div>
              <ul className="deliverables">
                {cap.deliverables.map((d, i) => (
                  <li key={i}>
                    <Markdown source={d} compact inline />
                  </li>
                ))}
              </ul>
            </Card>
            <div>
              <h2 className="section-title" style={{ marginBottom: 10 }}>
                Steps
              </h2>
              <ProjectSteps projectId={cap.id} steps={cap.steps} />
            </div>
            <Card>
              <div className="card__header">
                <div className="card__title">Rubric</div>
              </div>
              <dl className="rubric-list">
                {cap.rubric.map((r) => (
                  <div key={r.criterion} className="rubric-list__row">
                    <dt>{r.criterion}</dt>
                    <dd>
                      <Markdown source={r.description} compact />
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
          <aside className="stack gap-3">
            <Card pad="md">
              <div className="card__title">Progress</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 650, margin: '4px 0' }}>
                {done}/{cap.steps.length}
              </div>
              <ProgressBar value={cap.steps.length ? done / cap.steps.length : 0} />
              <div style={{ marginTop: 12 }}>
                {current === cap.id ? (
                  <Badge tone="success">Your current project</Badge>
                ) : (
                  <Button size="sm" icon={<Target />} onClick={() => setCurrent(cap.id)}>
                    Make this my current project
                  </Button>
                )}
              </div>
            </Card>
            {cap.starter && (
              <Card pad="md">
                <div className="card__title">Starter files</div>
                <p className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>
                  {cap.starter}/
                </p>
              </Card>
            )}
            <Card pad="md">
              <div className="card__title" style={{ marginBottom: 6 }}>
                Skills demonstrated
              </div>
              <div className="row gap-1 wrap">
                {cap.skills.map((s) => (
                  <Link key={s} to={`/progress/skill/${s}`} className="tag">
                    {skillById.get(s)?.name ?? s}
                  </Link>
                ))}
              </div>
            </Card>
            <ButtonLink to={`/portfolio?capstone=${cap.id}`} icon={<FolderGit2 />}>
              Turn into a portfolio repo
            </ButtonLink>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Substantial projects</div>
        <h1 className="page-title">Capstones</h1>
        <p className="page-lede">
          Eight end-to-end projects that mirror real deliverables — from cleaning messy CRF exports to a simulated submission package and a manufacturing
          analytics pipeline. Each one becomes a credible, accurately described portfolio repository.
        </p>
      </div>
      {capstones.length === 0 ? (
        <Card pad="md">
          <EmptyState icon={<Milestone />} title="No capstones defined yet">Capstones live in content/capstones/capstones.yaml.</EmptyState>
        </Card>
      ) : (
        <div className="capstone-list">
          {capstones.map((c) => {
            const done = c.steps.filter((s) => steps[`${c.id}:${s.id}`]).length;
            return (
              <Link key={c.id} to={`/capstones/${c.id}`} className="card card--interactive capstone-card">
                <span className="capstone-card__n num">{c.number}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 620, fontSize: 15.5 }}>{c.title}</div>
                  <p className="muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>
                    {c.summary}
                  </p>
                </div>
                <div className="capstone-card__meta">
                  <span className="muted num" style={{ fontSize: 12 }}>
                    {done}/{c.steps.length} steps · ~{c.hours}h
                  </span>
                  <ProgressBar value={c.steps.length ? done / c.steps.length : 0} thin />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
