'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   ExpressionEditor
   ────────────────────────────────────────────────────────────────────────────
   n8n-style inline editor that flips between two modes:

     Fixed mode       — plain text input, string stored as-is.
     Expression mode  — monospace input with a purple-tinted border and a
                        leading `=` glyph.  The stored value is `=<expr>`.

   A small `f(x)` toggle button (top-right) switches modes when `mode='auto'`.
   When the toggle is held on "expression", a live preview of the resolved
   value is rendered beneath the input via <ExpressionPreview/>.

   Autocomplete triggers
   ─────────────────────
     `$`           → expression roots ($json, $node, $input, $vars, $now, $env)
     `$json.`      → top-level keys of the sample input schema
     `$node[`      → `"NodeName"` completions (with closing bracket inserted)
     `{{`          → variable names (Typebot syntax)

   Keyboard
   ────────
     ArrowUp/Down  — move activeIndex
     Enter / Tab   — insert suggestion
     Escape        — close menu
   ──────────────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { LuFunctionSquare, LuBraces, LuBoxes, LuCircleDollarSign } from 'react-icons/lu';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { inputClass } from './primitives';
import { getCaretCoordinates } from './helpers/caretPosition';
import { ExpressionPreview } from './ExpressionPreview';

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export type ExpressionEditorMode = 'fixed' | 'expression' | 'auto';

export interface NodeHint {
  name: string;
  outputSchema?: Record<string, unknown>;
}

export interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variables: Variable[];
  nodes?: NodeHint[];
  mode?: ExpressionEditorMode;
  multiline?: boolean;
  className?: string;
  'aria-label'?: string;
}

type TriggerKind = 'root' | 'json-path' | 'node-bracket' | 'variable';

interface Trigger {
  kind: TriggerKind;
  /** Absolute index of the opening character(s) in the editor value. */
  startIndex: number;
  /** Absolute index to which the completion should write (usually caret). */
  endIndex: number;
  /** Current filter text entered after the trigger. */
  query: string;
  /** For `$json.…` completions, the full path before the caret. */
  path?: string[];
}

interface Suggestion {
  id: string;
  label: string;
  detail?: string;
  icon: 'dollar' | 'braces' | 'boxes';
  /** Text that replaces the trigger span (including the trigger chars). */
  insertText: string;
  /** Caret offset from start of `insertText` after insertion. */
  cursorOffset?: number;
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

const EXPRESSION_PREFIX = '=';

const EXPRESSION_ROOTS: ReadonlyArray<{
  name: string;
  detail: string;
  snippet: string;
  cursorOffset?: number;
}> = [
  { name: '$json', detail: 'Current input item (from previous node)', snippet: '$json.' },
  {
    name: '$node',
    detail: 'Access any upstream node output',
    snippet: '$node[""]',
    cursorOffset: 7, // inside the quotes
  },
  { name: '$input', detail: 'Full input context for this node', snippet: '$input.' },
  { name: '$vars', detail: 'Flow variables', snippet: '$vars.' },
  { name: '$now', detail: 'Current ISO-8601 timestamp', snippet: '$now' },
  { name: '$env', detail: 'Environment variables', snippet: '$env.' },
];

/* ══════════════════════════════════════════════════════════════════════════
   Trigger detection
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inspects the characters immediately preceding the caret to determine which
 * (if any) autocomplete trigger is active.  Returns null when no trigger is
 * in effect — the menu should stay closed.
 */
function detectTrigger(value: string, caret: number): Trigger | null {
  const before = value.slice(0, caret);

  // `{{ query` — variable mention
  const braceOpen = before.lastIndexOf('{{');
  if (braceOpen !== -1) {
    const tail = before.slice(braceOpen + 2);
    if (!tail.includes('}}') && /^[\w.\-]*$/.test(tail)) {
      return {
        kind: 'variable',
        startIndex: braceOpen,
        endIndex: caret,
        query: tail,
      };
    }
  }

  // `$node["…`
  const nodeBracket = before.lastIndexOf('$node[');
  if (nodeBracket !== -1) {
    const tail = before.slice(nodeBracket + '$node['.length);
    const bracketClosed = tail.includes(']');
    if (!bracketClosed) {
      const quoteMatch = tail.match(/^"([^"]*)$/);
      if (quoteMatch) {
        return {
          kind: 'node-bracket',
          startIndex: nodeBracket,
          endIndex: caret,
          query: quoteMatch[1],
        };
      }
      // User is past `[` but hasn't opened a quote yet — trigger on `[` itself.
      if (tail === '') {
        return {
          kind: 'node-bracket',
          startIndex: nodeBracket,
          endIndex: caret,
          query: '',
        };
      }
    }
  }

  // `$json.key.subkey` — property path
  const jsonMatch = before.match(/\$json((?:\.[\w]*)*)$/);
  if (jsonMatch && jsonMatch[1] !== undefined && before.endsWith(jsonMatch[0])) {
    const pathPart = jsonMatch[1]; // e.g. `.user.na`
    if (pathPart.length > 0) {
      const segments = pathPart.slice(1).split('.');
      const query = segments[segments.length - 1] ?? '';
      const path = segments.slice(0, -1);
      const matchStart = before.length - jsonMatch[0].length;
      return {
        kind: 'json-path',
        startIndex: matchStart + '$json'.length + 1 + path.join('.').length + (path.length ? 1 : 0),
        endIndex: caret,
        query,
        path,
      };
    }
  }

  // Bare `$query` — expression root menu
  const rootMatch = before.match(/\$([A-Za-z_]\w*)?$/);
  if (rootMatch) {
    return {
      kind: 'root',
      startIndex: before.length - rootMatch[0].length,
      endIndex: caret,
      query: rootMatch[1] ?? '',
    };
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Suggestion builders
   ══════════════════════════════════════════════════════════════════════════ */

function buildRootSuggestions(trigger: Trigger): Suggestion[] {
  const query = trigger.query.toLowerCase();
  return EXPRESSION_ROOTS
    .filter((root) => root.name.slice(1).toLowerCase().startsWith(query))
    .map((root) => ({
      id: `root:${root.name}`,
      label: root.name,
      detail: root.detail,
      icon: 'dollar' as const,
      insertText: root.snippet,
      cursorOffset: root.cursorOffset,
    }));
}

function buildJsonPathSuggestions(
  trigger: Trigger,
  nodes: readonly NodeHint[],
): Suggestion[] {
  const sampleSchema = nodes[0]?.outputSchema ?? {};
  const path = trigger.path ?? [];
  let cursor: unknown = sampleSchema;
  for (const segment of path) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return [];
    }
  }
  if (!cursor || typeof cursor !== 'object') return [];
  const keys = Object.keys(cursor as Record<string, unknown>);
  const query = trigger.query.toLowerCase();
  return keys
    .filter((key) => key.toLowerCase().startsWith(query))
    .map((key) => {
      const value = (cursor as Record<string, unknown>)[key];
      return {
        id: `json:${key}`,
        label: key,
        detail: describeValue(value),
        icon: 'braces' as const,
        insertText: key,
      };
    });
}

function buildNodeBracketSuggestions(
  trigger: Trigger,
  nodes: readonly NodeHint[],
): Suggestion[] {
  const query = trigger.query.toLowerCase();
  return nodes
    .filter((node) => node.name.toLowerCase().includes(query))
    .map((node) => ({
      id: `node:${node.name}`,
      label: `"${node.name}"`,
      detail: 'upstream node',
      icon: 'boxes' as const,
      insertText: `$node["${node.name}"]`,
    }));
}

function buildVariableSuggestions(
  trigger: Trigger,
  variables: readonly Variable[],
): Suggestion[] {
  const query = trigger.query.toLowerCase();
  return variables
    .filter((variable) => variable.name.toLowerCase().includes(query))
    .map((variable) => ({
      id: `var:${variable.id}`,
      label: variable.name,
      detail: 'variable',
      icon: 'braces' as const,
      insertText: `{{${variable.name}}}`,
    }));
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array · ${value.length}`;
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    const preview = value.length > 24 ? `${value.slice(0, 24)}…` : value;
    return `"${preview}"`;
  }
  return String(value);
}

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */

export function ExpressionEditor({
  value,
  onChange,
  placeholder,
  variables,
  nodes = [],
  mode = 'auto',
  multiline = false,
  className,
  'aria-label': ariaLabel,
}: ExpressionEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── Mode resolution ───────────────────────────────────────────────── */

  const isForcedExpression = mode === 'expression';
  const isForcedFixed = mode === 'fixed';
  const initialIsExpression = isForcedExpression || value.startsWith(EXPRESSION_PREFIX);
  const [userWantsExpression, setUserWantsExpression] = useState(initialIsExpression);
  const isExpression = isForcedExpression || (!isForcedFixed && userWantsExpression);

  // Keep internal toggle state in sync when the value arrives with an `=` from
  // an external source (e.g. block JSON restore).
  useEffect(() => {
    if (mode !== 'auto') return;
    if (value.startsWith(EXPRESSION_PREFIX) && !userWantsExpression) {
      setUserWantsExpression(true);
    }
  }, [value, mode, userWantsExpression]);

  /* ── Split value/inner (strip the leading `=`) ─────────────────────── */

  const innerValue = isExpression && value.startsWith(EXPRESSION_PREFIX)
    ? value.slice(1)
    : isExpression
      ? value
      : value;

  /* ── Autocomplete state ────────────────────────────────────────────── */

  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!trigger || !isExpression) return [];
    switch (trigger.kind) {
      case 'root':
        return buildRootSuggestions(trigger);
      case 'json-path':
        return buildJsonPathSuggestions(trigger, nodes);
      case 'node-bracket':
        return buildNodeBracketSuggestions(trigger, nodes);
      case 'variable':
        return buildVariableSuggestions(trigger, variables);
      default:
        return [];
    }
  }, [trigger, isExpression, nodes, variables]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.kind, trigger?.query, suggestions.length]);

  const isMenuOpen = trigger !== null && suggestions.length > 0;

  /* ── Trigger recomputation ─────────────────────────────────────────── */

  const recomputeTrigger = useCallback(() => {
    const el = inputRef.current;
    if (!el || !isExpression) {
      setTrigger(null);
      setMenuPos(null);
      return;
    }
    const caret = el.selectionEnd ?? el.value.length;
    const next = detectTrigger(el.value, caret);
    setTrigger(next);

    if (next) {
      const rect = el.getBoundingClientRect();
      const caretCoords = getCaretCoordinates(el);
      setMenuPos({
        top: rect.top + caretCoords.top + caretCoords.height + 4,
        left: rect.left + caretCoords.left,
      });
    } else {
      setMenuPos(null);
    }
  }, [isExpression]);

  /* ── Onchange handlers ─────────────────────────────────────────────── */

  const emit = useCallback(
    (nextInner: string) => {
      if (isExpression) {
        onChange(nextInner ? `${EXPRESSION_PREFIX}${nextInner}` : '');
      } else {
        onChange(nextInner);
      }
    },
    [isExpression, onChange],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      emit(event.target.value);
      requestAnimationFrame(recomputeTrigger);
    },
    [emit, recomputeTrigger],
  );

  const closeMenu = useCallback(() => {
    setTrigger(null);
    setMenuPos(null);
  }, []);

  /* ── Insertion ─────────────────────────────────────────────────────── */

  const insertSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const el = inputRef.current;
      if (!el || !trigger) return;

      const current = el.value;
      const before = current.slice(0, trigger.startIndex);
      const after = current.slice(trigger.endIndex);
      const nextInner = `${before}${suggestion.insertText}${after}`;
      emit(nextInner);

      const defaultCaret = before.length + suggestion.insertText.length;
      const nextCaret = before.length + (suggestion.cursorOffset ?? suggestion.insertText.length);

      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (!node) return;
        node.focus();
        const target = suggestion.cursorOffset !== undefined ? nextCaret : defaultCaret;
        node.setSelectionRange(target, target);
        recomputeTrigger();
      });

      closeMenu();
    },
    [trigger, emit, closeMenu, recomputeTrigger],
  );

  /* ── Keyboard nav ──────────────────────────────────────────────────── */

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!isMenuOpen) return;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((i) => (i + 1) % suggestions.length);
          return;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        case 'Enter':
        case 'Tab': {
          event.preventDefault();
          const picked = suggestions[activeIndex];
          if (picked) insertSuggestion(picked);
          return;
        }
        case 'Escape':
          event.preventDefault();
          closeMenu();
          return;
      }
    },
    [isMenuOpen, suggestions, activeIndex, insertSuggestion, closeMenu],
  );

  /* ── Click-outside ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [isMenuOpen, closeMenu]);

  /* ── Reposition on scroll/resize ───────────────────────────────────── */

  useLayoutEffect(() => {
    if (!isMenuOpen) return;
    const onLayout = () => recomputeTrigger();
    window.addEventListener('scroll', onLayout, true);
    window.addEventListener('resize', onLayout);
    return () => {
      window.removeEventListener('scroll', onLayout, true);
      window.removeEventListener('resize', onLayout);
    };
  }, [isMenuOpen, recomputeTrigger]);

  /* ── Toggle handler ────────────────────────────────────────────────── */

  const toggleMode = useCallback(() => {
    if (mode !== 'auto') return;
    setUserWantsExpression((prev) => {
      const next = !prev;
      // Rewrite the stored value to match the new mode.
      if (next) {
        onChange(value ? `${EXPRESSION_PREFIX}${value.replace(/^=/, '')}` : '');
      } else {
        onChange(value.startsWith(EXPRESSION_PREFIX) ? value.slice(1) : value);
      }
      return next;
    });
    closeMenu();
  }, [mode, onChange, value, closeMenu]);

  /* ── Styling ───────────────────────────────────────────────────────── */

  const exprClass = cn(
    'font-mono text-[12.5px]',
    'border-purple-500/40 focus:border-purple-400',
    'bg-purple-500/5',
  );

  const containerClass = cn('relative', className);

  /* ── Render helpers ────────────────────────────────────────────────── */

  const sharedInputProps = {
    value: innerValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onSelect: recomputeTrigger,
    onClick: recomputeTrigger,
    placeholder,
    spellCheck: false,
    'aria-label': ariaLabel,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': isMenuOpen,
    'aria-haspopup': 'listbox' as const,
  };

  return (
    <div className={containerClass}>
      <div className="relative">
        {isExpression && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 font-mono text-[13px] font-semibold select-none"
          >
            =
          </span>
        )}

        {multiline ? (
          <textarea
            {...sharedInputProps}
            ref={(node) => {
              inputRef.current = node;
            }}
            rows={4}
            className={cn(
              inputClass,
              'resize-y min-h-[76px]',
              isExpression && exprClass,
              isExpression && 'pl-7',
              mode === 'auto' && 'pr-10',
            )}
          />
        ) : (
          <input
            {...sharedInputProps}
            ref={(node) => {
              inputRef.current = node;
            }}
            type="text"
            className={cn(
              inputClass,
              isExpression && exprClass,
              isExpression && 'pl-7',
              mode === 'auto' && 'pr-10',
            )}
          />
        )}

        {mode === 'auto' && (
          <button
            type="button"
            onClick={toggleMode}
            aria-pressed={isExpression}
            title={isExpression ? 'Switch to fixed value' : 'Switch to expression'}
            className={cn(
              'absolute right-1.5 top-1.5 flex h-6 items-center gap-1 rounded-md px-1.5',
              'text-[11px] font-mono font-semibold transition-colors',
              isExpression
                ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
                : 'bg-[var(--gray-3)] text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-11)]',
            )}
          >
            <LuFunctionSquare className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            <span>f(x)</span>
          </button>
        )}
      </div>

      {isExpression && (
        <ExpressionPreview
          value={innerValue}
          variables={variables}
          nodes={nodes}
          className="mt-1.5 pl-1"
        />
      )}

      {isMenuOpen && menuPos && (
        <SuggestionMenu
          ref={menuRef}
          suggestions={suggestions}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={insertSuggestion}
          position={menuPos}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Suggestion menu
   ══════════════════════════════════════════════════════════════════════════ */

interface SuggestionMenuProps {
  suggestions: Suggestion[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelect: (s: Suggestion) => void;
  onHover: (index: number) => void;
  ref: React.Ref<HTMLDivElement>;
}

function SuggestionMenu({
  suggestions,
  activeIndex,
  position,
  onSelect,
  onHover,
  ref,
}: SuggestionMenuProps): ReactNode {
  const style: CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: 60,
  };

  return (
    <div
      ref={ref}
      role="listbox"
      style={style}
      className={cn(
        'min-w-[260px] max-w-[360px] max-h-[280px] overflow-y-auto',
        'rounded-lg border border-purple-500/30 bg-[var(--gray-1)] shadow-xl',
        'backdrop-blur-md p-1',
      )}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={() => onHover(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(suggestion);
          }}
          className={cn(
            'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
            index === activeIndex
              ? 'bg-purple-500/15 text-purple-200'
              : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          <SuggestionIcon icon={suggestion.icon} />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[12px] truncate">{suggestion.label}</div>
            {suggestion.detail && (
              <div className="text-[10.5px] text-[var(--gray-8)] truncate">{suggestion.detail}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function SuggestionIcon({ icon }: { icon: Suggestion['icon'] }): ReactNode {
  const className = 'h-3.5 w-3.5 shrink-0 text-purple-400';
  const strokeWidth = 1.8;
  if (icon === 'dollar')
    return <LuCircleDollarSign className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
  if (icon === 'boxes')
    return <LuBoxes className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
  return <LuBraces className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
