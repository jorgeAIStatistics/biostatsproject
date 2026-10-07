import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { Search, Library, ExternalLink } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useReference, lessonById } from '../../content/registry';
import { Badge, Card, EmptyState, Loading } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { CodeBlock } from '../../components/code/CodeBlock';
import './reference.css';

const STD_TONE = { official: 'accent', convention: 'neutral', simplification: 'warning' } as const;

export default function ReferencePage() {
  const { category, entryId } = useParams<{ category?: string; entryId?: string }>();
  const ref = useReference();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const cat = ref?.categories.find((c) => c.category === category);
  const entry = entryId ? ref?.byId.get(entryId) : undefined;
  usePage(entry?.term ?? cat?.title ?? 'Reference Library', [{ label: 'Reference', to: '/reference' }, ...(cat && entry ? [{ label: cat.title, to: `/reference/${cat.category}` }] : [])], 'reference');

  const results = useMemo(() => {
    if (!ref) return [];
    const query = q.trim().toLowerCase();
    const pool = cat ? cat.entries.map((e) => ({ ...e, category: cat.category })) : [...ref.byId.values()];
    if (!query) return cat ? pool : [];
    return pool
      .map((e) => {
        const hay = `${e.term} ${e.aliases.join(' ')}`.toLowerCase();
        const score = hay === query ? 3 : hay.startsWith(query) ? 2 : hay.includes(query) ? 1.5 : `${e.summary} ${e.body ?? ''}`.toLowerCase().includes(query) ? 1 : 0;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.e.term.localeCompare(b.e.term))
      .map((x) => x.e)
      .slice(0, 200);
  }, [ref, q, cat]);

  if (!ref) return <div className="page"><Loading /></div>;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Keep it open during coursework</div>
        <h1 className="page-title">Reference library</h1>
        <p className="page-lede">
          Fast lookups for SAS syntax and procedures, R and pandas functions, SQL, statistical distributions and tests, clinical-trial and survival terminology,
          SDTM domains, ADaM variables, regulatory concepts and abbreviations.
        </p>
      </div>
      <div className="ref-layout">
        <nav className="ref-nav" aria-label="Reference categories">
          <Link to="/reference" className={clsx('ref-nav__item', !category && 'is-active')}>
            All categories
          </Link>
          {ref.categories.map((c) => (
            <Link key={c.category} to={`/reference/${c.category}`} className={clsx('ref-nav__item', category === c.category && 'is-active')}>
              <span className="grow">{c.title}</span>
              <span className="num muted">{c.entries.length}</span>
            </Link>
          ))}
        </nav>
        <div className="stack gap-4" style={{ minWidth: 0 }}>
          <div className="search-input">
            <Search />
            <input
              className="input"
              style={{ height: 38, fontSize: 14 }}
              placeholder={cat ? `Search ${cat.title}…` : 'Search every reference entry (e.g. RETAIN, TRTEMFL, coxph, XLOOKUP, hazard ratio)…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search reference"
            />
          </div>

          {entry ? (
            <Card pad="md">
              <div className="stack gap-3">
                <div className="row gap-2 wrap">
                  <h2 style={{ fontSize: 22 }} className="mono">
                    {entry.term}
                  </h2>
                  {entry.standard && <Badge tone={STD_TONE[entry.standard]}>{entry.standard}</Badge>}
                </div>
                {entry.aliases.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>Also: {entry.aliases.join(', ')}</div>}
                <Markdown source={entry.summary} />
                {entry.syntax && <CodeBlock code={entry.syntax} lang={entry.language ?? 'text'} title="Syntax" compact />}
                {entry.body && <Markdown source={entry.body} compact />}
                {entry.example && <CodeBlock code={entry.example} lang={entry.language ?? 'text'} title="Example" compact />}
                {entry.source && (
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Source:{' '}
                    {entry.source.url ? (
                      <a href={entry.source.url} target="_blank" rel="noreferrer noopener">
                        {entry.source.label} <ExternalLink size={11} style={{ display: 'inline' }} />
                      </a>
                    ) : (
                      entry.source.label
                    )}
                  </div>
                )}
                {entry.related.length > 0 && (
                  <div className="row gap-2 wrap">
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      Related:
                    </span>
                    {entry.related.map((r) => {
                      const re = ref.byId.get(r);
                      const le = lessonById.get(r);
                      if (re)
                        return (
                          <Link key={r} to={`/reference/${re.category}/${re.id}`} className="tag">
                            {re.term}
                          </Link>
                        );
                      if (le)
                        return (
                          <Link key={r} to={`/learn/${le.lab}/${le.id}`} className="tag">
                            Lesson: {le.title}
                          </Link>
                        );
                      return null;
                    })}
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          {!entry && !cat && !q.trim() && (
            <div className="grid grid-auto">
              {ref.categories.map((c) => (
                <Link key={c.category} to={`/reference/${c.category}`} className="card card--interactive card--pad">
                  <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 620 }}>{c.title}</span>
                    <Badge>{c.entries.length}</Badge>
                  </div>
                  <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                    {c.description}
                  </p>
                </Link>
              ))}
              {ref.categories.length === 0 && (
                <Card pad="md">
                  <EmptyState icon={<Library />} title="The reference library is empty">Entries live in content/reference/*.yaml.</EmptyState>
                </Card>
              )}
            </div>
          )}

          {!entry && (cat || q.trim()) && (
            <Card>
              <ul className="list-reset ref-list">
                {results.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="ref-row" onClick={() => navigate(`/reference/${e.category}/${e.id}`)}>
                      <span className="ref-row__term mono">{e.term}</span>
                      <span className="ref-row__summary">
                        <Markdown source={e.summary} inline compact />
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && <li className="muted" style={{ padding: 16, fontSize: 13.5 }}>No entries match.</li>}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
