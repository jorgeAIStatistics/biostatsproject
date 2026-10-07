import { useEffect, useRef } from 'react';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  placeholder as placeholderExt,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { python } from '@codemirror/lang-python';
import { sql, SQLite } from '@codemirror/lang-sql';
import { sas } from '@codemirror/legacy-modes/mode/sas';
import { r } from '@codemirror/legacy-modes/mode/r';
import { tags as t } from '@lezer/highlight';
import './code.css';

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--tok-keyword)', fontWeight: '520' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--tok-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--tok-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.standard(t.variableName)], color: 'var(--tok-function)' },
  { tag: [t.special(t.variableName), t.macroName], color: 'var(--tok-macro)' },
  { tag: [t.typeName, t.className, t.definition(t.variableName), t.propertyName], color: 'var(--tok-type)' },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator], color: 'var(--tok-operator)' },
  { tag: [t.meta], color: 'var(--tok-meta)' },
]);

const theme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-text)',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '10px 0',
    caretColor: 'var(--accent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--code-line)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 10px',
    minWidth: '36px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--code-highlight)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft-2) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--accent-soft-2)',
    outline: 'none',
  },
  '.cm-placeholder': {
    color: 'var(--text-4)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow: 'var(--shadow-md)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--text)',
  },
});

export type EditorLanguage = 'sas' | 'r' | 'python' | 'sql' | 'text';

function languageExtension(lang: EditorLanguage, sqlSchema?: Record<string, string[]>): Extension {
  switch (lang) {
    case 'sas':
      return StreamLanguage.define(sas);
    case 'r':
      return StreamLanguage.define(r);
    case 'python':
      return python();
    case 'sql':
      return sql({ dialect: SQLite, schema: sqlSchema, upperCaseKeywords: true });
    default:
      return [];
  }
}

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: EditorLanguage;
  readOnly?: boolean;
  minHeight?: number;
  maxHeight?: number;
  height?: number | string;
  placeholder?: string;
  /** Called on Ctrl/Cmd+Enter. */
  onRun?: () => void;
  sqlSchema?: Record<string, string[]>;
  ariaLabel?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly,
  minHeight = 160,
  maxHeight,
  height,
  placeholder,
  onRun,
  sqlSchema,
  ariaLabel,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;
  const langCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
    const runKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          onRunRef.current?.();
          return true;
        },
      },
    ]);
    const state = EditorState.create({
      doc: value,
      extensions: [
        runKeymap,
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: language === 'sql' }),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
        syntaxHighlighting(highlightStyle),
        theme,
        EditorView.lineWrapping,
        placeholder ? placeholderExt(placeholder) : [],
        langCompartment.current.of(languageExtension(language, sqlSchema)),
        readOnlyCompartment.current.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? `${language.toUpperCase()} code editor` }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (reset, load solution) replace the document.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: langCompartment.current.reconfigure(languageExtension(language, sqlSchema)) });
  }, [language, sqlSchema]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  return (
    <div
      className="editor"
      ref={host}
      style={{ minHeight, maxHeight, height, overflow: maxHeight ? 'auto' : undefined, display: 'flex', flexDirection: 'column' }}
    />
  );
}
