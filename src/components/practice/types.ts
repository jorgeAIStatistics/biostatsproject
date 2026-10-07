import type { ReactNode } from 'react';
import type { ItemInfo } from '../../content/registry';
import type { ModeId } from '../../content/schema';

export interface CheckResult {
  /** 0..1 */
  score: number;
  /** Short verdict detail shown under the result banner. */
  detail?: ReactNode;
}

export interface FormatProps<I extends ItemInfo = ItemInfo> {
  item: I;
  mode: ModeId;
  /** True after the learner has checked (inputs become read-only). */
  locked: boolean;
  /** True after the solution was revealed (formats may show the answer). */
  revealed: boolean;
  onCheck: (r: CheckResult) => void;
}

/** Fisher–Yates shuffle with a deterministic seed per item (stable across renders). */
export function seededShuffle<T>(arr: T[], seedText: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const FORMAT_LABELS: Record<string, string> = {
  mcq: 'Multiple choice',
  multi: 'Select all that apply',
  numeric: 'Calculation',
  text: 'Short answer',
  mapping: 'Mapping',
  order: 'Ordering',
  classify: 'Classification',
  code: 'Coding',
  sql: 'SQL (runs live)',
  log: 'Log review',
  hotspot: 'Find the bug',
  diff: 'QC comparison',
  open: 'Explain',
};

export const MODE_LABELS: Record<ModeId, string> = {
  check: 'Knowledge check',
  guided: 'Guided practice',
  independent: 'Independent',
  debug: 'Debug',
  qc: 'QC',
  interview: 'Interview',
  speed: 'Speed drill',
  case: 'Case study',
  boss: 'Boss battle',
};
