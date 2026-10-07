import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Copy, Download, MessageSquareText, ListTree } from 'lucide-react';
import { highlightLines, LANGUAGE_LABELS, FILE_EXTENSIONS } from './highlight';
import { IconButton } from '../ui';
import './code.css';

export interface LineExplanation {
  from: number;
  to: number;
  content: ReactNode;
}

interface CodeBlockProps {
  code: string;
  lang?: string;
  title?: string;
  /** 1-based line numbers to highlight. */
  highlight?: Set<number>;
  explanations?: LineExplanation[];
  lineNumbers?: boolean;
  /** Clickable lines (for hotspot/log items). */
  onLineClick?: (line: number) => void;
  selectedLines?: Set<number>;
  lineStatus?: Map<number, 'correct' | 'missed' | 'wrong'>;
  lineNotes?: Map<number, ReactNode>;
  maxHeight?: number;
  className?: string;
  compact?: boolean;
  download?: boolean;
}

function parseRange(from: number, to: number) {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

export function CodeBlock({
  code,
  lang = 'text',
  title,
  highlight,
  explanations,
  lineNumbers,
  onLineClick,
  selectedLines,
  lineStatus,
  lineNotes,
  maxHeight,
  className,
  compact,
  download = true,
}: CodeBlockProps) {
  const lines = useMemo(() => highlightLines(code, lang), [code, lang]);
  const [copied, setCopied] = useState(false);
  const [openLines, setOpenLines] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Map each explained line → explanation index (explanation shows after the range's last line).
  const explByLastLine = useMemo(() => {
    const m = new Map<number, LineExplanation>();
    for (const e of explanations ?? []) m.set(e.to, e);
    return m;
  }, [explanations]);
  const explainedLines = useMemo(() => {
    const s = new Map<number, number>();
    for (const e of explanations ?? []) for (const l of parseRange(e.from, e.to)) s.set(l, e.to);
    return s;
  }, [explanations]);

  const showNumbers = lineNumbers ?? (lang !== 'output' && lang !== 'text' && lines.length > 1);
  const label = LANGUAGE_LABELS[lang] ?? lang.toUpperCase();
  const ext = FILE_EXTENSIONS[lang];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadFile = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title && title.includes('.') ? title : `program.${ext ?? 'txt'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleLine = (lastLine: number) => {
    setOpenLines((prev) => {
      const next = new Set(prev);
      if (next.has(lastLine)) next.delete(lastLine);
      else next.add(lastLine);
      return next;
    });
  };

  return (
    <div className={clsx('codeblock', `codeblock--${lang}`, compact && 'codeblock--compact', className)}>
      <div className="codeblock__bar">
        <span className="codeblock__lang">{label}</span>
        {title && <span className="codeblock__title">{title}</span>}
        <span className="grow" />
        {explanations && explanations.length > 0 && (
          <button
            type="button"
            className={clsx('codeblock__explain-toggle', showAll && 'is-on')}
            onClick={() => setShowAll((v) => !v)}
            aria-pressed={showAll}
          >
            <ListTree />
            {showAll ? 'Hide line notes' : 'Explain every line'}
          </button>
        )}
        {download && ext && (lang === 'sas' || lang === 'r' || lang === 'python' || lang === 'sql') && (
          <IconButton label={`Download .${ext}`} size="sm" onClick={downloadFile}>
            <Download />
          </IconButton>
        )}
        <IconButton label={copied ? 'Copied' : 'Copy code'} size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
        </IconButton>
      </div>
      <div className="codeblock__scroll" style={maxHeight ? { maxHeight } : undefined}>
        <div className="codeblock__code" role="presentation">
          {lines.map((tokens, i) => {
            const n = i + 1;
            const explTo = explainedLines.get(n);
            const status = lineStatus?.get(n);
            const note = lineNotes?.get(n);
            const expl = explByLastLine.get(n);
            const expanded = expl && (showAll || openLines.has(n));
            return (
              <div key={n} className="codeblock__row-group">
                <div
                  className={clsx(
                    'codeblock__line',
                    highlight?.has(n) && 'is-highlight',
                    explTo !== undefined && 'is-explained',
                    onLineClick && 'is-clickable',
                    selectedLines?.has(n) && 'is-selected',
                    status && `is-${status}`,
                    tokens[0]?.cls?.startsWith('log-') && tokens[0].cls,
                  )}
                  onClick={
                    onLineClick
                      ? () => onLineClick(n)
                      : explTo !== undefined
                        ? () => toggleLine(explTo)
                        : undefined
                  }
                  role={onLineClick || explTo !== undefined ? 'button' : undefined}
                  tabIndex={onLineClick || explTo !== undefined ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (onLineClick) onLineClick(n);
                    else if (explTo !== undefined) toggleLine(explTo);
                  }}
                  aria-label={explTo !== undefined ? `Line ${n}: show explanation` : onLineClick ? `Select line ${n}` : undefined}
                >
                  {showNumbers && <span className="codeblock__num">{n}</span>}
                  {explanations && explanations.length > 0 && (
                    <span className="codeblock__marker" aria-hidden="true">
                      {explTo !== undefined && <MessageSquareText />}
                    </span>
                  )}
                  <span className="codeblock__text">
                    {tokens.length === 0 || (tokens.length === 1 && tokens[0].text === '') ? (
                      '​'
                    ) : (
                      tokens.map((tk, j) => (
                        <span key={j} className={tk.cls.startsWith('log-') ? undefined : tk.cls || undefined}>
                          {tk.text}
                        </span>
                      ))
                    )}
                  </span>
                </div>
                {expanded && (
                  <div className="codeblock__explanation">
                    <span className="codeblock__explanation-range">
                      {expl.from === expl.to ? `Line ${expl.from}` : `Lines ${expl.from}–${expl.to}`}
                    </span>
                    <div className="codeblock__explanation-body">{expl.content}</div>
                  </div>
                )}
                {note && (
                  <div className={clsx('codeblock__explanation', 'codeblock__explanation--note', status && `is-${status}`)}>
                    <span className="codeblock__explanation-range">Line {n}</span>
                    <div className="codeblock__explanation-body">{note}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
