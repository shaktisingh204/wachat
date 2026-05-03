'use client';

import { useCallback, useMemo, useState } from 'react';
import { LuBot, LuClock, LuDollarSign, LuChevronDown, LuChevronUp } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  PanelHeader,
  inputClass,
  selectClass,
  Divider,
} from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface AgentRunOptions {
  /** Required: registered agent id (e.g. `sales-sdr`). */
  agentId?: string;
  /** Free-text template, supports {{variable}} tokens. */
  inputTemplate?: string;
  /** Variable id to receive the agent's final output. */
  outputVariable?: string;
  /** Per-call timeout in ms (caps the agent's default budget). */
  timeoutMs?: number;
  /** Per-call cost cap in USD-cents. */
  maxCostCents?: number;
}

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
  /**
   * Optional: list of registered agents pulled from `@/lib/agents`. The
   * caller (BlockSettingsPanel) is expected to fetch this server-side and
   * pass it down so the dropdown stays accurate without bundling
   * `server-only` code into the client.
   */
  agentOptions?: ReadonlyArray<{ id: string; name: string; description?: string }>;
};

const FALLBACK_AGENTS: ReadonlyArray<{ id: string; name: string; description?: string }> = [
  { id: 'sales-sdr', name: 'Sales SDR', description: 'Outbound sales prospector.' },
  { id: 'support-triage', name: 'Support Triage', description: 'Routes inbound tickets.' },
  { id: 'copywriter', name: 'Copywriter', description: 'Drafts marketing copy.' },
];

/* ══════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════ */

export function AgentRunSettings({
  block,
  onBlockChange,
  variables = [],
  agentOptions,
}: Props) {
  const opts = (block.options ?? {}) as AgentRunOptions;

  const agents = useMemo(
    () => (agentOptions && agentOptions.length > 0 ? agentOptions : FALLBACK_AGENTS),
    [agentOptions],
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<AgentRunOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === opts.agentId),
    [agents, opts.agentId],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuBot} title="Run AI Agent" />

      <Field label="Agent">
        <select
          value={opts.agentId ?? ''}
          onChange={(e) => update({ agentId: e.target.value || undefined })}
          className={selectClass}
          aria-label="Agent"
        >
          <option value="" disabled>
            — pick an agent —
          </option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {selectedAgent?.description && (
          <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
            {selectedAgent.description}
          </p>
        )}
      </Field>

      <Field label="Input">
        <VariableAutocompleteInput
          type="textarea"
          value={opts.inputTemplate ?? ''}
          onChange={(v) => update({ inputTemplate: v })}
          variables={variables}
          placeholder="Hi, please handle {{contact_name}} who said {{last_message}}"
          rows={4}
          aria-label="Agent input prompt"
          className="min-h-[80px]"
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          {'Use {{variable}} placeholders. Resolved before the agent runs.'}
        </p>
      </Field>

      <Field label="Save output to">
        <VariableSelect
          variables={variables}
          value={opts.outputVariable}
          onChange={(id) => update({ outputVariable: id })}
          placeholder="— select variable —"
        />
      </Field>

      <Divider />

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        aria-expanded={advancedOpen}
        className="flex w-full items-center justify-between text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide hover:text-[var(--gray-12)] transition-colors"
      >
        <span>Budget</span>
        {advancedOpen ? (
          <LuChevronUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        ) : (
          <LuChevronDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {advancedOpen && (
        <div className="space-y-4 pl-1 border-l-2 border-[var(--gray-4)]">
          <Field label="Timeout (ms)">
            <div className="relative flex items-center">
              <LuClock
                className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <input
                type="number"
                min={500}
                step={500}
                value={opts.timeoutMs ?? ''}
                onChange={(e) =>
                  update({
                    timeoutMs:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="60000"
                aria-label="Timeout in milliseconds"
                className={`${inputClass} pl-8`}
              />
            </div>
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              Hard wall-clock budget. The flow continues on the error edge if
              the agent exceeds this limit.
            </p>
          </Field>

          <Field label="Max cost (¢)">
            <div className="relative flex items-center">
              <LuDollarSign
                className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={opts.maxCostCents ?? ''}
                onChange={(e) =>
                  update({
                    maxCostCents:
                      e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="50"
                aria-label="Max cost in USD cents"
                className={`${inputClass} pl-8`}
              />
            </div>
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              Caps the agent's spend. The bridge marks the run as errored when
              the runner reports a higher cost.
            </p>
          </Field>
        </div>
      )}
    </div>
  );
}

export default AgentRunSettings;
