import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import type { WidgetProps } from '../registry';
import { AxisBottom, AxisLeft, useWidth } from '../../charts/core';
import { Segmented } from '../../ui';

export default function LogisticExplorer(_: WidgetProps) {
  void _;
  const [b0, setB0] = useState(-4.2);
  const [b1, setB1] = useState(0.06);
  const [x0, setX0] = useState(60);
  const [scaleKind, setScale] = useState<'prob' | 'odds' | 'logodds'>('prob');
  const [ref, width] = useWidth<HTMLDivElement>(520);

  const xs = useMemo(() => Array.from({ length: 241 }, (_, i) => 20 + i * 0.5), []);
  const p = (x: number) => 1 / (1 + Math.exp(-(b0 + b1 * x)));
  const value = (x: number) => (scaleKind === 'prob' ? p(x) : scaleKind === 'odds' ? p(x) / (1 - p(x)) : b0 + b1 * x);

  const h = 250;
  const m = { top: 14, right: 16, bottom: 38, left: 52 };
  const x = scaleLinear().domain([20, 140]).range([m.left, width - m.right]);
  const yDomain: [number, number] = scaleKind === 'prob' ? [0, 1] : scaleKind === 'odds' ? [0, Math.max(4, value(140))] : [-6, 6];
  const y = scaleLinear().domain(yDomain).range([h - m.bottom, m.top]);
  const l = line<number>().x((v) => x(v)).y((v) => y(value(v)));

  const or = Math.exp(b1);
  const or10 = Math.exp(b1 * 10);
  const pAt = p(x0);
  const pAtPlus = p(x0 + 10);

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label="Logistic model on the probability, odds or log-odds scale">
            <AxisLeft
              scale={y}
              x={m.left}
              ticks={5}
              grid
              gridWidth={width - m.right - m.left}
              label={scaleKind === 'prob' ? 'P(response)' : scaleKind === 'odds' ? 'odds' : 'log-odds'}
              format={(v) => (scaleKind === 'prob' ? v.toFixed(1) : v.toFixed(1))}
            />
            <AxisBottom scale={x} y={h - m.bottom} ticks={7} width={width} label="baseline tumour burden (mm)" />
            <path d={l(xs) ?? ''} fill="none" stroke="var(--viz-1)" strokeWidth={2} />
            <line x1={x(x0)} x2={x(x0)} y1={m.top} y2={h - m.bottom} stroke="var(--viz-2)" strokeDasharray="4 3" />
            <circle cx={x(x0)} cy={y(value(x0))} r={6} fill="var(--viz-2)" className="chart-mark-ring" />
            <circle cx={x(x0 + 10)} cy={y(value(x0 + 10))} r={6} fill="var(--viz-3)" className="chart-mark-ring" />
          </svg>
        </div>
        <div className="w-controls">
          <Segmented
            ariaLabel="Scale"
            value={scaleKind}
            onChange={setScale}
            options={[
              { value: 'prob', label: 'Probability' },
              { value: 'odds', label: 'Odds' },
              { value: 'logodds', label: 'Log-odds' },
            ]}
          />
          <label className="w-control">
            <span className="w-control__label">
              β₀ (intercept) <span className="w-control__value">{b0.toFixed(2)}</span>
            </span>
            <input type="range" min={-8} max={4} step={0.1} value={b0} onChange={(e) => setB0(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              β₁ (per mm) <span className="w-control__value">{b1.toFixed(3)}</span>
            </span>
            <input type="range" min={-0.12} max={0.12} step={0.005} value={b1} onChange={(e) => setB1(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              Reference x <span className="w-control__value">{x0} mm</span>
            </span>
            <input type="range" min={25} max={120} value={x0} onChange={(e) => setX0(Number(e.target.value))} />
          </label>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">OR per mm</div>
              <div className="w-stat__value">{or.toFixed(3)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">OR per 10 mm</div>
              <div className="w-stat__value">{or10.toFixed(2)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">P at {x0}</div>
              <div className="w-stat__value">{(pAt * 100).toFixed(1)}%</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">P at {x0 + 10}</div>
              <div className="w-stat__value">{(pAtPlus * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-explain">
        The model is linear in the log-odds: logit P = {b0.toFixed(2)} + {b1.toFixed(3)}·x. A one-unit increase multiplies the <i>odds</i> by e^β₁ ={' '}
        {or.toFixed(3)} — the same odds ratio everywhere on the curve. The <i>probability</i> change is not constant: from {x0} to {x0 + 10} mm it moves from{' '}
        {(pAt * 100).toFixed(1)}% to {(pAtPlus * 100).toFixed(1)}% ({((pAtPlus - pAt) * 100).toFixed(1)} percentage points), while the same 10 mm step near the
        middle of the curve moves it far more. Two consequences for reporting: an odds ratio is not a risk ratio (they only agree when the outcome is rare), and
        “the odds double” means little to a clinician without the underlying probabilities.
      </div>
    </div>
  );
}
