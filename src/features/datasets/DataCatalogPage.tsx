import { Link } from 'react-router';
import { HardDrive, Download } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useManifests } from '../../lib/datasets';
import { Badge, Card, EmptyState, Loading } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';

const LAYER_ORDER = ['raw', 'messy', 'sdtm', 'adam', 'process', 'teaching', 'reference'];
const LAYER_LABEL: Record<string, string> = {
  raw: 'Raw (EDC & vendor exports)',
  messy: 'Messy instrument exports',
  sdtm: 'SDTM (tabulation)',
  adam: 'ADaM (analysis)',
  process: 'Process & quality data',
  teaching: 'Teaching datasets',
  reference: 'Reference',
};
const LAYER_TONE = { raw: 'warning', sdtm: 'info', adam: 'violet', teaching: 'neutral', process: 'success', messy: 'danger', reference: 'neutral' } as const;

export default function DataCatalogPage() {
  usePage('Datasets');
  const manifests = useManifests();
  if (!manifests) return <div className="page"><Loading /></div>;
  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Synthetic data — no real patients</div>
        <h1 className="page-title">Datasets</h1>
        <p className="page-lede">
          Every dataset is generated deterministically by the scripts in <code>scripts/data/</code> (<code>npm run data</code>) and ships as CSV under{' '}
          <code>data/</code>, with a manifest describing each variable. Use them here, in SAS/R/Python locally, or through SQL in the browser.
        </p>
      </div>
      {manifests.length === 0 && (
        <Card pad="md">
          <EmptyState icon={<HardDrive />} title="No datasets generated yet">
            Run <code>npm run data</code> in the project folder.
          </EmptyState>
        </Card>
      )}
      <div className="stack gap-7">
        {manifests.map((m) => (
          <section key={m.study}>
            <div className="stack gap-1" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 19 }}>{m.title}</h2>
              <div style={{ maxWidth: '80ch' }}>
                <Markdown source={m.description} compact />
              </div>
            </div>
            {LAYER_ORDER.filter((layer) => m.datasets.some((d) => d.layer === layer)).map((layer) => (
              <div key={layer} style={{ marginBottom: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {LAYER_LABEL[layer] ?? layer}
                </div>
                <div className="grid grid-auto">
                  {m.datasets
                    .filter((d) => d.layer === layer)
                    .map((d) => (
                      <Link key={d.id} to={`/data/${d.id}`} className="card card--interactive card--pad-sm">
                        <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                          <span className="mono" style={{ fontWeight: 650, fontSize: 13.5 }}>
                            {d.name}
                          </span>
                          <Badge tone={LAYER_TONE[d.layer]}>{d.layer}</Badge>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>{d.label}</div>
                        <div className="muted num" style={{ fontSize: 12, marginTop: 6 }}>
                          {d.rows.toLocaleString()} rows · {d.columns.length} variables
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="muted row gap-2" style={{ fontSize: 12.5, marginTop: 24 }}>
        <Download size={13} /> Download any dataset as CSV from its page, or open the files in <code>data/</code> directly.
      </p>
    </div>
  );
}
