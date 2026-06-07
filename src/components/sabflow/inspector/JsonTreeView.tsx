'use client';

/**
 * JsonTreeView, a collapsible JSON tree with typed colour coding.
 *
 * Features:
 *   - Expand / collapse arrows (depth 0 opens by default)
 *   - Type-coloured primitives
 *       strings  -> green  (quoted)
 *       numbers  -> accent (blue)
 *       booleans -> amber
 *       null     -> muted italic
 *   - Path tooltip on hover        ($.data.users[0].name)
 *   - Right-click context menu:
 *        Copy path
 *        Copy value
 *        Use as expression ({{ $json.foo.bar }})
 *   - `searchQuery` filters keys (case-insensitive; keeps ancestors visible)
 *
 * Original implementation, not copied from any other library. Pure 20ui.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ChevronRight, ChevronDown, FileQuestion } from 'lucide-react';

import { Button, EmptyState, useToast } from '@/components/sabcrm/20ui';

/* -- Types -------------------------------------------------------------- */

type Primitive = string | number | boolean | null | undefined;
type JsonValue = Primitive | JsonObject | JsonArray;
type JsonObject = { [k: string]: JsonValue };
type JsonArray = JsonValue[];

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  value: unknown;
};

interface Props {
  /** Unknown JSON-ish value, we narrow at render time. */
  data: unknown;
  /** Case-insensitive key filter. Empty string = no filter. */
  searchQuery?: string;
  /** Callback for "Use as expression", receives a `$json.path` string. */
  onUseAsExpression?: (expression: string) => void;
  /** Root path label shown in the tooltip. Default: `$`. */
  rootLabel?: string;
}

/* -- Utilities ---------------------------------------------------------- */

/** Safe stringify with circular-ref detection. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v: unknown) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v as object)) return '[Circular]';
          seen.add(v as object);
        }
        return v;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Build an expression reference (`$json.foo[0].bar`) from a `$.` path. */
function toExpression(path: string): string {
  // path is like `$` or `$.foo.bar[0].name`
  const tail = path.startsWith('$') ? path.slice(1) : path;
  return `{{ $json${tail} }}`;
}

/** Does `key` (or any descendant key inside `value`) match the search query? */
function subtreeMatches(
  key: string | null,
  value: unknown,
  query: string,
): boolean {
  if (!query) return true;
  if (key !== null && key.toLowerCase().includes(query)) return true;

  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((v, i) => subtreeMatches(String(i), v, query));
  }
  for (const [k, v] of Object.entries(value as JsonObject)) {
    if (subtreeMatches(k, v, query)) return true;
  }
  return false;
}

/* -- Primitive renderer ------------------------------------------------- */

function PrimitiveView({ value }: { value: Primitive }) {
  if (value === null) {
    return <span className="italic text-[var(--st-text-tertiary)]">null</span>;
  }
  if (value === undefined) {
    return (
      <span className="italic text-[var(--st-text-tertiary)]">undefined</span>
    );
  }
  if (typeof value === 'string') {
    return (
      <span className="text-[var(--st-status-ok)] break-all">
        &quot;{value}&quot;
      </span>
    );
  }
  if (typeof value === 'number') {
    return (
      <span className="text-[var(--st-accent)] tabular-nums">
        {Number.isFinite(value) ? value : String(value)}
      </span>
    );
  }
  if (typeof value === 'boolean') {
    return <span className="text-[var(--st-warn)]">{String(value)}</span>;
  }
  return <span className="text-[var(--st-text)]">{String(value)}</span>;
}

/* -- Node renderer (recursive) ------------------------------------------ */

interface NodeProps {
  name: string | null;
  value: unknown;
  path: string;
  depth: number;
  query: string;
  onContextMenu: (e: React.MouseEvent, path: string, value: unknown) => void;
}

function JsonNode({
  name,
  value,
  path,
  depth,
  query,
  onContextMenu,
}: NodeProps) {
  const [expanded, setExpanded] = useState<boolean>(depth < 2);

  // Auto-expand matching subtrees when the query changes.
  useEffect(() => {
    if (query && subtreeMatches(name, value, query)) {
      setExpanded(true);
    }
  }, [query, name, value]);

  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isContainer = isObject || isArray;

  // Filter out non-matching branches.
  if (query && !subtreeMatches(name, value, query)) return null;

  const handleContextMenu = (e: React.MouseEvent) => {
    onContextMenu(e, path, value);
  };

  /* -- Primitive leaf -------------------------------------------------- */
  if (!isContainer) {
    return (
      <div
        className="flex items-baseline gap-1.5 pl-4 py-0.5 font-mono text-[12px] leading-5 hover:bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-sm)] cursor-default"
        title={path}
        onContextMenu={handleContextMenu}
      >
        {name !== null && (
          <>
            <span className="text-[var(--st-text)]">{name}</span>
            <span className="text-[var(--st-text-tertiary)]">:</span>
          </>
        )}
        <PrimitiveView value={value as Primitive} />
      </div>
    );
  }

  /* -- Container (array or object) ------------------------------------- */
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as JsonObject);

  const summary = isArray
    ? `Array(${entries.length})`
    : `{${entries.length}}`;

  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  const toggle = () => setExpanded((e) => !e);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${name ?? rootBracketLabel(isArray)} ${
          expanded ? 'collapse' : 'expand'
        }`}
        className="flex items-baseline gap-1 py-0.5 font-mono text-[12px] leading-5 hover:bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-sm)] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]"
        title={path}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        onContextMenu={handleContextMenu}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--st-text-tertiary)]">
          {expanded ? (
            <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronRight
              className="h-3 w-3"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
        </span>
        {name !== null && (
          <>
            <span className="text-[var(--st-text)]">{name}</span>
            <span className="text-[var(--st-text-tertiary)]">:</span>
          </>
        )}
        <span className="text-[var(--st-text-tertiary)]">{bracketOpen}</span>
        {!expanded && (
          <span className="italic text-[var(--st-text-tertiary)] ml-1">
            {summary}
          </span>
        )}
        {!expanded && (
          <span className="text-[var(--st-text-tertiary)] ml-0.5">
            {bracketClose}
          </span>
        )}
      </div>

      {expanded && (
        <div className="pl-4 border-l border-[var(--st-border)] ml-2">
          {entries.map(([k, v]) => {
            const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
            return (
              <JsonNode
                key={k}
                name={k}
                value={v}
                path={childPath}
                depth={depth + 1}
                query={query}
                onContextMenu={onContextMenu}
              />
            );
          })}
          <div className="pl-0 font-mono text-[12px] leading-5 text-[var(--st-text-tertiary)]">
            {bracketClose}
          </div>
        </div>
      )}
    </div>
  );
}

/** Human label for an unnamed root container, used in the toggle aria-label. */
function rootBracketLabel(isArray: boolean): string {
  return isArray ? 'array' : 'object';
}

/* -- Context-menu popup ------------------------------------------------- */

interface MenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onUseAsExpression?: (expression: string) => void;
}

function JsonContextMenu({ state, onClose, onUseAsExpression }: MenuProps) {
  const { toast } = useToast();

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  const copy = async (text: string, label: string) => {
    const ok = await writeToClipboard(text);
    if (ok) toast.success(`${label} copied`);
    else toast.error('Clipboard unavailable');
  };

  const item = (label: string, onClick: () => void): ReactNode => (
    <Button
      variant="ghost"
      size="sm"
      block
      className="!justify-start text-left text-[12px]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        onClose();
      }}
    >
      {label}
    </Button>
  );

  return (
    // top/left are runtime-computed from the cursor position, so inline style is allowed here.
    <div
      style={{ top: state.y, left: state.x }}
      className="fixed z-[100] min-w-[160px] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-pop)] p-1 flex flex-col gap-0.5"
      role="menu"
      aria-label="JSON node actions"
      onClick={(e) => e.stopPropagation()}
    >
      {item('Copy path', () => void copy(state.path, 'Path'))}
      {item('Copy value', () =>
        void copy(
          typeof state.value === 'string'
            ? state.value
            : safeStringify(state.value),
          'Value',
        ),
      )}
      {item('Use as expression', () => {
        const expr = toExpression(state.path);
        onUseAsExpression?.(expr);
        void copy(expr, 'Expression');
      })}
    </div>
  );
}

/* -- Main component ----------------------------------------------------- */

function JsonTreeViewImpl({
  data,
  searchQuery = '',
  onUseAsExpression,
  rootLabel = '$',
}: Props) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string, value: unknown) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, path, value });
    },
    [],
  );

  const query = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  if (data === undefined) {
    return (
      <div className="px-2 py-3">
        <EmptyState
          size="sm"
          icon={FileQuestion}
          title="No data"
          description="Nothing to inspect yet."
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <JsonNode
        name={null}
        value={data}
        path={rootLabel}
        depth={0}
        query={query}
        onContextMenu={handleContextMenu}
      />
      {menu && (
        <JsonContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onUseAsExpression={onUseAsExpression}
        />
      )}
    </div>
  );
}

export const JsonTreeView = memo(JsonTreeViewImpl);
