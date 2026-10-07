import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { WidgetProps } from '../registry';
import { Segmented } from '../../ui';
import { mulberry32 } from '../../../lib/stats/random';

type Method = 'none' | 'bonferroni' | 'holm' | 'hochberg' | 'sequence';

const METHODS: { id: Method; label: string; note: string }[] = [
  { id: 'none', label: 'No adjustment', note: 'Each test at α — the family-wise error rate grows with the number of tests.' },
  { id: 'bonferroni', label: 'Bonferroni', note: 'Compare every p-value with α/k. Always controls FWER; conservative when tests are correlated.' },
  { id: 'holm', label: 'Holm', note: 'Step-down: order p-values, compare the smallest with α/k, the next with α/(k−1), … and stop at the first failure. Uniformly more powerful than Bonferroni, same guarantee.' },
  { id: 'hochberg', label: 'Hochberg', note: 'Step-up: start from the largest p-value with α/1, then α/2… Requires assumptions about dependence, but is more powerful when they hold.' },
  { id: 'sequence', label: 'Fixed sequence', note: 'Test in a pre-specified order at full α and stop at the first non-significant result. No penalty — but everything after a failure is untestable, which is exactly why PFS → OS ordering is specified before unblinding.' },
];

function adjust(pvals: number[], method: Method, alpha: number): boolean[] {
  const k = pvals.length;
  const idx = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const rej = new Array(k).fill(false);
  switch (method) {
    case 'none':
      return pvals.map((p) => p <= alpha);
    case 'bonferroni':
      return pvals.map((p) => p <= alpha / k);
    case 'holm': {
      for (let r = 0; r < k; r++) {
        if (idx[r].p <= alpha / (k - r)) rej[idx[r].i] = true;
        else break;
      }
      return rej;
    }
    case 'hochberg': {
      for (let r = k - 1; r >= 0; r--) {
        if (idx[r].p <= alpha / (k - r)) {
          for (let s = 0; s <= r; s++) rej[idx[s].i] = true;
          break;
        }
      }
      return rej;
    }
    case 'sequence': {
      for (let i = 0; i < k; i++) {
        if (pvals[i] <= alpha) rej[i] = true;
        else break;
      }
      return rej;
    }
  }
}

export default function MultiplicitySimulator(_: WidgetProps) {
  void _;
  const [k, setK] = useState(5);
  const [method, setMethod] = useState<Method>('none');
  const [alpha, setAlpha] = useState(0.05);
  const [seed, setSeed] = useState(5);
  const sims = 2000;

  const { fwer, power, example } = useMemo(() => {
    const rand = mulberry32(seed);
    let anyFalse = 0;
    let trueRejected = 0;
    let example: number[] = [];
    for (let s = 0; s < sims; s++) {
      // All null except the first endpoint, which has a real effect (p ~ Beta(0.35,1): usually small).
      const pv = Array.from({ length: k }, (_, i) => (i === 0 ? Math.pow(rand(), 1 / 0.35) : rand()));
      const rej = adjust(pv, method, alpha);
      if (rej.slice(1).some(Boolean)) anyFalse++;
      if (rej[0]) trueRejected++;
      if (s === 0) example = pv;
    }
    return { fwer: anyFalse / sims, power: trueRejected / sims, example };
  }, [k, method, alpha, seed]);

  const exampleRej = adjust(example, method, alpha);

  return (
    <div className="stack gap-3">
      <div className="w-grid">
        <div className="stack gap-3" style={{ minWidth: 0 }}>
          <table className="w-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Truth</th>
                <th>p-value</th>
                <th>Declared significant?</th>
              </tr>
            </thead>
            <tbody>
              {example.map((p, i) => (
                <tr key={i} className={clsx(exampleRej[i] && i > 0 && 'is-active')}>
                  <td>{i === 0 ? 'Primary (real effect)' : `Secondary ${i} (no effect)`}</td>
                  <td>{i === 0 ? 'effect' : 'null'}</td>
                  <td>{p.toFixed(4)}</td>
                  <td style={{ color: exampleRej[i] ? (i === 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text-3)' }}>
                    {exampleRej[i] ? (i === 0 ? 'yes (true positive)' : 'yes — false positive') : 'no'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="w-stats">
            <div className="w-stat">
              <div className="w-stat__label">Family-wise error rate</div>
              <div className="w-stat__value" style={{ color: fwer > alpha * 1.3 ? 'var(--danger)' : 'var(--success)' }}>
                {(fwer * 100).toFixed(1)}%
              </div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Power for the real effect</div>
              <div className="w-stat__value">{(power * 100).toFixed(1)}%</div>
            </div>
            <div className="w-stat">
              <div className="w-stat__label">Target α</div>
              <div className="w-stat__value">{(alpha * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
        <div className="w-controls">
          <Segmented ariaLabel="Method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m.id, label: m.label }))} />
          <label className="w-control">
            <span className="w-control__label">
              Number of endpoints <span className="w-control__value">{k}</span>
            </span>
            <input type="range" min={2} max={12} value={k} onChange={(e) => setK(Number(e.target.value))} />
          </label>
          <label className="w-control">
            <span className="w-control__label">
              α <span className="w-control__value">{alpha.toFixed(2)}</span>
            </span>
            <input type="range" min={0.01} max={0.1} step={0.01} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
          </label>
          <button type="button" className="btn btn--sm" onClick={() => setSeed((s) => s + 1)}>
            New simulation
          </button>
          <div className="w-note">{sims.toLocaleString()} simulated trials; one is shown in the table.</div>
        </div>
      </div>
      <div className="w-explain">
        {METHODS.find((m) => m.id === method)!.note} With {k} independent tests and no adjustment the chance of at least one false positive is
        1 − (1 − α)<sup>{k - 1}</sup> ≈ {((1 - (1 - alpha) ** (k - 1)) * 100).toFixed(1)}% — the simulation gives {(fwer * 100).toFixed(1)}%. This is why a
        SAP fixes the testing strategy (for CBX417-301: PFS first, and OS is tested at full α only if PFS is significant) <i>before</i> unblinding, and why
        "we also looked at 14 secondary endpoints" is not a defence.
      </div>
    </div>
  );
}
