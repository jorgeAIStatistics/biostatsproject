import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useReference } from '../../content/registry';
import { Markdown } from './Markdown';

/** Inline glossary term: :term[TEAE]{id="teae"} — hover for the reference definition. */
export default function Term({ id, children }: { id: string; children?: ReactNode }) {
  const ref = useReference();
  const [open, setOpen] = useState(false);
  const entry = ref?.byId.get(id);
  return (
    <span
      className="md-term tooltip-wrap"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && entry && (
        <span className="tooltip tooltip--wide term-pop" role="tooltip">
          <b>{entry.term}</b> — <Markdown source={entry.summary} inline compact />
          <Link to={`/reference/${entry.category}/${entry.id}`} className="term-pop__link">
            Reference →
          </Link>
        </span>
      )}
    </span>
  );
}
