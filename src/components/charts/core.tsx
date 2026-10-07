/**
 * Minimal SVG chart kit shared by the dashboard and all interactive widgets.
 *
 * Conventions (see the dataviz method): categorical colours come from
 * --viz-1…8 in fixed order; text uses text tokens, never series colours;
 * bars have 4px rounded data-ends anchored to the baseline and 2px gaps;
 * lines are 2px; markers ≥ 8px; every chart has a hover tooltip; grid and
 * axes are recessive.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ScaleLinear, ScaleBand } from 'd3-scale';
import './charts.css';

export const SERIES = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)', 'var(--viz-7)', 'var(--viz-8)'];

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Observes the width of a container for responsive charts. */
export function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function AxisBottom({
  scale,
  y,
  ticks = 6,
  format,
  label,
  width,
}: {
  scale: ScaleLinear<number, number>;
  y: number;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
  width: number;
}) {
  const values = scale.ticks(ticks);
  const f = format ?? scale.tickFormat(ticks);
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      <line x1={scale.range()[0]} x2={scale.range()[1]} y1={0} y2={0} className="axis__domain" />
      {values.map((v) => (
        <g key={v} transform={`translate(${scale(v)},0)`}>
          <line y2={4} className="axis__tick" />
          <text y={16} textAnchor="middle" className="axis__label">
            {f(v)}
          </text>
        </g>
      ))}
      {label && (
        <text x={(scale.range()[0] + Math.min(width, scale.range()[1])) / 2} y={34} textAnchor="middle" className="axis__title">
          {label}
        </text>
      )}
    </g>
  );
}

export function AxisLeft({
  scale,
  x,
  ticks = 5,
  format,
  label,
  grid,
  gridWidth,
}: {
  scale: ScaleLinear<number, number>;
  x: number;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
  grid?: boolean;
  gridWidth?: number;
}) {
  const values = scale.ticks(ticks);
  const f = format ?? scale.tickFormat(ticks);
  const [y0, y1] = scale.range();
  return (
    <g className="axis" transform={`translate(${x},0)`}>
      {values.map((v) => (
        <g key={v} transform={`translate(0,${scale(v)})`}>
          {grid && <line x2={gridWidth ?? 0} className="axis__grid" />}
          <text x={-8} dy="0.32em" textAnchor="end" className="axis__label">
            {f(v)}
          </text>
        </g>
      ))}
      {label && (
        <text transform={`translate(${-x + 12},${(y0 + y1) / 2}) rotate(-90)`} textAnchor="middle" className="axis__title">
          {label}
        </text>
      )}
    </g>
  );
}

export function AxisBand({ scale, y, format }: { scale: ScaleBand<string>; y: number; format?: (v: string) => string }) {
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      {scale.domain().map((d) => (
        <text key={d} x={(scale(d) ?? 0) + scale.bandwidth() / 2} y={16} textAnchor="middle" className="axis__label">
          {format ? format(d) : d}
        </text>
      ))}
    </g>
  );
}

/** Path for a bar with 4px rounded corners at the data end only (vertical bars). */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Horizontal bar with the rounded end on the right. */
export function hbarPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Tooltip positioned inside a relatively positioned chart container. */
export function ChartTooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  return (
    <div className="chart-tooltip" style={{ left: state.x, top: state.y }} role="status">
      {state.content}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="chart-legend" role="list">
      {items.map((it) => (
        <span key={it.label} className="chart-legend__item" role="listitem">
          <span className="chart-legend__swatch" style={{ background: it.dashed ? 'transparent' : it.color, borderColor: it.color, borderStyle: it.dashed ? 'dashed' : 'solid' }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
