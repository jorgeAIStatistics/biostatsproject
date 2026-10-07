import { useMemo, useState } from 'react';
import { Download, Search, Table2, ListTree, Info } from 'lucide-react';
import { DataTable } from './DataTable';
import { Badge, Button, Loading, Tabs, EmptyState } from '../ui';
import { Markdown } from '../content/Markdown';
import { useDataset, toCsv, type Row } from '../../lib/datasets';

const LAYER_TONE = { raw: 'warning', sdtm: 'info', adam: 'violet', teaching: 'neutral', process: 'success', messy: 'danger', reference: 'neutral' } as const;

export function DatasetViewer({ id, compact, highlightRows }: { id: string; compact?: boolean; highlightRows?: Set<number> }) {
  const { data, error, loading } = useDataset(id);
  const [tab, setTab] = useState<'data' | 'vars' | 'about'>('data');
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!data) return [] as Row[];
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;
    // Supports "COL=value" for an exact column match, otherwise full-text contains.
    const m = q.match(/^([a-z0-9_]+)\s*=\s*(.*)$/i);
    if (m) {
      const col = data.columns.find((c) => c.toLowerCase() === m[1].toLowerCase());
      if (col) return data.rows.filter((r) => String(r[col] ?? '').toLowerCase() === m[2].trim());
    }
    return data.rows.filter((r) => data.columns.some((c) => r[c] !== null && String(r[c]).toLowerCase().includes(q)));
  }, [data, query]);

  if (loading) return <Loading label="Loading dataset…" />;
  if (error || !data)
    return (
      <EmptyState icon={<Table2 />} title="Dataset unavailable">
        {error ?? 'Unknown error'}
      </EmptyState>
    );

  const visibleCols = data.meta.columns.filter((c) => !hidden.has(c.name));
  const colInfo = visibleCols.map((c) => ({ name: c.name, label: c.label, type: c.type }));

  const download = () => {
    const blob = new Blob([toCsv(data.columns, data.rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = data.meta.file.split('/').pop() ?? `${data.meta.name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="stack gap-4">
      <div className="row gap-3 wrap" style={{ justifyContent: 'space-between' }}>
        <div className="stack gap-1" style={{ minWidth: 0 }}>
          <div className="row gap-2">
            <span className="mono" style={{ fontWeight: 650, fontSize: 15 }}>
              {data.meta.name}
            </span>
            <Badge tone={LAYER_TONE[data.meta.layer]}>{data.meta.layer.toUpperCase()}</Badge>
            {data.meta.structure && <span className="muted" style={{ fontSize: 12 }}>{data.meta.structure}</span>}
          </div>
          <span className="subtle" style={{ fontSize: 13 }}>
            {data.meta.label} · <span className="num">{data.rows.length.toLocaleString()}</span> rows ·{' '}
            <span className="num">{data.columns.length}</span> variables
            {data.meta.keys.length > 0 && (
              <>
                {' '}
                · keys <span className="mono">{data.meta.keys.join(', ')}</span>
              </>
            )}
          </span>
        </div>
        <Button size="sm" icon={<Download />} onClick={download}>
          CSV
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'data', label: 'Data', icon: <Table2 /> },
          { id: 'vars', label: 'Variables', icon: <ListTree />, count: data.meta.columns.length },
          { id: 'about', label: 'About', icon: <Info /> },
        ]}
      />

      {tab === 'data' && (
        <div className="stack gap-3">
          <div className="row gap-2 wrap">
            <div className="search-input" style={{ flex: '1 1 260px', maxWidth: 420 }}>
              <Search />
              <input
                className="input"
                placeholder="Search values, or COLUMN=value"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter rows"
              />
            </div>
            <span className="muted num" style={{ fontSize: 12 }}>
              {filtered.length.toLocaleString()} of {data.rows.length.toLocaleString()} rows
            </span>
            {hidden.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setHidden(new Set())}>
                Show all columns ({hidden.size} hidden)
              </Button>
            )}
          </div>
          <DataTable columns={colInfo} rows={filtered} maxHeight={compact ? 460 : 620} highlightRows={highlightRows} />
          <div className="muted" style={{ fontSize: 12 }}>
            Missing values: numeric shown as <code>.</code>, character shown blank (hatched). Click a column header to sort.
          </div>
        </div>
      )}

      {tab === 'vars' && (
        <div className="vars-table md-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Variable</th>
                <th>Label</th>
                <th>Type</th>
                <th>Role / category</th>
                <th>Origin</th>
                <th>Derivation / notes</th>
              </tr>
            </thead>
            <tbody>
              {data.meta.columns.map((c) => (
                <tr key={c.name}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.name)}
                      aria-label={`Show ${c.name}`}
                      onChange={() =>
                        setHidden((h) => {
                          const n = new Set(h);
                          if (n.has(c.name)) n.delete(c.name);
                          else n.add(c.name);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {c.name}
                  </td>
                  <td>{c.label}</td>
                  <td className="mono">{c.type}</td>
                  <td>{c.role ?? ''}</td>
                  <td>{c.origin ?? ''}</td>
                  <td style={{ minWidth: 260 }}>
                    {c.derivation && <Markdown source={c.derivation} compact />}
                    {c.codelist && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Codelist: <span className="mono">{c.codelist}</span>
                      </div>
                    )}
                    {c.notes && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {c.notes}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'about' && (
        <div className="stack gap-3">
          <Markdown source={data.meta.description} />
          <div className="muted" style={{ fontSize: 12.5 }}>
            File: <span className="mono">data/{data.study}/{data.meta.file}</span> · synthetic, generated deterministically — no real patients.
          </div>
        </div>
      )}
    </div>
  );
}
