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

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Play } from 'lucide-react';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { getBlockLabel, getBlockIcon, getBlockColor } from '@/lib/sabflow/blocks';
import { getBlockBrandIcon } from '@/lib/sabflow/blocks/icons';
import { BrandIcon } from '@/components/sabflow/BrandIcon';
import type { Block, SabFlowDoc, SabFlowEvent, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  Field,
  Input,
  IconButton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { TRIGGER_OPTIONS } from '@/components/sabflow/canvas/triggerPanel/triggerOptions';
import { TriggerEventSettings } from './TriggerEventSettings';
import { PinOutputSection } from './PinOutputSection';

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
import { NodeSettings } from '@/components/sabflow/panels/blocks/shared/NodeSettings';
import { ForgeBlockSettings } from '@/components/sabflow/panels/blocks/forge/ForgeBlockSettings';
// The full forge barrel (`@/lib/sabflow/forge`) is `server-only` because some
// blocks transitively import Node-only packages (mongodb, pg, ssh2, …).
// We fetch a serializable metadata snapshot from `/api/sabflow/forge-metadata`
// instead - see `metadata-client.ts`.
import {
  preloadForgeMetadata,
  getForgeBlockMetadataSync,
} from '@/lib/sabflow/forge/metadata-client';
import type { ForgeBlock } from '@/lib/sabflow/forge/types';
import { GoogleSheetsSettings } from '@/components/sabflow/panels/blocks/GoogleSheetsSettings';
import { SendEmailSettings } from '@/components/sabflow/panels/blocks/SendEmailSettings';
import { ZapierSettings } from '@/components/sabflow/panels/blocks/ZapierSettings';
import { MakeComSettings } from '@/components/sabflow/panels/blocks/MakeComSettings';
import { ChoiceInputSettings } from '@/components/sabflow/panels/blocks/ChoiceInputSettings';
import { PictureChoiceSettings } from '@/components/sabflow/panels/blocks/PictureChoiceSettings';
import { MergeSettings } from '@/components/sabflow/panels/blocks/logic/MergeSettings';
import { LoopSettings } from '@/components/sabflow/panels/blocks/logic/LoopSettings';
import { SwitchSettings } from '@/components/sabflow/panels/blocks/logic/SwitchSettings';
import { FilterSettings } from '@/components/sabflow/panels/blocks/logic/FilterSettings';
import { SortSettings } from '@/components/sabflow/panels/blocks/logic/SortSettings';
import { TestNodePanel } from '@/components/sabflow/panels/blocks/shared/TestNodePanel';
import { NodeStatusBadge } from '@/components/sabflow/inspector/NodeStatusBadge';
import { BlockDocsSection } from './BlockDocsSection';

// App-preset settings panel (forge_app_preset dispatcher). Loaded lazily —
// most flows never open it, so keep it out of the main editor chunk.
const AppPresetSettings = dynamic(
  () =>
    import('@/components/sabflow/panels/blocks/forge/AppPresetSettings').then(
      (m) => m.AppPresetSettings,
    ),
  { ssr: false },
);

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

  // Lazy-load the forge metadata registry once per session. We bump state on
  // completion so synchronous reads later in this render pick up the cache.
  const [, setForgeReady] = useState(0);
  useEffect(() => {
    let cancelled = false;
    preloadForgeMetadata()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setForgeReady((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Find the block that is currently open
  const openedBlock = openedNodeId
    ? flow.groups.flatMap((g) => g.blocks).find((b) => b.id === openedNodeId) ?? null
    : null;

  /* If the opened id isn't a block, see if it matches a trigger event - the
     event-level editor renders in this same right-rail slot. */
  const openedEvent = useMemo<SabFlowEvent | null>(() => {
    if (!openedNodeId || openedBlock) return null;
    return (flow.events ?? []).find((e) => e.id === openedNodeId) ?? null;
  }, [openedNodeId, openedBlock, flow.events]);

  const isOpen = Boolean(openedBlock || openedEvent);

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

  /* Propagate event-level changes (trigger options, etc.) back up. */
  const handleEventUpdate = useCallback(
    (changes: Partial<SabFlowEvent>) => {
      if (!openedEvent) return;
      onFlowChange({
        events: (flow.events ?? []).map((e) =>
          e.id === openedEvent.id ? ({ ...e, ...changes } as SabFlowEvent) : e,
        ),
      });
    },
    [openedEvent, flow.events, onFlowChange],
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
      <div className="w-80 h-full flex flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] z-20">
        {/* ── Header ──────────────────────────────────────────── */}
        <PanelHeader block={openedBlock} event={openedEvent} onClose={handleClose} />

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
              <TestNodePanel
                block={openedBlock}
                flow={flow}
                onBlockChange={handleBlockUpdate}
              />
              <PinOutputSection
                block={openedBlock}
                onUpdate={handleBlockUpdate}
              />
              <div className="mt-4">
                <BlockDocsSection blockType={openedBlock.type} />
              </div>
            </>
          )}
          {openedEvent && (
            <TriggerEventSettings event={openedEvent} onUpdate={handleEventUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Panel header ────────────────────────────────────────────────────────── */

function PanelHeader({
  block,
  event,
  onClose,
}: {
  block: Block | null;
  event: SabFlowEvent | null;
  onClose: () => void;
}) {
  let Icon: ReturnType<typeof getBlockIcon> | null = null;
  let label = '';
  let color = '#888';
  let brand: string | null = null;

  if (block) {
    Icon = getBlockIcon(block.type);
    label = getBlockLabel(block.type);
    color = getBlockColor(block.type);
    brand = getBlockBrandIcon(block.type);
  } else if (event) {
    const meta = TRIGGER_OPTIONS.find((o) => o.appEvent === event.appEvent);
    Icon = (meta?.icon as ReturnType<typeof getBlockIcon>) ?? Play;
    label = meta?.label ?? 'Trigger';
    color = meta?.color ?? '#10b981';
  }

  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3 shrink-0">
      {/* Block / event icon - brand logo when available, else tinted Lucide */}
      {brand ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-secondary)]">
          <BrandIcon icon={brand} className="h-4 w-4" aria-hidden />
        </div>
      ) : Icon ? (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          // Block tint is runtime-computed from the block type's brand color.
          style={{ background: `${color}22`, color }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      ) : null}

      {/* Label */}
      <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)] truncate">
        {label}
      </span>

      {/* Live status badge (hidden when idle) - blocks only */}
      {block && <NodeStatusBadge nodeId={block.id} size="sm" />}

      {/* Close button - back arrow (slides panel away) */}
      <IconButton
        icon={ArrowRight}
        label="Close settings panel"
        size="sm"
        onClick={onClose}
      />
    </div>
  );
}

/* ── Settings body (switch on block type) ────────────────────────────────── */

type BodyProps = {
  block: Block;
  /** Raw Variable objects - used by components that need id-based lookup (e.g. ConditionSettings) */
  variables: Variable[];
  /** Flat name list - used by legacy components that accept string[] */
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
          <Input
            type="text"
            value={String(options.url ?? '')}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com/file"
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
          <Input
            type="text"
            value={String(options.placeholder ?? '')}
            onChange={(e) => update({ placeholder: e.target.value })}
            placeholder="Enter your answer"
          />
        </Field>
        <Field label="Save answer to variable">
          <Input
            type="text"
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
          <Input
            type="text"
            value={String(options.url ?? '')}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com"
          />
        </Field>
        <Field label="Open in">
          <Select
            value={String(options.target ?? '_blank')}
            onValueChange={(v) => update({ target: v })}
          >
            <SelectTrigger aria-label="Open in">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_blank">New tab</SelectItem>
              <SelectItem value="_self">Same tab</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    );
  }

  if (block.type === 'ab_test') {
    return (
      <div className="space-y-4">
        <Field label="Traffic split (% to path A)">
          <Input
            type="number"
            min={0}
            max={100}
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
          <Input
            type="text"
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
      <SendEmailSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'google_sheets') {
    return (
      <GoogleSheetsSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'zapier' || block.type === 'pabbly_connect') {
    return (
      <ZapierSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
    );
  }

  if (block.type === 'make_com') {
    return (
      <MakeComSettings
        block={block}
        onBlockChange={(updated) => onUpdate({ options: updated.options })}
        variables={variables}
      />
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

  /* ── App presets — the generic `forge_app_preset` dispatcher gets a full
   *    branded panel (preset picker, action select, per-endpoint fields,
   *    credential) instead of the raw forge fields below. */
  if ((block.type as string) === 'forge_app_preset') {
    return (
      <AppPresetSettings
        nodeId={block.id}
        options={options}
        onChange={(patch) => onUpdate({ options: { ...options, ...patch } })}
      />
    );
  }

  /* ── Forge blocks (declarative integrations registered in
   *    @/lib/sabflow/forge - forge_github, forge_slack, forge_notion, etc.) */
  if (block.type.startsWith('forge_')) {
    // Metadata is loaded asynchronously via `/api/sabflow/forge-metadata`.
    // Settings panels never call `run`, so the cast back to `ForgeBlock` is
    // safe for the field-rendering renderer.
    const forgeMetadata = getForgeBlockMetadataSync(block.type);
    if (forgeMetadata) {
      return (
        <ForgeBlockSettings
          nodeId={block.id}
          block={forgeMetadata as unknown as ForgeBlock}
          options={options}
          onChange={(patch) => onUpdate({ options: { ...options, ...patch } })}
        />
      );
    }
    // Either still loading or unknown forge id - fall through.
  }

  /* ── Fallback: render the generic descriptor-driven settings panel.
   *    Any block type registered in the Rust `sabflow-nodes` crate
   *    (80 implemented + ~230 stubs) gets a working UI here automatically.
   *    NodeSettings handles its own loading / "unknown node" states.
   */
  return (
    <NodeSettings
      nodeType={block.type}
      values={options}
      onChange={(next) => onUpdate({ options: next })}
      onChangeBlockType={(nextType) =>
        // Stub-fallback "Swap" button - replace the block type in place
        // while keeping every option that overlaps.  Cast through the
        // string-keyed `Block.type` union (NodeSettings only suggests
        // forge types we know exist).
        onUpdate({ type: nextType as Block['type'] })
      }
    />
  );
}
