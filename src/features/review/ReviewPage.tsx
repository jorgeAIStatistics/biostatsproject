import { useMemo, useState } from 'react';
import { Repeat, CalendarClock } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useProgress, REVIEW_INTERVALS } from '../../state/progress';
import { useItems, itemTitle } from '../../content/registry';
import { ItemView } from '../../components/practice/ItemView';
import { Badge, Button, Card, EmptyState, Loading } from '../../components/ui';

/**
 * Spaced repetition. Missed items return after ~12 hours; each correct answer
 * moves an item up a Leitner box (1, 3, 7, 16, 35 days). "Review later" flags
 * are included until removed.
 */
export default function ReviewPage() {
  usePage('Review Queue');
  const reviews = useProgress((s) => s.reviews);
  const later = useProgress((s) => s.reviewLater);
  const index = useItems();
  const [pos, setPos] = useState(0);
  const [started, setStarted] = useState(false);

  const queue = useMemo(() => {
    if (!index) return [];
    const now = Date.now();
    const due = Object.entries(reviews)
      .filter(([id, r]) => r.due <= now && r.lastResult < 1 && index.byId.has(id))
      .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
      .map(([id]) => id);
    const flagged = Object.keys(later).filter((id) => index.byId.has(id) && !due.includes(id));
    return [...due, ...flagged].map((id) => index.byId.get(id)!);
    // Recompute only when the session starts, so answering doesn't reshuffle the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const buckets = new Map<string, number>();
    for (const r of Object.values(reviews)) {
      if (r.due <= now) continue;
      const days = Math.ceil((r.due - now) / 86_400_000);
      const key = days <= 1 ? 'Tomorrow' : days <= 7 ? `In ${days} days` : days <= 30 ? 'Within a month' : 'Later';
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()];
  }, [reviews]);

  if (!index) return <div className="page"><Loading /></div>;

  if (!started || queue.length === 0) {
    return (
      <div className="page page--narrow">
        <div className="page-header">
          <div className="eyebrow">Spaced repetition</div>
          <h1 className="page-title">Review queue</h1>
          <p className="page-lede">
            Anything you miss comes back soon; anything you answer correctly comes back later — after {REVIEW_INTERVALS.slice(1).join(', ')} days as it moves
            up. Retrieval spaced over time is what makes SAS syntax, CDISC variables and statistical reasoning stick through an 18–24 month programme.
          </p>
        </div>
        <Card pad="md">
          {queue.length === 0 ? (
            <EmptyState icon={<Repeat />} title="Nothing due right now">
              Items appear here after you practice: missed questions, questions due for spaced review, and anything you flag with “Review later”.
            </EmptyState>
          ) : (
            <div className="row gap-4 wrap" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 650 }} className="num">
                  {queue.length}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  item{queue.length === 1 ? '' : 's'} due · {Object.keys(later).length} flagged for later
                </div>
              </div>
              <Button variant="primary" icon={<Repeat />} onClick={() => { setPos(0); setStarted(true); }}>
                Start review
              </Button>
            </div>
          )}
        </Card>
        {queue.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <ul className="list-reset" style={{ padding: 8 }}>
              {queue.slice(0, 30).map((it) => (
                <li key={it.id} className="link-row" style={{ fontSize: 13.5 }}>
                  <span className="grow">{itemTitle(it)}</span>
                  {later[it.id] ? <Badge tone="warning">flagged</Badge> : <Badge tone="neutral">box {reviews[it.id]?.box ?? 0}</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {upcoming.length > 0 && (
          <Card style={{ marginTop: 16 }} pad="md">
            <div className="row gap-2" style={{ marginBottom: 8 }}>
              <CalendarClock size={15} />
              <span className="card__title">Coming up</span>
            </div>
            <div className="row gap-2 wrap">
              {upcoming.map(([k, n]) => (
                <Badge key={k} tone="neutral">
                  {k}: {n}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  const current = queue[Math.min(pos, queue.length - 1)];
  const done = pos >= queue.length;
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="row gap-3" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ fontSize: 22 }}>
          Review
        </h1>
        <span className="muted num">
          {Math.min(pos + 1, queue.length)} / {queue.length}
        </span>
      </div>
      {done ? (
        <Card pad="md">
          <EmptyState icon={<Repeat />} title="Review complete" action={<Button onClick={() => setStarted(false)}>Back to queue</Button>}>
            Items you missed will return in about half a day; the rest move to longer intervals.
          </EmptyState>
        </Card>
      ) : (
        <ItemView
          key={current.id}
          item={current}
          showLessonLink
          onNext={() => setPos((p) => p + 1)}
          nextLabel={pos < queue.length - 1 ? 'Next review' : 'Finish'}
        />
      )}
    </div>
  );
}
