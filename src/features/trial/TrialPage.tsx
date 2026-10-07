import { Suspense, lazy } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FlaskConical, Workflow, Database, Layers, Route, Table, Activity, UserSearch, FileText } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { Card, Loading, Tabs, Badge } from '../../components/ui';
import { WidgetHost } from '../../components/widgets/registry';
import './trial.css';

const SubjectExplorer = lazy(() => import('./SubjectExplorer'));
const TlfGallery = lazy(() => import('./TlfGallery'));

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: <FlaskConical /> },
  { id: 'lifecycle', label: 'Data lifecycle', icon: <Workflow /> },
  { id: 'subjects', label: 'Subject explorer', icon: <UserSearch /> },
  { id: 'sdtm', label: 'SDTM explorer', icon: <Layers /> },
  { id: 'trace', label: 'Trace a value', icon: <Route /> },
  { id: 'tlf', label: 'TLF gallery', icon: <Table /> },
  { id: 'survival', label: 'Survival', icon: <Activity /> },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const DESIGN: [string, string][] = [
  ['Study', 'CBX417-301 — randomized, double-blind, placebo-controlled Phase 2/3-style study (fictional)'],
  ['Population', 'Adults with previously treated advanced or metastatic NSCLC, ECOG 0–1, measurable disease (RECIST 1.1)'],
  ['Treatments', 'CBX-417 200 mg QD + docetaxel 75 mg/m² q3w  vs  placebo + docetaxel, 21-day cycles'],
  ['Randomization', '1:1, stratified by ECOG PS (0 vs 1) and prior anti-PD-(L)1 therapy; permuted blocks of 4 via IxRS'],
  ['Primary endpoint', 'Progression-free survival (investigator, RECIST 1.1)'],
  ['Key secondary', 'Overall survival; ORR (confirmed), duration of response; safety'],
  ['Sample size', '420 randomized; 331 PFS events for 90% power at HR 0.70, two-sided α 0.05'],
  ['Data cutoff', '31 March 2025 (final PFS analysis)'],
];

const FLOW: { n: number; label: string; note?: string }[] = [
  { n: 468, label: 'Screened (informed consent)' },
  { n: 48, label: 'Screen failures', note: 'ARMNRS = "SCREEN FAILURE" in DM' },
  { n: 420, label: 'Randomized — ITT population', note: '210 per arm' },
  { n: 4, label: 'Randomized, never treated', note: 'SAFFL = "N"; ARMNRS = "ASSIGNED, NOT TREATED"' },
  { n: 416, label: 'Treated — safety population', note: 'analysed by actual treatment (TRT01A)' },
];

export default function TrialPage() {
  const { section } = useParams<{ section?: string }>();
  const active = (SECTIONS.find((s) => s.id === section)?.id ?? 'overview') as SectionId;
  const navigate = useNavigate();
  usePage(active === 'overview' ? 'Trial Simulator' : SECTIONS.find((s) => s.id === active)!.label, active === 'overview' ? [] : [{ label: 'Trial Simulator', to: '/trial' }], 'trial');

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="row gap-2">
          <span className="eyebrow">Flagship synthetic study</span>
          <Badge tone="warning">Fictional · educational</Badge>
        </div>
        <h1 className="page-title">CBX417-301 trial simulator</h1>
        <p className="page-lede">
          One study, followed through the whole biometrics lifecycle: protocol → CRF → raw data (with realistic problems) → SDTM → ADaM → analysis → TLFs →
          QC → report. Everything here is generated from the same synthetic truth, so every number traces back to a raw CRF row.
        </p>
      </div>
      <Tabs value={active} onChange={(id) => navigate(id === 'overview' ? '/trial' : `/trial/${id}`)} tabs={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))} />
      <div style={{ marginTop: 20 }}>
        <Suspense fallback={<Loading />}>
          {active === 'overview' && (
            <div className="trial-overview">
              <Card>
                <div className="card__header">
                  <div className="card__title">Design at a glance</div>
                  <Link to="/documents/protocol-synopsis" className="row gap-1" style={{ fontSize: 12.5 }}>
                    <FileText size={13} /> Protocol synopsis
                  </Link>
                </div>
                <dl className="design-list">
                  {DESIGN.map(([k, v]) => (
                    <div key={k} className="design-list__row">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <div className="card__header">
                  <div className="card__title">Subject flow</div>
                  <Link to="/learn/trials" style={{ fontSize: 12.5 }}>
                    Why populations matter →
                  </Link>
                </div>
                <ol className="flow">
                  {FLOW.map((f) => (
                    <li key={f.label} className="flow__step">
                      <span className="flow__n num">{f.n}</span>
                      <span className="stack">
                        <span className="flow__label">{f.label}</span>
                        {f.note && <span className="flow__note">{f.note}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="muted" style={{ fontSize: 12.5, padding: '0 16px 14px', lineHeight: 1.5 }}>
                  Three dispensing errors make planned and actual treatment differ for three subjects — the reason safety tables use <code>TRT01A</code> while
                  efficacy uses <code>TRT01P</code>.
                </p>
              </Card>
              <Card className="trial-overview__wide">
                <div className="card__header">
                  <div className="card__title">Explore the layers</div>
                </div>
                <div className="layer-grid">
                  <Link to="/data" className="layer-tile layer-tile--raw">
                    <Database />
                    <b>Raw</b>
                    <span>EDC forms, lab vendor file, IxRS — with duplicates, impossible dates, unit mix-ups and coding variants.</span>
                  </Link>
                  <Link to="/trial/sdtm" className="layer-tile layer-tile--sdtm">
                    <Layers />
                    <b>SDTM</b>
                    <span>DM, AE, CM, MH, EX, LB, VS, EG, DS, DV, RS, TR and SUPPQUAL — standardized tabulation.</span>
                  </Link>
                  <Link to="/trial/trace" className="layer-tile layer-tile--adam">
                    <Route />
                    <b>ADaM</b>
                    <span>ADSL, ADAE, ADLB, ADVS, ADRS, ADTR, ADTTE — analysis-ready, with traceability back to SDTM.</span>
                  </Link>
                  <Link to="/trial/tlf" className="layer-tile layer-tile--tlf">
                    <Table />
                    <b>TLFs</b>
                    <span>Demographics, disposition, safety, lab shift, PFS/OS, KM and forest plots — computed live.</span>
                  </Link>
                </div>
              </Card>
            </div>
          )}
          {active === 'lifecycle' && <WidgetHost name="lifecycle-map" props={{}} />}
          {active === 'subjects' && <SubjectExplorer />}
          {active === 'sdtm' && <WidgetHost name="sdtm-explorer" props={{}} />}
          {active === 'trace' && <WidgetHost name="trace-value" props={{ tlf: 'demog' }} />}
          {active === 'tlf' && <TlfGallery />}
          {active === 'survival' && (
            <div className="stack gap-2">
              <WidgetHost name="km-study" props={{ endpoint: 'PFS' }} />
              <WidgetHost name="forest-plot" props={{ endpoint: 'PFS' }} />
              <WidgetHost name="km-hand-calculation" props={{}} />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
