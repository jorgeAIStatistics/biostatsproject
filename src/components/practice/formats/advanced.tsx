import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CircleCheck, Circle, Play, RotateCcw, Terminal, CircleX, Info, Cpu } from 'lucide-react';
import { Markdown } from '../../content/Markdown';
import { CodeBlock } from '../../code/CodeBlock';
import { CodeEditor } from '../../code/CodeEditor';
import { DataTable } from '../../data/DataTable';
import { Button, Badge, Loading } from '../../ui';
import type { ItemOf } from '../../../content/schema';
import type { ItemInfo } from '../../../content/registry';
import type { FormatProps } from '../types';
import { ChoiceFormat as ChoiceBridge } from './simple';
import { useProgress } from '../../../state/progress';
import { useSettings } from '../../../state/settings';
import { stripComments } from '../../../lib/code-checks';
import { compareResults, getReferenceDb, getWorkspaceDb, runQuery, resetWorkspace, DB_LABELS, type QueryResult } from '../../../lib/sql';
import { runPython, pyodideStatus } from '../../../lib/pyodide';

type Info<F extends string> = ItemOf<F & ItemInfo['format']> & ItemInfo;

/* ---------------------------------- Code ---------------------------------- */

export function CodeFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'code'>>) {
  const draft = useProgress((s) => s.drafts[item.id]);
  const saveDraft = useProgress((s) => s.saveDraft);
  const clearDraft = useProgress((s) => s.clearDraft);
  const allowPy = useSettings((s) => s.allowPyodide);
  const setSettings = useSettings((s) => s.set);
  const [code, setCode] = useState(draft ?? item.starter);
  const [results, setResults] = useState<{ message: string; ok: boolean }[] | null>(null);
  const [run, setRun] = useState<{ stdout: string; error?: string; testsPassed?: boolean } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(item.id, code), 400);
    return () => window.clearTimeout(t);
  }, [code, item.id, saveDraft]);

  const evaluate = () => {
    const stripped = stripComments(code, item.language);
    const r = item.checks.map((c) => {
      let hit = false;
      try {
        hit = new RegExp(c.pattern, c.flags).test(stripped);
      } catch {
        hit = false;
      }
      return { message: c.message, ok: hit !== c.absent };
    });
    setResults(r);
    return r;
  };

  const check = async () => {
    const r = evaluate();
    let score = r.filter((x) => x.ok).length / r.length;
    if (item.runnable && item.language === 'python' && allowPy) {
      setRunning(true);
      const out = await runPython(`${code}\n\n${item.tests ?? ''}`);
      setRunning(false);
      const testsPassed = !out.error;
      setRun({ stdout: out.stdout, error: out.error, testsPassed });
      score = testsPassed ? Math.max(score, 0.9) * 1 : Math.min(score, 0.5);
    }
    onCheck({
      score,
      detail: `${r.filter((x) => x.ok).length} of ${r.length} structural checks passed.`,
    });
  };

  const tryRun = async () => {
    setRunning(true);
    const out = await runPython(code);
    setRunning(false);
    setRun({ stdout: out.stdout, error: out.error });
  };

  const isSasOrR = item.language === 'sas' || item.language === 'r';

  return (
    <div className="stack gap-3">
      <div className="code-task__bar">
        <Badge tone="neutral" icon={<Terminal />}>
          {item.language.toUpperCase()}
        </Badge>
        {isSasOrR && (
          <span className="code-task__note">
            <Info /> {item.language === 'sas' ? 'SAS' : 'R'} does not run in the browser. Checks are structural; run the downloaded program in{' '}
            {item.language === 'sas' ? 'SAS (e.g. SAS OnDemand for Academics)' : 'R/RStudio'} to see real output.
          </span>
        )}
        {item.language === 'python' && item.runnable && !allowPy && (
          <span className="code-task__note">
            <Cpu /> This exercise can run in your browser with Pyodide (≈25 MB download).{' '}
            <button type="button" className="linklike" onClick={() => setSettings({ allowPyodide: true })}>
              Enable in-browser Python
            </button>
          </span>
        )}
      </div>
      <CodeEditor
        value={code}
        onChange={setCode}
        language={item.language}
        readOnly={locked}
        minHeight={Math.min(420, Math.max(160, item.starter.split('\n').length * 22 + 60))}
        onRun={() => !locked && void check()}
      />
      <div className="row gap-2 wrap">
        {!locked && (
          <Button variant="primary" onClick={() => void check()} icon={<CircleCheck />} disabled={running}>
            Check my code
          </Button>
        )}
        {item.language === 'python' && allowPy && !locked && (
          <Button onClick={() => void tryRun()} icon={<Play />} disabled={running}>
            {running ? (pyodideStatus() === 'loading' ? 'Loading Python…' : 'Running…') : 'Run'}
          </Button>
        )}
        {!locked && (
          <Button
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => {
              setCode(item.starter);
              clearDraft(item.id);
              setResults(null);
              setRun(null);
            }}
          >
            Reset code
          </Button>
        )}
        <span className="muted" style={{ fontSize: 12 }}>
          <kbd className="kbd">⌘</kbd> <kbd className="kbd">Enter</kbd> to check
        </span>
      </div>
      {results && (
        <ul className="checks">
          {results.map((r, i) => (
            <li key={i} className={clsx('checks__item', r.ok ? 'is-ok' : 'is-fail')}>
              {r.ok ? <CircleCheck /> : <CircleX />}
              <span>{r.message}</span>
            </li>
          ))}
        </ul>
      )}
      {run && (
        <div className="run-output">
          <div className="run-output__head">
            Python output
            {run.testsPassed !== undefined && (
              <Badge tone={run.testsPassed ? 'success' : 'danger'}>{run.testsPassed ? 'tests passed' : 'tests failed'}</Badge>
            )}
          </div>
          <pre className="run-output__body">
            {run.stdout || (run.error ? '' : '(no output)')}
            {run.error && <span className="run-output__err">{run.error}</span>}
          </pre>
        </div>
      )}
      {(locked || revealed) && (
        <div className="stack gap-3">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Reference solution</div>
            <CodeBlock code={item.reference} lang={item.language} compact />
          </div>
          {item.expectedOutput && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Expected output {isSasOrR ? '(computed independently — not produced by running SAS/R here)' : ''}
              </div>
              <CodeBlock code={item.expectedOutput} lang={/^(NOTE|WARNING|ERROR)/m.test(item.expectedOutput) ? 'log' : 'output'} compact download={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- SQL ---------------------------------- */

export function SqlFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'sql'>>) {
  const draft = useProgress((s) => s.drafts[item.id]);
  const saveDraft = useProgress((s) => s.saveDraft);
  const [code, setCode] = useState(draft ?? item.starter);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(item.id, code), 400);
    return () => window.clearTimeout(t);
  }, [code, item.id, saveDraft]);

  const execute = async (): Promise<QueryResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const db = await getWorkspaceDb(item.db);
      const r = runQuery(db, code);
      setResult(r);
      return r;
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    const r = await execute();
    let ref: QueryResult | null = null;
    try {
      ref = runQuery(await getReferenceDb(item.db), item.reference);
      setReference(ref);
    } catch (e) {
      setError(`Reference query failed: ${(e as Error).message}`);
    }
    if (!r || !ref) {
      onCheck({ score: 0, detail: 'Your query did not run.' });
      return;
    }
    const cmp = compareResults(r, ref, { orderMatters: item.orderMatters, compareColumns: item.compareColumns });
    onCheck({ score: cmp.match ? 1 : 0, detail: cmp.match ? 'Your result set matches the expected result.' : cmp.reason });
  };

  useEffect(() => {
    if ((locked || revealed) && !reference) {
      getReferenceDb(item.db)
        .then((db) => setReference(runQuery(db, item.reference)))
        .catch(() => undefined);
    }
  }, [locked, revealed, reference, item]);

  return (
    <div className="stack gap-3">
      <div className="code-task__bar">
        <Badge tone="accent" icon={<Terminal />}>
          SQLite
        </Badge>
        <span className="code-task__note">Runs live on the {DB_LABELS[item.db]} database in your browser.</span>
      </div>
      <CodeEditor value={code} onChange={setCode} language="sql" readOnly={locked} minHeight={150} onRun={() => void execute()} />
      <div className="row gap-2 wrap">
        <Button icon={<Play />} onClick={() => void execute()} disabled={busy}>
          Run query
        </Button>
        {!locked && (
          <Button variant="primary" icon={<CircleCheck />} onClick={() => void check()} disabled={busy || !code.trim()}>
            Check result
          </Button>
        )}
        <Button
          variant="ghost"
          icon={<RotateCcw />}
          onClick={() => {
            void resetWorkspace(item.db);
            setResult(null);
          }}
        >
          Reset database
        </Button>
        <span className="muted" style={{ fontSize: 12 }}>
          <kbd className="kbd">⌘</kbd> <kbd className="kbd">Enter</kbd> runs
        </span>
      </div>
      {busy && <Loading label="Running…" />}
      {error && <div className="sql-error">{error}</div>}
      {result && (
        <DataTable
          columns={result.columns}
          rows={result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])))}
          maxHeight={300}
          caption={`${result.rows.length} row${result.rows.length === 1 ? '' : 's'}${result.truncated ? ' (truncated)' : ''} · ${result.ms.toFixed(1)} ms`}
        />
      )}
      {(locked || revealed) && (
        <div className="stack gap-3">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Reference query</div>
            <CodeBlock code={item.reference} lang="sql" compact />
          </div>
          {reference && (
            <DataTable
              columns={reference.columns}
              rows={reference.rows.map((r) => Object.fromEntries(reference.columns.map((c, i) => [c, r[i]])))}
              maxHeight={260}
              caption={`Expected result · ${reference.rows.length} row(s)`}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Log / hotspot ------------------------------ */

function f1(selected: Set<number>, answer: Set<number>) {
  const tp = [...selected].filter((l) => answer.has(l)).length;
  if (tp === 0) return 0;
  const precision = tp / selected.size;
  const recall = tp / answer.size;
  return (2 * precision * recall) / (precision + recall);
}

export function LineSelectFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'log'> | Info<'hotspot'>>) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const answer = useMemo(() => new Set(item.format === 'log' ? item.issues : item.answerLines), [item]);
  const show = locked || revealed;
  const toggle = (n: number) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };
  const status = useMemo(() => {
    if (!show) return undefined;
    const m = new Map<number, 'correct' | 'missed' | 'wrong'>();
    for (const l of answer) m.set(l, selected.has(l) ? 'correct' : 'missed');
    for (const l of selected) if (!answer.has(l)) m.set(l, 'wrong');
    return m;
  }, [show, answer, selected]);
  const notes = useMemo(() => {
    if (!show) return undefined;
    return new Map(item.lineNotes.map((n) => [n.line, <Markdown key={n.line} source={n.note} compact />]));
  }, [show, item]);

  const check = () => {
    const score = f1(selected, answer);
    const hit = [...selected].filter((l) => answer.has(l)).length;
    onCheck({
      score,
      detail: `You flagged ${hit} of ${answer.size} problem line${answer.size === 1 ? '' : 's'}${
        selected.size - hit > 0 ? ` and ${selected.size - hit} line(s) that are fine` : ''
      }.`,
    });
  };

  return (
    <div className="stack gap-3">
      {item.format === 'log' && item.program && (
        <details className="program-details">
          <summary>Program that produced this log</summary>
          <CodeBlock code={item.program} lang="sas" compact />
        </details>
      )}
      <div className="muted" style={{ fontSize: 12.5 }}>
        {item.format === 'log' ? 'Click every log line that signals a problem you must act on.' : 'Click the line(s) containing the defect.'}
      </div>
      <CodeBlock
        code={item.format === 'log' ? item.log : item.code}
        lang={item.format === 'log' ? 'log' : item.language}
        lineNumbers
        onLineClick={toggle}
        selectedLines={selected}
        lineStatus={status}
        lineNotes={notes}
        download={false}
      />
      {!locked && (
        <div className="row gap-2">
          <Button variant="primary" onClick={check} disabled={selected.size === 0}>
            Check selection
          </Button>
          <span className="muted" style={{ fontSize: 12 }}>
            {selected.size} line{selected.size === 1 ? '' : 's'} selected
          </span>
        </div>
      )}
      {show && item.format === 'hotspot' && item.fixed && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Corrected code</div>
          <CodeBlock code={item.fixed} lang={item.language} compact />
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- Diff --------------------------------- */

function DiffTable({ table, other, side }: { table: Info<'diff'>['left']; other: Info<'diff'>['left']; side: 'left' | 'right' }) {
  const rows = table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i]])));
  const diffCells = new Set<string>();
  table.rows.forEach((r, ri) => {
    r.forEach((v, ci) => {
      const col = table.columns[ci];
      const oci = other.columns.indexOf(col);
      const ov = oci >= 0 ? other.rows[ri]?.[oci] : undefined;
      if (ov === undefined || String(ov ?? '') !== String(v ?? '')) diffCells.add(`${ri}:${col}`);
    });
  });
  return (
    <div className={clsx('qc-side', `qc-side--${side}`)}>
      <div className="qc-side__title">{table.title}</div>
      <DataTable
        columns={table.columns}
        rows={rows}
        rowNumbers={false}
        sortable={false}
        maxHeight={360}
        cellClassName={(_, col, i) => (diffCells.has(`${i}:${col}`) ? 'is-diff' : undefined)}
      />
      {table.footnote && <div className="qc-side__foot">{table.footnote}</div>}
    </div>
  );
}

export function DiffFormat({ item, locked, revealed, onCheck, mode }: FormatProps<Info<'diff'>>) {
  const [showCode, setShowCode] = useState(false);
  const choiceItem = useMemo(
    () => ({ ...item, format: item.choices.filter((c) => c.correct).length > 1 ? 'multi' : 'mcq', shuffle: true }) as unknown as Info<'mcq'>,
    [item],
  );
  return (
    <div className="stack gap-4">
      <div className="qc-grid">
        <DiffTable table={item.left} other={item.right} side="left" />
        <DiffTable table={item.right} other={item.left} side="right" />
      </div>
      {(item.leftCode || item.rightCode) && (
        <div>
          <Button size="sm" variant="subtle" onClick={() => setShowCode((v) => !v)}>
            {showCode ? 'Hide programs' : 'Inspect the two programs'}
          </Button>
          {showCode && (
            <div className="qc-grid" style={{ marginTop: 12 }}>
              {item.leftCode && <CodeBlock code={item.leftCode} lang={item.codeLanguage ?? 'sas'} title={item.left.title} compact />}
              {item.rightCode && <CodeBlock code={item.rightCode} lang={item.codeLanguage ?? 'sas'} title={item.right.title} compact />}
            </div>
          )}
        </div>
      )}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Why do the outputs disagree?
        </div>
        <ChoiceBridge item={choiceItem} locked={locked} revealed={revealed} onCheck={onCheck} mode={mode} />
      </div>
    </div>
  );
}

/* ----------------------------------- Open --------------------------------- */

export function OpenFormat({ item, locked, revealed, onCheck, mode }: FormatProps<Info<'open'>>) {
  const [answer, setAnswer] = useState('');
  const [shown, setShown] = useState(false);
  const [ticks, setTicks] = useState<Set<number>>(new Set());
  const reveal = shown || revealed || locked;
  const toggle = (i: number) =>
    setTicks((t) => {
      const n = new Set(t);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const grade = (score: number) => onCheck({ score, detail: `Rubric points covered: ${ticks.size} of ${item.rubric.length}.` });
  return (
    <div className="stack gap-3">
      <textarea
        className="textarea"
        rows={mode === 'interview' ? 7 : 5}
        placeholder={mode === 'interview' ? 'Answer as you would out loud in the interview. Structure first, then detail.' : 'Write your explanation…'}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={locked}
        aria-label="Your answer"
      />
      {!reveal && (
        <div className="row gap-2">
          <Button variant="primary" onClick={() => setShown(true)}>
            Compare with a strong answer
          </Button>
          <span className="muted" style={{ fontSize: 12 }}>
            {answer.trim() ? `${answer.trim().split(/\s+/).length} words` : 'Try answering first — retrieval is where learning happens.'}
          </span>
        </div>
      )}
      {reveal && (
        <div className="stack gap-3">
          <div className="model-answer">
            <div className="eyebrow">Strong answer</div>
            <Markdown source={item.modelAnswer} compact />
          </div>
          <div className="rubric">
            <div className="eyebrow">What an interviewer listens for — tick what you covered</div>
            {item.rubric.map((r, i) => (
              <button key={i} type="button" className={clsx('rubric__item', ticks.has(i) && 'is-on')} onClick={() => !locked && toggle(i)}>
                {ticks.has(i) ? <CircleCheck /> : <Circle />}
                <span>{r}</span>
              </button>
            ))}
          </div>
          {item.redFlags.length > 0 && (
            <div className="red-flags">
              <div className="eyebrow">Red flags</div>
              <ul>
                {item.redFlags.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {item.followUps.length > 0 && (
            <div className="follow-ups">
              <div className="eyebrow">Likely follow-up questions</div>
              <ul>
                {item.followUps.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {!locked && (
            <div className="row gap-2 wrap">
              <span style={{ fontSize: 13, fontWeight: 600 }}>How did you do?</span>
              <Button variant="success" size="sm" onClick={() => grade(1)}>
                Nailed it
              </Button>
              <Button size="sm" onClick={() => grade(0.5)}>
                Partially
              </Button>
              <Button size="sm" variant="danger" onClick={() => grade(0)}>
                Missed it
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
