import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import { Drawer, Button } from '../ui';
import { useProgress } from '../../state/progress';

/** Notes attached to the current page (keyed by path). Autosaves. */
export function NotesDrawer({ open, onClose, context, title }: { open: boolean; onClose: () => void; context: string; title: string }) {
  const note = useProgress((s) => s.notes[context]);
  const saveNote = useProgress((s) => s.saveNote);
  const deleteNote = useProgress((s) => s.deleteNote);
  const [text, setText] = useState(note?.text ?? '');

  useEffect(() => {
    if (open) setText(note?.text ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (text.trim()) saveNote(context, { text, context, title: title || context });
      else if (note) deleteNote(context);
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <Drawer open={open} onClose={onClose} title={`Notes — ${title || 'this page'}`} size="sm">
      <div className="stack gap-3">
        <textarea
          className="textarea"
          style={{ minHeight: 320, fontSize: 14 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write what you want to remember: a derivation rule, a SAS gotcha, a question for your professor. Markdown is fine. Notes save automatically and stay on this device."
          data-autofocus
        />
        <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {note ? `Saved ${new Date(note.updatedAt).toLocaleString()}` : 'Not saved yet'}
          </span>
          <div className="row gap-2">
            {note && (
              <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => { deleteNote(context); setText(''); }}>
                Delete
              </Button>
            )}
            <Link to="/notes" onClick={onClose} style={{ fontSize: 13 }}>
              All notes →
            </Link>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
