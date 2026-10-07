/**
 * remark plugin: turns our directive syntax into custom hast elements that the
 * Markdown component maps to React components.
 *
 *   :::why[Label] … :::        → <cb-disclosure kind="why"><cb-label>Label</cb-label>…</cb-disclosure>
 *   :::note / :::standard …    → <cb-callout kind="note" …>
 *   ::::tabs / :::tab[SAS]     → <cb-tabs><cb-tab>…</cb-tab></cb-tabs>
 *   ::::columns / :::col[x]    → <cb-columns><cb-col>…</cb-col></cb-columns>
 *   :::lines (after a code block) → attached to that code block as line explanations
 *   ::dataset{…} etc.          → <cb-embed name="dataset" attrs="{…}">
 *   :kbd[⌘K] :var[TRT01P] :term[TEAE]{id=teae}
 *
 * Unknown inline directives (e.g. the "1" in "3:1") are turned back into text.
 */
import { visit, SKIP } from 'unist-util-visit';
import { CONTAINER_DIRECTIVES } from '../../content/vocab';

interface Node {
  type: string;
  name?: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  attributes?: Record<string, string | null | undefined> | null;
  children?: Node[];
  data?: Record<string, unknown> & { directiveLabel?: boolean; hName?: string; hProperties?: Record<string, unknown> };
  position?: { start: { offset?: number; line: number }; end: { offset?: number; line: number } };
}

const DISCLOSURE = new Set(['why', 'number', 'line', 'intuition', 'math', 'clinical', 'interview', 'mistake', 'deeper']);
const CALLOUT = new Set(['note', 'tip', 'warning', 'industry', 'ai', 'standard']);

export interface LineEntry {
  from: number;
  to: number;
  text: string;
}

/** Parses the body of a :::lines block into entries. */
export function parseLineEntries(body: string): LineEntry[] {
  const entries: LineEntry[] = [];
  for (const raw of body.split('\n')) {
    const m = raw.match(/^\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*:\s?(.*)$/);
    if (m) {
      const from = Number(m[1]);
      const to = m[2] ? Number(m[2]) : from;
      entries.push({ from, to: Math.max(from, to), text: m[3] });
    } else if (entries.length && raw.trim()) {
      entries[entries.length - 1].text += `\n${raw.trim()}`;
    }
  }
  return entries;
}

function textOf(n: Node): string {
  if (typeof n.value === 'string') return n.value;
  return (n.children ?? []).map(textOf).join('');
}

export function remarkCbmos() {
  return (tree: Node, file: { value?: unknown }) => {
    const source = typeof file.value === 'string' ? file.value : String(file.value ?? '');

    visit(tree as never, (node: Node, index: number | undefined, parent: Node | undefined) => {
      if (node.type === 'code') {
        node.data = { ...(node.data ?? {}), hProperties: { ...((node.data?.hProperties as object) ?? {}), dataMeta: node.meta ?? '' } };
        return;
      }

      if (node.type === 'containerDirective') {
        const name = node.name ?? '';
        if (name === 'lines' && parent && index !== undefined) {
          const start = node.position?.start.offset;
          const end = node.position?.end.offset;
          let body = '';
          if (start !== undefined && end !== undefined) {
            const raw = source.slice(start, end).split('\n');
            body = raw.slice(1, raw.length - 1).join('\n');
          } else {
            body = textOf(node);
          }
          const entries = parseLineEntries(body);
          // Find the nearest preceding code block sibling.
          for (let i = index - 1; i >= 0; i--) {
            const prev = parent.children![i];
            if (prev.type === 'code') {
              prev.data = {
                ...(prev.data ?? {}),
                hProperties: { ...((prev.data?.hProperties as object) ?? {}), dataLines: JSON.stringify(entries), dataMeta: prev.meta ?? '' },
              };
              break;
            }
            if (prev.type !== 'containerDirective') break;
          }
          parent.children!.splice(index, 1);
          return [SKIP, index];
        }

        // Mark the label paragraph.
        const first = node.children?.[0];
        if (first?.data?.directiveLabel) first.data = { ...first.data, hName: 'cb-label' };
        const attrs = node.attributes ?? {};

        let hName = 'div';
        const hProperties: Record<string, unknown> = { kind: name };
        if (DISCLOSURE.has(name)) hName = 'cb-disclosure';
        else if (CALLOUT.has(name)) {
          hName = 'cb-callout';
          if (name === 'standard') {
            hProperties.standard = attrs.kind ?? 'convention';
            if (attrs.source) hProperties.source = attrs.source;
          }
        } else if (name === 'tabs') hName = 'cb-tabs';
        else if (name === 'tab') hName = 'cb-tab';
        else if (name === 'columns') hName = 'cb-columns';
        else if (name === 'col') hName = 'cb-col';
        else if (!(name in CONTAINER_DIRECTIVES)) hName = 'div';
        node.data = { ...(node.data ?? {}), hName, hProperties };
        return;
      }

      if (node.type === 'leafDirective') {
        node.data = {
          ...(node.data ?? {}),
          hName: 'cb-embed',
          hProperties: { name: node.name ?? '', attrs: JSON.stringify(node.attributes ?? {}) },
          hChildren: [],
        };
        return;
      }

      if (node.type === 'textDirective' && parent && index !== undefined) {
        const name = node.name ?? '';
        if (name === 'kbd') {
          node.data = { ...(node.data ?? {}), hName: 'kbd', hProperties: { className: ['kbd'] } };
          return;
        }
        if (name === 'var') {
          node.data = { ...(node.data ?? {}), hName: 'code', hProperties: { className: ['var'] } };
          return;
        }
        if (name === 'term') {
          node.data = { ...(node.data ?? {}), hName: 'cb-term', hProperties: { refid: node.attributes?.id ?? '' } };
          return;
        }
        // Not a directive: restore the original text (e.g. ratios like 3:1).
        const label = node.children?.length ? `[${textOf(node)}]` : '';
        const attrs = node.attributes && Object.keys(node.attributes).length
          ? `{${Object.entries(node.attributes).map(([k, v]) => `${k}="${v ?? ''}"`).join(' ')}}`
          : '';
        parent.children!.splice(index, 1, { type: 'text', value: `:${name}${label}${attrs}` });
        return [SKIP, index + 1];
      }
      return;
    });
  };
}
