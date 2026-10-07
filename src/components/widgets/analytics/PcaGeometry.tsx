import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { WidgetProps } from '../registry';
import { AxisBottom, AxisLeft, useWidth } from '../../charts/core';
import { pca } from '../../../lib/stats/pca';
import { mulberry32, normalGen } from '../../../lib/stats/random';
import { Button } from '../../ui';

/** PCA as geometry: rotate a candidate axis and watch the projected variance. */
export default function PcaGeometry(_: WidgetProps) {
  void _;
  const [angle, setAngle] = useState(20);
  const [corr, setCorr] = useState(0.85);
  const [ref, width] = useWidth<HTMLDivElement>(420);

  const points = useMemo(() => {
    const rand = mulberry32(42);
    const z = normalGen(rand);
    return Array.from({ length: 120 }, () => {
      const a = z();
      const b = corr * a + Math.sqrt(1 - corr * corr) * z();
      return [a * 1.6, b * 1.0] as [number, number];
    });
  }, [corr]);

  const res = useMemo(() => pca(points.map((p) => [p[0], p[1]]), false), [points]);
  const pc1Angle = (Math.atan2(res.loadings[0][1], res.loadings[0][0]) * 180) / Math.PI;
  const rad = (angle * Math.PI) / 180;
  const dir: [number, number] = [Math.cos(rad), Math.sin(rad)];
  const projections = points.map((p) => p[0] * dir[0] + p[1] * dir[1]);
  const mean = projections.reduce((a, b) => a + b, 0) / projections.length;
  const varProj = projections.reduce((s, v) => s + (v - mean) ** 2, 0) / (projections.length - 1);
  const totalVar = res.eigenvalues.reduce((a, b) => a + b, 0);

  const h = 300;
  const m = { top: 12, right: 14, bottom: 34, left: 44 };
  const ext = 4.5;
  const x = scaleLinear().domain([-ext, ext]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([-ext, ext]).range([h - m.bottom, m.top]);

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label="Point cloud with a rotating projection axis">
            <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} label="variable 2 (standardized)" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={7} width={width} label="variable 1 (standardized)" />
            <line
              x1={x(-ext * dir[0])}
              y1={y(-ext * dir[1])}
              x2={x(ext * dir[0])}
              y2={y(ext * dir[1])}
              stroke="var(--viz-2)"
              strokeWidth={2}
            />
            {points.map((p, i) => {
              const t = p[0] * dir[0] + p[1] * dir[1];
              const proj: [number, number] = [t * dir[0], t * dir[1]];
              return (
                <g key={i}>
                  <line x1={x(p[0])} y1={y(p[1])} x2={x(proj[0])} y2={y(proj[1])} stroke="var(--viz-2)" strokeWidth={0.6} opacity={0.4} />
                  <circle cx={x(p[0])} cy={y(p[1])} r={3} fill="var(--viz-1)" opacity={0.75} />
                  <circle cx={x(proj[0])} cy={y(proj[1])} r={2.4} fill="var(--viz-2)" />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="w-controls">
          <label className="w-control">
            <span className="w-control__label">
              Axis angle <span className="w-control__value">{angle}°</span>
            </span>
            <input type="range" min={-90} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              Correlation between the variables <span className="w-control__value">{corr.toFixed(2)}</span>
            </span>
            <input type="range" min={0} max={0.98} step={0.01} value={corr} onChange={(e) => setCorr(Number(e.target.value))} />
          </label>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">Variance on this axis</div>
              <div className="w-stat__value">{varProj.toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">PC1 variance (max)</div>
              <div className="w-stat__value">{res.eigenvalues[0].toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">% of total</div>
              <div className="w-stat__value">{((varProj / totalVar) * 100).toFixed(1)}%</div>
            </div>
          </div>
          <Button size="sm" onClick={() => setAngle(Math.round(pc1Angle))}>
            Snap to PC1 ({pc1Angle.toFixed(1)}°)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAngle(Math.round(pc1Angle + 90))}>
            Snap to PC2
          </Button>
        </div>
      </div>
      <div className="w-explain">
        Every point is projected onto the orange axis. PCA is the answer to one question: <i>which direction makes the projected variance largest?</i> That
        direction is PC1 ({res.eigenvalues[0].toFixed(3)} of {totalVar.toFixed(3)} total variance ={' '}
        {((res.eigenvalues[0] / totalVar) * 100).toFixed(1)}%); PC2 is the best direction perpendicular to it. Slide the correlation to 0 and notice that no
        direction is much better than another — PCA only compresses information when variables are correlated. Two consequences people get wrong: the components
        are defined only up to sign (flipping PC1 changes nothing), and a component is a <i>direction</i>, not a variable you can name without looking at its
        loadings.
      </div>
    </div>
  );
}
