/**
 * Static syntax highlighting with the same Lezer/CodeMirror grammars the
 * editors use, so read-only code blocks and editable code look identical.
 */
import { StreamLanguage, type Language } from '@codemirror/language';
import { sas } from '@codemirror/legacy-modes/mode/sas';
import { r } from '@codemirror/legacy-modes/mode/r';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { xml } from '@codemirror/legacy-modes/mode/xml';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { pythonLanguage } from '@codemirror/lang-python';
import { SQLite } from '@codemirror/lang-sql';
import { highlightCode, tagHighlighter, tags as t } from '@lezer/highlight';

export const tokenHighlighter = tagHighlighter([
  { tag: t.keyword, class: 'tok-keyword' },
  { tag: [t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], class: 'tok-keyword' },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], class: 'tok-string' },
  { tag: [t.number, t.bool, t.null, t.atom], class: 'tok-number' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], class: 'tok-comment' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-function' },
  { tag: t.standard(t.variableName), class: 'tok-builtin' },
  { tag: [t.special(t.variableName), t.macroName], class: 'tok-macro' },
  { tag: [t.definition(t.variableName)], class: 'tok-def' },
  { tag: [t.typeName, t.className, t.namespace], class: 'tok-type' },
  { tag: [t.propertyName, t.attributeName], class: 'tok-property' },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator], class: 'tok-operator' },
  { tag: [t.meta, t.processingInstruction], class: 'tok-meta' },
  { tag: [t.inserted], class: 'tok-inserted' },
  { tag: [t.deleted], class: 'tok-deleted' },
  { tag: [t.heading], class: 'tok-heading' },
  { tag: [t.tagName], class: 'tok-keyword' },
  { tag: t.invalid, class: 'tok-invalid' },
]);

const cache = new Map<string, Language>();

export function languageFor(lang: string): Language | null {
  const key = lang.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  let language: Language | null = null;
  switch (key) {
    case 'sas':
      language = StreamLanguage.define(sas);
      break;
    case 'r':
      language = StreamLanguage.define(r);
      break;
    case 'python':
    case 'py':
      language = pythonLanguage;
      break;
    case 'sql':
      language = SQLite.language;
      break;
    case 'bash':
    case 'sh':
    case 'shell':
      language = StreamLanguage.define(shell);
      break;
    case 'yaml':
      language = StreamLanguage.define(yaml);
      break;
    case 'xml':
      language = StreamLanguage.define(xml);
      break;
    case 'diff':
      language = StreamLanguage.define(diff);
      break;
    case 'json':
      language = StreamLanguage.define(json);
      break;
    default:
      language = null;
  }
  if (language) cache.set(key, language);
  return language;
}

export interface Token {
  text: string;
  cls: string;
}

/** Split code into lines of classed tokens. */
export function highlightLines(code: string, lang: string): Token[][] {
  const source = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const l = lang.toLowerCase();
  if (l === 'log') return highlightLog(source);
  if (l === 'excel') return source.split('\n').map(highlightExcelLine);
  const language = languageFor(l);
  if (!language) return source.split('\n').map((line) => [{ text: line, cls: '' }]);
  const tree = language.parser.parse(source);
  const lines: Token[][] = [[]];
  highlightCode(
    source,
    tree,
    tokenHighlighter,
    (text, classes) => lines[lines.length - 1].push({ text, cls: classes }),
    () => lines.push([]),
  );
  return lines;
}

/** SAS log colouring: program echo, ERROR / WARNING / NOTE blocks. */
function highlightLog(source: string): Token[][] {
  let current = '';
  return source.split('\n').map((line) => {
    if (/^ERROR\b/.test(line)) current = 'log-error';
    else if (/^WARNING\b/.test(line)) current = 'log-warning';
    else if (/^NOTE\b/.test(line)) current = 'log-note';
    else if (/^INFO\b/.test(line)) current = 'log-note';
    else if (/^\s*\d+\s{2,}/.test(line) || /^\s*\d+\s*$/.test(line)) current = 'log-echo';
    else if (/^\s{2,}\S/.test(line) && current && current !== 'log-echo') {
      /* continuation of the previous message */
    } else if (line.trim() === '') current = '';
    else if (current === 'log-echo') current = 'log-plain';
    return [{ text: line, cls: current }];
  });
}

const EXCEL_TOKEN = /("(?:[^"]|"")*")|(\b[A-Z][A-Z0-9.]*(?=\())|(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)|(\b\d+(?:\.\d+)?\b)|([=<>+\-*/&^,:;()])/g;

function highlightExcelLine(line: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(EXCEL_TOKEN)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index), cls: '' });
    const cls = m[1] ? 'tok-string' : m[2] ? 'tok-function' : m[3] ? 'tok-property' : m[4] ? 'tok-number' : 'tok-operator';
    out.push({ text: m[0], cls });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: '' });
  return out;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  sas: 'SAS',
  r: 'R',
  python: 'Python',
  sql: 'SQL',
  bash: 'Shell',
  yaml: 'YAML',
  json: 'JSON',
  csv: 'CSV',
  text: 'Text',
  output: 'Output',
  log: 'SAS log',
  excel: 'Excel',
  diff: 'Diff',
  xml: 'XML',
};

export const FILE_EXTENSIONS: Record<string, string> = {
  sas: 'sas',
  r: 'R',
  python: 'py',
  sql: 'sql',
  bash: 'sh',
  yaml: 'yaml',
  json: 'json',
  csv: 'csv',
  xml: 'xml',
};
