'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Bold, Eraser } from 'lucide-react';
import { TEXT_BLAST_BLUE } from '../../lib/text-blast';

const DEFAULT_TEXT_COLOR = '#374151'; // Tailwind gray-700 — the editor's normal text colour

// Computed-style values the browser reports for the two colours (getComputedStyle uses rgb()).
const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const BLUE_RGB = toRgb(TEXT_BLAST_BLUE);

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Spaces are kept as &nbsp; where HTML would otherwise collapse them — most importantly the one
// after each "Label:", so the cursor lands after the space when the investigator starts typing.
const runHtml = (run) => {
  const text = escapeHtml(run.t).replace(/ {2}/g, ' &nbsp;').replace(/ $/, '&nbsp;').replace(/^ /, '&nbsp;');
  const style = [
    run.b && 'font-weight: 700',
    run.c === 'blue' && `color: ${TEXT_BLAST_BLUE}`,
  ].filter(Boolean).join('; ');
  return style ? `<span style="${style}">${text}</span>` : text;
};

const linesToHtml = (lines) =>
  lines.map((line) => `<div>${line.length ? line.map(runHtml).join('') : '<br>'}</div>`).join('');

// Reads the editor back into the lines/runs format of lib/text-blast.js. Formatting is taken from
// each text's computed style, so it works whatever markup the browser's editing produced.
function readLines(root) {
  const lines = [[]];
  const current = () => lines[lines.length - 1];

  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue.replace(/ /g, ' ').replace(/\n/g, '');
        if (!text) return;
        const style = getComputedStyle(child.parentElement);
        current().push({
          t: text,
          ...(Number(style.fontWeight) >= 600 ? { b: true } : {}),
          ...(style.color === BLUE_RGB ? { c: 'blue' } : {}),
        });
      } else if (child.nodeName === 'BR') {
        lines.push([]);
      } else if (child.nodeName === 'DIV' || child.nodeName === 'P') {
        if (current().length) lines.push([]);
        walk(child);
        if (current().length) lines.push([]);
      } else {
        walk(child);
      }
    });
  };

  walk(root);
  while (lines.length && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

const exec = (command, value = null) => {
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
};

const selectionStyle = () => {
  const node = window.getSelection()?.anchorNode;
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element ? getComputedStyle(element) : null;
};

// A small Word-like editor for the text blast: the template is typed in, the investigator writes
// after each label, deletes or adds lines freely, and selects text to make it bold or blue. `ref.current.getLines()` returns the content; `ref.current.setLines(lines)` loads.
const TextBlastEditor = forwardRef(function TextBlastEditor({ initialLines, onChange }, ref) {
  const editorRef = useRef(null);

  const emitChange = () => onChange?.(readLines(editorRef.current));

  useImperativeHandle(ref, () => ({
    getLines: () => readLines(editorRef.current),
    setLines: (lines) => {
      editorRef.current.innerHTML = linesToHtml(lines);
      emitChange();
    },
  }));

  useEffect(() => {
    editorRef.current.innerHTML = linesToHtml(initialLines);
    emitChange();
    // Loaded once; later template changes go through setLines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (command) => {
    editorRef.current.focus();
    if (command === 'blue') {
      exec('foreColor', selectionStyle()?.color === BLUE_RGB ? DEFAULT_TEXT_COLOR : TEXT_BLAST_BLUE);
    } else {
      exec(command);
    }
    emitChange();
  };

  // Pasted text keeps none of its outside formatting (fonts, sizes, links from Word or a website).
  const handlePaste = (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  const tools = [
    { command: 'bold', title: 'Bold (Ctrl+B)', icon: <Bold className="w-4 h-4" /> },
    { command: 'blue', title: 'Blue text', icon: <span className="text-base font-bold leading-none" style={{ color: TEXT_BLAST_BLUE }}>A</span> },
    { command: 'removeFormat', title: 'Clear formatting', icon: <Eraser className="w-4 h-4" /> },
  ];

  return (
    <div className="rounded-lg border border-gray-300 focus-within:border-bfp-navy focus-within:ring-1 focus-within:ring-bfp-navy">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5 rounded-t-lg" role="toolbar" aria-label="Formatting">
        {tools.map((tool) => (
          <button
            key={tool.command}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            // mousedown, not click: keeps the text selection the button is meant to format.
            onMouseDown={(e) => {
              e.preventDefault();
              apply(tool.command);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded text-gray-700 hover:bg-gray-200 ${tool.className || ''}`}
          >
            {tool.icon}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-gray-400 sm:inline">Select text, then pick a style</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text blast message"
        spellCheck
        onInput={emitChange}
        onPaste={handlePaste}
        className="min-h-[24rem] max-h-[70vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-700 focus:outline-none"
      />
    </div>
  );
});

export default TextBlastEditor;
