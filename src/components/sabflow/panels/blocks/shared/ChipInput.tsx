'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   ChipInput — Notion-style inline variable chip editor.

   Renders a contentEditable surface where `{{variable}}` tokens in the value
   are displayed as orange pill badges, and surrounding text is freely
   editable.  Chips behave as atomic units:
   - They cannot be partially edited — Backspace / Delete removes the whole
     chip in one keystroke.
   - Caret navigation steps over chips rather than landing inside them.
   - Typing `{{` inside the editable text opens a variable picker identical to
     the one used by VariableAutocompleteInput (via VariableMentionMenu).

   Under the hood the component keeps `value` (plain string with `{{...}}`
   tokens) as the source of truth.  The DOM tree is reconciled imperatively
   whenever `value` changes externally — contentEditable + React is otherwise a
   footgun because React's reconciler fights the browser's edits.
   ──────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { VariableMentionMenu } from './VariableMentionMenu';

/* ─────────────────────────────────────────────────────────────────────────────
   Tokeniser
   ──────────────────────────────────────────────────────────────────────────── */

type Token =
  | { type: 'text'; value: string }
  | { type: 'chip'; name: string };

const TOKEN_RE = /\{\{([\w.\-]+)\}\}/g;

function tokenise(value: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(value)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    tokens.push({ type: 'chip', name: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    tokens.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return tokens;
}

/* ─────────────────────────────────────────────────────────────────────────────
   DOM serialisation (contentEditable → string)

   Each chip is marked with `data-chip="name"` so we can round-trip.
   ──────────────────────────────────────────────────────────────────────────── */

function serialise(root: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const chipName = el.dataset.chip;
    if (chipName) {
      out += `{{${chipName}}}`;
      return;
    }
    if (el.tagName === 'BR') {
      out += '\n';
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Render tokens into a container

   We wipe and rebuild the DOM whenever `value` changes from the outside.
   For internal (user-typed) edits we read the DOM via serialise() and push the
   string up — React does NOT re-render the content during typing to avoid
   losing the caret.
   ──────────────────────────────────────────────────────────────────────────── */

function renderTokens(root: HTMLElement, tokens: Token[]) {
  root.innerHTML = '';
  const doc = root.ownerDocument;
  tokens.forEach((t) => {
    if (t.type === 'text') {
      // Preserve line breaks by splitting on \n and inserting <br>.
      const segments = t.value.split('\n');
      segments.forEach((seg, i) => {
        if (seg) root.appendChild(doc.createTextNode(seg));
        if (i < segments.length - 1) root.appendChild(doc.createElement('br'));
      });
    } else {
      const chip = doc.createElement('span');
      chip.dataset.chip = t.name;
      chip.contentEditable = 'false';
      chip.textContent = `{{${t.name}}}`;
      chip.className = [
        'inline-flex items-center rounded-md',
        'bg-[#f76808]/15 text-[#f76808]',
        'px-1.5 py-0.5 mx-0.5',
        'font-mono text-[11.5px] font-medium',
        'select-none whitespace-nowrap align-baseline',
      ].join(' ');
      root.appendChild(chip);
    }
  });

  // Ensure there's always a trailing text node so the caret can land past the
  // last chip.  Without this, Chrome traps the caret inside a non-editable
  // chip when the chip is the final child.
  const last = root.lastChild;
  if (!last || (last.nodeType === Node.ELEMENT_NODE && (last as HTMLElement).dataset.chip)) {
    root.appendChild(doc.createTextNode('\u200B'));
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trigger detection (mirrors VariableAutocompleteInput)
   ──────────────────────────────────────────────────────────────────────────── */

interface TriggerMatch {
  /** Absolute index of the opening `{{` in the serialised value string. */
  startIndex: number;
  query: string;
}

function findActiveTrigger(textBeforeCaret: string): TriggerMatch | null {
  const openIndex = textBeforeCaret.lastIndexOf('{{');
  if (openIndex === -1) return null;
  const afterOpen = textBeforeCaret.slice(openIndex + 2);
  if (afterOpen.includes('}}')) return null;
  if (!/^[\w.\-]*$/.test(afterOpen)) return null;
  return { startIndex: openIndex, query: afterOpen };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Caret helpers

   Offset = the index into the *serialised string* that corresponds to the
   current selection end.  Chips count as `{{name}}` characters.
   ──────────────────────────────────────────────────────────────────────────── */

function getCaretOffset(root: HTMLElement): number {
  const sel = root.ownerDocument.defaultView?.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return 0;

  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);

  // Use a temporary DocumentFragment-free measure: build a clone serialiser.
  // Instead of cloning, we walk the DOM up to the selection end manually.
  let offset = 0;
  const endNode = range.endContainer;
  const endOffset = range.endOffset;
  let done = false;

  const walk = (node: Node) => {
    if (done) return;
    if (node === endNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += endOffset;
      } else {
        // Element endOffset means "after N child nodes".
        for (let i = 0; i < endOffset; i++) {
          const child = node.childNodes[i];
          if (child) walk(child);
          if (done) return;
        }
      }
      done = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent ?? '').length;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset.chip) {
      offset += `{{${el.dataset.chip}}}`.length;
      return;
    }
    if (el.tagName === 'BR') {
      offset += 1;
      return;
    }
    el.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);
  return offset;
}

/* Place caret at a given serialised-string offset. */
function setCaretOffset(root: HTMLElement, targetOffset: number) {
  const sel = root.ownerDocument.defaultView?.getSelection();
  if (!sel) return;

  let remaining = targetOffset;
  let placed = false;
  const range = root.ownerDocument.createRange();

  const walk = (node: Node): boolean => {
    if (placed) return true;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) {
        range.setStart(node, Math.max(0, remaining));
        range.setEnd(node, Math.max(0, remaining));
        placed = true;
        return true;
      }
      remaining -= len;
      return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    if (el.dataset.chip) {
      const len = `{{${el.dataset.chip}}}`.length;
      if (remaining < len) {
        // Place caret just before the chip.
        const parent = el.parentNode;
        if (parent) {
          const idx = Array.prototype.indexOf.call(parent.childNodes, el);
          range.setStart(parent, idx);
          range.setEnd(parent, idx);
          placed = true;
          return true;
        }
      }
      remaining -= len;
      return false;
    }
    if (el.tagName === 'BR') {
      if (remaining === 0) {
        const parent = el.parentNode;
        if (parent) {
          const idx = Array.prototype.indexOf.call(parent.childNodes, el);
          range.setStart(parent, idx);
          range.setEnd(parent, idx);
          placed = true;
          return true;
        }
      }
      remaining -= 1;
      return false;
    }
    for (const child of Array.from(el.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  };

  Array.from(root.childNodes).some(walk);

  if (!placed) {
    // Fallback: place at end.
    range.selectNodeContents(root);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────────────────────── */

export type ChipInputProps = {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  placeholder?: string;
  className?: string;
  /** Render multi-line with min-height; caller can override via className. */
  multiline?: boolean;
  'aria-label'?: string;
  onCreateVariable?: (name: string) => Variable;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export function ChipInput({
  value,
  onChange,
  variables,
  placeholder,
  className,
  multiline = false,
  'aria-label': ariaLabel,
  onCreateVariable,
}: ChipInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [trigger, setTrigger] = useState<TriggerMatch | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  /* Memoised tokens for the current value — used when reconciling. */
  const tokens = useMemo(() => tokenise(value), [value]);

  /* ── Reconcile DOM when `value` changes externally ────────────────────── */

  const lastSyncedValue = useRef<string>('');

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // If the DOM already matches the incoming value (i.e. this was our own
    // onChange round-trip), skip the destructive rebuild to preserve caret.
    if (lastSyncedValue.current === value && serialise(root) === value) {
      return;
    }
    renderTokens(root, tokens);
    lastSyncedValue.current = value;
  }, [value, tokens]);

  /* ── Filtered variable list ───────────────────────────────────────────── */

  const filteredVariables = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [trigger, variables]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.query, variables.length]);

  /* ── Serialise + maybe open trigger on every input ────────────────────── */

  const recomputeTrigger = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const serialised = serialise(root);
    const caretOffset = getCaretOffset(root);
    const before = serialised.slice(0, caretOffset);
    const match = findActiveTrigger(before);

    setTrigger(match);

    if (match) {
      // Position the menu based on the current DOM selection rect.
      const sel = root.ownerDocument.defaultView?.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        // Collapsed ranges inside empty inline contexts can have zero dims —
        // fall back to the root's rect.
        if (rect.width === 0 && rect.height === 0) {
          rect = root.getBoundingClientRect();
        }
        setMenuPos({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    } else {
      setMenuPos(null);
    }
  }, []);

  const handleInput = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = serialise(root);
    lastSyncedValue.current = next;
    onChange(next);
    recomputeTrigger();
  }, [onChange, recomputeTrigger]);

  /* ── Key handling (chip deletion + autocomplete nav) ──────────────────── */

  const closeMenu = useCallback(() => {
    setTrigger(null);
    setMenuPos(null);
  }, []);

  const insertVariable = useCallback(
    (variable: Variable) => {
      const root = rootRef.current;
      if (!root || !trigger) return;

      const current = serialise(root);
      const caretOffset = getCaretOffset(root);
      const before = current.slice(0, trigger.startIndex);
      const after = current.slice(caretOffset);
      const insertion = `{{${variable.name}}}`;
      const next = `${before}${insertion}${after}`;

      onChange(next);

      const nextCaret = before.length + insertion.length;

      // After React updates, our useLayoutEffect reconciles the DOM; we then
      // restore the caret.
      requestAnimationFrame(() => {
        const r = rootRef.current;
        if (!r) return;
        renderTokens(r, tokenise(next));
        lastSyncedValue.current = next;
        r.focus();
        setCaretOffset(r, nextCaret);
      });

      closeMenu();
    },
    [trigger, onChange, closeMenu],
  );

  const handleCreateVariable = useCallback(
    (name: string) => {
      if (!onCreateVariable) return;
      const created = onCreateVariable(name);
      insertVariable(created);
    },
    [onCreateVariable, insertVariable],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      /* ── Autocomplete nav first ─────────────────────────────────────── */
      if (trigger) {
        const hasMatches = filteredVariables.length > 0;
        if (e.key === 'ArrowDown' && hasMatches) {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filteredVariables.length);
          return;
        }
        if (e.key === 'ArrowUp' && hasMatches) {
          e.preventDefault();
          setActiveIndex(
            (i) => (i - 1 + filteredVariables.length) % filteredVariables.length,
          );
          return;
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && hasMatches) {
          e.preventDefault();
          const picked = filteredVariables[activeIndex];
          if (picked) insertVariable(picked);
          return;
        }
        if (
          e.key === 'Enter' &&
          !hasMatches &&
          onCreateVariable &&
          trigger.query.trim()
        ) {
          e.preventDefault();
          handleCreateVariable(trigger.query.trim());
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMenu();
          return;
        }
      }

      /* ── Enter handling outside autocomplete ────────────────────────── */
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        return;
      }

      /* ── Chip deletion: Backspace / Delete on an adjacent chip ──────── */
      const root = rootRef.current;
      if (!root) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = root.ownerDocument.defaultView?.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return; // let default delete the selection

        const container = range.endContainer;
        const offset = range.endOffset;

        // Figure out the neighbouring chip candidate.
        let chip: HTMLElement | null = null;

        const isChip = (n: Node | null): HTMLElement | null => {
          if (!n || n.nodeType !== Node.ELEMENT_NODE) return null;
          const el = n as HTMLElement;
          return el.dataset.chip ? el : null;
        };

        if (e.key === 'Backspace') {
          if (container.nodeType === Node.TEXT_NODE && offset === 0) {
            chip = isChip(container.previousSibling);
          } else if (container.nodeType === Node.ELEMENT_NODE) {
            const el = container as HTMLElement;
            const child = el.childNodes[offset - 1];
            chip = isChip(child ?? null);
          }
        } else {
          // Delete
          if (
            container.nodeType === Node.TEXT_NODE &&
            offset === (container.textContent ?? '').length
          ) {
            chip = isChip(container.nextSibling);
          } else if (container.nodeType === Node.ELEMENT_NODE) {
            const el = container as HTMLElement;
            const child = el.childNodes[offset];
            chip = isChip(child ?? null);
          }
        }

        if (chip) {
          e.preventDefault();
          chip.remove();
          handleInput();
        }
      }
    },
    [
      trigger,
      filteredVariables,
      activeIndex,
      insertVariable,
      closeMenu,
      handleCreateVariable,
      onCreateVariable,
      multiline,
      handleInput,
    ],
  );

  /* ── Paste handler: strip HTML, preserve plain text ───────────────────── */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      const root = rootRef.current;
      if (!root) return;
      const current = serialise(root);
      const caretOffset = getCaretOffset(root);
      const next =
        current.slice(0, caretOffset) + text + current.slice(caretOffset);
      onChange(next);
      const nextCaret = caretOffset + text.length;
      requestAnimationFrame(() => {
        const r = rootRef.current;
        if (!r) return;
        renderTokens(r, tokenise(next));
        lastSyncedValue.current = next;
        setCaretOffset(r, nextCaret);
      });
    },
    [onChange],
  );

  /* ── Click-outside handler ────────────────────────────────────────────── */

  useEffect(() => {
    if (!trigger) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (rootRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [trigger, closeMenu]);

  /* ── Reposition menu on scroll / resize ───────────────────────────────── */

  useLayoutEffect(() => {
    if (!trigger) return;
    const onLayoutChange = () => recomputeTrigger();
    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
    };
  }, [trigger, recomputeTrigger]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  const showPlaceholder = !isFocused && value.length === 0;

  return (
    <>
      <div className="relative">
        <div
          ref={rootRef}
          role="textbox"
          aria-label={ariaLabel}
          aria-multiline={multiline}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
            'px-3 py-2 text-[13px] text-[var(--gray-12)]',
            'outline-none focus:border-[#f76808] transition-colors',
            'whitespace-pre-wrap break-words',
            multiline ? 'min-h-[80px]' : 'min-h-[38px]',
            className,
          )}
        />

        {showPlaceholder && placeholder && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-2 text-[13px] text-[var(--gray-8)]"
          >
            {placeholder}
          </span>
        )}
      </div>

      {trigger && menuPos && (
        <VariableMentionMenu
          ref={menuRef}
          variables={filteredVariables}
          activeIndex={activeIndex}
          onSelect={insertVariable}
          onCreate={onCreateVariable ? handleCreateVariable : undefined}
          onHoverIndex={setActiveIndex}
          query={trigger.query}
          position={menuPos}
        />
      )}
    </>
  );
}
