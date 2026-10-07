import { Children, isValidElement, lazy, memo, Suspense, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import { Link } from 'react-router';
import clsx from 'clsx';
import {
  CircleQuestionMark,
  Hash,
  CodeXml,
  Lightbulb,
  Sigma,
  Stethoscope,
  MessagesSquare,
  TriangleAlert,
  Layers,
  Info,
  Building,
  Bot,
  BadgeCheck,
  Users,
  FlaskConical,
  Link2,
} from 'lucide-react';
import { remarkCbmos, type LineEntry } from './remark-cbmos';
import { CodeBlock } from '../code/CodeBlock';
import { Disclosure, Loading } from '../ui';
import { CONTAINER_DIRECTIVES } from '../../content/vocab';
import { useSettings } from '../../state/settings';
import './prose.css';

const Embed = lazy(() => import('./embeds'));
const Term = lazy(() => import('./Term'));

const DISCLOSURE_ICONS: Record<string, ReactNode> = {
  why: <CircleQuestionMark />,
  number: <Hash />,
  line: <CodeXml />,
  intuition: <Lightbulb />,
  math: <Sigma />,
  clinical: <Stethoscope />,
  interview: <MessagesSquare />,
  mistake: <TriangleAlert />,
  deeper: <Layers />,
};

const CALLOUT_ICONS: Record<string, ReactNode> = {
  note: <Info />,
  tip: <Lightbulb />,
  warning: <TriangleAlert />,
  industry: <Building />,
  ai: <Bot />,
  official: <BadgeCheck />,
  convention: <Users />,
  simplification: <FlaskConical />,
};

const STANDARD_TITLES: Record<string, string> = {
  official: 'Official requirement',
  convention: 'Industry convention',
  simplification: 'Educational simplification',
};

/** Extracts plain text from rendered children (for heading ids). */
export function childrenText(children: ReactNode): string {
  let out = '';
  Children.forEach(children, (c) => {
    if (typeof c === 'string' || typeof c === 'number') out += String(c);
    else if (isValidElement<{ children?: ReactNode }>(c)) out += childrenText(c.props.children);
  });
  return out;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function Label({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function splitLabel(children: ReactNode): { label: ReactNode | null; rest: ReactNode[] } {
  let label: ReactNode | null = null;
  const rest: ReactNode[] = [];
  Children.forEach(children, (c) => {
    if (label === null && isValidElement<{ children?: ReactNode }>(c) && c.type === Label) label = c.props.children;
    else rest.push(c);
  });
  return { label, rest };
}

type HastNode = { properties?: Record<string, unknown>; children?: HastNode[]; tagName?: string };

function parseMeta(meta: string): { title?: string; highlight?: Set<number> } {
  const out: { title?: string; highlight?: Set<number> } = {};
  const title = meta.match(/title="([^"]*)"/);
  if (title) out.title = title[1];
  const hl = meta.match(/highlight="([^"]*)"/);
  if (hl) {
    const set = new Set<number>();
    for (const part of hl[1].split(',')) {
      const [a, b] = part.split('-').map((x) => Number(x.trim()));
      if (!Number.isFinite(a)) continue;
      for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) set.add(i);
    }
    out.highlight = set;
  }
  return out;
}

function TabsBlock({ children }: { children?: ReactNode }) {
  const tabs: { label: ReactNode; text: string; content: ReactNode[] }[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement<{ children?: ReactNode }>(c) && c.type === TabPanel) {
      const { label, rest } = splitLabel(c.props.children);
      tabs.push({ label, text: childrenText(label), content: rest });
    }
  });
  const preferred = useSettings((s) => s.codeTab);
  const setSettings = useSettings((s) => s.set);
  const initial = Math.max(0, tabs.findIndex((t) => t.text === preferred));
  const [active, setActive] = useState(initial);
  const idx = Math.min(active, tabs.length - 1);
  if (tabs.length === 0) return null;
  return (
    <div className="md-tabs">
      <div className="md-tabs__list" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            className="md-tabs__tab"
            onClick={() => {
              setActive(i);
              if (['SAS', 'R', 'Python', 'SQL'].includes(t.text)) setSettings({ codeTab: t.text });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="md-tabs__panel" role="tabpanel">
        {tabs[idx].content}
      </div>
    </div>
  );
}

function TabPanel({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function Columns({ children }: { children?: ReactNode }) {
  return <div className="md-columns">{children}</div>;
}

function Column({ children }: { children?: ReactNode }) {
  const { label, rest } = splitLabel(children);
  return (
    <div className="md-col">
      {label && <div className="md-col__label">{label}</div>}
      <div className="md-col__body">{rest}</div>
    </div>
  );
}

interface MarkdownProps {
  source: string;
  className?: string;
  /** Compact typography for items, hints and explanations. */
  compact?: boolean;
  /** Render without a wrapping block (for short inline strings). */
  inline?: boolean;
}

function MarkdownImpl({ source, className, compact, inline }: MarkdownProps) {
  const components = useMemo<Components>(() => {
    const c: Record<string, unknown> = {
      'cb-label': Label,
      'cb-disclosure': ({ kind, children }: { kind?: string; children?: ReactNode }) => {
        const k = kind ?? 'why';
        const { label, rest } = splitLabel(children);
        const fallback = (CONTAINER_DIRECTIVES as Record<string, { defaultLabel: string }>)[k]?.defaultLabel ?? 'More';
        return (
          <Disclosure kind={k} label={label ?? fallback} icon={DISCLOSURE_ICONS[k]}>
            {rest}
          </Disclosure>
        );
      },
      'cb-callout': ({ kind, standard, source: src, children }: { kind?: string; standard?: string; source?: string; children?: ReactNode }) => {
        const k = kind ?? 'note';
        const { label, rest } = splitLabel(children);
        const variant = k === 'standard' ? (standard ?? 'convention') : k;
        const fallback = (CONTAINER_DIRECTIVES as Record<string, { defaultLabel: string }>)[k]?.defaultLabel;
        return (
          <aside className={clsx('callout', `callout--${variant}`)}>
            <span className="callout__icon">{CALLOUT_ICONS[variant] ?? <Info />}</span>
            <div className="callout__body">
              {k === 'standard' && (
                <div className="callout__meta">
                  {STANDARD_TITLES[variant] ?? 'Standards'}
                  {src ? ` · ${src}` : ''}
                </div>
              )}
              {(label || (k !== 'standard' && k !== 'note' && fallback)) && (
                <div className="callout__title">{label ?? fallback}</div>
              )}
              <div className="callout__content">{rest}</div>
            </div>
          </aside>
        );
      },
      'cb-tabs': TabsBlock,
      'cb-tab': TabPanel,
      'cb-columns': Columns,
      'cb-col': Column,
      'cb-embed': ({ name, attrs }: { name?: string; attrs?: string }) => {
        let parsed: Record<string, string> = {};
        try {
          parsed = JSON.parse(attrs ?? '{}');
        } catch {
          /* ignore */
        }
        return (
          <Suspense fallback={<Loading />}>
            <Embed name={name ?? ''} attrs={parsed} />
          </Suspense>
        );
      },
      'cb-term': ({ refid, children }: { refid?: string; children?: ReactNode }) => (
        <Suspense fallback={<span className="md-term">{children}</span>}>
          <Term id={refid ?? ''}>{children}</Term>
        </Suspense>
      ),
      pre: ({ node }: { node?: HastNode }) => {
        const code = node?.children?.[0];
        const props = code?.properties ?? {};
        const cls = (props.className as string[] | undefined) ?? [];
        const lang = (cls.find((x) => x.startsWith('language-')) ?? 'language-text').replace('language-', '');
        const text = (code?.children ?? []).map((ch) => (ch as unknown as { value?: string }).value ?? '').join('');
        const meta = parseMeta(String(props.dataMeta ?? ''));
        let lines: LineEntry[] = [];
        if (props.dataLines) {
          try {
            lines = JSON.parse(String(props.dataLines));
          } catch {
            lines = [];
          }
        }
        return (
          <CodeBlock
            code={text}
            lang={lang}
            title={meta.title}
            highlight={meta.highlight}
            explanations={lines.map((l) => ({ from: l.from, to: l.to, content: <Markdown source={l.text} compact /> }))}
          />
        );
      },
      table: ({ children }: { children?: ReactNode }) => (
        <div className="md-table">
          <table>{children}</table>
        </div>
      ),
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        if (href && (href.startsWith('/') || href.startsWith('#/'))) {
          return <Link to={href.replace(/^#/, '')}>{children}</Link>;
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        );
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const id = slugify(childrenText(children));
        return (
          <h2 id={id} className="md-h2">
            <a href={`#${id}`} className="md-anchor" aria-label="Link to section" onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}>
              <Link2 />
            </a>
            {children}
          </h2>
        );
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const id = slugify(childrenText(children));
        return (
          <h3 id={id} className="md-h3">
            {children}
          </h3>
        );
      },
    };
    return c as Components;
  }, []);

  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkCbmos as never]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
      components={components}
    >
      {source}
    </ReactMarkdown>
  );
  if (inline) return <span className={clsx('prose prose--inline', className)}>{body}</span>;
  return <div className={clsx('prose', compact && 'prose--compact', className)}>{body}</div>;
}

export const Markdown = memo(MarkdownImpl);
