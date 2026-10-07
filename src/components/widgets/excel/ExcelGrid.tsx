import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CircleCheck, CircleX, Eye, RotateCcw } from 'lucide-react';
import type { WidgetProps } from '../registry';
import { Button, Loading } from '../../ui';
import { useSheets } from '../../../content/registry';
import type { Sheet } from '../../../content/schema';
import { evaluateFormula, formatValue, indexToCol, parseRef, cellName, ExcelError, type CellValue, type EvalValue } from '../../../lib/excel/engine';
import { Markdown } from '../../content/Markdown';
import { DEFAULT_SHEET } from './defaultSheet';

type CellMap = Record<string, CellValue>;

export default function ExcelGrid({ props }: WidgetProps) {
  const sheets = useSheets();
  const sheet = (props.sheet && sheets?.get(props.sheet)) || DEFAULT_SHEET;
  const [edits, setEdits] = useState<CellMap>({});
  const [selected, setSelected] = useState('A1');
  const [draft, setDraft] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const nCols = Math.max(sheet.columns.length + 2, 8);
  const nRows = sheet.rows.length + 6;

  const base = useMemo(() => {
    const map: CellMap = {};
    sheet.columns.forEach((c, j) => (map[cellName(0, j)] = c));
    sheet.rows.forEach((row, i) => row.forEach((v, j) => (map[cellName(i + 1, j)] = (v ?? null) as CellValue)));
    return map;
  }, [sheet]);

  const grid = useMemo(
    () => ({
      rows: nRows,
      cols: nCols,
      get: (row: number, col: number): CellValue => {
        const k = cellName(row, col);
        return k in edits ? edits[k] : (base[k] ?? null);
      },
    }),
    [edits, base, nRows, nCols],
  );

  const valueOf = (key: string): EvalValue => {
    const a = parseRef(key);
    if (!a) return null;
    const raw = grid.get(a.row, a.col);
    if (typeof raw === 'string' && raw.startsWith('=')) return evaluateFormula(raw, grid);
    return raw;
  };

  const setCell = (key: string, value: string) => {
    const v: CellValue = value === '' ? null : value.startsWith('=') ? value : Number.isFinite(Number(value)) && value.trim() !== '' ? Number(value) : value;
    setEdits((e) => ({ ...e, [key]: v }));
  };

  const taskStatus = (t: Sheet['tasks'][number]) => {
    const raw = grid.get(parseRef(t.cell)!.row, parseRef(t.cell)!.col);
    if (raw === null || raw === undefined || raw === '') return 'empty' as const;
    const v = valueOf(t.cell);
    if (v instanceof ExcelError) return 'error' as const;
    if (typeof t.expected === 'number' && typeof v === 'number') return Math.abs(v - t.expected) <= (t.tolerance || 0) ? ('ok' as const) : ('wrong' as const);
    return String(formatValue(v)).trim().toLowerCase() === String(t.expected).trim().toLowerCase() ? ('ok' as const) : ('wrong' as const);
  };

  if (props.sheet && !sheets) return <Loading label="Loading sheet…" />;

  const selectedRaw = (() => {
    const a = parseRef(selected);
    if (!a) return '';
    const raw = grid.get(a.row, a.col);
    return raw === null ? '' : String(raw);
  })();

  return (
    <div className="stack gap-3">
      <div>
        <div style={{ fontWeight: 620 }}>{sheet.title}</div>
        <div className="w-note">
          <Markdown source={sheet.description} inline compact />
        </div>
      </div>
      <div className="xl-formula-bar">
        <span className="xl-formula-bar__ref mono">{selected}</span>
        <span className="xl-formula-bar__fx">fx</span>
        <input
          className="input input--mono"
          value={draft ?? selectedRaw}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) setCell(selected, draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (draft !== null) setCell(selected, draft);
              setDraft(null);
              const a = parseRef(selected)!;
              setSelected(cellName(Math.min(nRows - 1, a.row + 1), a.col));
            }
            if (e.key === 'Escape') setDraft(null);
          }}
          placeholder="Type a value or a formula starting with ="
          aria-label="Formula bar"
        />
      </div>
      <div className="xl-scroll">
        <table className="xl-grid">
          <thead>
            <tr>
              <th className="xl-corner" />
              {Array.from({ length: nCols }, (_, j) => (
                <th key={j} className={clsx(parseRef(selected)?.col === j && 'is-active')}>
                  {indexToCol(j)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: nRows }, (_, i) => (
              <tr key={i}>
                <th className={clsx('xl-rownum', parseRef(selected)?.row === i && 'is-active')}>{i + 1}</th>
                {Array.from({ length: nCols }, (_, j) => {
                  const key = cellName(i, j);
                  const raw = grid.get(i, j);
                  const isFormula = typeof raw === 'string' && raw.startsWith('=');
                  const v = isFormula ? evaluateFormula(raw, grid) : raw;
                  const numeric = typeof v === 'number';
                  const isHeader = i === 0 && j < sheet.columns.length;
                  return (
                    <td
                      key={j}
                      className={clsx('xl-cell', selected === key && 'is-selected', isHeader && 'is-header', numeric && 'is-num', v instanceof ExcelError && 'is-error', isFormula && 'is-formula')}
                      onClick={() => {
                        setSelected(key);
                        setDraft(null);
                      }}
                      onDoubleClick={() => setDraft(raw === null ? '' : String(raw))}
                      title={isFormula ? String(raw) : undefined}
                    >
                      {formatValue(v, sheet.formats[indexToCol(j)])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.tasks.length > 0 && (
        <div className="xl-tasks">
          {sheet.tasks.map((t, i) => {
            const status = taskStatus(t);
            return (
              <div key={i} className={clsx('xl-task', `is-${status}`)}>
                <span className="xl-task__icon">{status === 'ok' ? <CircleCheck /> : status === 'wrong' || status === 'error' ? <CircleX /> : <span className="xl-task__dot" />}</span>
                <div className="grow">
                  <Markdown source={t.prompt} compact />
                  {revealed.has(t.cell) && (
                    <code className="xl-task__solution">{t.solution}</code>
                  )}
                  {status === 'error' && <div className="w-note">The formula returns an error — check the function name, the argument order and the ranges.</div>}
                </div>
                <div className="row gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelected(t.cell);
                      setDraft('');
                    }}
                  >
                    Go to {t.cell}
                  </Button>
                  {t.hint && (
                    <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => new Set([...r, t.cell]))} icon={<Eye />}>
                      Show formula
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row gap-2">
        <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => { setEdits({}); setRevealed(new Set()); }}>
          Reset sheet
        </Button>
        <span className="w-note">
          Supported: SUM, AVERAGE(IFS), COUNT(IF/IFS), SUMIF(S), MAX/MINIFS, IF/IFS, XLOOKUP, VLOOKUP, INDEX/MATCH, text and date functions. Dates are Excel
          serial numbers.
        </span>
      </div>
    </div>
  );
}
