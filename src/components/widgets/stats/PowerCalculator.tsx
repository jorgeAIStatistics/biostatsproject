import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import type { WidgetProps } from '../registry';
import { Segmented } from '../../ui';
import { nPerGroupMeans, powerMeans, nPerGroupProportions, schoenfeldEvents } from '../../../lib/stats/tests';
import { normalQuantile, normalCdf } from '../../../lib/stats/distributions';
import { AxisBottom, AxisLeft, useWidth } from '../../charts/core';

type Endpoint = 'means' | 'proportions' | 'survival';

export default function PowerCalculator({ props }: WidgetProps) {
  const [endpoint, setEndpoint] = useState<Endpoint>((props.endpoint as Endpoint) ?? 'means');
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.9);
  // means
  const [delta, setDelta] = useState(5);
  const [sdv, setSdv] = useState(11);
  // proportions
  const [p1, setP1] = useState(0.27);
  const [p2, setP2] = useState(0.14);
  // survival
  const [hr, setHr] = useState(0.7);
  const [eventRate, setEventRate] = useState(0.8);
  const [ref, width] = useWidth<HTMLDivElement>(520);

  const result = useMemo(() => {
    if (endpoint === 'means') {
      const n = nPerGroupMeans(delta, sdv, alpha, power);
      return { n: Math.ceil(n), total: Math.ceil(n) * 2, detail: `${Math.ceil(n)} per group` };
    }
    if (endpoint === 'proportions') {
      const n = nPerGroupProportions(p1, p2, alpha, power);
      return { n: Math.ceil(n), total: Math.ceil(n) * 2, detail: `${Math.ceil(n)} per group` };
    }
    const events = schoenfeldEvents(hr, alpha, power);
    const total = events / eventRate;
    return { n: Math.ceil(events), total: Math.ceil(total), detail: `${Math.ceil(events)} events` };
  }, [endpoint, alpha, power, delta, sdv, p1, p2, hr, eventRate]);

  const curve = useMemo(() => {
    const xs: { x: number; y: number }[] = [];
    if (endpoint === 'means') {
      for (let n = 5; n <= 400; n += 5) xs.push({ x: n, y: powerMeans(delta, sdv, n, alpha) });
    } else if (endpoint === 'proportions') {
      for (let n = 10; n <= 800; n += 10) {
        const za = normalQuantile(1 - alpha / 2);
        const pbar = (p1 + p2) / 2;
        const se0 = Math.sqrt(2 * pbar * (1 - pbar) / n);
        const se1 = Math.sqrt((p1 * (1 - p1) + p2 * (1 - p2)) / n);
        xs.push({ x: n, y: normalCdf((Math.abs(p1 - p2) - za * se0) / se1) });
      }
    } else {
      for (let d = 20; d <= 800; d += 10) {
        const za = normalQuantile(1 - alpha / 2);
        xs.push({ x: d, y: normalCdf(Math.abs(Math.log(hr)) * Math.sqrt(d / 4) - za) });
      }
    }
    return xs;
  }, [endpoint, delta, sdv, alpha, p1, p2, hr]);

  const h = 200;
  const m = { top: 12, right: 14, bottom: 36, left: 46 };
  const x = scaleLinear().domain([curve[0].x, curve[curve.length - 1].x]).range([m.left, width - m.right]);
  const y = scaleLinear().domain([0, 1]).range([h - m.bottom, m.top]);
  const l = line<{ x: number; y: number }>().x((d) => x(d.x)).y((d) => y(d.y));

  return (
    <div className="stack gap-3">
      <Segmented
        ariaLabel="Endpoint"
        value={endpoint}
        onChange={setEndpoint}
        options={[
          { value: 'means', label: 'Two means' },
          { value: 'proportions', label: 'Two proportions' },
          { value: 'survival', label: 'Time to event' },
        ]}
      />
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label="Power curve">
            <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} format={(v) => `${Math.round(v * 100)}%`} label="power" />
            <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label={endpoint === 'survival' ? 'events' : 'subjects per group'} />
            <line x1={m.left} x2={width - m.right} y1={y(power)} y2={y(power)} stroke="var(--viz-2)" strokeDasharray="4 3" />
            <path d={l(curve) ?? ''} fill="none" stroke="var(--viz-1)" strokeWidth={2} />
            <circle cx={x(Math.min(result.n, curve[curve.length - 1].x))} cy={y(power)} r={5} fill="var(--viz-1)" className="chart-mark-ring" />
          </svg>
        </div>
        <div className="w-controls">
          <label className="w-control">
            <span className="w-control__label">
              Two-sided α <span className="w-control__value">{alpha.toFixed(3)}</span>
            </span>
            <input type="range" min={0.005} max={0.1} step={0.005} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              Power <span className="w-control__value">{Math.round(power * 100)}%</span>
            </span>
            <input type="range" min={0.5} max={0.99} step={0.01} value={power} onChange={(e) => setPower(Number(e.target.value))} />
          </label>
          {endpoint === 'means' && (
            <>
              <label className="w-control">
                <span className="w-control__label">
                  Difference to detect <span className="w-control__value">{delta.toFixed(1)}</span>
                </span>
                <input type="range" min={1} max={20} step={0.5} value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
              </label>
              <label className="w-control">
                <span className="w-control__label">
                  SD <span className="w-control__value">{sdv.toFixed(1)}</span>
                </span>
                <input type="range" min={2} max={30} step={0.5} value={sdv} onChange={(e) => setSdv(Number(e.target.value))} />
              </label>
            </>
          )}
          {endpoint === 'proportions' && (
            <>
              <label className="w-control">
                <span className="w-control__label">
                  Response rate, treatment <span className="w-control__value">{Math.round(p1 * 100)}%</span>
                </span>
                <input type="range" min={0.05} max={0.9} step={0.01} value={p1} onChange={(e) => setP1(Number(e.target.value))} />
              </label>
              <label className="w-control">
                <span className="w-control__label">
                  Response rate, control <span className="w-control__value">{Math.round(p2 * 100)}%</span>
                </span>
                <input type="range" min={0.01} max={0.9} step={0.01} value={p2} onChange={(e) => setP2(Number(e.target.value))} />
              </label>
            </>
          )}
          {endpoint === 'survival' && (
            <>
              <label className="w-control">
                <span className="w-control__label">
                  Hazard ratio <span className="w-control__value">{hr.toFixed(2)}</span>
                </span>
                <input type="range" min={0.4} max={0.95} step={0.01} value={hr} onChange={(e) => setHr(Number(e.target.value))} />
              </label>
              <label className="w-control">
                <span className="w-control__label">
                  Expected event rate by cutoff <span className="w-control__value">{Math.round(eventRate * 100)}%</span>
                </span>
                <input type="range" min={0.3} max={1} step={0.01} value={eventRate} onChange={(e) => setEventRate(Number(e.target.value))} />
              </label>
            </>
          )}
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">{endpoint === 'survival' ? 'Events required' : 'Per group'}</div>
              <div className="w-stat__value">{result.n}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Total subjects</div>
              <div className="w-stat__value">{result.total}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-explain">
        {endpoint === 'means' && (
          <>
            n per group = 2(z<sub>1−α/2</sub> + z<sub>1−β</sub>)²σ²/Δ² = 2({normalQuantile(1 - alpha / 2).toFixed(3)} + {normalQuantile(power).toFixed(3)})² ×{' '}
            {sdv}² / {delta}² = <b>{result.n}</b>. Halving the difference you want to detect multiplies the sample size by four.
          </>
        )}
        {endpoint === 'proportions' && (
          <>
            With {Math.round(p1 * 100)}% vs {Math.round(p2 * 100)}%, you need <b>{result.n}</b> per group. Response-rate endpoints are expensive: small absolute
            differences need large trials.
          </>
        )}
        {endpoint === 'survival' && (
          <>
            Schoenfeld: events = 4(z<sub>1−α/2</sub> + z<sub>1−β</sub>)² / (ln HR)² = 4({normalQuantile(1 - alpha / 2).toFixed(3)} +{' '}
            {normalQuantile(power).toFixed(3)})² / (ln {hr.toFixed(2)})² = <b>{result.n}</b> events. Power depends on the number of <i>events</i>, not the number
            of subjects — you enrol {result.total} subjects only to accumulate those events by the data cutoff. This is exactly the CBX417-301 calculation:
            HR 0.70, 90% power, α 0.05 → 331 PFS events.
          </>
        )}
      </div>
    </div>
  );
}
