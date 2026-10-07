import { useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { RotateCcw, Plus } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button } from '../../ui';
import { ols } from '../../../lib/stats/regression';
import { normalQuantile } from '../../../lib/stats/distributions';
import { AxisBottom, AxisLeft, useWidth } from '../../charts/core';

interface P {
  x: number;
  y: number;
}

const BASE: P[] = [
  { x: 45, y: 118 }, { x: 48, y: 122 }, { x: 52, y: 126 }, { x: 55, y: 124 }, { x: 58, y: 131 },
  { x: 60, y: 134 }, { x: 62, y: 130 }, { x: 65, y: 140 }, { x: 67, y: 138 }, { x: 70, y: 145 },
  { x: 72, y: 143 }, { x: 75, y: 150 }, { x: 77, y: 148 }, { x: 80, y: 155 },
];

export default function RegressionDiagnostics(_: WidgetProps) {
  void _;
  const [points, setPoints] = useState<P[]>(BASE);
  const [drag, setDrag] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(420);
  const svgRef = useRef<SVGSVGElement>(null);

  const fit = useMemo(() => ols(points.map((p) => [1, p.x]), points.map((p) => p.y)), [points]);
  const h = 260;
  const m = { top: 12, right: 14, bottom: 36, left: 46 };
  const x = scaleLinear().domain([35, 95]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([100, 180]).range([h - m.bottom, m.top]);

  const toData = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: x.invert(clientX - rect.left), y: y.invert(clientY - rect.top) };
  };

  const resid = fit.residuals;
  const maxCook = Math.max(...fit.cooksD);
  const worst = fit.cooksD.indexOf(maxCook);

  // Residual plot scales
  const rh = 130;
  const rm = { top: 10, right: 12, bottom: 28, left: 40 };
  const rw = width;
  const rx = scaleLinear().domain([Math.min(...fit.fitted) - 3, Math.max(...fit.fitted) + 3]).range([rm.left, rw - rm.right]);
  const rmax = Math.max(6, ...resid.map((r) => Math.abs(r)));
  const ry = scaleLinear().domain([-rmax, rmax]).range([rh - rm.bottom, rm.top]);

  // QQ plot
  const sorted = [...fit.studentized].sort((a, b) => a - b);
  const qq = sorted.map((v, i) => ({ t: normalQuantile((i + 0.5) / sorted.length), s: v }));
  const qx = scaleLinear().domain([-2.6, 2.6]).range([rm.left, rw - rm.right]);
  const qy = scaleLinear().domain([-3.2, 3.2]).range([rh - rm.bottom, rm.top]);

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg
            ref={svgRef}
            width={width}
            height={h}
            role="img"
            aria-label="Scatter plot with fitted line; drag points to see the fit change"
            onMouseMove={(e) => {
              if (drag === null) return;
              const d = toData(e.clientX, e.clientY);
              setPoints((ps) => ps.map((p, i) => (i === drag ? { x: Math.max(36, Math.min(94, d.x)), y: Math.max(101, Math.min(179, d.y)) } : p)));
            }}
            onMouseUp={() => setDrag(null)}
            onMouseLeave={() => setDrag(null)}
            onDoubleClick={(e) => {
              const d = toData(e.clientX, e.clientY);
              setPoints((ps) => [...ps, d]);
            }}
          >
            <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} label="SBP (mmHg)" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label="age (years)" />
            <line x1={x(35)} x2={x(95)} y1={y(fit.coef[0] + fit.coef[1] * 35)} y2={y(fit.coef[0] + fit.coef[1] * 95)} stroke="var(--viz-1)" strokeWidth={2} />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={i === worst && maxCook > 0.5 ? 7 : 5}
                fill={i === worst && maxCook > 0.5 ? 'var(--viz-8)' : 'var(--viz-1)'}
                className="chart-mark-ring"
                style={{ cursor: 'grab' }}
                onMouseDown={() => setDrag(i)}
              />
            ))}
          </svg>
          <div className="w-note">Drag any point; double-click empty space to add one. Red = highest Cook’s distance when it exceeds 0.5.</div>
        </div>
        <div className="w-controls">
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">Slope</div>
              <div className="w-stat__value">{fit.coef[1].toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">SE (slope)</div>
              <div className="w-stat__value">{fit.se[1].toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">p</div>
              <div className="w-stat__value">{fit.p[1] < 0.001 ? '<0.001' : fit.p[1].toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">R²</div>
              <div className="w-stat__value">{fit.rSquared.toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">σ̂</div>
              <div className="w-stat__value">{fit.sigma.toFixed(2)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">max Cook’s D</div>
              <div className="w-stat__value">{maxCook.toFixed(2)}</div>
            </div>
          </div>
          <div className="row gap-2">
            <Button size="sm" icon={<RotateCcw />} onClick={() => setPoints(BASE)}>
              Reset data
            </Button>
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setPoints((ps) => [...ps, { x: 92, y: 115 }])}>
              Add an outlier
            </Button>
          </div>
          <div className="w-note">
            95% CI for the slope: {fit.lower[1].toFixed(3)} to {fit.upper[1].toFixed(3)} mmHg per year. Intercept {fit.coef[0].toFixed(1)} is the fitted SBP at
            age 0 — outside the data, so it is an extrapolation, not a meaning.
          </div>
        </div>
      </div>
      <div className="w-grid">
        <div className="chart">
          <div className="eyebrow">Residuals vs fitted</div>
          <svg width={rw} height={rh} role="img" aria-label="Residuals versus fitted values">
            <AxisLeft scale={ry} x={rm.left} ticks={4} grid gridWidth={rw - rm.right - rm.left} />
            <AxisBottom scale={rx} y={rh - rm.bottom} ticks={5} width={rw} />
            <line x1={rm.left} x2={rw - rm.right} y1={ry(0)} y2={ry(0)} stroke="var(--viz-axis)" strokeDasharray="3 3" />
            {fit.fitted.map((f, i) => (
              <circle key={i} cx={rx(f)} cy={ry(resid[i])} r={4} fill="var(--viz-3)" className="chart-mark-ring" />
            ))}
          </svg>
        </div>
        <div className="chart">
          <div className="eyebrow">Normal Q–Q of studentized residuals</div>
          <svg width={rw} height={rh} role="img" aria-label="Normal quantile-quantile plot">
            <AxisLeft scale={qy} x={rm.left} ticks={4} grid gridWidth={rw - rm.right - rm.left} />
            <AxisBottom scale={qx} y={rh - rm.bottom} ticks={5} width={rw} />
            <line x1={qx(-2.6)} x2={qx(2.6)} y1={qy(-2.6)} y2={qy(2.6)} stroke="var(--viz-axis)" strokeDasharray="3 3" />
            {qq.map((p, i) => (
              <circle key={i} cx={qx(p.t)} cy={qy(p.s)} r={4} fill="var(--viz-4)" className="chart-mark-ring" />
            ))}
          </svg>
        </div>
      </div>
      <div className="w-explain">
        Drag a point far to the right and watch the slope swing: points with extreme <i>x</i> have high leverage, and a high-leverage point that also sits off
        the line has high influence (Cook’s D). R² can stay respectable while the model is wrong — the residual plot is where curvature and non-constant
        variance show up, and the Q–Q plot is where heavy tails do. In clinical work this is the difference between “the covariate is significant” and “one
        subject with an implausible lab value is driving the analysis”.
      </div>
    </div>
  );
}
