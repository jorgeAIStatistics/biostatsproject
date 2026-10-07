import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line, area } from 'd3-shape';
import type { WidgetProps } from '../registry';
import { AxisBottom, AxisLeft, Legend, useWidth } from '../../charts/core';
import { normalPdf, tPdf, tQuantile, normalQuantile } from '../../../lib/stats/distributions';

export default function TDistribution(_: WidgetProps) {
  void _;
  const [df, setDf] = useState(5);
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const h = 260;
  const m = { top: 14, right: 16, bottom: 40, left: 46 };
  const xs = useMemo(() => Array.from({ length: 361 }, (_, i) => -4.5 + (i * 9) / 360), []);
  const x = scaleLinear().domain([-4.5, 4.5]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 0.42]).range([h - m.bottom, m.top]);
  const l = line<number>()
    .x((v) => x(v))
    .y((v) => y(tPdf(v, df)));
  const ln = line<number>()
    .x((v) => x(v))
    .y((v) => y(normalPdf(v)));
  const tCrit = tQuantile(0.975, df);
  const zCrit = normalQuantile(0.975);
  const tail = area<number>()
    .x((v) => x(v))
    .y0(y(0))
    .y1((v) => y(tPdf(v, df)));
  const upper = xs.filter((v) => v >= tCrit);
  const lower = xs.filter((v) => v <= -tCrit);

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label={`t distribution with ${df} degrees of freedom versus the standard normal`}>
            <AxisLeft scale={y} x={m.left} ticks={4} grid gridWidth={width - m.right - m.left} label="density" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={9} width={width} label="test statistic" />
            <path d={tail(upper) ?? ''} fill="var(--viz-1)" opacity={0.18} />
            <path d={tail(lower) ?? ''} fill="var(--viz-1)" opacity={0.18} />
            <path d={ln(xs) ?? ''} fill="none" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" />
            <path d={l(xs) ?? ''} fill="none" stroke="var(--viz-1)" strokeWidth={2} />
            <line x1={x(tCrit)} x2={x(tCrit)} y1={y(0)} y2={y(tPdf(tCrit, df))} stroke="var(--viz-1)" strokeWidth={1.5} />
            <line x1={x(-tCrit)} x2={x(-tCrit)} y1={y(0)} y2={y(tPdf(-tCrit, df))} stroke="var(--viz-1)" strokeWidth={1.5} />
            <line x1={x(zCrit)} x2={x(zCrit)} y1={y(0)} y2={y(normalPdf(zCrit))} stroke="var(--viz-2)" strokeWidth={1.5} strokeDasharray="3 3" />
            <text x={x(tCrit) + 4} y={m.top + 12} className="axis__label" fill="var(--text-2)">
              t* = {tCrit.toFixed(3)}
            </text>
            <text x={x(zCrit) + 4} y={m.top + 28} className="axis__label" fill="var(--text-3)">
              z* = {zCrit.toFixed(3)}
            </text>
          </svg>
          <Legend items={[{ label: `t with ${df} df`, color: 'var(--viz-1)' }, { label: 'standard normal', color: 'var(--viz-2)', dashed: true }]} />
        </div>
        <div className="w-controls">
          <label className="w-control">
            <span className="w-control__label">
              Degrees of freedom <span className="w-control__value">{df}</span>
            </span>
            <input type="range" min={1} max={120} value={df} onChange={(e) => setDf(Number(e.target.value))} />
          </label>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">t critical (0.975)</div>
              <div className="w-stat__value">{tCrit.toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">z critical</div>
              <div className="w-stat__value">{zCrit.toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Extra width</div>
              <div className="w-stat__value">{(((tCrit - zCrit) / zCrit) * 100).toFixed(1)}%</div>
            </div>
          </div>
          <table className="w-table">
            <thead>
              <tr>
                <th>df</th>
                <th>t*(0.975)</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 5, 10, 20, 30, 60, 120].map((d) => (
                <tr key={d} className={d === df ? 'is-active' : undefined}>
                  <td>{d}</td>
                  <td>{tQuantile(0.975, d).toFixed(3)}</td>
                </tr>
              ))}
              <tr>
                <td>∞</td>
                <td>{zCrit.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="w-explain">
        The t distribution is wider than the normal because the standard error itself is estimated from the same small sample. With {df} degrees of freedom a
        95% interval must reach {tCrit.toFixed(2)} standard errors instead of {zCrit.toFixed(2)} — {(((tCrit - zCrit) / zCrit) * 100).toFixed(0)}% wider. Past
        about 60 df the difference is under 2%, which is why large trials can use normal-based intervals with little loss.
      </div>
    </div>
  );
}
