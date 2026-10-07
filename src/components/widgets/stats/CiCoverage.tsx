import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { Play } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button } from '../../ui';
import { mulberry32, normalGen } from '../../../lib/stats/random';
import { mean, sd } from '../../../lib/stats/descriptive';
import { tQuantile } from '../../../lib/stats/distributions';
import { AxisBottom, useWidth } from '../../charts/core';

const MU = 130;
const SIGMA = 15;

export default function CiCoverage(_: WidgetProps) {
  void _;
  const [n, setN] = useState(20);
  const [conf, setConf] = useState(0.95);
  const [seed, setSeed] = useState(11);
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const studies = 100;

  const intervals = useMemo(() => {
    const rand = mulberry32(seed);
    const z = normalGen(rand);
    return Array.from({ length: studies }, () => {
      const x = Array.from({ length: n }, () => MU + SIGMA * z());
      const m = mean(x);
      const se = sd(x) / Math.sqrt(n);
      const t = tQuantile(1 - (1 - conf) / 2, n - 1);
      return { m, lo: m - t * se, hi: m + t * se };
    });
  }, [n, conf, seed]);
  const covered = intervals.filter((i) => i.lo <= MU && MU <= i.hi).length;

  const h = 300;
  const m = { top: 8, right: 14, bottom: 28, left: 14 };
  const lo = Math.min(...intervals.map((i) => i.lo));
  const hi = Math.max(...intervals.map((i) => i.hi));
  const x = scaleLinear().domain([lo, hi]).range([m.left, width - m.right]);
  const rowH = (h - m.top - m.bottom) / studies;

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="chart" ref={ref}>
          <svg width={width} height={h} role="img" aria-label={`${studies} confidence intervals from repeated studies`}>
            <line x1={x(MU)} x2={x(MU)} y1={m.top} y2={h - m.bottom} stroke="var(--text-2)" strokeWidth={1.5} strokeDasharray="4 3" />
            {intervals.map((iv, i) => {
              const yy = m.top + i * rowH + rowH / 2;
              const ok = iv.lo <= MU && MU <= iv.hi;
              return (
                <g key={i}>
                  <line x1={x(iv.lo)} x2={x(iv.hi)} y1={yy} y2={yy} stroke={ok ? 'var(--viz-1)' : 'var(--viz-8)'} strokeWidth={Math.max(1.2, rowH - 1.2)} opacity={ok ? 0.55 : 0.95} />
                </g>
              );
            })}
            <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label="mean systolic blood pressure (mmHg)" />
            <text x={x(MU) + 6} y={m.top + 10} className="axis__label" fill="var(--text-2)">
              true μ = {MU}
            </text>
          </svg>
        </div>
        <div className="w-controls">
          <label className="w-control">
            <span className="w-control__label">
              Sample size n <span className="w-control__value">{n}</span>
            </span>
            <input type="range" min={5} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              Confidence level <span className="w-control__value">{Math.round(conf * 100)}%</span>
            </span>
            <input type="range" min={0.5} max={0.99} step={0.01} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
          </label>
          <Button size="sm" icon={<Play />} onClick={() => setSeed((s) => s + 1)}>
            Run 100 new studies
          </Button>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">Contain μ</div>
              <div className="w-stat__value">{covered}/100</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Nominal</div>
              <div className="w-stat__value">{Math.round(conf * 100)}%</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Mean width</div>
              <div className="w-stat__value">{(intervals.reduce((s, i) => s + (i.hi - i.lo), 0) / studies).toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-explain">
        Each horizontal bar is one study's {Math.round(conf * 100)}% confidence interval; red ones miss the true mean. The confidence level describes the
        <b> procedure</b>, not a single interval: about {Math.round(conf * 100)} of every 100 intervals built this way capture μ. Once you have computed one
        interval, μ is either inside it or not — “95% probability that μ is in this interval” is the classic misstatement. Notice also what the sliders do:
        larger n narrows intervals without changing coverage; a higher confidence level widens them.
      </div>
    </div>
  );
}
