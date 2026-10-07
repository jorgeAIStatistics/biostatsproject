import { useEffect, useMemo, useState } from 'react';
import { Play, RotateCcw, Database, Table2, History } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { CodeEditor } from '../../components/code/CodeEditor';
import { DataTable } from '../../components/data/DataTable';
import { Button, Card, EmptyState, Loading, Segmented } from '../../components/ui';
import { getWorkspaceDb, getSchema, runQuery, resetWorkspace, isDatabaseAvailable, DB_LABELS, type QueryResult, type Schema } from '../../lib/sql';
import type { SqlDatabase } from '../../content/vocab';
import './sql.css';

const STARTERS: Record<SqlDatabase, string> = {
  oncology: `-- Subjects per planned treatment in the ITT population
SELECT TRT01P, COUNT(*) AS n
FROM adsl
WHERE ITTFL = 'Y'
GROUP BY TRT01P
ORDER BY TRT01P;`,
  cardio: `-- Mean change from baseline in SBP at Week 12 by arm (observed cases)
SELECT TRTP, COUNT(*) AS n, ROUND(AVG(CHG), 2) AS mean_chg
FROM advs
WHERE PARAMCD = 'SYSBP' AND AVISIT = 'Week 12' AND CHG IS NOT NULL
GROUP BY TRTP
ORDER BY TRTP;`,
  manufacturing: `-- Mean potency and disposition mix by line and media supplier
SELECT LINE, SUPPLIER,
       COUNT(*)                                        AS batches,
       ROUND(AVG(POTENCY_PCT), 1)                      AS mean_potency,
       SUM(DISPOSITION = 'Released')                   AS released,
       SUM(DISPOSITION <> 'Released')                  AS held
FROM batches
GROUP BY LINE, SUPPLIER
ORDER BY LINE, SUPPLIER;`,
};

const HISTORY_KEY = 'cbmos:sql-history';

export default function SqlWorkbenchPage() {
  usePage('SQL Workbench');
  const dbs = (['oncology', 'cardio', 'manufacturing'] as SqlDatabase[]).filter(isDatabaseAvailable);
  const [db, setDb] = useState<SqlDatabase>(dbs[0] ?? 'oncology');
  const [code, setCode] = useState(STARTERS[db]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isDatabaseAvailable(db)) return;
    setSchema(null);
    getSchema(db).then(setSchema).catch((e: Error) => setError(e.message));
  }, [db]);

  const completion = useMemo(() => (schema ? Object.fromEntries(schema.tables.map((t) => [t.name, t.columns.map((c) => c.name)])) : undefined), [schema]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = runQuery(await getWorkspaceDb(db), code);
      setResult(r);
      const h = [code, ...history.filter((x) => x !== code)].slice(0, 20);
      setHistory(h);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  if (dbs.length === 0)
    return (
      <div className="page">
        <EmptyState icon={<Database />} title="No databases available">
          Generate the datasets with <code>npm run data</code>.
        </EmptyState>
      </div>
    );

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">SQLite in your browser — offline</div>
        <h1 className="page-title">SQL workbench</h1>
        <p className="page-lede">
          Query the synthetic study databases with real SQL (SQLite dialect). Your workspace is a private copy — create tables, run updates, then reset. Press{' '}
          <kbd className="kbd">⌘</kbd> <kbd className="kbd">Enter</kbd> to run.
        </p>
      </div>
      <div className="sql-layout">
        <aside className="sql-schema">
          <Segmented
            ariaLabel="Database"
            value={db}
            onChange={(v) => {
              setDb(v);
              setCode(STARTERS[v]);
              setResult(null);
            }}
            options={dbs.map((d) => ({ value: d, label: d === 'oncology' ? 'Oncology' : d === 'cardio' ? 'Cardio' : 'Mfg' }))}
          />
          <div className="muted" style={{ fontSize: 12, margin: '8px 0 10px' }}>
            {DB_LABELS[db]}
          </div>
          {!schema && <Loading label="Reading schema…" />}
          {schema?.tables.map((t) => (
            <details key={t.name} className="sql-table">
              <summary>
                <Table2 size={13} />
                <span className="mono grow">{t.name}</span>
                <span className="muted num" style={{ fontSize: 11 }}>
                  {t.rows.toLocaleString()}
                </span>
              </summary>
              <ul className="list-reset">
                {t.columns.map((c) => (
                  <li key={c.name} className="sql-col">
                    <button type="button" className="sql-col__btn" onClick={() => setCode((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${c.name}`)}>
                      <span className="mono">{c.name}</span>
                      <span className="muted">{c.type.toLowerCase()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </aside>
        <div className="stack gap-3" style={{ minWidth: 0 }}>
          <CodeEditor value={code} onChange={setCode} language="sql" minHeight={200} onRun={() => void run()} sqlSchema={completion} />
          <div className="row gap-2 wrap">
            <Button variant="primary" icon={<Play />} onClick={() => void run()} disabled={busy}>
              Run
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw />}
              onClick={() => {
                void resetWorkspace(db);
                setResult(null);
              }}
            >
              Reset workspace
            </Button>
            {history.length > 0 && (
              <select className="select" style={{ width: 260 }} value="" onChange={(e) => e.target.value && setCode(e.target.value)} aria-label="Query history">
                <option value="">Recent queries…</option>
                {history.map((h, i) => (
                  <option key={i} value={h}>
                    {h.replace(/\s+/g, ' ').slice(0, 70)}
                  </option>
                ))}
              </select>
            )}
            <span className="grow" />
            <History size={14} className="muted" />
          </div>
          {error && <div className="sql-error">{error}</div>}
          {result && (
            <DataTable
              columns={result.columns}
              rows={result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])))}
              maxHeight={520}
              caption={`${result.rows.length.toLocaleString()} row${result.rows.length === 1 ? '' : 's'}${result.truncated ? ' (first 5,000 shown)' : ''} · ${result.ms.toFixed(1)} ms${result.statements > 1 ? ` · ${result.statements} statements` : ''}`}
            />
          )}
          {!result && !error && (
            <Card pad="md" flat>
              <p className="muted" style={{ fontSize: 13.5 }}>
                Tip: table names are lowercase (<code>adsl</code>, <code>adae</code>, <code>dm</code>…); column names keep their CDISC capitalization. Click a column
                in the schema to insert it.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
