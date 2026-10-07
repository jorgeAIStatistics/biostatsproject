import { useState } from 'react';
import clsx from 'clsx';
import { CircleCheck, Circle, ChevronDown } from 'lucide-react';
import { useProgress } from '../../state/progress';
import { useItems } from '../../content/registry';
import { Markdown } from '../../components/content/Markdown';
import { ItemView } from '../../components/practice/ItemView';

interface Step {
  id: string;
  title: string;
  body: string;
  items: string[];
  done?: string;
}

/** Checklist of project steps with expandable instructions and verifying exercises. */
export function ProjectSteps({ projectId, steps }: { projectId: string; steps: Step[] }) {
  const done = useProgress((s) => s.steps);
  const toggle = useProgress((s) => s.toggleStep);
  const items = useItems();
  const [open, setOpen] = useState<string | null>(steps.find((s) => !done[`${projectId}:${s.id}`])?.id ?? steps[0]?.id ?? null);
  return (
    <ol className="steps">
      {steps.map((s, i) => {
        const key = `${projectId}:${s.id}`;
        const isDone = !!done[key];
        const isOpen = open === s.id;
        return (
          <li key={s.id} className={clsx('step', isDone && 'is-done', isOpen && 'is-open')}>
            <div className="step__head">
              <button type="button" className="step__check" aria-label={isDone ? 'Mark step as not done' : 'Mark step as done'} onClick={() => toggle(key)}>
                {isDone ? <CircleCheck /> : <Circle />}
              </button>
              <button type="button" className="step__title" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span className="step__num num">Step {i + 1}</span>
                <span className="grow">{s.title}</span>
                <ChevronDown className="step__chev" />
              </button>
            </div>
            {isOpen && (
              <div className="step__body">
                <Markdown source={s.body} compact />
                {s.done && (
                  <div className="step__done">
                    <div className="eyebrow">Done when</div>
                    <Markdown source={s.done} compact />
                  </div>
                )}
                {s.items.length > 0 && items && (
                  <div className="stack gap-3" style={{ marginTop: 12 }}>
                    {s.items
                      .map((id) => items.byId.get(id))
                      .filter((x): x is NonNullable<typeof x> => !!x)
                      .map((it) => (
                        <ItemView key={it.id} item={it} mode="case" inline />
                      ))}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
