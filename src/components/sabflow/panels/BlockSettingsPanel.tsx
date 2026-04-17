'use client';
/**
 * BlockSettingsPanel
 *
 * A 320px right-side sliding panel that opens when a block node is clicked.
 * It reads `openedNodeId` from `useGraph()`, finds the matching block in
 * `flow.groups`, and renders the appropriate settings component.
 *
 * Animation: CSS translate-x transition (slide in from right).
 */

import { useCallback } from 'react';
import { LuArrowRight } from 'react-icons/lu';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { getBlockLabel, getBlockIcon, getBlockColor } from '@/lib/sabflow/blocks';
import type { Block, SabFlowDoc, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

// Re-use the existing per-block settings sub-components
import { TextBlockSettings } from '@/components/sabflow/blocks/panels/settings/TextBlockSettings';
import { TextInputSettings } from '@/components/sabflow/blocks/panels/settings/TextInputSettings';
import { ConditionSettings } from '@/components/sabflow/panels/blocks/logic/ConditionSettings';
import { WebhookSettings } from '@/components/sabflow/blocks/panels/settings/WebhookSettings';
import { SetVariableSettings } from '@/components/sabflow/blocks/panels/settings/SetVariableSettings';
import { WaitSettings } from '@/components/sabflow/blocks/panels/settings/WaitSettings';
import { ScriptSettings } from '@/components/sabflow/panels/blocks/logic/ScriptSettings';

// AI / Integration panels
import { OpenAISettings } from '@/components/sabflow/panels/blocks/OpenAISettings';
import { AnthropicSettings } from '@/components/sabflow/panels/blocks/integrations/AnthropicSettings';
import { TogetherAISettings } from '@/components/sabflow/panels/blocks/integrations/TogetherAISettings';
import { MistralSettings } from '@/components/sabflow/panels/blocks/integrations/MistralSettings';
import { GoogleAnalyticsSettings } from '@/components/sabflow/panels/blocks/integrations/GoogleAnalyticsSettings';
import { TypebotLinkSettings } from '@/components/sabflow/panels/blocks/logic/TypebotLinkSettings';
import { ChatwootSettings } from '@/components/sabflow/panels/blocks/integrations/ChatwootSettings';
import { CalComSettings } from '@/components/sabflow/panels/blocks/integrations/CalComSettings';
import { NocoDBSettings } from '@/components/sabflow/panels/blocks/integrations/NocoDBSettings';
import { ElevenLabsSettings } from '@/components/sabflow/panels/blocks/integrations/ElevenLabsSettings';
import { SegmentSettings } from '@/components/sabflow/panels/blocks/integrations/SegmentSettings';
import { PixelSettings } from '@/components/sabflow/panels/blocks/integrations/PixelSettings';
import { ChoiceInputSettings } from '@/components/sabflow/panels/blocks/ChoiceInputSettings';
import { PictureChoiceSettings } from '@/components/sabflow/panels/blocks/PictureChoiceSettings';
import { MergeSettings } from '@/components/sabflow/panels/blocks/logic/MergeSettings';
import { LoopSettings } from '@/components/sabflow/panels/blocks/logic/LoopSettings';
import { SwitchSettings } from '@/components/sabflow/panels/blocks/logic/SwitchSettings';
import { FilterSettings } from '@/components/sabflow/panels/blocks/logic/FilterSettings';
import { SortSettings } from '@/components/sabflow/panels/blocks/logic/SortSettings';
import { TestNodePanel } from '@/components/sabflow/panels/blocks/shared/TestNodePanel';
import { NodeStatusBadge } from '@/components/sabflow/inspector/NodeStatusBadge';

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => void;
  /** Optional: allow block settings panels to create new variables inline */
  onVariablesChange?: (variables: Variable[]) => void;
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function BlockSettingsPanel({ flow, onFlowChange, onVariablesChange }: Props) {
  const { openedNodeId, setOpenedNodeId } = useGraph();

  // Find the block that is currently open
  const openedBlock = openedNodeId
    ? flow.groups.flatMap((g) => g.blocks).find((b) => b.id === openedNodeId) ?? null
    : null;

  const isOpen = Boolean(openedBlock);

  const handleClose = useCallback(() => {
    setOpenedNodeId(undefined);
  }, [setOpenedNodeId]);

  /* Propagate block-level changes back up to the flow */
  const handleBlockUpdate = useCallback(
    (changes: Partial<Block>) => {
      if (!openedBlock) return;
      onFlowChange({
        groups: flow.groups.map((g) => ({
          ...g,
          blocks: g.blocks.map((b) =>
            b.id === openedBlock.id ? { ...b, ...changes } : b,
          ),
        })),
      });
    },
    [openedBlock, flow.groups, onFlowChange],
  );

  const variableNames = flow.variables.map((v) => v.name);
  const variables = flow.variables;

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    /*
     * The outer wrapper always occupies space in the flex row; we collapse its
     * width to 0 when closed via `w-0 / w-80` toggling plus `overflow-hidden`.
     * The inner div carries the visual chrome and scrollable body.
     */
    <div
      className={cn(
        'shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden',
        isOpen ? 'w-80' : 'w-0',
      )}
    >
      <div className="w-80 h-full flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20">
        {/* ── Header ──────────────────────────────────────────── */}
        <PanelHeader block={openedBlock} onClose={handleClose} />

        {/* ── Body (scrollable) ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">
          {openedBlock && (
            <>
              <BlockSettingsBody
                block={openedBlock}
                variableNames={variableNames}
                variables={variables}
                onUpdate={handleBlockUpdate}
                onCreateVariable={
                  onVariablesChange
                    ? (v) => onVariablesChange([...flow.variables, v])
                    : undefined
                }
              />
              <TestNodePanel block={openedBlock} flow={flow} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Panel header ────────────────────────────────────────────────────────── */

function PanelHeader({
  block,
  onClose,
}: {
  block: Block | null;
  onClose: () => void;
}) {
  const Icon = block ? getBlockIcon(block.type) : null;
  const label = block ? getBlockLabel(block.type) : '';
  const color = block ? getBlockColor(block.type) : '#888';

  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
      {/* Block type icon */}
      {Icon && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}

      {/* Block type label */}
      <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)] truncate">
        {label}
      </span>

      {/* Live status badge (hidden when idle) */}
      {block && <NodeStatusBadge nodeId={block.id} size="sm" />}

      {/* Close button — back arrow (slides panel away) */}
      <button
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        aria-label="Close settings panel"
        title="Close"
      >
        <LuArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── Settings body (switch on block type) ────────────────────────────────── */

type BodyProps = {
  block: Block;
  /** Raw Variable objects — used by components that need id-based lookup (e.g. ConditionSettings) */
  variables: Variable[];
  /** Flat name list — used by legacy components that accept string[] */
  variableNames: string[];
  onUpdate: (changes: Partial<Block>) => void;
  /** Allow block-level VariableSelect to create a new variable inline */
  onCreateVariable?: (variable: Variable) => void;
};

function BlockSettingsBody({ block, variables, variableNames, onUpdate, onCreateVariable }: BodyProps) {
  const options = block.options ?? {};
  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  /* ── Bubbles ───────────────────────────────────────── */

  if (block.type === 'text') {
    return <TextBlockSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'embed') {
    const urlLabel: Record<string, string> = {
      image: 'Image URL',
      video: 'Video URL',
      audio: 'Audio URL',
      embed: 'Embed URL',
    };
    return (
      <div className="space-y-4">
        <Field label={urlLabel[block.type] ?? 'URL'}>
          <input
            type="text"
            className={inputClass}
            value={String(options.url ?? '')}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://…"
          />
        </Field>
      </div>
    );
  }

  /* ── Inputs ────────────────────────────────────────── */

  if (block.type === 'text_input') {
    return <TextInputSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'choice_input') {
    return (
      <ChoiceInputSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options, items: updated.items })}
        variables={variables}
      />
    );
  }

  if (block.type === 'picture_choice_input') {
    return (
      <PictureChoiceSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options, items: updated.items })}
        variables={variables}
      />
    );
  }

  // Generic inputs (number, email, phone, url, date, time, rating, file, payment)
  if (block.type.endsWith('_input')) {
    return (
      <div className="space-y-4">
        <Field label="Placeholder">
          <input
            type="text"
            className={inputClass}
            value={String(options.placeholder ?? '')}
            onChange={(e) => update({ placeholder: e.target.value })}
            placeholder="Enter placeholder…"
          />
        </Field>
        <Field label="Save answer to variable">
          <input
            type="text"
            className={inputClass}
            value={String(options.variableName ?? '')}
            onChange={(e) => update({ variableName: e.target.value })}
            placeholder="{{answerVariable}}"
          />
        </Field>
      </div>
    );
  }

  /* ── Logic ─────────────────────────────────────────── */

  if (block.type === 'condition') {
    return (
      <ConditionSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'set_variable') {
    return <SetVariableSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'wait') {
    return <WaitSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'script') {
    return (
      <ScriptSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'redirect') {
    return (
      <div className="space-y-4">
        <Field label="Redirect URL">
          <input
            type="text"
            className={inputClass}
            value={String(options.url ?? '')}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Open in">
          <select
            className={inputClass}
            value={String(options.target ?? '_blank')}
            onChange={(e) => update({ target: e.target.value })}
          >
            <option value="_blank">New tab</option>
            <option value="_self">Same tab</option>
          </select>
        </Field>
      </div>
    );
  }

  if (block.type === 'ab_test') {
    return (
      <div className="space-y-4">
        <Field label="Traffic split (% to path A)">
          <input
            type="number"
            min={0}
            max={100}
            className={inputClass}
            value={String(options.percentageToA ?? 50)}
            onChange={(e) => update({ percentageToA: Number(e.target.value) })}
          />
        </Field>
      </div>
    );
  }

  if (block.type === 'jump') {
    return (
      <div className="space-y-4">
        <Field label="Jump to group ID">
          <input
            type="text"
            className={inputClass}
            value={String(options.groupId ?? '')}
            onChange={(e) => update({ groupId: e.target.value })}
            placeholder="target-group-id"
          />
        </Field>
      </div>
    );
  }

  if (block.type === 'merge') {
    return <MergeSettings block={block} onUpdate={onUpdate} />;
  }

  if (block.type === 'loop') {
    return <LoopSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'switch') {
    return <SwitchSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'filter') {
    return <FilterSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'sort') {
    return <SortSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  /* ── Integrations ──────────────────────────────────── */

  if (block.type === 'webhook') {
    return <WebhookSettings block={block} onUpdate={onUpdate} variables={variableNames} />;
  }

  if (block.type === 'send_email') {
    return (
      <div className="space-y-3">
        <Field label="To">
          <input
            type="text"
            className={inputClass}
            value={String(options.to ?? '')}
            onChange={(e) => update({ to: e.target.value })}
            placeholder="recipient@example.com or {{email}}"
          />
        </Field>
        <Field label="Subject">
          <input
            type="text"
            className={inputClass}
            value={String(options.subject ?? '')}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="Your subject…"
          />
        </Field>
        <Field label="Body">
          <textarea
            className={cn(inputClass, 'min-h-[100px] resize-y')}
            value={String(options.body ?? '')}
            onChange={(e) => update({ body: e.target.value })}
            placeholder="Email body… use {{variable}} for dynamic content."
          />
        </Field>
      </div>
    );
  }

  if (block.type === 'open_ai') {
    return (
      <OpenAISettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'anthropic') {
    return (
      <AnthropicSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'together_ai') {
    return (
      <TogetherAISettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'mistral') {
    return (
      <MistralSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'typebot_link') {
    return (
      <TypebotLinkSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'google_analytics') {
    return (
      <GoogleAnalyticsSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'chatwoot') {
    return (
      <ChatwootSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'cal_com') {
    return (
      <CalComSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'nocodb') {
    return (
      <NocoDBSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'elevenlabs') {
    return (
      <ElevenLabsSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'segment') {
    return (
      <SegmentSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  if (block.type === 'pixel') {
    return (
      <PixelSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
      />
    );
  }

  /* ── Fallback ──────────────────────────────────────── */
  return <ComingSoon label={getBlockLabel(block.type)} />;
}

/* ── Shared primitives ───────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 text-center text-[12px] text-[var(--gray-9)]">
      Settings for <strong>{label}</strong> coming soon.
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
