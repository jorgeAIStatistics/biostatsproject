import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { CodeBlock } from '../../code/CodeBlock';
import { Segmented } from '../../ui';

/** Parses an ISO 8601 date, tolerating partial dates as SDTM stores them. */
function parseIso(value: string): { year?: number; month?: number; day?: number; precision: 'day' | 'month' | 'year' | 'none'; valid: boolean } {
  const v = value.trim();
  const m = v.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (!m) return { precision: 'none', valid: v === '' };
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  const valid = (!month || (month >= 1 && month <= 12)) && (!day || (day >= 1 && day <= new Date(year, month ?? 1, 0).getDate()));
  return { year, month, day, precision: day ? 'day' : month ? 'month' : 'year', valid };
}

const toDate = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const DAY = 86_400_000;

export default function StudyDayCalculator(_: WidgetProps) {
  void _;
  const [rfstdtc, setRfstdtc] = useState('2023-03-06');
  const [dtc, setDtc] = useState('2023-03-20');
  const [impute, setImpute] = useState<'none' | 'first' | 'trtsdt'>('none');

  const ref = parseIso(rfstdtc);
  const ev = parseIso(dtc);

  const result = useMemo(() => {
    if (!ref.valid || !ev.valid || !ref.year || !ev.year) return { dy: null as number | null, note: 'Fix the invalid date first — an impossible date such as 2023-02-30 must be queried, never silently converted.' };
    if (!ref.month || !ref.day) return { dy: null, note: 'The reference start date (RFSTDTC) must be a complete date; a partial reference date would make every study day ambiguous.' };
    let y = ev.year;
    let mo = ev.month;
    let d = ev.day;
    let imputed = '';
    if (!mo || !d) {
      if (impute === 'none') return { dy: null, note: 'The date is partial. SDTM keeps it partial in --DTC; --DY stays missing. ADaM may impute it with a documented rule and record the imputation flag (e.g. ASTDTF).' };
      if (impute === 'first') {
        mo = mo ?? 1;
        d = d ?? 1;
        imputed = `Imputed to the earliest possible date (${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}), ASTDTF = '${ev.month ? 'D' : 'M'}'.`;
      } else {
        const sameMonth = ev.month === ref.month && ev.year === ref.year;
        const sameYear = ev.year === ref.year;
        if (!ev.month && sameYear) {
          mo = ref.month;
          d = ref.day;
          imputed = `Same year as first dose: imputed to the treatment start date, ASTDTF = 'M'.`;
        } else if (ev.month && sameMonth) {
          d = ref.day;
          imputed = `Same month as first dose: imputed to the treatment start date, ASTDTF = 'D'.`;
        } else {
          mo = mo ?? 1;
          d = d ?? 1;
          imputed = `Different month/year from first dose: imputed to the first of the period, ASTDTF = '${ev.month ? 'D' : 'M'}'.`;
        }
      }
    }
    const t0 = toDate(ref.year, ref.month, ref.day);
    const t1 = toDate(y, mo!, d!);
    const diff = Math.round((t1 - t0) / DAY);
    const dy = diff >= 0 ? diff + 1 : diff;
    return { dy, note: imputed };
  }, [ref, ev, impute]);

  const examples = [
    { dtc: '2023-03-06', label: 'Same day as first dose' },
    { dtc: '2023-03-05', label: 'Day before first dose' },
    { dtc: '2023-03-20', label: 'Two weeks later' },
    { dtc: '2023-02-14', label: 'Before treatment (screening)' },
    { dtc: '2023-03', label: 'Partial: month known' },
    { dtc: '2023', label: 'Partial: year only' },
    { dtc: '2023-02-30', label: 'Impossible date' },
  ];

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="stack gap-3" style={{ minWidth: 0 }}>
          <div className="row gap-3 wrap">
            <label className="field" style={{ width: 190 }}>
              <span className="field__label">RFSTDTC (reference start)</span>
              <input className="input input--mono" value={rfstdtc} onChange={(e) => setRfstdtc(e.target.value)} />
            </label>
            <label className="field" style={{ width: 190 }}>
              <span className="field__label">--DTC (event date)</span>
              <input className="input input--mono" value={dtc} onChange={(e) => setDtc(e.target.value)} />
            </label>
          </div>
          <div className="row gap-1 wrap">
            {examples.map((e) => (
              <button key={e.dtc} type="button" className="tag" onClick={() => setDtc(e.dtc)} title={e.label} style={{ cursor: 'pointer' }}>
                {e.dtc}
              </button>
            ))}
          </div>
          <Segmented
            ariaLabel="Imputation rule"
            value={impute}
            onChange={setImpute}
            options={[
              { value: 'none', label: 'No imputation (SDTM)' },
              { value: 'first', label: 'Earliest possible' },
              { value: 'trtsdt', label: 'SAP rule (treatment start)' },
            ]}
          />
          <div className={clsx('dy-result', result.dy === null && 'is-missing')}>
            <span className="dy-result__label">--DY</span>
            <span className="dy-result__value num">{result.dy === null ? '.' : result.dy}</span>
            <span className="dy-result__icon">{result.dy === null ? <TriangleAlert /> : <CircleCheck />}</span>
          </div>
          {result.note && <div className="w-note">{result.note}</div>}
        </div>
        <div className="stack gap-2">
          <div className="w-explain" style={{ fontSize: 12.5 }}>
            <b>There is no Day 0.</b> If the event date is on or after the reference date, --DY = (date − RFSTDTC) + 1; if it is before, --DY = date − RFSTDTC.
            So the day before first dose is Day −1 and the day of first dose is Day 1.
          </div>
          <table className="w-table">
            <thead>
              <tr>
                <th>Relationship</th>
                <th>--DY</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2 days before</td>
                <td>−2</td>
              </tr>
              <tr>
                <td>1 day before</td>
                <td>−1</td>
              </tr>
              <tr>
                <td>First dose day</td>
                <td>1</td>
              </tr>
              <tr>
                <td>Next day</td>
                <td>2</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <CodeBlock
        lang="sas"
        title="Study day in SAS, R and Python"
        download={false}
        compact
        code={`/* SAS: --DTC is character ISO 8601; convert, then apply the no-day-zero rule */
data ae1;
  set sdtm.ae;
  ASTDT = input(substr(AESTDTC, 1, 10), ?? yymmdd10.);   /* ?? suppresses notes for partial dates */
  RFSTDT = input(substr(RFSTDTC, 1, 10), ?? yymmdd10.);
  if nmiss(ASTDT, RFSTDT) = 0 then
    AESTDY = ASTDT - RFSTDT + (ASTDT >= RFSTDT);          /* +1 only when on/after day 1 */
  format ASTDT RFSTDT yymmdd10.;
run;`}
      />
    </div>
  );
}
