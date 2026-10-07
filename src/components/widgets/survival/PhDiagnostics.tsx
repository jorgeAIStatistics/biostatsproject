import { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { WidgetProps } from '../registry';
import { loadDataset, type Row } from '../../../lib/datasets';
import { kaplanMeier, coxPH, schoenfeldResiduals, type SurvRecord } from '../../../lib/stats/survival';
import { correlation, simpleRegression } from '../../../lib/stats/regression';
import { AxisBottom, AxisLeft, Legend, useWidth } from '../../charts/core';
import { EmptyState, Loading, Segmented } from '../../ui';

/** Checking proportional hazards on the flagship study's PFS analysis. */
export default function PhDiagnostics(_: WidgetProps) {
  void _;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'loglog' | 'schoenfeld'>('loglog');
  const [ref, width] = useWidth<HTMLDivElement>(560);

  useEffect(() => {
    loadDataset('oncology/adam/adtte')
      .then((d) => setRows(d.rows.filter((r) => r.PARAMCD === 'PFS')))
      .catch((e: Error) => setError(e.message));
  }, []);

  const model = useMemo(() => {
    if (!rows) return null;
    const arms = [...new Set(rows.map((r) => String(r.TRTP)))].sort();
    const recs: SurvRecord[] = rows.map((r) => ({
      time: Number(r.AVAL) / 30.4375,
      event: Number(r.CNSR) === 0 ? 1 : 0,
      group: String(r.TRTP),
      covariates: [String(r.TRTP) === arms[0] ? 1 : 0],
    }));
    const fit = coxPH(recs, { ties: 'efron' });
    const res = schoenfeldResiduals(recs, fit.coef, 0);
    const kmByArm = arms.map((a) => ({ arm: a, km: kaplanMeier(recs.filter((r) => r.group === a)) }));
    const logT = res.map((r) => Math.log(r.time));
    const corr = correlation(logT, res.map((r) => r.scaled));
    const trend = simpleRegression(logT, res.map((r) => r.scaled));
    return { arms, fit, res, kmByArm, corr, trend };
  }, [rows]);

  if (error) return <EmptyState title="Study data not generated yet">Run <code>npm run data</code>.</EmptyState>;
  if (!model) return <Loading label="Fitting the Cox model…" />;

  const h = 260;
  const m = { top: 14, right: 16, bottom: 40, left: 52 };

  let body: React.ReactNode = null;
  if (view === 'loglog') {
    const pts = model.kmByArm.map((a, i) => ({
      arm: a.arm,
      color: i === 0 ? 'var(--viz-1)' : 'var(--viz-2)',
      data: a.km.steps.filter((s) => s.nEvent > 0 && s.surv > 0 && s.surv < 1).map((s) => ({ x: Math.log(s.time), y: Math.log(-Math.log(s.surv)) })),
    }));
    const xs = pts.flatMap((p) => p.data.map((d) => d.x));
    const ys = pts.flatMap((p) => p.data.map((d) => d.y));
    const x = scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).nice().range([m.left, width - m.right]);
    const y = scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).nice().range([h - m.bottom, m.top]);
    body = (
      <svg width={width} height={h} role="img" aria-label="log(-log) survival versus log time by arm">
        <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} label="log(−log S(t))" format={(v) => v.toFixed(1)} />
        <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label="log(time in months)" />
        {pts.map((p) => (
          <g key={p.arm}>
            {p.data.map((d, i) => (
              <circle key={i} cx={x(d.x)} cy={y(d.y)} r={2.6} fill={p.color} opacity={0.85} />
            ))}
          </g>
        ))}
      </svg>
    );
  } else {
    const x = scaleLinear().domain([Math.log(Math.min(...model.res.map((r) => r.time))), Math.log(Math.max(...model.res.map((r) => r.time)))]).nice().range([m.left, width - m.right]);
    const ys = model.res.map((r) => r.scaled);
    const y = scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).nice().range([h - m.bottom, m.top]);
    const x0 = x.domain()[0];
    const x1 = x.domain()[1];
    body = (
      <svg width={width} height={h} role="img" aria-label="Scaled Schoenfeld residuals versus log time">
        <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} label="scaled Schoenfeld residual (β(t))" format={(v) => v.toFixed(1)} />
        <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label="log(time in months)" />
        <line x1={m.left} x2={width - m.right} y1={y(model.fit.coef[0])} y2={y(model.fit.coef[0])} stroke="var(--viz-2)" strokeDasharray="4 3" />
        {model.res.map((r, i) => (
          <circle key={i} cx={x(Math.log(r.time))} cy={y(r.scaled)} r={2.4} fill="var(--viz-1)" opacity={0.6} />
        ))}
        <line
          x1={x(x0)}
          x2={x(x1)}
          y1={y(model.trend.coef[0] + model.trend.coef[1] * x0)}
          y2={y(model.trend.coef[0] + model.trend.coef[1] * x1)}
          stroke="var(--viz-3)"
          strokeWidth={2}
        />
      </svg>
    );
  }

  return (
    <div className="stack gap-3">
      <Segmented
        ariaLabel="Diagnostic"
        value={view}
        onChange={setView}
        options={[
          { value: 'loglog', label: 'log(−log) plot' },
          { value: 'schoenfeld', label: 'Scaled Schoenfeld residuals' },
        ]}
      />
      <div className="chart" ref={ref}>
        {body}
        {view === 'loglog' && <Legend items={model.kmByArm.map((a, i) => ({ label: a.arm, color: i === 0 ? 'var(--viz-1)' : 'var(--viz-2)' }))} />}
      </div>
      <div className="w-stats">
        <div className="w-stat">
          <div className="w-stat__label">log HR (β)</div>
          <div className="w-stat__value">{model.fit.coef[0].toFixed(3)}</div>
        </div>
        <div className="w-stat">
          <div className="w-stat__label">HR</div>
          <div className="w-stat__value">{model.fit.hr[0].toFixed(3)}</div>
        </div>
        <div className="w-stat">
          <div className="w-stat__label">corr(residual, log t)</div>
          <div className="w-stat__value">{model.corr.toFixed(3)}</div>
        </div>
        <div className="w-stat">
          <div className="w-stat__label">trend slope</div>
          <div className="w-stat__value">{model.trend.coef[1].toFixed(3)}</div>
        </div>
      </div>
      <div className="w-explain">
        {view === 'loglog'
          ? 'Under proportional hazards the two log(−log) curves are parallel, separated vertically by log HR. Curves that converge or cross are the visual signature of a treatment effect that changes over time — common with immunotherapies (delayed effect) and with treatments that stop after a fixed number of cycles.'
          : `Scaled Schoenfeld residuals estimate β(t): a flat cloud around the dashed line (β = ${model.fit.coef[0].toFixed(3)}) supports proportional hazards, while a systematic trend does not. Here the correlation with log time is ${model.corr.toFixed(3)} and the fitted slope is ${model.trend.coef[1].toFixed(3)} — R's cox.zph() performs the corresponding test. When the assumption fails, the single hazard ratio still summarises the data, but as an average over the follow-up period: report restricted mean survival time, piecewise hazard ratios, or a landmark analysis instead of pretending it is constant.`}
      </div>
    </div>
  );
}
