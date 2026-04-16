'use client';
import { useState } from 'react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  getBlockLabel,
  getBlockIcon,
  getBlockColor,
  getBlockCategory,
} from '@/lib/sabflow/blocks';
import { cn } from '@/lib/utils';
import { LuX, LuSettings } from 'react-icons/lu';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

import { TextBlockSettings } from './settings/TextBlockSettings';
import { TextInputSettings } from './settings/TextInputSettings';
import { ConditionSettings } from './settings/ConditionSettings';
import { WebhookSettings } from './settings/WebhookSettings';
import { SetVariableSettings } from './settings/SetVariableSettings';
import { WaitSettings } from './settings/WaitSettings';
import { ScriptSettings } from './settings/ScriptSettings';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  /** Flow-level variables for autocomplete */
  variables?: Variable[];
};

export function BlockPropertiesPanel({ block, onUpdate, variables = [] }: Props) {
  const { setOpenedNodeId } = useGraph();
  const category = getBlockCategory(block.type);
  const isIntegration = category === 'integrations';
  const Icon = getBlockIcon(block.type);
  const label = getBlockLabel(block.type);
  const color = getBlockColor(block.type);
  const variableNames = variables.map((v) => v.name);

  return (
    <div
      className={cn(
        'w-[340px] shrink-0 flex flex-col',
        'border-l border-[var(--gray-5)] bg-[var(--gray-1)]',
        'z-20 overflow-hidden',
        // Slide-in from right — the parent holds it in a flex row so it
        // naturally animates on mount/unmount via CSS transitions when wrapped.
      )}
    >
      {/* ── Panel header ────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)] truncate">
          {label}
        </span>
        <button
          onClick={() => setOpenedNodeId(undefined)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          aria-label="Close panel"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Panel content ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {isIntegration ? (
          <IntegrationPanel block={block} onUpdate={onUpdate} variables={variableNames} />
        ) : (
          <BlockSettings block={block} onUpdate={onUpdate} variables={variableNames} />
        )}
      </div>
    </div>
  );
}

/* ── Typebot-style blocks (bubbles, inputs, logic) ────────── */
type InnerProps = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

function BlockSettings({ block, onUpdate, variables }: InnerProps) {
  // --- Bubbles ---
  if (block.type === 'text') {
    return <TextBlockSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  if (['image', 'video', 'audio', 'embed'].includes(block.type)) {
    return <MediaBubbleSettings block={block} onUpdate={onUpdate} />;
  }

  // --- Inputs ---
  if (block.type === 'text_input') {
    return <TextInputSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  // Generic input blocks (number, email, phone, url, date, time, rating, file, payment, choice, picture_choice)
  if (block.type.endsWith('_input')) {
    return <GenericInputSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  // --- Logic ---
  if (block.type === 'condition') {
    return <ConditionSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  if (block.type === 'set_variable') {
    return <SetVariableSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  if (block.type === 'wait') {
    return <WaitSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  if (block.type === 'script') {
    return <ScriptSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  if (block.type === 'redirect') {
    return <RedirectSettings block={block} onUpdate={onUpdate} />;
  }

  return <FallbackSettings block={block} />;
}

/* ── n8n-style integration panel ─────────────────────────── */
function IntegrationPanel({ block, onUpdate, variables }: InnerProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'output'>('params');
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
        {(['params', 'output'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors',
              activeTab === tab
                ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {tab === 'params' ? 'Parameters' : 'Output'}
          </button>
        ))}
      </div>

      {activeTab === 'params' && (
        <IntegrationParamsContent
          block={block}
          onUpdate={onUpdate}
          variables={variables}
        />
      )}

      {activeTab === 'output' && (
        <div className="space-y-3">
          <Field label="Save response to variable">
            <input
              type="text"
              className={inputClass}
              value={String(options.outputVariable ?? '')}
              onChange={(e) => update({ outputVariable: e.target.value })}
              placeholder="{{responseData}}"
            />
          </Field>
          <div className="rounded-lg border border-dashed border-[var(--gray-6)] p-3 text-[12px] text-[var(--gray-9)] leading-relaxed">
            The full response is stored in the variable above and available
            in subsequent blocks.
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationParamsContent({ block, onUpdate, variables }: InnerProps) {
  // Route webhook/HTTP to the dedicated settings component
  if (block.type === 'webhook') {
    return <WebhookSettings block={block} onUpdate={onUpdate} variables={variables} />;
  }

  const options = block.options ?? {};
  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  // Send Email
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

  // AI blocks (OpenAI / Anthropic / Together / Mistral)
  if (['open_ai', 'anthropic', 'together_ai', 'mistral'].includes(block.type)) {
    return (
      <div className="space-y-3">
        <Field label="System prompt">
          <textarea
            className={cn(inputClass, 'min-h-[80px] resize-y')}
            value={String(options.systemPrompt ?? '')}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant…"
          />
        </Field>
        <Field label="User message">
          <textarea
            className={cn(inputClass, 'min-h-[60px] resize-y')}
            value={String(options.userMessage ?? '')}
            onChange={(e) => update({ userMessage: e.target.value })}
            placeholder="{{userMessage}}"
          />
        </Field>
        <Field label="Save response to">
          <input
            type="text"
            className={inputClass}
            value={String(options.responseVariable ?? '')}
            onChange={(e) => update({ responseVariable: e.target.value })}
            placeholder="{{aiResponse}}"
          />
        </Field>
      </div>
    );
  }

  // Generic fallback for unimplemented integrations
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 text-center text-[12px] text-[var(--gray-9)]">
      <LuSettings className="mx-auto mb-2 h-5 w-5 opacity-40" strokeWidth={1.5} />
      Configuration for <strong>{getBlockLabel(block.type)}</strong> coming soon.
    </div>
  );
}

/* ── Inline mini settings for non-dedicated block types ───── */

function MediaBubbleSettings({ block, onUpdate }: Omit<InnerProps, 'variables'>) {
  const options = block.options ?? {};
  const typeLabel: Record<string, string> = {
    image: 'Image URL',
    video: 'Video URL',
    audio: 'Audio URL',
    embed: 'Embed URL',
  };
  return (
    <div className="space-y-4">
      <Field label={typeLabel[block.type] ?? 'URL'}>
        <input
          type="text"
          className={inputClass}
          value={String(options.url ?? '')}
          onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}

function GenericInputSettings({ block, onUpdate, variables }: InnerProps) {
  const options = block.options ?? {};
  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

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

function RedirectSettings({ block, onUpdate }: Omit<InnerProps, 'variables'>) {
  const options = block.options ?? {};
  return (
    <div className="space-y-4">
      <Field label="Redirect URL">
        <input
          type="text"
          className={inputClass}
          value={String(options.url ?? '')}
          onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
          placeholder="https://…"
        />
      </Field>
      <Field label="Open in">
        <select
          className={inputClass}
          value={String(options.target ?? '_blank')}
          onChange={(e) => onUpdate({ options: { ...options, target: e.target.value } })}
        >
          <option value="_blank">New tab</option>
          <option value="_self">Same tab</option>
        </select>
      </Field>
    </div>
  );
}

function FallbackSettings({ block }: { block: Block }) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 text-center text-[12px] text-[var(--gray-9)]">
      <LuSettings className="mx-auto mb-2 h-5 w-5 opacity-40" strokeWidth={1.5} />
      Settings for <strong>{getBlockLabel(block.type)}</strong> coming soon.
    </div>
  );
}

/* ── Shared primitives ────────────────────────────────────── */
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

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
