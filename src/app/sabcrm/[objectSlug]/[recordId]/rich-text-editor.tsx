'use client';

/**
 * SabCRM — dependency-free rich-text editor + HTML sanitizer (Twenty fidelity).
 *
 * A tiny `contentEditable`-based block editor for note / activity bodies. There
 * is NO npm dependency here: formatting runs through `document.execCommand`
 * (acceptable for this scope) and the produced markup is normalized + sanitized
 * to a small allow-list before it ever leaves the component or hits the DOM.
 *
 * Two exports:
 *   - `RichTextEditor` — the composer surface: a Twenty-style toolbar
 *     (Bold / Italic / bullet list / numbered list / link / clear-formatting)
 *     above a `contentEditable` div. Emits a *sanitized* HTML string via
 *     `onChange`, and submits the parent on ⌘/Ctrl+Enter.
 *   - `sanitizeRichText` + `RichTextView` — render a stored body as HTML, but
 *     only after stripping `<script>` / `<style>`, every `on*` handler, and any
 *     non-allow-listed tag/attribute. Plain-text bodies (legacy entries with no
 *     tags) fall through unchanged as text.
 *
 * Styling lives in `rich-text.css` (`.rte-*` namespace, shared Twenty `--st-*`
 * tokens) — NO ZoruUI / Tailwind / clay.
 */

import * as React from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Eraser,
} from 'lucide-react';

import './rich-text.css';

// ---------------------------------------------------------------------------
// Sanitization (no library — small allow-list pass)
// ---------------------------------------------------------------------------

/** Inline + block tags the editor is allowed to emit / render. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'A',
  'UL',
  'OL',
  'LI',
  'P',
  'BR',
  'DIV',
  'SPAN',
]);

/** Per-tag attribute allow-list. Anything else (incl. every `on*`) is dropped. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  A: new Set(['href', 'target', 'rel']),
};

/** Only these URL schemes are permitted on links; everything else is dropped. */
const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

/**
 * Strip a string down to the tag/attribute allow-list above. Runs entirely in
 * the DOM (parse → walk → rebuild) so there's no regex-soup HTML parsing:
 *   - `<script>` / `<style>` and their contents are removed wholesale,
 *   - any tag not in `ALLOWED_TAGS` is unwrapped (its safe children survive),
 *   - every attribute not explicitly allowed for its tag is removed — this
 *     covers all `on*` event handlers and `style`,
 *   - `href`s with an unsafe scheme (e.g. `javascript:`) are dropped, and any
 *     surviving link is forced to `target="_blank"` + `rel="noopener..."`.
 *
 * Returns sanitized HTML. On the server (no `document`) it falls back to a
 * tag-stripping pass so a stray SSR call can't inject markup.
 */
export function sanitizeRichText(input: string): string {
  if (!input) return '';
  if (typeof document === 'undefined') {
    // SSR / non-DOM fallback: strip all tags, keep text.
    return input.replace(/<[^>]*>/g, '');
  }

  const template = document.createElement('template');
  template.innerHTML = input;

  const walk = (node: Node): void => {
    // Iterate over a static copy — we mutate children as we go.
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        // Comments / CDATA / processing instructions → drop.
        child.parentNode?.removeChild(child);
        continue;
      }

      const el = child as HTMLElement;
      const tag = el.tagName.toUpperCase();

      if (tag === 'SCRIPT' || tag === 'STYLE') {
        el.parentNode?.removeChild(el);
        continue;
      }

      // Recurse first so an unwrapped element's children are already clean.
      walk(el);

      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: splice the (already-sanitized) children in place of the tag.
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        continue;
      }

      // Scrub attributes against the per-tag allow-list.
      const allowed = ALLOWED_ATTRS[tag];
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (!allowed || !allowed.has(name)) {
          el.removeAttribute(attr.name);
        }
      }

      // Link hardening: drop unsafe schemes, force safe rel/target.
      if (tag === 'A') {
        const href = el.getAttribute('href') ?? '';
        if (!SAFE_HREF.test(href.trim())) {
          el.removeAttribute('href');
        } else {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
}

/** True when a stored body carries HTML markup (vs. a legacy plain-text note). */
export function isHtmlBody(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/** True when sanitized HTML has no visible text and no list/line content. */
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').trim() === '';
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  const hasText = (el.textContent ?? '').replace(/ /g, '').trim() !== '';
  const hasBlocks = el.querySelector('li, br') !== null;
  return !hasText && !hasBlocks;
}

// ---------------------------------------------------------------------------
// Read-only renderer
// ---------------------------------------------------------------------------

interface RichTextViewProps {
  /** Stored body — either sanitized HTML or a legacy plain-text string. */
  body: string;
  className?: string;
}

/**
 * Render a stored note/activity body. HTML bodies are sanitized and injected;
 * legacy plain-text bodies render as text (preserving line breaks via CSS).
 */
export function RichTextView({
  body,
  className,
}: RichTextViewProps): React.JSX.Element {
  const cls = `rte-view${className ? ` ${className}` : ''}`;
  if (isHtmlBody(body)) {
    const clean = sanitizeRichText(body);
    return (
      <div
        className={cls}
        // Sanitized above: script/style removed, on* + non-allow-listed attrs
        // stripped, unsafe link schemes dropped.
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  return <div className={`${cls} rte-view--plain`}>{body}</div>;
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type Command =
  | { kind: 'exec'; command: string }
  | { kind: 'list'; command: 'insertUnorderedList' | 'insertOrderedList' }
  | { kind: 'link' }
  | { kind: 'clear' };

interface ToolbarButton {
  id: string;
  label: string;
  icon: typeof Bold;
  command: Command;
}

const TOOLBAR: readonly ToolbarButton[] = [
  { id: 'bold', label: 'Bold', icon: Bold, command: { kind: 'exec', command: 'bold' } },
  { id: 'italic', label: 'Italic', icon: Italic, command: { kind: 'exec', command: 'italic' } },
  {
    id: 'ul',
    label: 'Bulleted list',
    icon: List,
    command: { kind: 'list', command: 'insertUnorderedList' },
  },
  {
    id: 'ol',
    label: 'Numbered list',
    icon: ListOrdered,
    command: { kind: 'list', command: 'insertOrderedList' },
  },
  { id: 'link', label: 'Insert link', icon: Link2, command: { kind: 'link' } },
  {
    id: 'clear',
    label: 'Clear formatting',
    icon: Eraser,
    command: { kind: 'clear' },
  },
] as const;

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  /** Sanitized HTML string emitted on each edit. */
  value: string;
  onChange: (html: string) => void;
  /** Fired on ⌘/Ctrl+Enter so the parent form can submit. */
  onSubmit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * A small `contentEditable` rich-text surface with a Twenty-style toolbar.
 * `document.execCommand` powers Bold / Italic / lists; links are inserted from a
 * prompt and clear-formatting strips inline marks + lists from the selection.
 * Every emitted value is run through `sanitizeRichText` first.
 */
export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  disabled,
}: RichTextEditorProps): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement | null>(null);

  // Keep the DOM in sync with controlled `value` ONLY when they diverge — never
  // while the user is typing (that would reset the caret on every keystroke).
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  // Read the current DOM, sanitize it, and push it up.
  const emit = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onChange(sanitizeRichText(el.innerHTML));
  }, [onChange]);

  // Run a toolbar command against the live selection, then re-emit.
  const run = React.useCallback(
    (command: Command) => {
      const el = ref.current;
      if (!el || disabled) return;
      el.focus();

      switch (command.kind) {
        case 'exec':
        case 'list':
          document.execCommand(command.command, false);
          break;
        case 'link': {
          const url = window.prompt('Link URL', 'https://');
          if (url && SAFE_HREF.test(url.trim())) {
            document.execCommand('createLink', false, url.trim());
          }
          break;
        }
        case 'clear': {
          // Strip inline marks, then collapse any list back to plain blocks.
          document.execCommand('removeFormat', false);
          document.execCommand('unlink', false);
          break;
        }
      }
      emit();
    },
    [disabled, emit],
  );

  const isEmpty = isRichTextEmpty(value);

  return (
    <div className={`rte${disabled ? ' is-disabled' : ''}`}>
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLBAR.map(({ id, label, icon: Icon, command }) => (
          <button
            key={id}
            type="button"
            className="rte-toolbar__btn"
            // Keep the selection: prevent the editor from blurring on mousedown.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            disabled={disabled}
            aria-label={label}
            title={label}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className={`rte-input${isEmpty ? ' is-empty' : ''}`}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </div>
  );
}

export default RichTextEditor;
