import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Search, Trash2, Bookmark, NotebookPen, History, BookmarkX } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useProgress } from '../../state/progress';
import { Card, CardHeader, EmptyState, IconButton, Tabs } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { useItems, itemTitle } from '../../content/registry';

export default function NotesPage() {
  usePage('Notes & Bookmarks');
  const notes = useProgress((s) => s.notes);
  const bookmarks = useProgress((s) => s.bookmarks);
  const history = useProgress((s) => s.history);
  const later = useProgress((s) => s.reviewLater);
  const deleteNote = useProgress((s) => s.deleteNote);
  const toggleBookmark = useProgress((s) => s.toggleBookmark);
  const toggleLater = useProgress((s) => s.toggleReviewLater);
  const items = useItems();
  const [tab, setTab] = useState<'notes' | 'bookmarks' | 'later' | 'history'>('notes');
  const [q, setQ] = useState('');
  const noteList = useMemo(
    () =>
      Object.entries(notes)
        .filter(([, n]) => !q || `${n.title} ${n.text}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt),
    [notes, q],
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Your workspace</div>
        <h1 className="page-title">Notes & bookmarks</h1>
        <p className="page-lede">Press <kbd className="kbd">n</kbd> on any page to write a note attached to it, and <kbd className="kbd">b</kbd> to bookmark it. Everything stays on this device.</p>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'notes', label: 'Notes', icon: <NotebookPen />, count: Object.keys(notes).length },
          { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark />, count: Object.keys(bookmarks).length },
          { id: 'later', label: 'Review later', icon: <BookmarkX />, count: Object.keys(later).length },
          { id: 'history', label: 'Recent', icon: <History />, count: history.length },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === 'notes' && (
          <div className="stack gap-3">
            <div className="search-input" style={{ maxWidth: 360 }}>
              <Search />
              <input className="input" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
            </div>
            {noteList.length === 0 && (
              <Card pad="md">
                <EmptyState icon={<NotebookPen />} title="No notes yet">Open any lesson or dataset and press n.</EmptyState>
              </Card>
            )}
            {noteList.map(([key, n]) => (
              <Card key={key}>
                <CardHeader
                  title={<Link to={n.context}>{n.title}</Link>}
                  subtitle={`Updated ${new Date(n.updatedAt).toLocaleString()}`}
                  actions={
                    <IconButton label="Delete note" size="sm" onClick={() => deleteNote(key)}>
                      <Trash2 />
                    </IconButton>
                  }
                />
                <div className="card__body">
                  <Markdown source={n.text} compact />
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab === 'bookmarks' && (
          <Card>
            <ul className="list-reset" style={{ padding: 8 }}>
              {Object.values(bookmarks)
                .sort((a, b) => b.addedAt - a.addedAt)
                .map((b) => (
                  <li key={b.path} className="row gap-2">
                    <Link to={b.path} className="link-row grow" style={{ fontSize: 14 }}>
                      <span className="grow">{b.title}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {b.kind}
                      </span>
                    </Link>
                    <IconButton label="Remove bookmark" size="sm" onClick={() => toggleBookmark(b)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                ))}
              {Object.keys(bookmarks).length === 0 && <li className="muted" style={{ padding: 16, fontSize: 13.5 }}>No bookmarks yet.</li>}
            </ul>
          </Card>
        )}
        {tab === 'later' && (
          <Card>
            <ul className="list-reset" style={{ padding: 8 }}>
              {Object.keys(later).map((id) => {
                const it = items?.byId.get(id);
                return (
                  <li key={id} className="row gap-2">
                    <Link to={`/practice?ids=${id}`} className="link-row grow" style={{ fontSize: 14 }}>
                      {it ? itemTitle(it) : id}
                    </Link>
                    <IconButton label="Remove" size="sm" onClick={() => toggleLater(id)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                );
              })}
              {Object.keys(later).length === 0 && <li className="muted" style={{ padding: 16, fontSize: 13.5 }}>Flag exercises with the bookmark icon to review them later.</li>}
            </ul>
          </Card>
        )}
        {tab === 'history' && (
          <Card>
            <ul className="list-reset" style={{ padding: 8 }}>
              {history.map((h) => (
                <li key={h.path}>
                  <Link to={h.path} className="link-row" style={{ fontSize: 14 }}>
                    <span className="grow">{h.title}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(h.ts).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
