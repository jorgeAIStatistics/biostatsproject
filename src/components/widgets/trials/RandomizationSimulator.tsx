import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { RotateCcw } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button, Segmented } from '../../ui';
import { mulberry32 } from '../../../lib/stats/random';
import { AxisBottom, AxisLeft, ChartTooltip, useWidth, type TooltipState } from '../../charts/core';

type Method = 'simple' | 'block' | 'stratified';

interface Alloc {
  i: number;
  arm: 0 | 1;
  stratum: string;
  /** Could the next allocation be guessed with certainty before it happened? */
  predictable: boolean;
}

const STRATA = ['ECOG 0 / prior IO: Y', 'ECOG 0 / prior IO: N', 'ECOG 1 / prior IO: Y', 'ECOG 1 / prior IO: N'];

function allocate(n: number, method: Method, blockSize: number, seed: number): Alloc[] {
  const rand = mulberry32(seed);
  const out: Alloc[] = [];
  const queues = new Map<string, (0 | 1)[]>();
  const newBlock = (): (0 | 1)[] => {
    const half = blockSize / 2;
    const b: (0 | 1)[] = [...Array(half).fill(0), ...Array(half).fill(1)];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  for (let i = 0; i < n; i++) {
    const stratum = method === 'stratified' ? STRATA[Math.floor(rand() * STRATA.length)] : 'All subjects';
    if (method === 'simple') {
      out.push({ i, arm: rand() < 0.5 ? 0 : 1, stratum, predictable: false });
      continue;
    }
    let q = queues.get(stratum);
    if (!q || q.length === 0) {
      q = newBlock();
      queues.set(stratum, q);
    }
    // Predictable when only one arm remains in the open block.
    const remaining = new Set(q);
    const predictable = remaining.size === 1;
    out.push({ i, arm: q.shift()!, stratum, predictable });
  }
  return out;
}

export default function RandomizationSimulator(_: WidgetProps) {
  void _;
  const [n, setN] = useState(60);
  const [method, setMethod] = useState<Method>('block');
  const [blockSize, setBlockSize] = useState(4);
  const [seed, setSeed] = useState(7);
  const allocs = useMemo(() => allocate(n, method, blockSize, seed), [n, method, blockSize, seed]);
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const imbalance = useMemo(() => {
    let d = 0;
    return allocs.map((a) => {
      d += a.arm === 0 ? 1 : -1;
      return { i: a.i + 1, d };
    });
  }, [allocs]);
  const counts = [allocs.filter((a) => a.arm === 0).length, allocs.filter((a) => a.arm === 1).length];
  const predictable = allocs.filter((a) => a.predictable).length;
  const byStratum = STRATA.map((s) => ({
    s,
    a: allocs.filter((x) => x.stratum === s && x.arm === 0).length,
    b: allocs.filter((x) => x.stratum === s && x.arm === 1).length,
  })).filter((x) => x.a + x.b > 0);

  const h = 140;
  const m = { top: 10, right: 12, bottom: 28, left: 36 };
  const x = scaleLinear().domain([1, Math.max(2, n)]).range([m.left, width - m.right]);
  const maxAbs = Math.max(3, ...imbalance.map((p) => Math.abs(p.d)));
  const y = scaleLinear().domain([-maxAbs, maxAbs]).nice().range([h - m.bottom, m.top]);
  const path = imbalance.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.i)},${y(p.d)}`).join(' ');

  return (
    <div className="stack gap-4">
      <div className="w-grid">
        <div className="stack gap-3" style={{ minWidth: 0 }}>
          <div className="alloc-strip" aria-label="Allocation sequence">
            {allocs.map((a) => (
              <span
                key={a.i}
                className="alloc-cell"
                title={`Subject ${a.i + 1}: ${a.arm === 0 ? 'CBX-417' : 'Placebo'}${method !== 'simple' ? ` · ${a.stratum}` : ''}`}
                style={{ background: a.arm === 0 ? 'var(--viz-1)' : 'var(--viz-2)', outline: a.predictable ? '2px solid var(--danger)' : undefined }}
              />
            ))}
          </div>
          <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
            <svg width={width} height={h} role="img" aria-label="Cumulative imbalance between arms">
              <AxisLeft scale={y} x={m.left} ticks={5} grid gridWidth={width - m.right - m.left} />
              <AxisBottom scale={x} y={h - m.bottom} ticks={6} width={width} label="Subjects randomized" />
              <line x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" />
              <path d={path} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" />
              <rect
                className="chart-hit"
                x={m.left}
                y={m.top}
                width={Math.max(0, width - m.right - m.left)}
                height={h - m.bottom - m.top}
                onMouseMove={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  const idx = Math.max(0, Math.min(imbalance.length - 1, Math.round(x.invert(e.clientX - rect.left + m.left) - 1)));
                  const p = imbalance[idx];
                  setTip({ x: x(p.i), y: y(p.d), content: <>After {p.i} subjects: imbalance {p.d > 0 ? '+' : ''}{p.d}</> });
                }}
              />
            </svg>
            <ChartTooltip state={tip} />
          </div>
          <div className="w-note">Imbalance = (CBX-417 count − placebo count) as subjects are randomized. Red outlines mark allocations that were predictable from the open block.</div>
        </div>
        <div className="w-controls">
          <Segmented
            ariaLabel="Method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'block', label: 'Blocks' },
              { value: 'stratified', label: 'Stratified' },
            ]}
          />
          <label className="w-control">
            <span className="w-control__label">
              Subjects <span className="w-control__value">{n}</span>
            </span>
            <input type="range" min={20} max={200} step={10} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
          {method !== 'simple' && (
            <label className="w-control">
              <span className="w-control__label">
                Block size <span className="w-control__value">{blockSize}</span>
              </span>
              <input type="range" min={2} max={8} step={2} value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))} />
            </label>
          )}
          <Button size="sm" icon={<RotateCcw />} onClick={() => setSeed((s) => s + 1)}>
            New randomization list
          </Button>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">CBX-417</div>
              <div className="w-stat__value">{counts[0]}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Placebo</div>
              <div className="w-stat__value">{counts[1]}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Final imbalance</div>
              <div className="w-stat__value">{Math.abs(counts[0] - counts[1])}</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Predictable</div>
              <div className="w-stat__value">{predictable}</div>
            </div>
          </div>
          {method === 'stratified' && byStratum.length > 0 && (
            <table className="w-table">
              <thead>
                <tr>
                  <th>Stratum</th>
                  <th>CBX</th>
                  <th>PBO</th>
                </tr>
              </thead>
              <tbody>
                {byStratum.map((s) => (
                  <tr key={s.s}>
                    <td style={{ fontSize: 11 }}>{s.s}</td>
                    <td>{s.a}</td>
                    <td>{s.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="w-explain">
        {method === 'simple' &&
          'Simple randomization is unpredictable but drifts: with 60 subjects an imbalance of 6–10 is unremarkable, and imbalance costs power. Nothing keeps the arms balanced within sites or prognostic groups.'}
        {method === 'block' &&
          `Permuted blocks of ${blockSize} force the arms back into balance every ${blockSize} subjects — at most ${blockSize / 2} apart at any time. The price is predictability: the last allocation in a block is guessable if someone tracks assignments, which is why block sizes are kept confidential (and often varied).`}
        {method === 'stratified' &&
          'Stratified permuted blocks balance within each stratum, so the prognostic factors used for stratification stay comparable between arms. Those same factors then appear in the analysis model (stratified log-rank / stratified Cox) — that is why the SAP lists them.'}
      </div>
    </div>
  );
}
