'use client';

/**
 * ScriptSettings — panel UI for the `script` logic block (and the
 * "Result of code" mode of the set_variable block).
 *
 * Lets the user:
 *   • Write JavaScript source
 *   • Pick server- or client-side execution
 *   • Configure a timeout and an optional fetch-domain whitelist
 *   • Test the script with a mocked variable set and inspect the result
 */

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  LuCode,
  LuPlay,
  LuPlus,
  LuX,
  LuServer,
  LuMonitor,
  LuBraces,
  LuCopy,
  LuCheck,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, toggleClass } from '../shared/primitives';
import { ScriptTestPanel } from '@/components/sabflow/panels/ScriptTestPanel';
import { runScript } from '@/lib/sabflow/execution/sandbox';
import type { SandboxResult } from '@/lib/sabflow/execution/sandbox';

/* ── Types ────────────────────────────────────────────────────────────────── */

/**
 * Extended ScriptOptions shape. We layer SabFlow-specific fields
 * (`timeoutMs`, `allowFetch`, `allowedDomains`, `runOnClient`) on top of the
 * Typebot-compatible base type.
 */
interface ScriptSettingsOptions {
  /** Human-readable label for the script block */
  name?: string;
  /** JavaScript source */
  code?: string;
  /** Typebot-compat field — same thing as `code` */
  content?: string;
  /** Run on the browser rather than on the server */
  runOnClient?: boolean;
  isExecutedOnClient?: boolean;
  /** Hard timeout in milliseconds (default 5000) */
  timeoutMs?: number;
  /** Allow the script to call `fetch`. Server-side only. */
  allowFetch?: boolean;
  /** Whitelist of hostnames the script may fetch. */
  allowedDomains?: string[];
  /** Variable name to persist the return value into */
  outputVariable?: string;
}

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables: Variable[];
};

/* ── Component ───────────────────────────────────────────────────────────── */

const DEFAULT_TEMPLATE = `// Available:
//   variables[name]          — read a flow variable
//   setVariable(name, value) — persist a new variable value
//   console.log / .error     — show up in the Logs tab
//
// Return a value to save into the selected output variable.

return variables['userName'] ?? 'guest';
`;

export function ScriptSettings({ block, onBlockChange, variables }: Props) {
  const opts = (block.options ?? {}) as ScriptSettingsOptions;
  const code = opts.code ?? opts.content ?? '';
  const runOnClient = opts.runOnClient === true || opts.isExecutedOnClient === true;
  const allowFetch = opts.allowFetch === true;
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 5000;
  const allowedDomains = opts.allowedDomains ?? [];

  const update = useCallback(
    (patch: Partial<ScriptSettingsOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  // ── Test runner state ────────────────────────────────────────────────────
  const [testResult, setTestResult] = useState<SandboxResult | null>(null);
  const [testBefore, setTestBefore] = useState<Record<string, unknown>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runTest = useCallback(async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setTestResult(null);

    // Build a mock variable map from the flow's declared variables.
    const beforeVars: Record<string, unknown> = {};
    for (const v of variables) {
      beforeVars[v.name] =
        v.defaultValue !== undefined ? v.defaultValue : v.value ?? '';
    }
    setTestBefore(beforeVars);

    const collected: Record<string, unknown> = { ...beforeVars };
    const result = await runScript(
      code,
      {
        variables: beforeVars,
        setVariable: (name, value) => {
          collected[name] = value;
        },
        console: {
          log: () => {},
          error: () => {},
        },
      },
      {
        timeoutMs,
        allowFetch,
        allowedDomains,
      },
    );
    // Fold any setVariable calls into the result.variables field so the
    // diff view sees them even if the sandbox did not attach them.
    setTestResult({
      ...result,
      variables: { ...(result.variables ?? {}), ...collected },
    });
    setIsRunning(false);
  }, [code, variables, timeoutMs, allowFetch, allowedDomains, isRunning]);

  const applyTemplate = useCallback(() => {
    update({ code: DEFAULT_TEMPLATE });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [update]);

  // ── Variable insertion (append to the end of the textarea) ───────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertVariable = useCallback(
    (varName: string) => {
      const insertion = `variables['${varName.replace(/'/g, "\\'")}']`;
      const ta = textareaRef.current;
      if (!ta) {
        update({ code: `${code}${insertion}` });
        return;
      }
      const start = ta.selectionStart ?? code.length;
      const end = ta.selectionEnd ?? code.length;
      const next = `${code.slice(0, start)}${insertion}${code.slice(end)}`;
      update({ code: next });
    },
    [code, update],
  );

  /* ── Allowed domains editor ───────────────────────────────────────────── */

  const [newDomain, setNewDomain] = useState('');
  const addDomain = useCallback(() => {
    const d = newDomain.trim().toLowerCase();
    if (!d) return;
    if (allowedDomains.includes(d)) return;
    update({ allowedDomains: [...allowedDomains, d] });
    setNewDomain('');
  }, [newDomain, allowedDomains, update]);
  const removeDomain = useCallback(
    (d: string) => {
      update({ allowedDomains: allowedDomains.filter((x) => x !== d) });
    },
    [allowedDomains, update],
  );

  /* ── IDs for a11y ─────────────────────────────────────────────────────── */

  const codeFieldId = useId();
  const timeoutFieldId = useId();
  const outputFieldId = useId();

  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuCode} title="Script" />

      {/* ── Run on toggle ─────────────────────────────────────────────── */}
      <Field label="Run on">
        <div className="flex rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-0.5">
          <RunOnButton
            active={!runOnClient}
            icon={LuServer}
            label="Server"
            onClick={() => update({ runOnClient: false, isExecutedOnClient: false })}
          />
          <RunOnButton
            active={runOnClient}
            icon={LuMonitor}
            label="Client"
            onClick={() => update({ runOnClient: true, isExecutedOnClient: true })}
          />
        </div>
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1 leading-relaxed">
          Server runs in a Node.js <code>vm</code> sandbox (can use
          <code> fetch</code> with whitelisted hosts). Client runs in a hidden
          iframe on the visitor's browser.
        </p>
      </Field>

      {/* ── Code editor ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={codeFieldId}
            className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide"
          >
            JavaScript source
          </label>
          <button
            type="button"
            onClick={applyTemplate}
            className="flex items-center gap-1 text-[11px] text-[var(--gray-8)] hover:text-[var(--gray-12)] transition-colors"
          >
            {copied ? (
              <LuCheck className="h-3 w-3 text-green-500" strokeWidth={2} />
            ) : (
              <LuCopy className="h-3 w-3" strokeWidth={1.8} />
            )}
            {copied ? 'Applied' : 'Use template'}
          </button>
        </div>
        {/* Line-number gutter via CSS counter on the wrapping div. */}
        <div className="relative rounded-lg border border-[var(--gray-5)] bg-[#0d0d0d] overflow-hidden focus-within:border-[#f76808] transition-colors">
          <LineGutter lineCount={lineCount} />
          <textarea
            id={codeFieldId}
            ref={textareaRef}
            value={code}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              update({ code: e.target.value })
            }
            rows={12}
            spellCheck={false}
            placeholder="// Write JavaScript here…"
            className={cn(
              'w-full resize-y min-h-[220px] bg-transparent',
              'pl-10 pr-3 py-3 outline-none',
              'font-mono text-[12px] leading-[1.55] text-green-400',
              'placeholder:text-[var(--gray-7)]',
            )}
            aria-describedby={`${codeFieldId}-hint`}
          />
        </div>
        <p id={`${codeFieldId}-hint`} className="text-[10.5px] text-[var(--gray-8)]">
          Syntax highlighting coming soon. Use <code>variables[name]</code> to
          read and <code>setVariable(name, value)</code> to write.
        </p>
      </div>

      {/* ── Insert variable buttons ──────────────────────────────────── */}
      {variables.length > 0 && (
        <Field label="Insert variable">
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => insertVariable(v.name)}
                className={cn(
                  'flex items-center gap-1 rounded-md border border-[var(--gray-5)]',
                  'bg-[var(--gray-2)] px-2 py-1 text-[11px] text-[var(--gray-11)]',
                  'hover:border-[#f76808]/40 hover:bg-[#f76808]/5 hover:text-[#f76808]',
                  'transition-colors',
                )}
                title={`Insert variables['${v.name}']`}
              >
                <LuBraces className="h-3 w-3" strokeWidth={1.8} />
                <span className="font-mono">{v.name}</span>
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* ── Output variable ───────────────────────────────────────────── */}
      <Field label="Save return value to">
        <input
          id={outputFieldId}
          type="text"
          value={opts.outputVariable ?? ''}
          onChange={(e) => update({ outputVariable: e.target.value })}
          placeholder="scriptOutput"
          className={inputClass}
        />
      </Field>

      {/* ── Timeout ──────────────────────────────────────────────────── */}
      <Field label="Timeout (ms)">
        <input
          id={timeoutFieldId}
          type="number"
          min={100}
          max={60000}
          step={100}
          value={timeoutMs}
          onChange={(e) =>
            update({
              timeoutMs: Math.max(100, Math.min(60000, Number(e.target.value) || 5000)),
            })
          }
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Hard wall-clock limit. The script is aborted if it has not returned
          in this many milliseconds.
        </p>
      </Field>

      {/* ── Fetch toggle (server only) ───────────────────────────────── */}
      {!runOnClient && (
        <Field label="Allow fetch (server)">
          <label className="flex items-center gap-2 cursor-pointer">
            <span
              role="switch"
              aria-checked={allowFetch}
              tabIndex={0}
              onClick={() => update({ allowFetch: !allowFetch })}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  update({ allowFetch: !allowFetch });
                }
              }}
              className={toggleClass(allowFetch)}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 translate-y-0 transform rounded-full bg-white shadow transition',
                  allowFetch ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </span>
            <span className="text-[12px] text-[var(--gray-11)]">
              Expose <code>fetch()</code> to the script
            </span>
          </label>

          {allowFetch && (
            <div className="mt-3 space-y-2">
              <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide block">
                Allowed fetch domains
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                  placeholder="api.example.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addDomain}
                  disabled={!newDomain.trim()}
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-medium',
                    'transition-colors',
                    newDomain.trim()
                      ? 'bg-[#f76808] text-white hover:bg-[#e25c00]'
                      : 'bg-[var(--gray-4)] text-[var(--gray-7)] cursor-not-allowed',
                  )}
                >
                  <LuPlus className="h-3 w-3" strokeWidth={2.4} />
                  Add
                </button>
              </div>

              {allowedDomains.length === 0 ? (
                <p className="text-[10.5px] text-[var(--gray-8)]">
                  No domains allowed. Fetch is effectively disabled until you
                  add at least one hostname.
                </p>
              ) : (
                <ul className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
                  {allowedDomains.map((d) => (
                    <li
                      key={d}
                      className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--gray-11)]"
                    >
                      <span className="font-mono flex-1 truncate">{d}</span>
                      <button
                        type="button"
                        onClick={() => removeDomain(d)}
                        title="Remove domain"
                        className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-500 transition-colors"
                      >
                        <LuX className="h-3 w-3" strokeWidth={2.2} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>
      )}

      {/* ── Test run button ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={runTest}
        disabled={!code.trim() || isRunning}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg py-2',
          'text-[12px] font-semibold transition-colors',
          !code.trim() || isRunning
            ? 'bg-[var(--gray-4)] text-[var(--gray-7)] cursor-not-allowed'
            : 'bg-[#f76808] text-white hover:bg-[#e25c00]',
        )}
      >
        <LuPlay className="h-3.5 w-3.5" strokeWidth={2.2} />
        {isRunning ? 'Running…' : 'Test run'}
      </button>

      {testResult && (
        <ScriptTestPanel
          result={testResult}
          variablesBefore={testBefore}
          onClose={() => setTestResult(null)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function RunOnButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5',
        'text-[12px] font-medium transition-colors',
        active
          ? 'bg-[#f76808] text-white shadow-sm'
          : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {label}
    </button>
  );
}

/**
 * Absolutely-positioned line-number gutter rendered on the left edge of the
 * code editor. Line numbers are emitted via CSS counters so they stay in sync
 * with scrolling; we pad the textarea with `pl-10`.
 */
function LineGutter({ lineCount }: { lineCount: number }) {
  // Render one span per line; the textarea next to it dictates actual layout.
  const nums = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-0 bottom-0 w-8',
        'border-r border-[var(--gray-5)] bg-[#0a0a0a]',
        'py-3 text-right pr-1.5',
        'font-mono text-[11px] leading-[1.55] text-[var(--gray-7)]',
        'select-none overflow-hidden',
      )}
    >
      {nums.map((n) => (
        <div key={n}>{n}</div>
      ))}
    </div>
  );
}
