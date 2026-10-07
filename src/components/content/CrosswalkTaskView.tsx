import { useState } from 'react';
import type { CrosswalkTask } from '../../content/schema';
import { CodeBlock } from '../code/CodeBlock';
import { Markdown } from './Markdown';
import { useSettings } from '../../state/settings';

const LANGS = [
  { key: 'sas', label: 'SAS' },
  { key: 'r', label: 'R' },
  { key: 'python', label: 'Python' },
  { key: 'sql', label: 'SQL' },
] as const;

export function CrosswalkTaskView({ task, compact }: { task: CrosswalkTask; compact?: boolean }) {
  const available = LANGS.filter((l) => task[l.key]);
  const preferred = useSettings((s) => s.codeTab);
  const setSettings = useSettings((s) => s.set);
  const [view, setView] = useState<'tabs' | 'side'>(compact ? 'tabs' : 'side');
  const initial = available.find((l) => l.label === preferred)?.key ?? available[0]?.key;
  const [active, setActive] = useState<string>(initial ?? 'sas');
  const cur = available.find((l) => l.key === active) ?? available[0];

  return (
    <div className="crosswalk">
      {!compact && <Markdown source={task.summary} compact />}
      <div className="row gap-2" style={{ justifyContent: 'space-between', margin: '10px 0 0' }}>
        <div className="md-tabs__list" role="tablist" style={{ borderBottom: 0 }}>
          {view === 'tabs' &&
            available.map((l) => (
              <button
                key={l.key}
                type="button"
                role="tab"
                className="md-tabs__tab"
                aria-selected={cur?.key === l.key}
                onClick={() => {
                  setActive(l.key);
                  setSettings({ codeTab: l.label });
                }}
              >
                {l.label}
              </button>
            ))}
        </div>
        {!compact && (
          <div className="segmented" role="radiogroup" aria-label="Layout">
            <button type="button" role="radio" aria-checked={view === 'side'} className="segmented__item" onClick={() => setView('side')}>
              Side by side
            </button>
            <button type="button" role="radio" aria-checked={view === 'tabs'} className="segmented__item" onClick={() => setView('tabs')}>
              Tabs
            </button>
          </div>
        )}
      </div>
      {view === 'tabs' && cur && (
        <div>
          <CodeBlock code={task[cur.key]!.code} lang={cur.key} compact />
          {task[cur.key]!.notes && (
            <div className="crosswalk__notes">
              <Markdown source={task[cur.key]!.notes!} compact />
            </div>
          )}
        </div>
      )}
      {view === 'side' && (
        <div className="crosswalk__grid">
          {available.map((l) => (
            <div key={l.key} className="crosswalk__col">
              <CodeBlock code={task[l.key]!.code} lang={l.key} compact />
              {task[l.key]!.notes && (
                <div className="crosswalk__notes">
                  <Markdown source={task[l.key]!.notes!} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="crosswalk__semantics">
        <div className="eyebrow">Semantic differences that matter</div>
        <Markdown source={task.semantics} compact />
      </div>
      {task.pitfalls.length > 0 && !compact && (
        <div className="crosswalk__pitfalls">
          <div className="eyebrow">Pitfalls</div>
          <ul>
            {task.pitfalls.map((p, i) => (
              <li key={i}>
                <Markdown source={p} compact inline />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
