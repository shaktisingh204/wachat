'use client';

/**
 * ScriptSettings - panel UI for the `script` logic block (and the
 * "Result of code" mode of the set_variable block).
 *
 * Lets the user:
 *   - Write JavaScript source
 *   - Pick server- or client-side execution
 *   - Configure a timeout and an optional fetch-domain whitelist
 *   - Test the script with a mocked variable set and inspect the result
 */

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Code,
  Play,
  Plus,
  X,
  Server,
  Monitor,
  Braces,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Button,
  Field,
  Input,
  Textarea,
  SegmentedControl,
  Switch,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from '../shared/primitives';
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
  /** Typebot-compat field - same thing as `code` */
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
//   variables[name]          - read a flow variable
//   setVariable(name, value) - persist a new variable value
//   console.log / .error     - show up in the Logs tab
//
// Return a value to save into the selected output variable.

return variables['userName'] ?? 'guest';
`;

type RunMode = 'server' | 'client';

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

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <PanelHeader icon={Code} title="Script" />

      {/* ── Run on toggle ─────────────────────────────────────────────── */}
      <Field
        label="Run on"
        help={
          <>
            Server runs in a Node.js <code>vm</code> sandbox (can use{' '}
            <code>fetch</code> with whitelisted hosts). Client runs in a hidden
            iframe on the visitor&apos;s browser.
          </>
        }
      >
        <SegmentedControl<RunMode>
          aria-label="Where the script runs"
          fullWidth
          value={runOnClient ? 'client' : 'server'}
          onChange={(mode) =>
            update({
              runOnClient: mode === 'client',
              isExecutedOnClient: mode === 'client',
            })
          }
          items={[
            { value: 'server', label: 'Server', icon: Server },
            { value: 'client', label: 'Client', icon: Monitor },
          ]}
        />
      </Field>

      {/* ── Code editor ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={codeFieldId}
            className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]"
          >
            JavaScript source
          </label>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={copied ? Check : Copy}
            onClick={applyTemplate}
          >
            {copied ? 'Applied' : 'Use template'}
          </Button>
        </div>
        <Textarea
          id={codeFieldId}
          ref={textareaRef}
          value={code}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            update({ code: e.target.value })
          }
          rows={12}
          spellCheck={false}
          placeholder="// Write JavaScript here..."
          className={cn(
            'min-h-[220px] resize-y',
            'font-mono text-[12px] leading-[1.55]',
          )}
          aria-describedby={`${codeFieldId}-hint`}
        />
        <p
          id={`${codeFieldId}-hint`}
          className="text-[10.5px] text-[var(--st-text-secondary)]"
        >
          Syntax highlighting coming soon. Use <code>variables[name]</code> to
          read and <code>setVariable(name, value)</code> to write.
        </p>
      </div>

      {/* ── Insert variable buttons ──────────────────────────────────── */}
      {variables.length > 0 && (
        <Field label="Insert variable">
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <Button
                key={v.id}
                variant="outline"
                size="sm"
                iconLeft={Braces}
                onClick={() => insertVariable(v.name)}
                title={`Insert variables['${v.name}']`}
              >
                <span className="font-mono">{v.name}</span>
              </Button>
            ))}
          </div>
        </Field>
      )}

      {/* ── Output variable ───────────────────────────────────────────── */}
      <Field label="Save return value to">
        <Input
          type="text"
          value={opts.outputVariable ?? ''}
          onChange={(e) => update({ outputVariable: e.target.value })}
          placeholder="scriptOutput"
        />
      </Field>

      {/* ── Timeout ──────────────────────────────────────────────────── */}
      <Field
        label="Timeout (ms)"
        help="Hard wall-clock limit. The script is aborted if it has not returned in this many milliseconds."
      >
        <Input
          type="number"
          min={100}
          max={60000}
          step={100}
          value={timeoutMs}
          onChange={(e) =>
            update({
              timeoutMs: Math.max(
                100,
                Math.min(60000, Number(e.target.value) || 5000),
              ),
            })
          }
        />
      </Field>

      {/* ── Fetch toggle (server only) ───────────────────────────────── */}
      {!runOnClient && (
        <Field label="Allow fetch (server)">
          <Switch
            checked={allowFetch}
            onCheckedChange={() => update({ allowFetch: !allowFetch })}
            label={
              <>
                Expose <code>fetch()</code> to the script
              </>
            }
          />

          {allowFetch && (
            <div className="mt-3 space-y-2">
              <span className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Allowed fetch domains
              </span>
              <div className="flex gap-1.5">
                <Input
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
                />
                <Button
                  variant="primary"
                  iconLeft={Plus}
                  onClick={addDomain}
                  disabled={!newDomain.trim()}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>

              {allowedDomains.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Globe}
                  title="No domains allowed"
                  description="Fetch is effectively disabled until you add at least one hostname."
                />
              ) : (
                <ul className="divide-y divide-[var(--st-border)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                  {allowedDomains.map((d) => (
                    <li
                      key={d}
                      className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--st-text)]"
                    >
                      <span className="flex-1 truncate font-mono">{d}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={X}
                        onClick={() => removeDomain(d)}
                        aria-label={`Remove ${d}`}
                        title={`Remove ${d}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>
      )}

      {/* ── Test run button ──────────────────────────────────────────── */}
      <Button
        variant="primary"
        block
        iconLeft={Play}
        loading={isRunning}
        disabled={!code.trim()}
        onClick={runTest}
      >
        {isRunning ? 'Running...' : 'Test run'}
      </Button>

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
