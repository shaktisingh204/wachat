'use client';

/**
 * 20ui composite — dependency-free BLOCK rich-text editor + HTML sanitizer
 * (Twenty fidelity, BlockNote-style).
 *
 * Promoted VERBATIM from
 * `src/app/sabcrm/[objectSlug]/[recordId]/rich-text-editor.tsx` (a re-export
 * shim remains at the old path so `record-detail-tw.tsx` keeps compiling).
 * Import THIS path directly — the file is intentionally NOT re-exported
 * through the 20ui barrel index (barrel self-cycle gotcha).
 *
 * A `contentEditable`-based block editor for note / activity bodies. There is
 * NO npm dependency: inline formatting runs through `document.execCommand`
 * (acceptable for this scope), block transforms run through `formatBlock` +
 * targeted DOM surgery, and the produced markup is normalized + sanitized to a
 * small allow-list before it ever leaves the component or hits the DOM.
 *
 * Block model (re-implemented natively from Twenty's BlockNote block-types
 * table — paragraph, heading 1/2/3, bullet list, numbered list, checklist/todo,
 * quote, code, divider). A Twenty-style **slash menu** ("/" at the start of a
 * line) opens a keyboard-navigable command palette to insert any block.
 *
 * Exports (unchanged public API):
 *   - `RichTextEditor` — the composer surface: a Twenty-style toolbar
 *     (Bold / Italic / bullet list / numbered list / link / clear) above a
 *     `contentEditable` div with a "/" slash menu. Emits a *sanitized* HTML
 *     string via `onChange`, and submits the parent on ⌘/Ctrl+Enter.
 *   - `sanitizeRichText` + `RichTextView` — render a stored body as HTML, but
 *     only after stripping `<script>` / `<style>`, every `on*` handler, and any
 *     non-allow-listed tag/attribute. Plain-text bodies fall through as text.
 *   - `isHtmlBody`, `isRichTextEmpty` — body classification helpers.
 *   - `plainTextOfBody` — plain-text projection of a stored body (sanitize +
 *     tag-strip) for one-line previews / derived titles.
 *
 * Styling lives in `rich-text.css` (`.rte-*` namespace, shared Twenty `--st-*`
 * tokens) — NO Ui20 / Tailwind / clay.
 */

import * as React from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Text,
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
  // Block-editor additions (Twenty BlockNote block types):
  'H1',
  'H2',
  'H3',
  'BLOCKQUOTE',
  'PRE',
  'CODE',
  'HR',
  'INPUT', // checklist/todo checkboxes (type=checkbox only, see below)
]);

/** Per-tag attribute allow-list. Anything else (incl. every `on*`) is dropped. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  A: new Set(['href', 'target', 'rel']),
  // To-do checkboxes: keep only the bits that make them a checkbox + checked
  // state; everything else (handlers, name, value…) is dropped.
  INPUT: new Set(['type', 'checked', 'disabled']),
  // Allow our block markers so checklist / divider survive a round-trip.
  LI: new Set(['data-checked']),
  UL: new Set(['data-checklist']),
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
 *   - `<input>` is kept ONLY as a disabled checkbox (todo marker); any other
 *     input type is dropped entirely,
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

      // `<input>` is only ever a checklist checkbox; anything else is dropped.
      if (tag === 'INPUT') {
        const type = (el.getAttribute('type') ?? '').toLowerCase();
        if (type !== 'checkbox') {
          el.parentNode?.removeChild(el);
          continue;
        }
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

      // Todo checkboxes are render-only: never interactive in stored markup.
      if (tag === 'INPUT') {
        el.setAttribute('type', 'checkbox');
        el.setAttribute('disabled', '');
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

/**
 * Plain-text projection of a stored body. HTML bodies are sanitized first,
 * block boundaries (`</p>`, `</li>`, `<br>`, headings…) become newlines, then
 * tags are stripped — so callers can take a clean "first line" for derived
 * titles or collapse whitespace for one-line previews. Legacy plain-text
 * bodies pass through verbatim.
 */
export function plainTextOfBody(body: string): string {
  if (!body) return '';
  if (!isHtmlBody(body)) return body;
  const clean = sanitizeRichText(body)
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h1|h2|h3|blockquote|pre|ul|ol)>/gi, '\n');
  let text: string;
  if (typeof document === 'undefined') {
    text = clean.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  } else {
    const el = document.createElement('div');
    el.innerHTML = clean;
    text = el.textContent ?? '';
  }
  return text
    .replace(/[ \t\u00a0]+/g, " ") // incl. NBSP from contentEditable output
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** True when sanitized HTML has no visible text and no list/line/block content. */
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').trim() === '';
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  const hasText = (el.textContent ?? '').replace(/ /g, '').trim() !== '';
  const hasBlocks =
    el.querySelector('li, br, hr, img, input[type="checkbox"]') !== null;
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
        // stripped, unsafe link schemes dropped, inputs reduced to disabled
        // checkboxes.
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  return <div className={`${cls} rte-view--plain`}>{body}</div>;
}

// ---------------------------------------------------------------------------
// Toolbar (inline / list formatting)
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
// Slash menu — block types (re-implemented from Twenty's BlockNote slash menu)
// ---------------------------------------------------------------------------

/** Every block kind the "/" menu can insert. */
type BlockKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'numberedList'
  | 'checkList'
  | 'quote'
  | 'code'
  | 'divider';

interface SlashItem {
  kind: BlockKind;
  title: string;
  hint: string;
  icon: typeof Bold;
  /** Extra search aliases beyond the title. */
  keywords: readonly string[];
}

const SLASH_ITEMS: readonly SlashItem[] = [
  { kind: 'paragraph', title: 'Text', hint: 'Plain paragraph', icon: Text, keywords: ['paragraph', 'plain', 'p'] },
  { kind: 'h1', title: 'Heading 1', hint: 'Large section heading', icon: Heading1, keywords: ['title', 'h1', 'big'] },
  { kind: 'h2', title: 'Heading 2', hint: 'Medium section heading', icon: Heading2, keywords: ['subtitle', 'h2'] },
  { kind: 'h3', title: 'Heading 3', hint: 'Small section heading', icon: Heading3, keywords: ['h3'] },
  { kind: 'bulletList', title: 'Bulleted list', hint: 'Unordered list', icon: List, keywords: ['bullet', 'ul', 'unordered'] },
  { kind: 'numberedList', title: 'Numbered list', hint: 'Ordered list', icon: ListOrdered, keywords: ['number', 'ol', 'ordered'] },
  { kind: 'checkList', title: 'To-do list', hint: 'Checklist with checkboxes', icon: ListChecks, keywords: ['todo', 'task', 'checkbox', 'check'] },
  { kind: 'quote', title: 'Quote', hint: 'Block quote', icon: Quote, keywords: ['blockquote', 'cite'] },
  { kind: 'code', title: 'Code block', hint: 'Monospace code', icon: Code2, keywords: ['code', 'pre', 'snippet'] },
  { kind: 'divider', title: 'Divider', hint: 'Horizontal rule', icon: Minus, keywords: ['hr', 'rule', 'separator', 'line'] },
] as const;

interface SlashState {
  /** Anchor rect (caret) used to position the menu, in editor-local coords. */
  top: number;
  left: number;
  /** The query typed after "/" (excludes the slash). */
  query: string;
  /** Highlighted item index in the *filtered* list. */
  index: number;
}

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
 * A `contentEditable` BLOCK rich-text surface with a Twenty-style toolbar and a
 * "/" slash menu. `document.execCommand` powers Bold / Italic / lists; block
 * transforms (headings / quote / code / checklist / divider) run through
 * `formatBlock` + targeted DOM surgery. Every emitted value is sanitized.
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
  const [slash, setSlash] = React.useState<SlashState | null>(null);
  // Keep the latest emit/onChange reachable from imperative handlers.
  const slashRef = React.useRef<SlashState | null>(null);
  slashRef.current = slash;

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

  // --- Slash-menu helpers --------------------------------------------------

  /** The filtered slash items for the current query. */
  const filteredSlash = React.useMemo(() => {
    if (!slash) return SLASH_ITEMS;
    const q = slash.query.trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter((it) => {
      const hay = [it.title, it.hint, ...it.keywords].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [slash]);

  const closeSlash = React.useCallback(() => setSlash(null), []);

  /** Position the menu under the caret (coords relative to the editor box). */
  const computeAnchor = React.useCallback((): { top: number; left: number } => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return { top: 0, left: 0 };
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    let rect = range.getBoundingClientRect();
    // Empty lines yield a zero rect — fall back to a temporary marker.
    if (rect.top === 0 && rect.left === 0 && rect.width === 0) {
      const marker = document.createElement('span');
      marker.textContent = '​';
      range.insertNode(marker);
      rect = marker.getBoundingClientRect();
      marker.parentNode?.removeChild(marker);
    }
    const box = el.getBoundingClientRect();
    return {
      top: rect.bottom - box.top + el.scrollTop + 4,
      left: rect.left - box.left + el.scrollLeft,
    };
  }, []);

  /** True when the caret sits on an empty-ish line that can start a "/" menu. */
  const caretAtLineStartBeforeSlash = React.useCallback((): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const node = range.startContainer;
    // Allow "/" only when it's the first character of its text node / line.
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const before = text.slice(0, range.startOffset);
      return before.trim() === '';
    }
    return range.startOffset === 0;
  }, []);

  // Open / refresh the slash menu state from the current caret + query.
  const openSlash = React.useCallback(
    (query: string) => {
      const { top, left } = computeAnchor();
      setSlash((prev) => ({
        top,
        left,
        query,
        index: prev ? Math.min(prev.index, 0) : 0,
      }));
    },
    [computeAnchor],
  );

  /**
   * Read back the "/query" token immediately to the left of the caret. Returns
   * null when the caret isn't inside an open slash token (e.g. user typed a
   * space, deleted the slash, or moved away).
   */
  const readSlashToken = React.useCallback((): string | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return null;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent ?? '';
    const before = text.slice(0, range.startOffset);
    // Token = trailing "/..." with no whitespace after the slash.
    const m = before.match(/\/([^\s/]*)$/);
    if (!m) return null;
    // Slash must be line-leading (start of node or preceded by whitespace).
    const slashIdx = before.length - m[0].length;
    const prevChar = before.slice(0, slashIdx).replace(/​/g, '');
    if (prevChar.trim() !== '') return null;
    return m[1];
  }, []);

  /** Delete the "/query" token to the left of the caret (before inserting). */
  const deleteSlashToken = React.useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? '';
    const before = text.slice(0, range.startOffset);
    const m = before.match(/\/([^\s/]*)$/);
    if (!m) return;
    const start = range.startOffset - m[0].length;
    const del = document.createRange();
    del.setStart(node, Math.max(0, start));
    del.setEnd(node, range.startOffset);
    del.deleteContents();
    sel.removeAllRanges();
    sel.addRange(del);
  }, []);

  // --- Block insertion -----------------------------------------------------

  /** Walk up from the caret to the block element directly inside the editor. */
  const currentBlock = React.useCallback((): HTMLElement | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== el) {
      if (n.parentNode === el && n.nodeType === Node.ELEMENT_NODE) {
        return n as HTMLElement;
      }
      n = n.parentNode;
    }
    return null;
  }, []);

  /**
   * Apply a block transform at the caret. The "/query" token has already been
   * removed by the caller. execCommand handles lists + most blocks; checklist,
   * code and divider need a little DOM surgery to match Twenty's markup.
   */
  const applyBlock = React.useCallback(
    (kind: BlockKind) => {
      const el = ref.current;
      if (!el) return;
      el.focus();

      switch (kind) {
        case 'paragraph':
          document.execCommand('formatBlock', false, 'P');
          break;
        case 'h1':
          document.execCommand('formatBlock', false, 'H1');
          break;
        case 'h2':
          document.execCommand('formatBlock', false, 'H2');
          break;
        case 'h3':
          document.execCommand('formatBlock', false, 'H3');
          break;
        case 'quote':
          document.execCommand('formatBlock', false, 'BLOCKQUOTE');
          break;
        case 'bulletList':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'numberedList':
          document.execCommand('insertOrderedList', false);
          break;
        case 'checkList': {
          // Build a checklist: a UL[data-checklist] whose LIs carry a
          // disabled checkbox + data-checked marker. We start from a bullet
          // list, then re-tag the containing UL.
          document.execCommand('insertUnorderedList', false);
          const block = currentBlock();
          const ul =
            block && block.tagName === 'UL'
              ? block
              : block?.closest?.('ul') ?? el.querySelector('ul:last-of-type');
          if (ul instanceof HTMLElement) {
            ul.setAttribute('data-checklist', '');
            for (const li of Array.from(ul.querySelectorAll('li'))) {
              if (!li.querySelector('input[type="checkbox"]')) {
                li.setAttribute('data-checked', 'false');
                const box = document.createElement('input');
                box.type = 'checkbox';
                li.insertBefore(box, li.firstChild);
              }
            }
          }
          break;
        }
        case 'code': {
          // Code block = <pre><code>…</code></pre>. formatBlock to PRE, then
          // ensure an inner <code> for monospace styling fidelity.
          document.execCommand('formatBlock', false, 'PRE');
          const block = currentBlock();
          const pre =
            block && block.tagName === 'PRE' ? block : block?.closest?.('pre');
          if (pre instanceof HTMLElement && !pre.querySelector('code')) {
            const code = document.createElement('code');
            while (pre.firstChild) code.appendChild(pre.firstChild);
            pre.appendChild(code);
          }
          break;
        }
        case 'divider': {
          // Insert an <hr> followed by an empty paragraph to land the caret on.
          document.execCommand('insertHTML', false, '<hr><p><br></p>');
          break;
        }
      }
    },
    [currentBlock],
  );

  /** Insert the chosen slash item: strip the token, transform, re-emit. */
  const chooseSlashItem = React.useCallback(
    (kind: BlockKind) => {
      deleteSlashToken();
      applyBlock(kind);
      closeSlash();
      emit();
    },
    [applyBlock, closeSlash, deleteSlashToken, emit],
  );

  // --- Toolbar commands ----------------------------------------------------

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
          // Strip inline marks, then collapse any block back to a paragraph.
          document.execCommand('removeFormat', false);
          document.execCommand('unlink', false);
          document.execCommand('formatBlock', false, 'P');
          break;
        }
      }
      emit();
    },
    [disabled, emit],
  );

  // --- Input / keyboard ----------------------------------------------------

  // On every input, refresh the slash token: open / update / close the menu.
  const handleInput = React.useCallback(() => {
    emit();
    const token = readSlashToken();
    if (token === null) {
      if (slashRef.current) closeSlash();
      return;
    }
    openSlash(token);
  }, [closeSlash, emit, openSlash, readSlashToken]);

  // Toggle a checklist checkbox when its (otherwise disabled) box is clicked.
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement &&
        target.type === 'checkbox' &&
        target.closest('li')
      ) {
        const li = target.closest('li')!;
        const next = li.getAttribute('data-checked') !== 'true';
        li.setAttribute('data-checked', next ? 'true' : 'false');
        // Mirror to the box's property (live UI) AND attribute (so the state
        // serializes into innerHTML and survives the sanitize round-trip).
        target.checked = next;
        if (next) target.setAttribute('checked', '');
        else target.removeAttribute('checked');
        emit();
      }
    },
    [disabled, emit],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Slash menu navigation takes priority while it's open.
      const s = slashRef.current;
      if (s) {
        const items = filteredSlash;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSlash();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlash((prev) =>
            prev ? { ...prev, index: (prev.index + 1) % Math.max(items.length, 1) } : prev,
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlash((prev) =>
            prev
              ? {
                  ...prev,
                  index:
                    (prev.index - 1 + Math.max(items.length, 1)) %
                    Math.max(items.length, 1),
                }
              : prev,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          if (items.length > 0) {
            e.preventDefault();
            chooseSlashItem(items[Math.min(s.index, items.length - 1)].kind);
            return;
          }
          // No matches → fall through (let Enter behave normally) + close.
          closeSlash();
        }
      }

      // ⌘/Ctrl+Enter submits the parent form (when the menu isn't capturing it).
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit?.();
        return;
      }

      // Bare "/" at the start of a line opens the menu after the char lands.
      if (e.key === '/' && !s && caretAtLineStartBeforeSlash()) {
        // Defer: let the "/" insert first, then read the token in onInput.
        // (onInput fires right after this handler.)
      }
    },
    [
      caretAtLineStartBeforeSlash,
      chooseSlashItem,
      closeSlash,
      filteredSlash,
      onSubmit,
    ],
  );

  // Keep the highlighted index in range as the filter shrinks.
  React.useEffect(() => {
    if (!slash) return;
    if (slash.index > filteredSlash.length - 1) {
      setSlash((prev) => (prev ? { ...prev, index: 0 } : prev));
    }
  }, [filteredSlash.length, slash]);

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

      <div className="rte-surface">
        <div
          ref={ref}
          className={`rte-input${isEmpty ? ' is-empty' : ''}`}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel ?? placeholder ?? 'Rich text editor'}
          data-placeholder={placeholder}
          onInput={handleInput}
          onClick={handleClick}
          onBlur={() => {
            // Defer so a mousedown on a menu item is handled before close.
            window.setTimeout(() => {
              if (slashRef.current) closeSlash();
              emit();
            }, 120);
          }}
          onKeyDown={handleKeyDown}
        />

        {slash && (
          <div
            className="rte-slash"
            role="listbox"
            aria-label="Insert block"
            style={{ top: slash.top, left: slash.left }}
          >
            {filteredSlash.length === 0 ? (
              <div className="rte-slash__empty">No blocks</div>
            ) : (
              filteredSlash.map((it, i) => {
                const Icon = it.icon;
                const active = i === slash.index;
                return (
                  <button
                    key={it.kind}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`rte-slash__item${active ? ' is-active' : ''}`}
                    // Don't blur the editor on mousedown; commit on click.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() =>
                      setSlash((prev) => (prev ? { ...prev, index: i } : prev))
                    }
                    onClick={() => chooseSlashItem(it.kind)}
                  >
                    <span className="rte-slash__icon">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="rte-slash__text">
                      <span className="rte-slash__title">{it.title}</span>
                      <span className="rte-slash__hint">{it.hint}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RichTextEditor;
