'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bot, Clock, DollarSign } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { PanelHeader, Divider } from './shared/primitives';
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
      <PanelHeader icon={Bot} title="Run AI Agent" />

      <Field label="Agent" help={selectedAgent?.description}>
        <Select
          value={opts.agentId ?? ''}
          onValueChange={(v) => update({ agentId: v || undefined })}
        >
          <SelectTrigger aria-label="Agent">
            <SelectValue placeholder="Pick an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Input" help="Use {{variable}} placeholders. Resolved before the agent runs.">
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
      </Field>

      <Field label="Save output to">
        <VariableSelect
          variables={variables}
          value={opts.outputVariable}
          onChange={(id) => update({ outputVariable: id })}
          placeholder="Select variable"
        />
      </Field>

      <Divider />

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger>Budget</CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-l-2 border-[var(--st-border)] pl-3">
            <Field
              label="Timeout (ms)"
              help="Hard wall-clock budget. The flow continues on the error edge if the agent exceeds this limit."
            >
              <Input
                type="number"
                min={500}
                step={500}
                iconLeft={Clock}
                value={opts.timeoutMs ?? ''}
                onChange={(e) =>
                  update({
                    timeoutMs: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="60000"
                aria-label="Timeout in milliseconds"
              />
            </Field>

            <Field
              label="Max cost (cents)"
              help="Caps the agent's spend. The bridge marks the run as errored when the runner reports a higher cost."
            >
              <Input
                type="number"
                min={0}
                step={1}
                iconLeft={DollarSign}
                value={opts.maxCostCents ?? ''}
                onChange={(e) =>
                  update({
                    maxCostCents: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="50"
                aria-label="Max cost in USD cents"
              />
            </Field>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default AgentRunSettings;
