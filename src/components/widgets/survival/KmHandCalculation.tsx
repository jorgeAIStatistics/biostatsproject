import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button } from '../../ui';
import { kaplanMeier, type SurvRecord } from '../../../lib/stats/survival';
import { AxisBottom, AxisLeft, useWidth } from '../../charts/core';

/** The same 12 subjects are in data/teaching/km12.csv so you can reproduce this in SAS, R or Python. */
const DATA: { subj: string; time: number; event: 0 | 1 }[] = [
  { subj: 'T-01', time: 2, event: 1 },
  { subj: 'T-02', time: 3, event: 1 },
  { subj: 'T-03', time: 4, event: 0 },
  { subj: 'T-04', time: 5, event: 1 },
  { subj: 'T-05', time: 6, event: 1 },
  { subj: 'T-06', time: 6, event: 0 },
  { subj: 'T-07', time: 8, event: 1 },
  { subj: 'T-08', time: 9, event: 0 },
  { subj: 'T-09', time: 11, event: 1 },
  { subj: 'T-10', time: 13, event: 0 },
  { subj: 'T-11', time: 15, event: 1 },
  { subj: 'T-12', time: 18, event: 0 },
];

export default function KmHandCalculation(_: WidgetProps) {
  void _;
  const records: SurvRecord[] = useMemo(() => DATA.map((d) => ({ time: d.time, event: d.event })), []);
  const km = useMemo(() => kaplanMeier(records, { ciType: 'log-log' }), [records]);
  const eventSteps = km.steps.filter((s) => s.nEvent > 0);
  const [i, setI] = useState(0);
  const [showCi, setShowCi] = useState(false);
  const shown = km.steps.filter((s) => s.time <= (eventSteps[Math.min(i, eventSteps.length - 1)]?.time ?? 0));
  const cur = eventSteps[Math.min(i, eventSteps.length - 1)];

  const [ref, width] = useWidth<HTMLDivElement>(480);
  const h = 230;
  const m = { top: 12, right: 14, bottom: 36, left: 44 };
  const x = scaleLinear().domain([0, 19]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 1]).range([h - m.bottom, m.top]);

  // Step path for the survival curve up to the current step
  let path = `M${x(0)},${y(1)}`;
  let prev = 1;
  for (const s of shown) {
    path += `L${x(s.time)},${y(prev)}L${x(s.time)},${y(s.surv)}`;
    prev = s.surv;
  }
  path += `L${x(cur?.time ?? 0)},${y(prev)}`;

  const censorMarks = km.censorTimes.filter((t) => t <= (cur?.time ?? 0));
  const survBefore = i === 0 ? 1 : eventSteps[i - 1].surv;

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label="Kaplan-Meier curve built step by step">
            <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} format={(v) => v.toFixed(2)} label="S(t)" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={8} width={width} label="months" />
            {showCi && (
              <path
                d={(() => {
                  let up = `M${x(0)},${y(1)}`;
                  let lo = '';
                  let pu = 1;
                  let pl = 1;
                  for (const s of shown) {
                    up += `L${x(s.time)},${y(pu)}L${x(s.time)},${y(s.upper)}`;
                    pu = s.upper;
                  }
                  const rev = [...shown].reverse();
                  for (const s of rev) {
                    lo += `${lo ? 'L' : 'L'}${x(s.time)},${y(s.lower)}`;
                    pl = s.lower;
                  }
                  void pl;
                  return `${up}L${x(cur?.time ?? 0)},${y(pu)}${lo}L${x(0)},${y(1)}Z`;
                })()}
                fill="var(--viz-1)"
                opacity={0.12}
              />
            )}
            <path d={path} fill="none" stroke="var(--viz-1)" strokeWidth={2} />
            {censorMarks.map((t, k) => {
              const s = [...km.steps].reverse().find((st) => st.time <= t)!;
              return <line key={k} x1={x(t)} x2={x(t)} y1={y(s.surv) - 5} y2={y(s.surv) + 5} stroke="var(--viz-1)" strokeWidth={2} />;
            })}
            <line x1={m.left} x2={width - m.right} y1={y(0.5)} y2={y(0.5)} stroke="var(--viz-2)" strokeDasharray="4 3" />
            <text x={m.left + 4} y={y(0.5) - 5} className="axis__label" fill="var(--viz-2)">
              50%
            </text>
          </svg>
        </div>
        <div className="stack gap-3">
          <div className="km-calc">
            <div className="eyebrow">Event time {i + 1} of {eventSteps.length}</div>
            <div className="km-calc__eq">
              <div>
                t = <b>{cur?.time}</b> months
              </div>
              <div>
                n<sub>at risk</sub> = <b>{cur?.nRisk}</b>, d<sub>events</sub> = <b>{cur?.nEvent}</b>
                {cur && cur.nCensor > 0 ? `, ${cur.nCensor} censored at the same time` : ''}
              </div>
              <div>
                S(t) = S(previous) × (1 − d/n) = {survBefore.toFixed(4)} × (1 − {cur?.nEvent}/{cur?.nRisk}) = <b>{cur?.surv.toFixed(4)}</b>
              </div>
              <div className="muted">
                Greenwood SE = S(t) · √Σ d/(n(n−d)) = <b>{cur?.se.toFixed(4)}</b>
                {showCi && cur && ` → 95% CI ${cur.lower.toFixed(3)}–${cur.upper.toFixed(3)}`}
              </div>
            </div>
            <div className="row gap-2" style={{ marginTop: 10 }}>
              <Button size="sm" icon={<ChevronLeft />} onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
                Back
              </Button>
              <Button size="sm" variant="primary" iconRight={<ChevronRight />} onClick={() => setI((v) => Math.min(eventSteps.length - 1, v + 1))} disabled={i >= eventSteps.length - 1}>
                Next event
              </Button>
              <label className="checkbox" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={showCi} onChange={(e) => setShowCi(e.target.checked)} /> 95% CI
              </label>
            </div>
          </div>
          <table className="w-table">
            <thead>
              <tr>
                <th>t</th>
                <th>n</th>
                <th>d</th>
                <th>censored</th>
                <th>S(t)</th>
              </tr>
            </thead>
            <tbody>
              {km.steps.map((s) => (
                <tr key={s.time} className={clsx(s.time === cur?.time && 'is-active')}>
                  <td>{s.time}</td>
                  <td>{s.nRisk}</td>
                  <td>{s.nEvent}</td>
                  <td>{s.nCensor}</td>
                  <td>{s.time <= (cur?.time ?? 0) ? s.surv.toFixed(4) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="w-explain">
        Censored subjects never pull the curve down — they leave the risk set, which makes each later death count for more. At t = 6 one subject has an event and
        another is censored: the convention is that the censored subject <i>was</i> at risk at t = 6, so n = 8 there and the risk set drops to 6 afterwards. The
        median is the first time the curve reaches 0.5, here <b>{km.median} months</b>; with only {km.events} events the 95% CI for the median is wide
        ({km.medianLower ?? '—'}–{km.medianUpper ?? '—'} months) — small studies estimate medians poorly.
      </div>
    </div>
  );
}
