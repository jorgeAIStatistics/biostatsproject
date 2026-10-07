import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router';
import clsx from 'clsx';
import { FileText, ClipboardList, FileSpreadsheet, ScrollText, BookText, Table, FileCheck, Notebook, NotebookText } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { documents, documentById, loadDocumentBody, useItems } from '../../content/registry';
import { Badge, Card, EmptyState, Loading } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { ItemView } from '../../components/practice/ItemView';
import '../reference/reference.css';
import './documents.css';

const TYPE_META: Record<string, { label: string; icon: typeof FileText }> = {
  protocol: { label: 'Protocol', icon: ScrollText },
  crf: { label: 'CRF', icon: ClipboardList },
  acrf: { label: 'Annotated CRF', icon: ClipboardList },
  dmp: { label: 'Data management plan', icon: Notebook },
  sap: { label: 'Statistical analysis plan', icon: BookText },
  shells: { label: 'TLF shells', icon: Table },
  'sdtm-spec': { label: 'SDTM specification', icon: FileSpreadsheet },
  'adam-spec': { label: 'ADaM specification', icon: FileSpreadsheet },
  adrg: { label: "Reviewer's guide", icon: NotebookText },
  csr: { label: 'Clinical study report', icon: FileCheck },
};

export default function DocumentsPage() {
  const { docId } = useParams<{ docId?: string }>();
  const location = useLocation();
  const doc = docId ? documentById.get(docId) : undefined;
  const items = useItems();
  const [body, setBody] = useState<string | null>(null);
  usePage(doc?.title ?? 'Study Documents', doc ? [{ label: 'Study documents', to: '/documents' }] : [], 'document');

  useEffect(() => {
    if (!doc) return;
    setBody(null);
    loadDocumentBody(doc.file).then(setBody).catch(() => setBody('*Document file missing.*'));
  }, [doc]);

  useEffect(() => {
    if (!body || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [body, location.hash]);

  return (
    <div className="page page--wide">
      {!doc && (
        <div className="page-header">
          <div className="eyebrow">CBX417-301 · fictional, educational</div>
          <h1 className="page-title">Study documents</h1>
          <p className="page-lede">
            The paper trail a biometrics team works from: protocol synopsis, CRF and annotated CRF, data management plan, statistical analysis plan, table
            shells, dataset specifications and reviewer's guide. Each comes with interpretation exercises — the questions you must answer before programming
            anything.
          </p>
        </div>
      )}
      <div className="ref-layout">
        <nav className="ref-nav" aria-label="Documents">
          {documents.map((d) => {
            const meta = TYPE_META[d.type];
            const Icon = meta?.icon ?? FileText;
            return (
              <Link key={d.id} to={`/documents/${d.id}`} className={clsx('ref-nav__item', d.id === docId && 'is-active')}>
                <Icon size={14} />
                <span className="grow">{d.title}</span>
              </Link>
            );
          })}
        </nav>
        <div style={{ minWidth: 0 }}>
          {!doc && documents.length === 0 && (
            <Card pad="md">
              <EmptyState icon={<FileText />} title="No documents yet">Documents are registered in content/documents/index.yaml.</EmptyState>
            </Card>
          )}
          {!doc && documents.length > 0 && (
            <div className="grid grid-auto">
              {documents.map((d) => {
                const meta = TYPE_META[d.type];
                const Icon = meta?.icon ?? FileText;
                return (
                  <Link key={d.id} to={`/documents/${d.id}`} className="card card--interactive card--pad">
                    <div className="row gap-2">
                      <Icon size={16} color="var(--accent)" />
                      <span style={{ fontWeight: 620 }}>{d.title}</span>
                    </div>
                    <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                      {d.summary}
                    </p>
                    {d.items.length > 0 && (
                      <Badge tone="accent" className="doc-badge">
                        {d.items.length} interpretation exercises
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
          {doc && (
            <div className="stack gap-5">
              <div className="doc-head">
                <Badge tone="accent">{TYPE_META[doc.type]?.label ?? doc.type}</Badge>
                <h1 className="page-title">{doc.title}</h1>
                <p className="page-lede">{doc.summary}</p>
                <p className="muted" style={{ fontSize: 12.5 }}>
                  Fictional document for education. CBX-417 and Halden Therapeutics do not exist.{doc.version ? ` Version ${doc.version}.` : ''}
                </p>
              </div>
              <Card pad="md" className="doc-paper">
                {body ? <Markdown source={body} /> : <Loading />}
              </Card>
              {doc.items.length > 0 && (
                <section>
                  <h2 className="section-title" style={{ marginBottom: 12 }}>
                    Interpret this document
                  </h2>
                  {!items && <Loading />}
                  <div className="stack gap-3">
                    {items &&
                      doc.items
                        .map((id) => items.byId.get(id))
                        .filter((x): x is NonNullable<typeof x> => !!x)
                        .map((it) => <ItemView key={it.id} item={it} inline />)}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
