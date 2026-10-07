import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { scaleLinear } from 'd3-scale';
import { Route, Info } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { buildTlf, type TlfTable, type TlfCell, type FigureData } from '../../../lib/tlf/engine';
import { Drawer, EmptyState, Loading, Badge } from '../../ui';
import { AxisBottom, AxisLeft, useWidth, barPath, ChartTooltip, type TooltipState, Legend } from '../../charts/core';
import { TraceValue } from './TraceValue';
import './tlf.css';

function KmFigure({ km }: { km: NonNullable<FigureData['km']> }) {
  const [ref, width] = useWidth<HTMLDivElement>(620);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const h = 320;
  const m = { top: 14, right: 16, bottom: 46, left: 52 };
  const maxT = Math.max(...km.times, ...km.arms.flatMap((a) => a.steps.map((s) => s.time)));
  const x = scaleLinear().domain([0, maxT]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 1]).range([h - m.bottom, m.top]);
  const stepPath = (steps: { time: number; surv: number }[]) => {
    let d = `M${x(0)},${y(1)}`;
    let prev = 1;
    for (const s of steps) {
      d += `L${x(s.time)},${y(prev)}L${x(s.time)},${y(s.surv)}`;
      prev = s.surv;
    }
    d += `L${x(maxT)},${y(prev)}`;
    return d;
  };
  return (
    <div className="stack gap-2">
      <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
        <svg width={width} height={h} role="img" aria-label="Kaplan-Meier curves by treatment arm">
          <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} format={(v) => `${Math.round(v * 100)}%`} label="Event-free probability" />
          <AxisBottom scale={x} y={h - m.bottom} ticks={Math.min(10, km.times.length)} width={width} label={km.xLabel} />
          {km.arms.map((a) => (
            <g key={a.label}>
              <path d={stepPath(a.steps)} fill="none" stroke={a.color} strokeWidth={2} />
              {a.censor.map((c, i) => (
                <line key={i} x1={x(c.time)} x2={x(c.time)} y1={y(c.surv) - 4} y2={y(c.surv) + 4} stroke={a.color} strokeWidth={1.5} />
              ))}
            </g>
          ))}
          <rect
            className="chart-hit"
            x={m.left}
            y={m.top}
            width={Math.max(0, width - m.left - m.right)}
            height={h - m.top - m.bottom}
            onMouseMove={(e) => {
              const rect = (e.target as SVGRectElement).getBoundingClientRect();
              const t = x.invert(e.clientX - rect.left + m.left);
              const vals = km.arms.map((a) => {
                let s = 1;
                for (const st of a.steps) {
                  if (st.time > t) break;
                  s = st.surv;
                }
                return { label: a.label, s, color: a.color };
              });
              setTip({
                x: x(t),
                y: m.top + 8,
                content: (
                  <>
                    <b>{t.toFixed(1)} months</b>
                    {vals.map((v) => (
                      <div key={v.label} style={{ color: 'var(--text-2)' }}>
                        <span style={{ color: v.color }}>■</span> {v.label}: {(v.s * 100).toFixed(1)}%
                      </div>
                    ))}
                  </>
                ),
              });
            }}
          />
        </svg>
        <ChartTooltip state={tip} />
        <Legend items={km.arms.map((a) => ({ label: a.label, color: a.color }))} />
      </div>
      <table className="tlf-risk">
        <tbody>
          <tr>
            <th>Number at risk</th>
            {km.times.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
          {km.arms.map((a) => (
            <tr key={a.label}>
              <td style={{ color: a.color }}>{a.label}</td>
              {a.atRisk.map((n, i) => (
                <td key={i}>{n}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="tlf-table tlf-table--compact">
        <thead>
          <tr>
            <th>Arm</th>
            <th>n</th>
            <th>Events</th>
            <th>Median (months)</th>
            <th>95% CI</th>
          </tr>
        </thead>
        <tbody>
          {km.summary.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td className="num">{s.n}</td>
              <td className="num">{s.events}</td>
              <td className="num">{s.median === null ? 'NE' : s.median.toFixed(1)}</td>
              <td className="num">
                {s.lower === null ? 'NE' : s.lower.toFixed(1)}, {s.upper === null ? 'NE' : s.upper.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {km.hr && (
        <div className="w-explain">
          Hazard ratio {km.hr.value.toFixed(2)} (95% CI {km.hr.lower.toFixed(2)}–{km.hr.upper.toFixed(2)}), stratified log-rank p{' '}
          {km.hr.p < 0.0001 ? '< 0.0001' : `= ${km.hr.p.toFixed(4)}`}. A hazard ratio of {km.hr.value.toFixed(2)} means that at any moment, a subject still at
          risk in the experimental arm has about {Math.round(km.hr.value * 100)}% of the instantaneous risk of a subject in the control arm — it is not a
          statement that anyone lives {Math.round((1 / km.hr.value - 1) * 100)}% longer.
        </div>
      )}
    </div>
  );
}

function ForestFigure({ data }: { data: NonNullable<FigureData['forest']> }) {
  const [ref, width] = useWidth<HTMLDivElement>(620);
  const rowH = 26;
  const h = data.length * rowH + 46;
  const labelW = Math.min(220, width * 0.34);
  const numW = 96;
  const m = { top: 8, right: 14, bottom: 30 };
  const lo = Math.min(0.25, ...data.map((d) => d.lower));
  const hi = Math.max(2.5, ...data.map((d) => d.upper));
  const x = scaleLinear().domain([Math.log(lo), Math.log(hi)]).range([labelW + numW, width - m.right]);
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={h} role="img" aria-label="Forest plot of hazard ratios by subgroup">
        <line x1={x(0)} x2={x(0)} y1={m.top} y2={h - m.bottom} stroke="var(--text-3)" strokeDasharray="4 3" />
        {data.map((d, i) => {
          const yy = m.top + i * rowH + rowH / 2;
          return (
            <g key={d.label}>
              <text x={0} y={yy} dy="0.32em" className="axis__label" fill="var(--text)" fontSize={12}>
                {d.label}
              </text>
              <text x={labelW + numW - 10} y={yy} dy="0.32em" textAnchor="end" className="axis__label">
                {d.events}/{d.n}
              </text>
              <line x1={x(Math.log(Math.max(lo, d.lower)))} x2={x(Math.log(Math.min(hi, d.upper)))} y1={yy} y2={yy} stroke="var(--viz-1)" strokeWidth={1.5} />
              <rect x={x(Math.log(d.hr)) - 4} y={yy - 4} width={8} height={8} fill="var(--viz-1)" className="chart-mark-ring" />
            </g>
          );
        })}
        <g transform={`translate(0,${h - m.bottom})`}>
          {[0.25, 0.5, 1, 2].filter((v) => v >= lo && v <= hi).map((v) => (
            <g key={v} transform={`translate(${x(Math.log(v))},0)`}>
              <line y2={4} className="axis__tick" />
              <text y={16} textAnchor="middle" className="axis__label">
                {v}
              </text>
            </g>
          ))}
          <text x={(x(Math.log(lo)) + x(Math.log(hi))) / 2} y={30} textAnchor="middle" className="axis__title">
            Hazard ratio (log scale) — favours experimental ← → favours control
          </text>
        </g>
      </svg>
    </div>
  );
}

function WaterfallFigure({ data }: { data: NonNullable<FigureData['waterfall']> }) {
  const [ref, width] = useWidth<HTMLDivElement>(620);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const h = 260;
  const m = { top: 12, right: 14, bottom: 34, left: 48 };
  const y = scaleLinear().domain([Math.min(-100, ...data.map((d) => d.value)), Math.max(60, ...data.map((d) => d.value))]).range([h - m.bottom, m.top]);
  const bw = Math.max(1, (width - m.left - m.right) / Math.max(1, data.length));
  const color = (r: string) => (r === 'CR' ? 'var(--viz-6)' : r === 'PR' ? 'var(--viz-1)' : r === 'SD' ? 'var(--viz-4)' : r === 'PD' ? 'var(--viz-2)' : 'var(--viz-other)');
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={h} role="img" aria-label="Waterfall plot of best percentage change in tumour size">
        <AxisLeft scale={y} x={m.left} ticks={6} grid gridWidth={width - m.right - m.left} format={(v) => `${v}%`} label="Best change from baseline" />
        <line x1={m.left} x2={width - m.right} y1={y(-30)} y2={y(-30)} stroke="var(--viz-1)" strokeDasharray="4 3" />
        <line x1={m.left} x2={width - m.right} y1={y(20)} y2={y(20)} stroke="var(--viz-2)" strokeDasharray="4 3" />
        <line x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" />
        {data.map((d, i) => {
          const x0 = m.left + i * bw;
          const top = d.value >= 0 ? y(d.value) : y(0);
          const height = Math.abs(y(d.value) - y(0));
          return (
            <path
              key={d.subject}
              d={barPath(x0, top, Math.max(1, bw - 0.6), height, Math.min(3, bw / 2))}
              fill={color(d.response)}
              onMouseMove={() => setTip({ x: x0 + bw / 2, y: top, content: <><b>{d.subject}</b><br />{d.value.toFixed(1)}% · best response {d.response}</> })}
            />
          );
        })}
        <AxisBottom scale={scaleLinear().domain([0, data.length]).range([m.left, width - m.right])} y={h - m.bottom} ticks={0} width={width} label={`${data.length} subjects with a post-baseline tumour assessment`} />
      </svg>
      <ChartTooltip state={tip} />
      <Legend items={['CR', 'PR', 'SD', 'PD', 'NE'].map((r) => ({ label: r, color: color(r) }))} />
    </div>
  );
}

export default function TlfWidget({ props }: WidgetProps) {
  const id = props.id ?? 't-demog';
  const [table, setTable] = useState<TlfTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<{ cell: TlfCell; label: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setTable(null);
    setError(null);
    buildTlf(id)
      .then((t) => alive && setTable(t))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error)
    return (
      <EmptyState title="This output cannot be computed yet" icon={<Info />}>
        {error} Generate the study data with <code>npm run data</code>.
      </EmptyState>
    );
  if (!table) return <Loading label="Computing output from ADaM…" />;

  return (
    <div className="tlf">
      <header className="tlf__head">
        <div>
          <div className="tlf__title">{table.title}</div>
          <div className="tlf__sub">{table.subtitle}</div>
        </div>
        <Badge tone="neutral">computed live from ADaM</Badge>
      </header>
      {table.figure?.kind === 'km' && table.figure.km && <KmFigure km={table.figure.km} />}
      {table.figure?.kind === 'forest' && table.figure.forest && <ForestFigure data={table.figure.forest} />}
      {table.figure?.kind === 'waterfall' && table.figure.waterfall && <WaterfallFigure data={table.figure.waterfall} />}
      {!table.figure && (
        <div className="tlf__scroll">
          <table className="tlf-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c.key} className={c.key === '__label' ? 'tlf-table__stub' : undefined}>
                    {c.label}
                    {c.sub && <span className="tlf-table__n">{c.sub}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className={clsx(r.section && 'is-section')}>
                  {table.columns.map((c) => {
                    const cell = r.cells[c.key];
                    if (!cell) return <td key={c.key} />;
                    const clickable = !!cell.keys?.length;
                    return (
                      <td
                        key={c.key}
                        className={clsx(cell.align === 'right' && 'is-right', cell.emphasis && 'is-emphasis', clickable && 'is-traceable', c.key === '__label' && 'tlf-table__stub')}
                        style={cell.indent ? { paddingLeft: 12 + cell.indent * 16 } : undefined}
                        onClick={clickable ? () => setTrace({ cell, label: `${r.cells.__label?.text ?? ''} — ${c.label}` }) : undefined}
                        title={cell.definition}
                      >
                        {cell.text}
                        {clickable && <Route className="tlf-table__trace" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ol className="tlf__footnotes">
        {table.footnotes.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ol>
      <Drawer open={!!trace} onClose={() => setTrace(null)} title={`Trace: ${trace?.label ?? ''}`} size="lg">
        {trace && <TraceValue cell={trace.cell} label={trace.label} />}
      </Drawer>
    </div>
  );
}
