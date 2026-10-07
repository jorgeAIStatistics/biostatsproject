/**
 * "Trace this value": from a TLF cell down to the raw CRF row.
 *
 *   TLF cell → contributing ADaM records → ADaM variables & derivations
 *            → SDTM record (SRCDOM/SRCSEQ) → raw record (lineage map)
 */
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, Database, Layers, Route, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { loadDataset, loadCsvFile, type Row } from '../../../lib/datasets';
import type { TlfCell } from '../../../lib/tlf/engine';
import type { DatasetMeta } from '../../../content/schema';
import { Badge, Loading } from '../../ui';
import { Markdown } from '../../content/Markdown';
import './tlf.css';

/** ADaM → SDTM pointers that are implicit in the record's sequence variable. */
const INFER_SOURCE = [
  { seqVar: 'AESEQ', domain: 'AE' },
  { seqVar: 'CMSEQ', domain: 'CM' },
  { seqVar: 'MHSEQ', domain: 'MH' },
  { seqVar: 'LBSEQ', domain: 'LB' },
  { seqVar: 'VSSEQ', domain: 'VS' },
  { seqVar: 'EGSEQ', domain: 'EG' },
];

interface Level {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

function RecordTable({ row, meta, highlight }: { row: Row; meta?: DatasetMeta; highlight?: string[] }) {
  const cols = meta?.columns.filter((c) => row[c.name] !== undefined) ?? Object.keys(row).map((name) => ({ name, label: name, type: 'char' as const }));
  return (
    <table className="trace-record">
      <tbody>
        {cols.map((c) => {
          const v = row[c.name];
          if (v === null || v === '') return null;
          const meta2 = meta?.columns.find((x) => x.name === c.name);
          return (
            <tr key={c.name} className={clsx(highlight?.includes(c.name) && 'is-highlight')}>
              <th>
                <span className="mono">{c.name}</span>
                <span className="trace-record__label">{meta2?.label ?? ''}</span>
              </th>
              <td>
                <span className="trace-record__value">{String(v)}</span>
                {meta2?.derivation && (
                  <div className="trace-record__derivation">
                    <Markdown source={meta2.derivation} compact inline />
                  </div>
                )}
                {meta2?.origin && <div className="trace-record__origin">Origin: {meta2.origin}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TraceValue({ cell, label }: { cell: TlfCell; label: string }) {
  const [adamRows, setAdamRows] = useState<Row[] | null>(null);
  const [adamMeta, setAdamMeta] = useState<DatasetMeta | undefined>();
  const [selected, setSelected] = useState<Row | null>(null);
  const [sdtm, setSdtm] = useState<{ row: Row; meta?: DatasetMeta; dataset: string } | null>(null);
  const [raw, setRaw] = useState<{ row: Row; file: string; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keys = useMemo(() => new Set(cell.keys ?? []), [cell.keys]);

  useEffect(() => {
    let alive = true;
    setAdamRows(null);
    setSelected(null);
    setSdtm(null);
    setRaw(null);
    if (!cell.source) return;
    void (async () => {
      try {
        const ds = await loadDataset(cell.source!);
        if (!alive) return;
        const seqVar = ds.meta.columns.find((c) => /SEQ$/.test(c.name))?.name;
        const rows = ds.rows.filter((r) => keys.has(String(r.USUBJID)) || (seqVar ? keys.has(`${r.USUBJID}|${r[seqVar]}`) : false));
        setAdamRows(rows);
        setAdamMeta(ds.meta);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cell.source, keys]);

  // Level 3 → SDTM
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    void (async () => {
      // Some analysis datasets carry SRCDOM/SRCSEQ explicitly; OCCDS datasets such as
      // ADAE point at their SDTM parent through the domain sequence number instead.
      const inferred = INFER_SOURCE.find((x) => selected[x.seqVar] !== undefined && selected[x.seqVar] !== null);
      const dom = String(selected.SRCDOM ?? inferred?.domain ?? '').toLowerCase();
      const seq = selected.SRCSEQ ?? (inferred ? selected[inferred.seqVar] : undefined);
      if (!dom) {
        setSdtm(null);
        return;
      }
      const id = `oncology/sdtm/${dom}`;
      try {
        const ds = await loadDataset(id);
        const seqVar = ds.meta.columns.find((c) => c.name === `${dom.toUpperCase()}SEQ`)?.name ?? `${dom.toUpperCase()}SEQ`;
        const row = ds.rows.find((r) => String(r.USUBJID) === String(selected.USUBJID) && String(r[seqVar]) === String(seq));
        if (alive) setSdtm(row ? { row, meta: ds.meta, dataset: id } : null);
      } catch {
        if (alive) setSdtm(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected]);

  // Level 4 → raw record via the lineage map
  useEffect(() => {
    if (!sdtm) {
      setRaw(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const map = await loadCsvFile('oncology/lineage/sdtm_raw_map.csv');
        const dom = String(sdtm.row.DOMAIN ?? '').toUpperCase();
        const seqVar = `${dom}SEQ`;
        const entry = map.rows.find(
          (m) => String(m.DOMAIN) === dom && String(m.USUBJID) === String(sdtm.row.USUBJID) && String(m.SEQ) === String(sdtm.row[seqVar]),
        );
        if (!entry) {
          if (alive) setRaw(null);
          return;
        }
        const file = String(entry.RAW_FILE);
        const rawData = await loadCsvFile(`oncology/${file}`);
        const idCol = rawData.columns.find((c) => /RECORD_ID/i.test(c)) ?? rawData.columns[0];
        const row = rawData.rows.find((r) => String(r[idCol]) === String(entry.RECORD_ID));
        if (alive) setRaw(row ? { row, file, note: entry.NOTE ? String(entry.NOTE) : undefined } : null);
      } catch {
        if (alive) setRaw(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sdtm]);

  const levels: Level[] = [
    { id: 'cell', icon: <Route />, title: 'TLF cell', subtitle: label },
    { id: 'adam', icon: <Layers />, title: 'Analysis records', subtitle: cell.source ?? '' },
    { id: 'sdtm', icon: <Database />, title: 'SDTM record', subtitle: sdtm?.dataset ?? 'select a record' },
    { id: 'raw', icon: <FileSpreadsheet />, title: 'Raw CRF record', subtitle: raw?.file ?? 'lineage map' },
  ];

  return (
    <div className="trace">
      <ol className="trace__levels">
        {levels.map((l, i) => (
          <li key={l.id} className={clsx('trace__level', (i === 0 || (i === 1 && adamRows) || (i === 2 && sdtm) || (i === 3 && raw)) && 'is-on')}>
            <span className="trace__icon">{l.icon}</span>
            <span>
              <b>{l.title}</b>
              <span className="trace__sub">{l.subtitle}</span>
            </span>
            {i < levels.length - 1 && <ChevronRight className="trace__arrow" />}
          </li>
        ))}
      </ol>

      <section className="trace__section">
        <div className="eyebrow">1 · The number</div>
        <div className="trace__value">{cell.text}</div>
        {cell.definition && <p className="trace__definition">{cell.definition}</p>}
      </section>

      <section className="trace__section">
        <div className="eyebrow">2 · Contributing analysis records ({cell.keys?.length ?? 0})</div>
        {error && <div className="w-note">{error}</div>}
        {!adamRows && !error && <Loading label="Loading analysis dataset…" />}
        {adamRows && (
          <div className="trace__list">
            {adamRows.slice(0, 60).map((r, i) => (
              <button key={i} type="button" className={clsx('trace__row', selected === r && 'is-selected')} onClick={() => setSelected(r)}>
                <span className="mono">{String(r.USUBJID)}</span>
                <span className="muted">
                  {[r.AEDECOD, r.PARAM, r.TRT01A ?? r.TRT01P ?? r.TRTA, r.AVAL !== undefined ? `AVAL ${r.AVAL}` : '', r.CNSR !== undefined ? `CNSR ${r.CNSR}` : '']
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' · ')}
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {adamRows.length > 60 && <div className="w-note">Showing the first 60 of {adamRows.length} records.</div>}
          </div>
        )}
      </section>

      {selected && (
        <section className="trace__section">
          <div className="eyebrow">3 · Analysis record and its derivations</div>
          <RecordTable row={selected} meta={adamMeta} highlight={['SRCDOM', 'SRCVAR', 'SRCSEQ', 'AVAL', 'BASE', 'CHG', 'CNSR', 'TRTEMFL', 'ABLFL']} />
          {!sdtm && selected.SRCDOM && (
            <div className="w-note row gap-2">
              <TriangleAlert size={14} /> The SDTM record referenced by SRCDOM/SRCSEQ could not be loaded.
            </div>
          )}
          {!selected.SRCDOM && (
            <div className="w-note">
              This ADaM record has no SRCDOM/SRCSEQ because it is subject-level (ADSL) or derived from several source records — traceability is then documented
              in the ADaM specification and the reviewer's guide rather than by a single pointer.
            </div>
          )}
        </section>
      )}

      {sdtm && (
        <section className="trace__section">
          <div className="eyebrow">
            4 · SDTM record <Badge tone="info">{sdtm.dataset.split('/').pop()?.toUpperCase()}</Badge>
          </div>
          <RecordTable row={sdtm.row} meta={sdtm.meta} />
        </section>
      )}

      {raw && (
        <section className="trace__section">
          <div className="eyebrow">
            5 · Raw record <Badge tone="warning">{raw.file}</Badge>
          </div>
          <RecordTable row={raw.row} />
          {raw.note && (
            <div className="w-explain" style={{ marginTop: 8 }}>
              Data-management note: {raw.note}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function TraceValueWidget() {
  return (
    <div className="w-note">
      Open any table in the <a href="#/trial/tlf">TLF gallery</a> and click a number with the trace icon to follow it back to the raw CRF row.
    </div>
  );
}
