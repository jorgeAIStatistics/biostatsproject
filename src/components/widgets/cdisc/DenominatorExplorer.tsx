import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { WidgetProps } from '../registry';
import { loadDataset, type Row } from '../../../lib/datasets';
import { Loading, Segmented, EmptyState } from '../../ui';
import { pct } from '../../../lib/stats/descriptive';

type Unit = 'subjects' | 'events';
type Pop = 'safety' | 'itt';
type Arm = 'TRT01A' | 'TRT01P';

/** The same adverse-event data, counted four different ways. */
export default function DenominatorExplorer(_: WidgetProps) {
  void _;
  const [adsl, setAdsl] = useState<Row[] | null>(null);
  const [adae, setAdae] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>('subjects');
  const [pop, setPop] = useState<Pop>('safety');
  const [armVar, setArmVar] = useState<Arm>('TRT01A');
  const [teaeOnly, setTeaeOnly] = useState(true);

  useEffect(() => {
    Promise.all([loadDataset('oncology/adam/adsl'), loadDataset('oncology/adam/adae')])
      .then(([a, b]) => {
        setAdsl(a.rows);
        setAdae(b.rows);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const table = useMemo(() => {
    if (!adsl || !adae) return null;
    const popRows = adsl.filter((r) => (pop === 'safety' ? r.SAFFL === 'Y' : r.ITTFL === 'Y'));
    const arms = [...new Set(popRows.map((r) => String(r[armVar] ?? '')).filter(Boolean))].sort();
    const inPop = new Set(popRows.map((r) => String(r.USUBJID)));
    const events = adae.filter((e) => inPop.has(String(e.USUBJID)) && (!teaeOnly || e.TRTEMFL === 'Y'));
    const armOf = new Map(popRows.map((r) => [String(r.USUBJID), String(r[armVar] ?? '')]));
    const terms = [...new Set(events.map((e) => String(e.AEDECOD ?? '')))]
      .map((pt) => ({
        pt,
        n: new Set(events.filter((e) => e.AEDECOD === pt).map((e) => e.USUBJID)).size,
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((t) => t.pt);
    return {
      arms,
      denom: Object.fromEntries(arms.map((a) => [a, popRows.filter((r) => String(r[armVar]) === a).length])),
      rows: terms.map((pt) => ({
        pt,
        cells: Object.fromEntries(
          arms.map((a) => {
            const evs = events.filter((e) => e.AEDECOD === pt && armOf.get(String(e.USUBJID)) === a);
            const subs = new Set(evs.map((e) => String(e.USUBJID))).size;
            return [a, unit === 'subjects' ? subs : evs.length];
          }),
        ),
      })),
    };
  }, [adsl, adae, unit, pop, armVar, teaeOnly]);

  if (error)
    return (
      <EmptyState title="Study data not generated yet">
        Run <code>npm run data</code> to build the CBX417-301 datasets.
      </EmptyState>
    );
  if (!table) return <Loading label="Loading adverse events…" />;

  return (
    <div className="stack gap-3">
      <div className="w-toolbar">
        <Segmented
          ariaLabel="Count"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'subjects', label: 'Subjects' },
            { value: 'events', label: 'Events' },
          ]}
        />
        <Segmented
          ariaLabel="Population"
          value={pop}
          onChange={setPop}
          options={[
            { value: 'safety', label: 'Safety population' },
            { value: 'itt', label: 'ITT population' },
          ]}
        />
        <Segmented
          ariaLabel="Treatment variable"
          value={armVar}
          onChange={setArmVar}
          options={[
            { value: 'TRT01A', label: 'Actual (TRT01A)' },
            { value: 'TRT01P', label: 'Planned (TRT01P)' },
          ]}
        />
        <label className="checkbox" style={{ fontSize: 12.5 }}>
          <input type="checkbox" checked={teaeOnly} onChange={(e) => setTeaeOnly(e.target.checked)} /> treatment-emergent only
        </label>
      </div>
      <table className="w-table">
        <thead>
          <tr>
            <th>Preferred term</th>
            {table.arms.map((a) => (
              <th key={a}>
                {a}
                <div style={{ fontWeight: 400, color: 'var(--text-3)' }}>N = {table.denom[a]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.pt}>
              <td>{r.pt}</td>
              {table.arms.map((a) => (
                <td key={a}>
                  {r.cells[a]} ({pct(r.cells[a], table.denom[a])}%)
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={clsx('w-explain')}>
        {unit === 'events'
          ? 'Counting events lets one subject with five episodes of the same term contribute five times — percentages can exceed 100% and the table stops being a statement about people. Safety tables count subjects unless the shell explicitly says otherwise.'
          : 'Counting subjects (each counted once per preferred term) is the standard for safety tables.'}{' '}
        {pop === 'itt'
          ? 'Using the ITT population as the denominator includes the 4 randomized subjects who were never treated — they can never have a treatment-emergent event, so every percentage is diluted.'
          : 'The safety population (treated subjects) is the correct denominator for adverse events.'}{' '}
        {armVar === 'TRT01P'
          ? 'Summarizing by planned treatment attributes the events of the three subjects who received the wrong kit to the arm they were randomized to — which is why safety is analysed by actual treatment.'
          : 'Actual treatment (TRT01A) is what the subject really received — the right basis for safety.'}{' '}
        {!teaeOnly && 'Including non-treatment-emergent events counts problems that started before the first dose or long after the last one.'}
      </div>
    </div>
  );
}
