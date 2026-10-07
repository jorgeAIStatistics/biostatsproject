import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import type { WidgetProps } from '../registry';
import { Segmented } from '../../ui';
import { mulberry32, normalGen } from '../../../lib/stats/random';
import { mean } from '../../../lib/stats/descriptive';
import { AxisBottom, AxisLeft, Legend, useWidth } from '../../charts/core';

type Mechanism = 'mcar' | 'mar' | 'mnar';

const VISITS = [0, 2, 4, 8, 12];

/**
 * A 3-visit antihypertensive trial with dropout generated under MCAR, MAR or
 * MNAR, comparing complete-case, LOCF and a mixed-model-style estimate.
 */
export default function MissingDataSimulator(_: WidgetProps) {
  void _;
  const [mech, setMech] = useState<Mechanism>('mar');
  const [dropout, setDropout] = useState(0.3);
  const [seed, setSeed] = useState(4);
  const [ref, width] = useWidth<HTMLDivElement>(560);

  const sim = useMemo(() => {
    const rand = mulberry32(seed);
    const z = normalGen(rand);
    const n = 200;
    const subjects = Array.from({ length: n }, () => {
      const arm = rand() < 0.5 ? 0 : 1;
      const base = 150 + 10 * z();
      const u = 6 * z(); // subject random effect
      const trueChange = VISITS.map((v) => (arm === 1 ? -12 : -4) * (v / 12) + u * (v / 12));
      const obs = trueChange.map((c) => c + 3 * z());
      // Dropout
      let dropVisit = VISITS.length;
      for (let k = 1; k < VISITS.length; k++) {
        let p = dropout / 3;
        if (mech === 'mar') p = (dropout / 3) * (obs[k - 1] > -4 ? 2.2 : 0.4); // depends on the previous OBSERVED value
        if (mech === 'mnar') p = (dropout / 3) * (obs[k] > -4 ? 2.4 : 0.35); // depends on the CURRENT (unobserved) value
        if (rand() < p) {
          dropVisit = k;
          break;
        }
      }
      return { arm, base, trueChange, obs, dropVisit };
    });
    const armMeans = (fn: (s: (typeof subjects)[number]) => number | null, arm: number) => {
      const vals = subjects.filter((s) => s.arm === arm).map(fn).filter((v): v is number => v !== null);
      return vals.length ? mean(vals) : NaN;
    };
    const lastIdx = VISITS.length - 1;
    const truth = armMeans((s) => s.trueChange[lastIdx], 1) - armMeans((s) => s.trueChange[lastIdx], 0);
    const completeCase = armMeans((s) => (s.dropVisit > lastIdx ? s.obs[lastIdx] : null), 1) - armMeans((s) => (s.dropVisit > lastIdx ? s.obs[lastIdx] : null), 0);
    const locf = armMeans((s) => s.obs[Math.min(lastIdx, s.dropVisit - 1)], 1) - armMeans((s) => s.obs[Math.min(lastIdx, s.dropVisit - 1)], 0);
    // A simple MAR-valid estimator: average of within-visit changes conditional on the previous observed value
    // (a stand-in for MMRM, which uses all observed data under MAR).
    const mixed = (() => {
      // Estimate visit-to-visit increments from observed pairs, then cumulate.
      const arms = [0, 1].map((arm) => {
        let total = 0;
        for (let k = 1; k < VISITS.length; k++) {
          const pairs = subjects.filter((s) => s.arm === arm && s.dropVisit > k);
          const inc = pairs.length ? mean(pairs.map((s) => s.obs[k] - s.obs[k - 1])) : 0;
          total += inc;
        }
        return total;
      });
      return arms[1] - arms[0];
    })();
    const observedMeans = [0, 1].map((arm) =>
      VISITS.map((_, k) => {
        const vals = subjects.filter((s) => s.arm === arm && s.dropVisit > k).map((s) => s.obs[k]);
        return vals.length ? mean(vals) : NaN;
      }),
    );
    const trueMeans = [0, 1].map((arm) => VISITS.map((_, k) => mean(subjects.filter((s) => s.arm === arm).map((s) => s.trueChange[k]))));
    const completed = subjects.filter((s) => s.dropVisit > lastIdx).length;
    return { truth, completeCase, locf, mixed, observedMeans, trueMeans, completed, n };
  }, [mech, dropout, seed]);

  const h = 230;
  const m = { top: 14, right: 16, bottom: 38, left: 48 };
  const x = scaleLinear().domain([0, 12]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([-18, 2]).range([h - m.bottom, m.top]);
  const l = line<number>()
    .x((_, i) => x(VISITS[i]))
    .y((v) => y(v));

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label="Mean change from baseline by visit, observed versus true">
            <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} label="mean change in SBP (mmHg)" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={5} width={width} label="weeks" />
            {sim.trueMeans.map((vals, i) => (
              <path key={`t${i}`} d={l(vals) ?? ''} fill="none" stroke={i === 1 ? 'var(--viz-1)' : 'var(--viz-2)'} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
            ))}
            {sim.observedMeans.map((vals, i) => (
              <path key={`o${i}`} d={l(vals) ?? ''} fill="none" stroke={i === 1 ? 'var(--viz-1)' : 'var(--viz-2)'} strokeWidth={2.5} />
            ))}
          </svg>
          <Legend
            items={[
              { label: 'Treatment (observed)', color: 'var(--viz-1)' },
              { label: 'Placebo (observed)', color: 'var(--viz-2)' },
              { label: 'True mean (all subjects)', color: 'var(--text-3)', dashed: true },
            ]}
          />
        </div>
        <div className="w-controls">
          <Segmented
            ariaLabel="Mechanism"
            value={mech}
            onChange={setMech}
            options={[
              { value: 'mcar', label: 'MCAR' },
              { value: 'mar', label: 'MAR' },
              { value: 'mnar', label: 'MNAR' },
            ]}
          />
          <label className="w-control">
            <span className="w-control__label">
              Dropout by week 12 <span className="w-control__value">{Math.round((1 - sim.completed / sim.n) * 100)}%</span>
            </span>
            <input type="range" min={0} max={0.7} step={0.05} value={dropout} onChange={(e) => setDropout(Number(e.target.value))} />
          </label>
          <button type="button" className="btn btn--sm" onClick={() => setSeed((s) => s + 1)}>
            New trial
          </button>
          <table className="w-table">
            <thead>
              <tr>
                <th>Estimate of the week-12 difference</th>
                <th>mmHg</th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-active">
                <td>Truth (if nobody dropped out)</td>
                <td>{sim.truth.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Complete cases only</td>
                <td>{sim.completeCase.toFixed(2)}</td>
              </tr>
              <tr>
                <td>LOCF</td>
                <td>{sim.locf.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Uses all observed data (MMRM-style)</td>
                <td>{sim.mixed.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="w-explain">
        {mech === 'mcar' && 'MCAR: dropout is unrelated to anything. Every method is unbiased; you only lose precision. This is the mechanism people assume and almost never have.'}
        {mech === 'mar' && 'MAR: dropout depends on values you observed (subjects not responding by the previous visit leave). Complete-case analysis is biased, LOCF freezes people at their worst observed value, and a method that uses all observed data (MMRM, or multiple imputation under MAR) recovers the estimate.'}
        {mech === 'mnar' && 'MNAR: dropout depends on the value you did not get to see. No method based only on observed data is guaranteed unbiased — including MMRM. This is why regulators expect sensitivity analyses (tipping point, jump-to-reference) rather than a single number.'}{' '}
        Watch the gap between the solid (observed) and dashed (true) curves grow as dropout increases: the observed mean drifts because the subjects who remain are not the subjects who started.
      </div>
    </div>
  );
}
