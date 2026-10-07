import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Row, Cell } from '../../lib/datasets';
import { sortRows } from '../../lib/datasets';
import { useSettings } from '../../state/settings';
import './data.css';

export interface ColumnInfo {
  name: string;
  label?: string;
  type?: 'char' | 'num' | 'date' | 'datetime';
}

interface DataTableProps {
  columns: (string | ColumnInfo)[];
  rows: Row[];
  /** Max height of the scroll area (px). */
  maxHeight?: number;
  /** Show the 1-based row number column. */
  rowNumbers?: boolean;
  sortable?: boolean;
  onRowClick?: (row: Row, index: number) => void;
  highlightRows?: Set<number>;
  /** Cells to emphasise: key `${rowIndex}:${column}`. */
  highlightCells?: Set<string>;
  cellClassName?: (row: Row, column: string, index: number) => string | undefined;
  renderCell?: (value: Cell, row: Row, column: string) => ReactNode;
  emptyMessage?: string;
  /** Force virtualization on/off (auto when > 200 rows). */
  virtualize?: boolean;
  caption?: ReactNode;
  className?: string;
}

function norm(c: string | ColumnInfo): ColumnInfo {
  return typeof c === 'string' ? { name: c } : c;
}

function estimateWidth(col: ColumnInfo, rows: Row[]): number {
  let maxLen = col.name.length + 2;
  const sample = rows.length > 400 ? rows.slice(0, 400) : rows;
  for (const r of sample) {
    const v = r[col.name];
    if (v !== null && v !== undefined) maxLen = Math.max(maxLen, String(v).length);
  }
  return Math.min(360, Math.max(64, Math.round(maxLen * 7.4 + 26)));
}

export function isNumericColumn(col: ColumnInfo, rows: Row[]): boolean {
  if (col.type) return col.type === 'num';
  const sample = rows.slice(0, 200).map((r) => r[col.name]).filter((v) => v !== null);
  return sample.length > 0 && sample.every((v) => typeof v === 'number');
}

export function formatCell(v: Cell, numeric: boolean): string {
  if (v === null || v === undefined) return numeric ? '.' : '';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    const abs = Math.abs(v);
    return abs !== 0 && (abs < 1e-4 || abs >= 1e9) ? v.toExponential(4) : String(Number(v.toPrecision(10)));
  }
  return v;
}

export function DataTable({
  columns: rawColumns,
  rows,
  maxHeight = 520,
  rowNumbers = true,
  sortable = true,
  onRowClick,
  highlightRows,
  highlightCells,
  cellClassName,
  renderCell,
  emptyMessage = 'No rows',
  virtualize,
  caption,
  className,
}: DataTableProps) {
  const dense = useSettings((s) => s.denseTables);
  const columns = useMemo(() => rawColumns.map(norm), [rawColumns]);
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const numeric = useMemo(() => new Map(columns.map((c) => [c.name, isNumericColumn(c, rows)])), [columns, rows]);
  const widths = useMemo(() => columns.map((c) => estimateWidth(c, rows)), [columns, rows]);

  // Keep original indices so highlights survive sorting.
  const indexed = useMemo(() => rows.map((r, i) => ({ r, i })), [rows]);
  const sorted = useMemo(() => {
    if (!sort) return indexed;
    const s = sortRows(
      indexed.map(({ r, i }) => ({ ...r, __i: i })),
      sort.col,
      sort.desc,
    );
    return s.map((r) => ({ r: rows[r.__i as number], i: r.__i as number }));
  }, [indexed, rows, sort]);

  const rowH = dense ? 26 : 32;
  const numW = rowNumbers ? Math.max(44, String(rows.length).length * 8 + 22) : 0;
  const template = `${rowNumbers ? `${numW}px ` : ''}${widths.map((w) => `${w}px`).join(' ')}`;
  const totalWidth = numW + widths.reduce((a, b) => a + b, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const useVirtual = virtualize ?? rows.length > 200;
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 12,
    enabled: useVirtual,
  });

  const onHeader = (col: string) => {
    if (!sortable) return;
    setSort((prev) => (!prev || prev.col !== col ? { col, desc: false } : prev.desc ? null : { col, desc: true }));
  };

  const renderRow = (entry: { r: Row; i: number }, style?: React.CSSProperties, key?: React.Key) => (
    <div
      key={key}
      role="row"
      className={clsx('dt__row', highlightRows?.has(entry.i) && 'is-highlight', onRowClick && 'is-clickable')}
      style={{ gridTemplateColumns: template, height: rowH, ...style }}
      onClick={onRowClick ? () => onRowClick(entry.r, entry.i) : undefined}
    >
      {rowNumbers && (
        <div role="cell" className="dt__cell dt__cell--num">
          {entry.i + 1}
        </div>
      )}
      {columns.map((c) => {
        const v = entry.r[c.name];
        const isNum = numeric.get(c.name) ?? false;
        const extra = cellClassName?.(entry.r, c.name, entry.i);
        return (
          <div
            key={c.name}
            role="cell"
            className={clsx(
              'dt__cell',
              isNum && 'is-numeric',
              (v === null || v === undefined) && 'is-missing',
              highlightCells?.has(`${entry.i}:${c.name}`) && 'is-highlight',
              extra,
            )}
            title={v === null || v === undefined ? 'missing' : String(v)}
          >
            {renderCell ? renderCell(v, entry.r, c.name) : formatCell(v, isNum)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={clsx('dt', dense && 'dt--dense', className)}>
      {caption && <div className="dt__caption">{caption}</div>}
      <div ref={scrollRef} className="dt__scroll" style={{ maxHeight }} role="table" aria-rowcount={rows.length}>
        <div style={{ minWidth: totalWidth }}>
          <div role="row" className="dt__head" style={{ gridTemplateColumns: template }}>
            {rowNumbers && <div role="columnheader" className="dt__th dt__th--num">#</div>}
            {columns.map((c) => (
              <div
                key={c.name}
                role="columnheader"
                className={clsx('dt__th', numeric.get(c.name) && 'is-numeric', sortable && 'is-sortable')}
                onClick={() => onHeader(c.name)}
                title={c.label ? `${c.name} — ${c.label}` : c.name}
                aria-sort={sort?.col === c.name ? (sort.desc ? 'descending' : 'ascending') : undefined}
              >
                <span className="dt__th-name">{c.name}</span>
                {sort?.col === c.name && (sort.desc ? <ArrowDown /> : <ArrowUp />)}
              </div>
            ))}
          </div>
          {sorted.length === 0 ? (
            <div className="dt__empty">{emptyMessage}</div>
          ) : useVirtual ? (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) =>
                renderRow(sorted[vi.index], { position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }, vi.key),
              )}
            </div>
          ) : (
            sorted.map((entry) => renderRow(entry, undefined, entry.i))
          )}
        </div>
      </div>
    </div>
  );
}
