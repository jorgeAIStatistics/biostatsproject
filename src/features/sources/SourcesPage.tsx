import { ExternalLink, BadgeCheck, Users, FlaskConical } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { sources } from '../../content/registry';
import { Badge, Card, EmptyState } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';

const ORG_ORDER = ['CDISC', 'FDA', 'ICH', 'NCI', 'EMA', 'PHUSE', 'WHO', 'Academic', 'Software'];

export default function SourcesPage() {
  usePage('Standards & Sources');
  const byOrg = ORG_ORDER.map((o) => ({ org: o, list: sources.filter((s) => s.org === o) })).filter((g) => g.list.length);
  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Primary sources</div>
        <h1 className="page-title">Standards & sources</h1>
        <p className="page-lede">
          This app distinguishes three kinds of statements, and labels them wherever they appear. When in doubt, the primary source below wins over anything
          written here — standards are versioned and change.
        </p>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        <Card pad="md">
          <Badge tone="accent" icon={<BadgeCheck />}>
            Official requirement
          </Badge>
          <p className="subtle" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>
            Stated in a CDISC standard or an FDA/EMA/ICH document, cited with document and version.
          </p>
        </Card>
        <Card pad="md">
          <Badge tone="neutral" icon={<Users />}>
            Industry convention
          </Badge>
          <p className="subtle" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>
            Common practice at sponsors and CROs that is not a requirement. Your study's specifications decide.
          </p>
        </Card>
        <Card pad="md">
          <Badge tone="warning" icon={<FlaskConical />}>
            Educational simplification
          </Badge>
          <p className="subtle" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>
            Something simplified for teaching (e.g., TR contains only sums of diameters). Never mistake these for how a real submission is built.
          </p>
        </Card>
      </div>
      {byOrg.length === 0 && (
        <Card pad="md">
          <EmptyState title="No sources registered yet">Sources are listed in content/sources/sources.yaml.</EmptyState>
        </Card>
      )}
      {byOrg.map((g) => (
        <section key={g.org} style={{ marginBottom: 28 }}>
          <h2 className="section-title" style={{ marginBottom: 10 }}>
            {g.org}
          </h2>
          <div className="stack gap-3">
            {g.list.map((s) => (
              <Card key={s.id} pad="md">
                <div className="row gap-3" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="stack gap-1" style={{ minWidth: 0 }}>
                    <a href={s.url} target="_blank" rel="noreferrer noopener" style={{ fontWeight: 620, fontSize: 14.5 }}>
                      {s.title} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
                    </a>
                    {s.version && <span className="muted" style={{ fontSize: 12 }}>{s.version}</span>}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Markdown source={s.note} compact />
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
