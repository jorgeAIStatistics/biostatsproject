/**
 * Shows how SAS MERGE and SQL joins combine two small clinical tables, and how
 * the same inputs give different row counts depending on the technique.
 */
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { WidgetProps } from './registry';
import { Segmented } from '../ui';
import { CodeBlock } from '../code/CodeBlock';

type Row = Record<string, string | number | null>;

const CASES = {
  'one-to-one': {
    label: 'One-to-one',
    left: [
      { USUBJID: 'S-01', TRT01A: 'CBX' },
      { USUBJID: 'S-02', TRT01A: 'PBO' },
    ],
    right: [
      { USUBJID: 'S-01', SAFFL: 'Y' },
      { USUBJID: 'S-02', SAFFL: 'Y' },
    ],
    note: 'One row per key on both sides: MERGE and an inner join agree.',
  },
  'one-to-many': {
    label: 'One-to-many',
    left: [
      { USUBJID: 'S-01', TRT01A: 'CBX' },
      { USUBJID: 'S-02', TRT01A: 'PBO' },
    ],
    right: [
      { USUBJID: 'S-01', AEDECOD: 'Nausea' },
      { USUBJID: 'S-01', AEDECOD: 'Rash' },
      { USUBJID: 'S-02', AEDECOD: 'Fatigue' },
    ],
    note: 'The standard pattern: subject-level values are repeated on every event row. Both techniques give 3 rows.',
  },
  'many-to-many': {
    label: 'Many-to-many',
    left: [
      { USUBJID: 'S-01', VISIT: 'C1D1' },
      { USUBJID: 'S-01', VISIT: 'C2D1' },
    ],
    right: [
      { USUBJID: 'S-01', AEDECOD: 'Nausea' },
      { USUBJID: 'S-01', AEDECOD: 'Rash' },
      { USUBJID: 'S-01', AEDECOD: 'Fever' },
    ],
    note: 'Here the techniques disagree. DATA step MERGE pairs rows positionally within the BY group and writes max(2,3) = 3 rows (and notes "MERGE statement has more than one data set with repeats of BY values"). SQL produces the Cartesian product: 2 × 3 = 6 rows.',
  },
  'non-matching': {
    label: 'Non-matching keys',
    left: [
      { USUBJID: 'S-01', TRT01A: 'CBX' },
      { USUBJID: 'S-02', TRT01A: 'PBO' },
    ],
    right: [
      { USUBJID: 'S-02', AEDECOD: 'Fatigue' },
      { USUBJID: 'S-03', AEDECOD: 'Cough' },
    ],
    note: 'S-01 has no AE; S-03 has an AE but no subject record. MERGE without IN= keeps all three keys (a full join); an inner join keeps only S-02. IN= flags let you choose.',
  },
} as const;

type CaseId = keyof typeof CASES;

function mergeRows(left: Row[], right: Row[], leftCols: string[], rightCols: string[]) {
  const keys = [...new Set([...left.map((r) => r.USUBJID), ...right.map((r) => r.USUBJID)])].sort() as string[];
  const out: (Row & { __in: string })[] = [];
  for (const k of keys) {
    const l = left.filter((r) => r.USUBJID === k);
    const r = right.filter((x) => x.USUBJID === k);
    const n = Math.max(l.length, r.length);
    for (let i = 0; i < n; i++) {
      const row: Row = { USUBJID: k };
      // SAS retains the last non-missing value within the BY group for the shorter dataset.
      for (const c of leftCols) row[c] = (l[i] ?? l[l.length - 1])?.[c] ?? null;
      for (const c of rightCols) row[c] = (r[i] ?? r[r.length - 1])?.[c] ?? null;
      if (!l.length) for (const c of leftCols) row[c] = null;
      if (!r.length) for (const c of rightCols) row[c] = null;
      out.push({ ...row, __in: `${l.length ? 1 : 0}${r.length ? 1 : 0}` });
    }
  }
  return out;
}

function sqlJoin(left: Row[], right: Row[], kind: 'inner' | 'left', leftCols: string[], rightCols: string[]) {
  const out: Row[] = [];
  for (const l of left) {
    const matches = right.filter((r) => r.USUBJID === l.USUBJID);
    if (matches.length === 0 && kind === 'left') {
      const row: Row = { USUBJID: l.USUBJID };
      for (const c of leftCols) row[c] = l[c] ?? null;
      for (const c of rightCols) row[c] = null;
      out.push(row);
    }
    for (const r of matches) {
      const row: Row = { USUBJID: l.USUBJID };
      for (const c of leftCols) row[c] = l[c] ?? null;
      for (const c of rightCols) row[c] = r[c] ?? null;
      out.push(row);
    }
  }
  return out;
}

export default function JoinVisualizer({ props }: WidgetProps) {
  const [caseId, setCaseId] = useState<CaseId>((props.case as CaseId) in CASES ? (props.case as CaseId) : 'one-to-many');
  const [engine, setEngine] = useState<'merge' | 'inner' | 'left'>(props.engine === 'sql' ? 'inner' : 'merge');
  const c = CASES[caseId];
  const leftCols = Object.keys(c.left[0]).filter((k) => k !== 'USUBJID');
  const rightCols = Object.keys(c.right[0]).filter((k) => k !== 'USUBJID');
  const result = useMemo(
    () => (engine === 'merge' ? mergeRows(c.left as unknown as Row[], c.right as unknown as Row[], leftCols, rightCols) : sqlJoin(c.left as unknown as Row[], c.right as unknown as Row[], engine, leftCols, rightCols)),
    [c, engine, leftCols, rightCols],
  );
  const code =
    engine === 'merge'
      ? `proc sort data=adsl; by USUBJID; run;
proc sort data=ae;   by USUBJID; run;

data joined;
  merge adsl(in=a) ae(in=b);
  by USUBJID;
run;`
      : `proc sql;
  create table joined as
  select a.*, b.*
  from adsl a
  ${engine === 'inner' ? 'inner' : 'left'} join ae b
    on a.USUBJID = b.USUBJID;
quit;`;

  const table = (title: string, rows: Row[], cols: string[], flag?: boolean) => (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {title} ({rows.length} row{rows.length === 1 ? '' : 's'})
      </div>
      <table className="w-table">
        <thead>
          <tr>
            <th>USUBJID</th>
            {cols.map((k) => (
              <th key={k}>{k}</th>
            ))}
            {flag && <th>IN=a / IN=b</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{String(r.USUBJID)}</td>
              {cols.map((k) => (
                <td key={k} className={clsx(r[k] === null && 'is-missing')}>
                  {r[k] === null ? '.' : String(r[k])}
                </td>
              ))}
              {flag && <td className="mono">{String((r as Row & { __in?: string }).__in ?? '').split('').join(' / ')}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="stack gap-4">
      <div className="w-toolbar">
        <Segmented ariaLabel="Case" value={caseId} onChange={setCaseId} options={(Object.keys(CASES) as CaseId[]).map((k) => ({ value: k, label: CASES[k].label }))} />
        <Segmented
          ariaLabel="Technique"
          value={engine}
          onChange={setEngine}
          options={[
            { value: 'merge', label: 'DATA step MERGE' },
            { value: 'inner', label: 'SQL inner join' },
            { value: 'left', label: 'SQL left join' },
          ]}
        />
      </div>
      <div className="join-grid">
        {table('ADSL (subject level)', c.left as unknown as Row[], leftCols)}
        {table('AE (event level)', c.right as unknown as Row[], rightCols)}
      </div>
      <div className="join-result">{table(engine === 'merge' ? 'MERGE result' : engine === 'inner' ? 'INNER JOIN result' : 'LEFT JOIN result', result, [...leftCols, ...rightCols], engine === 'merge')}</div>
      <div className="w-explain">{c.note}</div>
      <CodeBlock code={code} lang="sas" compact download={false} />
    </div>
  );
}
