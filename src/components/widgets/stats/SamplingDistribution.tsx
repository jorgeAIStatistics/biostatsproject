import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { Play, RotateCcw } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button, Segmented } from '../../ui';
import { mulberry32, normalGen } from '../../../lib/stats/random';
import { mean, sd } from '../../../lib/stats/descriptive';
import { AxisBottom, barPath, useWidth } from '../../charts/core';

type Pop = 'normal' | 'skewed' | 'bimodal';

const POPS: Record<Pop, { label: string; draw: (u: () => number, z: () => number) => number; mu: number; sigma: number; note: string }> = {
  normal: { label: 'Normal (e.g. SBP)', draw: (_u, z) => 130 + 15 * z(), mu: 130, sigma: 15, note: 'Systolic blood pressure, roughly normal.' },
  skewed: {
    label: 'Right-skewed (e.g. ALT)',
    draw: (_u, z) => Math.exp(3.1 + 0.55 * z()),
    mu: Math.exp(3.1 + (0.55 * 0.55) / 2),
    sigma: Math.sqrt((Math.exp(0.55 ** 2) - 1) * Math.exp(2 * 3.1 + 0.55 ** 2)),
    note: 'Liver enzymes are strongly right-skewed: a few subjects have values many times the median.',
  },
  bimodal: {
    label: 'Bimodal (two subgroups)',
    draw: (u, z) => (u() < 0.45 ? 95 + 8 * z() : 135 + 10 * z()),
    mu: 0.45 * 95 + 0.55 * 135,
    sigma: Math.sqrt(0.45 * (8 * 8 + 95 * 95) + 0.55 * (10 * 10 + 135 * 135) - (0.45 * 95 + 0.55 * 135) ** 2),
    note: 'Two subgroups with different means — the population is not normal at all.',
  },
};

export default function SamplingDistribution(_: WidgetProps) {
  void _;
  const [pop, setPop] = useState<Pop>('skewed');
  const [n, setN] = useState(25);
  const [reps, setReps] = useState(500);
  const [seed, setSeed] = useState(3);
  const [ref, width] = useWidth<HTMLDivElement>(560);

  const { sample, means, theoreticalSe } = useMemo(() => {
    const rand = mulberry32(seed);
    const z = normalGen(rand);
    const p = POPS[pop];
    const sample = Array.from({ length: 400 }, () => p.draw(rand, z));
    const means = Array.from({ length: reps }, () => mean(Array.from({ length: n }, () => p.draw(rand, z))));
    return { sample, means, theoreticalSe: p.sigma / Math.sqrt(n) };
  }, [pop, n, reps, seed]);

  const h = 130;
  const m = { top: 8, right: 10, bottom: 26, left: 10 };
  const hist = (values: number[], color: string, domain?: [number, number]) => {
    const lo = domain?.[0] ?? Math.min(...values);
    const hi = domain?.[1] ?? Math.max(...values);
    const bins = 28;
    const counts = new Array(bins).fill(0);
    for (const v of values) counts[Math.max(0, Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo || 1)) * bins)))]++;
    const x = scaleLinear().domain([lo, hi]).range([m.left, width - m.right]);
    const y = scaleLinear().domain([0, Math.max(...counts)]).range([h - m.bottom, m.top]);
    const bw = (width - m.left - m.right) / bins;
    return (
      <svg width={width} height={h} role="img">
        {counts.map((c, i) => (
          <path key={i} d={barPath(m.left + i * bw + 1, y(c), Math.max(1, bw - 2), y(0) - y(c), 3)} fill={color} />
        ))}
        <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} />
      </svg>
    );
  };

  const meanOfMeans = mean(means);
  const sdOfMeans = sd(means);
  const lo = Math.min(...means);
  const hi = Math.max(...means);
  const pad = (hi - lo) * 0.15 || 1;

  return (
    <div className="stack gap-4">
      <div className="w-grid">
        <div className="stack gap-3" style={{ minWidth: 0 }} ref={ref}>
          <div>
            <div className="eyebrow">One population (400 individuals)</div>
            {width > 0 && hist(sample, 'var(--viz-6)')}
            <div className="w-note">{POPS[pop].note} Population mean μ ≈ {POPS[pop].mu.toFixed(1)}, SD σ ≈ {POPS[pop].sigma.toFixed(1)}.</div>
          </div>
          <div>
            <div className="eyebrow">Sampling distribution of the mean ({reps} studies of n = {n})</div>
            {width > 0 && hist(means, 'var(--viz-1)', [lo - pad, hi + pad])}
            <div className="w-note">Each bar counts studies whose sample mean fell in that range — not individual people.</div>
          </div>
        </div>
        <div className="w-controls">
          <Segmented ariaLabel="Population" value={pop} onChange={setPop} options={(Object.keys(POPS) as Pop[]).map((k) => ({ value: k, label: POPS[k].label }))} />
          <label className="w-control">
            <span className="w-control__label">
              Sample size n <span className="w-control__value">{n}</span>
            </span>
            <input type="range" min={2} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              Number of studies <span className="w-control__value">{reps}</span>
            </span>
            <input type="range" min={50} max={2000} step={50} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
          </label>
          <Button size="sm" icon={<Play />} onClick={() => setSeed((s) => s + 1)}>
            Resample
          </Button>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">Mean of means</div>
              <div className="w-stat__value">{meanOfMeans.toFixed(2)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">SD of means</div>
              <div className="w-stat__value">{sdOfMeans.toFixed(2)}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">σ/√n</div>
              <div className="w-stat__value">{theoreticalSe.toFixed(2)}</div>
            </div>
          </div>
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => { setN(25); setReps(500); setSeed(3); }}>
            Reset
          </Button>
        </div>
      </div>
      <div className="w-explain">
        The spread of the sampling distribution is the <b>standard error</b>: the simulated SD of the study means ({sdOfMeans.toFixed(2)}) matches σ/√n ={' '}
        {theoreticalSe.toFixed(2)}. Two consequences you use constantly: quadrupling the sample size halves the standard error, and even for the skewed
        population the distribution of the <i>mean</i> becomes symmetric as n grows — which is why t-based intervals work for lab means but not for individual
        lab values.
      </div>
    </div>
  );
}
