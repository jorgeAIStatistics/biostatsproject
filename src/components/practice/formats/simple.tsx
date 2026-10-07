import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Check, X, GripVertical } from 'lucide-react';
import { Markdown } from '../../content/Markdown';
import { Button } from '../../ui';
import type { ItemOf } from '../../../content/schema';
import type { ItemInfo } from '../../../content/registry';
import { seededShuffle, type FormatProps } from '../types';

type Info<F extends string> = ItemOf<F & ItemInfo['format']> & ItemInfo;

/* --------------------------------- Choices -------------------------------- */

export function ChoiceFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'mcq'> | Info<'multi'>>) {
  const multi = item.format === 'multi';
  const order = useMemo(() => {
    const idx = item.choices.map((_, i) => i);
    return item.shuffle ? seededShuffle(idx, item.id) : idx;
  }, [item]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const showAnswers = locked || revealed;

  const toggle = (i: number) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (prev.has(i) && multi) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const check = () => {
    const correct = new Set(item.choices.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0));
    const ok = correct.size === selected.size && [...selected].every((i) => correct.has(i));
    onCheck({ score: ok ? 1 : 0 });
  };

  return (
    <div className="stack gap-3">
      <div className="choices" role={multi ? 'group' : 'radiogroup'}>
        {order.map((i) => {
          const c = item.choices[i];
          const isSel = selected.has(i);
          const state = showAnswers ? (c.correct ? 'correct' : isSel ? 'wrong' : 'neutral') : isSel ? 'selected' : 'neutral';
          return (
            <div key={i} className="choice-wrap">
              <button
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={isSel}
                className={clsx('choice', `is-${state}`)}
                onClick={() => toggle(i)}
                disabled={locked}
              >
                <span className={clsx('choice__mark', multi && 'choice__mark--box')}>
                  {showAnswers && c.correct ? <Check /> : showAnswers && isSel ? <X /> : null}
                </span>
                <span className="choice__text">
                  <Markdown source={c.text} compact />
                </span>
              </button>
              {showAnswers && c.feedback && (isSel || c.correct) && (
                <div className={clsx('choice__feedback', c.correct ? 'is-correct' : 'is-wrong')}>
                  <Markdown source={c.feedback} compact />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="row gap-2">
          <Button variant="primary" onClick={check} disabled={selected.size === 0}>
            Check answer
          </Button>
          {multi && <span className="muted" style={{ fontSize: 12 }}>Select every correct option.</span>}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Numeric -------------------------------- */

export function NumericFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'numeric'>>) {
  const [value, setValue] = useState('');
  const num = Number(value.replace(/,/g, '').trim());
  const valid = value.trim() !== '' && Number.isFinite(num);
  const check = () => {
    const ok = Math.abs(num - item.answer) <= item.tolerance + 1e-12;
    onCheck({
      score: ok ? 1 : 0,
      detail: ok ? undefined : <>Your answer: <b className="num">{num}</b>{item.unit ? ` ${item.unit}` : ''}.</>,
    });
  };
  return (
    <div className="row gap-2 wrap">
      <input
        className="input input--mono"
        style={{ maxWidth: 200 }}
        inputMode="decimal"
        value={value}
        placeholder="Your answer"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valid && !locked && check()}
        disabled={locked}
        aria-label="Numeric answer"
      />
      {item.unit && <span className="muted">{item.unit}</span>}
      {!locked && (
        <Button variant="primary" onClick={check} disabled={!valid}>
          Check answer
        </Button>
      )}
      {(locked || revealed) && (
        <span className="badge badge--success num">
          Expected {item.answer}
          {item.unit ? ` ${item.unit}` : ''}
          {item.tolerance > 0 ? ` (±${item.tolerance})` : ''}
        </span>
      )}
    </div>
  );
}

/* ----------------------------------- Text --------------------------------- */

const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function TextFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'text'>>) {
  const [value, setValue] = useState('');
  const check = () => {
    const v = normalize(value);
    const ok =
      item.accept.some((a) => normalize(a) === v) ||
      item.acceptPatterns.some((p) => {
        try {
          return new RegExp(p, 'i').test(value.trim());
        } catch {
          return false;
        }
      });
    onCheck({ score: ok ? 1 : 0 });
  };
  return (
    <div className="row gap-2 wrap">
      <input
        className={clsx('input', item.monospace && 'input--mono')}
        style={{ maxWidth: 420 }}
        value={value}
        placeholder={item.placeholder ?? 'Your answer'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && value.trim() && !locked && check()}
        disabled={locked}
        aria-label="Answer"
        spellCheck={false}
      />
      {!locked && (
        <Button variant="primary" onClick={check} disabled={!value.trim()}>
          Check answer
        </Button>
      )}
      {(locked || revealed) && <span className="badge badge--success mono">Accepted: {item.accept[0]}</span>}
    </div>
  );
}

/* --------------------------------- Mapping -------------------------------- */

export function MappingFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'mapping'>>) {
  const targets = useMemo(() => item.targets ?? [...new Set(item.pairs.map((p) => p.target))], [item]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const complete = item.pairs.every((_, i) => answers[i]);
  const show = locked || revealed;
  const check = () => {
    const right = item.pairs.filter((p, i) => answers[i] === p.target).length;
    onCheck({ score: right / item.pairs.length, detail: `${right} of ${item.pairs.length} mappings correct.` });
  };
  return (
    <div className="stack gap-3">
      <div className="mapping">
        <div className="mapping__head">
          <span>{item.sourceLabel}</span>
          <span>{item.targetLabel}</span>
        </div>
        {item.pairs.map((p, i) => {
          const ok = answers[i] === p.target;
          return (
            <div key={i} className={clsx('mapping__row', show && (ok ? 'is-correct' : 'is-wrong'))}>
              <code className="mapping__source">{p.source === '' ? '(blank)' : JSON.stringify(p.source).slice(1, -1)}</code>
              <div className="stack gap-1">
                <select
                  className="select"
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  disabled={locked}
                  aria-label={`Map ${p.source}`}
                >
                  <option value="">Choose…</option>
                  {targets.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {show && !ok && (
                  <span className="mapping__fix">
                    Correct: <code>{p.target}</code>
                  </span>
                )}
                {show && p.note && (
                  <span className="mapping__note">
                    <Markdown source={p.note} compact inline />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div>
          <Button variant="primary" onClick={check} disabled={!complete}>
            Check mapping
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Order --------------------------------- */

export function OrderFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'order'>>) {
  const initial = useMemo(() => {
    let s = seededShuffle(item.steps.map((_, i) => i), item.id);
    if (s.every((v, i) => v === i)) s = [...s.slice(1), s[0]];
    return s;
  }, [item]);
  const [order, setOrder] = useState(initial);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || locked) return;
    setOrder((o) => {
      const next = [...o];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };
  const show = locked || revealed;
  const check = () => {
    const right = order.filter((v, i) => v === i).length;
    onCheck({ score: right === order.length ? 1 : right / order.length / 1.25, detail: `${right} of ${order.length} steps in the right position.` });
  };
  return (
    <div className="stack gap-3">
      <ol className="order-list">
        {order.map((stepIdx, pos) => (
          <li key={stepIdx} className={clsx('order-item', show && (stepIdx === pos ? 'is-correct' : 'is-wrong'))}>
            <GripVertical className="order-item__grip" />
            <span className="order-item__pos num">{pos + 1}</span>
            <span className="order-item__text">
              <Markdown source={item.steps[stepIdx]} compact inline />
            </span>
            {show && stepIdx !== pos && <span className="order-item__should">should be #{stepIdx + 1}</span>}
            {!locked && (
              <span className="order-item__moves">
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(pos, pos - 1)} aria-label="Move up" disabled={pos === 0}>
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => move(pos, pos + 1)}
                  aria-label="Move down"
                  disabled={pos === order.length - 1}
                >
                  <ArrowDown />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!locked && (
        <div>
          <Button variant="primary" onClick={check}>
            Check order
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Classify -------------------------------- */

export function ClassifyFormat({ item, locked, revealed, onCheck }: FormatProps<Info<'classify'>>) {
  const entries = useMemo(() => seededShuffle(item.entries.map((_, i) => i), item.id), [item]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const complete = item.entries.every((_, i) => answers[i]);
  const show = locked || revealed;
  const check = () => {
    const right = item.entries.filter((e, i) => answers[i] === e.category).length;
    onCheck({ score: right / item.entries.length, detail: `${right} of ${item.entries.length} classified correctly.` });
  };
  return (
    <div className="stack gap-3">
      <div className="classify">
        {entries.map((i) => {
          const e = item.entries[i];
          const ok = answers[i] === e.category;
          return (
            <div key={i} className={clsx('classify__row', show && (ok ? 'is-correct' : 'is-wrong'))}>
              <div className="classify__text">
                <Markdown source={e.text} compact inline />
                {show && e.note && (
                  <div className="mapping__note">
                    <Markdown source={e.note} compact inline />
                  </div>
                )}
              </div>
              <div className="classify__options" role="radiogroup">
                {item.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={answers[i] === c}
                    className={clsx('classify__opt', answers[i] === c && 'is-on', show && c === e.category && 'is-answer')}
                    disabled={locked}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: c }))}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!locked && (
        <div>
          <Button variant="primary" onClick={check} disabled={!complete}>
            Check
          </Button>
        </div>
      )}
    </div>
  );
}
