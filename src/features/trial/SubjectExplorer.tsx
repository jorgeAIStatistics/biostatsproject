import { useEffect, useMemo, useState } from 'react';
import { Search, UserSearch } from 'lucide-react';
import { loadDataset, useManifests, type LoadedDataset, type Row } from '../../lib/datasets';
import { DataTable } from '../../components/data/DataTable';
import { Badge, Card, EmptyState, Loading, Segmented } from '../../components/ui';

/**
 * Subject profile: every record for one USUBJID across the SDTM (or ADaM)
 * datasets — how a medical monitor or programmer investigates a single patient.
 */
export default function SubjectExplorer() {
  const manifests = useManifests();
  const onc = manifests?.find((m) => m.study === 'oncology');
  const [layer, setLayer] = useState<'sdtm' | 'adam' | 'raw'>('sdtm');
  const [dm, setDm] = useState<LoadedDataset | null>(null);
  const [subject, setSubject] = useState<string>('');
  const [query, setQuery] = useState('');
  const [tables, setTables] = useState<{ name: string; label: string; rows: Row[]; columns: string[] }[] | null>(null);

  useEffect(() => {
    if (!onc) return;
    loadDataset('oncology/sdtm/dm')
      .then((d) => {
        setDm(d);
        const first = d.rows.find((r) => r.ARMCD)?.USUBJID;
        if (first) setSubject(String(first));
      })
      .catch(() => setDm(null));
  }, [onc]);

  useEffect(() => {
    if (!onc || !subject) return;
    let alive = true;
    setTables(null);
    const ids = onc.datasets.filter((d) => d.layer === layer).map((d) => d.id);
    Promise.all(ids.map((id) => loadDataset(id).catch(() => null))).then((list) => {
      if (!alive) return;
      const sid = subject.split('-').slice(-2).join('-');
      const out = list
        .filter((d): d is LoadedDataset => !!d)
        .map((d) => {
          const key = d.columns.includes('USUBJID') ? 'USUBJID' : d.columns.includes('SUBJECT_ID') ? 'SUBJECT_ID' : null;
          if (!key) return null;
          const rows = d.rows.filter((r) => {
            const v = String(r[key] ?? '');
            return key === 'USUBJID' ? v === subject : v.trim() === sid;
          });
          return { name: d.meta.name, label: d.meta.label, rows, columns: d.columns };
        })
        .filter((x): x is NonNullable<typeof x> => !!x && x.rows.length > 0);
      setTables(out);
    });
    return () => {
      alive = false;
    };
  }, [onc, subject, layer]);

  const options = useMemo(() => {
    if (!dm) return [];
    const q = query.trim().toLowerCase();
    return dm.rows
      .filter((r) => !q || String(r.USUBJID).toLowerCase().includes(q) || String(r.ARM ?? '').toLowerCase().includes(q))
      .slice(0, 400);
  }, [dm, query]);

  if (!manifests) return <Loading />;
  if (!onc)
    return (
      <Card pad="md">
        <EmptyState icon={<UserSearch />} title="Oncology data not generated yet">
          Run <code>npm run data</code> to build the CBX417-301 datasets.
        </EmptyState>
      </Card>
    );

  const dmRow = dm?.rows.find((r) => r.USUBJID === subject);

  return (
    <div className="stack gap-4">
      <Card pad="md">
        <div className="row gap-3 wrap">
          <div className="search-input" style={{ width: 240 }}>
            <Search />
            <input className="input" placeholder="Filter subjects…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter subjects" />
          </div>
          <select className="select mono" style={{ width: 280 }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            {options.map((r) => (
              <option key={String(r.USUBJID)} value={String(r.USUBJID)}>
                {String(r.USUBJID)} {r.ARMCD ? `· ${r.ARMCD}` : '· screen failure'}
              </option>
            ))}
          </select>
          <Segmented
            ariaLabel="Layer"
            value={layer}
            onChange={setLayer}
            options={[
              { value: 'raw', label: 'Raw' },
              { value: 'sdtm', label: 'SDTM' },
              { value: 'adam', label: 'ADaM' },
            ]}
          />
        </div>
        {dmRow && (
          <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
            <Badge tone="accent">{String(dmRow.ARM ?? 'Not randomized')}</Badge>
            <Badge>
              {String(dmRow.SEX ?? '')} · {String(dmRow.AGE ?? '')} {String(dmRow.AGEU ?? '').toLowerCase()}
            </Badge>
            <Badge>{String(dmRow.RACE ?? '')}</Badge>
            <Badge>{String(dmRow.COUNTRY ?? '')}</Badge>
            {dmRow.DTHFL === 'Y' && <Badge tone="danger">Died {String(dmRow.DTHDTC ?? '')}</Badge>}
            {dmRow.RFXSTDTC && <Badge tone="neutral">First dose {String(dmRow.RFXSTDTC)}</Badge>}
          </div>
        )}
      </Card>
      {!tables && <Loading label="Collecting this subject's records…" />}
      {tables?.map((t) => (
        <section key={t.name}>
          <div className="row gap-2" style={{ marginBottom: 6 }}>
            <span className="mono" style={{ fontWeight: 650 }}>
              {t.name}
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {t.label} · {t.rows.length} record{t.rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <DataTable columns={t.columns} rows={t.rows} maxHeight={320} />
        </section>
      ))}
    </div>
  );
}
