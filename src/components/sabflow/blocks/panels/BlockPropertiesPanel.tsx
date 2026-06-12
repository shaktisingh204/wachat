'use client';

import { useState } from 'react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  getBlockLabel,
  getBlockIcon,
  getBlockColor,
  getBlockCategory,
} from '@/lib/sabflow/blocks';
import { getBlockBrandIcon } from '@/lib/sabflow/blocks/icons';
import { cn } from '@/lib/utils';
import { BrandIcon } from '@/components/sabflow/BrandIcon';
import { X } from 'lucide-react';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

import {
  Field,
  Input,
  Textarea,
  IconButton,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';

import { NodeSettings } from '@/components/sabflow/panels/blocks/shared/NodeSettings';
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
  const brand = getBlockBrandIcon(block.type);
  const variableNames = variables.map((v) => v.name);

  return (
    <div
      className={cn(
        'w-[340px] shrink-0 flex flex-col',
        'border-l border-[var(--st-border)] bg-[var(--st-bg)]',
        'z-20 overflow-hidden',
        // Slide-in from right. The parent holds it in a flex row so it
        // naturally animates on mount/unmount via CSS transitions when wrapped.
      )}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3 shrink-0">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)]',
            brand && 'bg-[var(--st-bg-secondary)]',
          )}
          style={brand ? undefined : { background: `${color}22`, color }}
        >
          {brand ? (
            <BrandIcon icon={brand} className="h-4 w-4" aria-hidden />
          ) : (
            Icon && <Icon className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)] truncate">
          {label}
        </span>
        <IconButton
          label="Close panel"
          icon={X}
          size="sm"
          onClick={() => setOpenedNodeId(undefined)}
        />
      </div>

      {/* Panel content */}
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

/* Typebot-style blocks (bubbles, inputs, logic) */
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

  return <FallbackSettings block={block} onUpdate={onUpdate} />;
}

/* n8n-style integration panel */
function IntegrationPanel({ block, onUpdate, variables }: InnerProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'output'>('params');
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-1">
        {(['params', 'output'] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'secondary' : 'ghost'}
            size="sm"
            block
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'params' ? 'Parameters' : 'Output'}
          </Button>
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
            <Input
              type="text"
              value={String(options.outputVariable ?? '')}
              onChange={(e) => update({ outputVariable: e.target.value })}
              placeholder="{{responseData}}"
            />
          </Field>
          <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-3 text-[12px] text-[var(--st-text-secondary)] leading-relaxed">
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
          <Input
            type="text"
            value={String(options.to ?? '')}
            onChange={(e) => update({ to: e.target.value })}
            placeholder="recipient@example.com or {{email}}"
          />
        </Field>
        <Field label="Subject">
          <Input
            type="text"
            value={String(options.subject ?? '')}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="Your subject"
          />
        </Field>
        <Field label="Body">
          <Textarea
            className="min-h-[100px] resize-y"
            value={String(options.body ?? '')}
            onChange={(e) => update({ body: e.target.value })}
            placeholder="Email body. Use {{variable}} for dynamic content."
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
          <Textarea
            className="min-h-[80px] resize-y"
            value={String(options.systemPrompt ?? '')}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant."
          />
        </Field>
        <Field label="User message">
          <Textarea
            className="min-h-[60px] resize-y"
            value={String(options.userMessage ?? '')}
            onChange={(e) => update({ userMessage: e.target.value })}
            placeholder="{{userMessage}}"
          />
        </Field>
        <Field label="Save response to">
          <Input
            type="text"
            value={String(options.responseVariable ?? '')}
            onChange={(e) => update({ responseVariable: e.target.value })}
            placeholder="{{aiResponse}}"
          />
        </Field>
      </div>
    );
  }

  // Generic fallback: render the descriptor-driven settings panel sourced
  // from the Rust `sabflow-nodes` registry (310 node types).
  return (
    <NodeSettings
      nodeType={block.type}
      values={(block.options ?? {}) as Record<string, unknown>}
      onChange={(next) => onUpdate({ options: next })}
    />
  );
}

/* Inline mini settings for non-dedicated block types */

function MediaBubbleSettings({ block, onUpdate }: Omit<InnerProps, 'variables'>) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');
  const setUrl = (next: string) =>
    onUpdate({ options: { ...options, url: next } });

  // Embed bubbles point at external content (e.g. a YouTube or iframe URL),
  // which is not a SabFiles asset, so they take a plain URL field. Image,
  // video, and audio bubbles source from the user's SabFiles library.
  if (block.type === 'embed') {
    return (
      <div className="space-y-4">
        <Field label="Embed URL">
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
      </div>
    );
  }

  const accept =
    block.type === 'image'
      ? 'image'
      : block.type === 'video'
        ? 'video'
        : 'audio';
  const fieldLabel: Record<string, string> = {
    image: 'Image file',
    video: 'Video file',
    audio: 'Audio file',
  };

  return (
    <div className="space-y-4">
      <Field label={fieldLabel[block.type] ?? 'File'}>
        <SabFileUrlInput
          value={url}
          onChange={setUrl}
          accept={accept}
          placeholder="No file chosen"
        />
      </Field>
    </div>
  );
}

function GenericInputSettings({ block, onUpdate }: InnerProps) {
  const options = block.options ?? {};
  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Placeholder">
        <Input
          type="text"
          value={String(options.placeholder ?? '')}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="Enter placeholder"
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

function RedirectSettings({ block, onUpdate }: Omit<InnerProps, 'variables'>) {
  const options = block.options ?? {};
  return (
    <div className="space-y-4">
      <Field label="Redirect URL">
        <Input
          type="text"
          value={String(options.url ?? '')}
          onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
          placeholder="https://"
        />
      </Field>
      <Field label="Open in">
        <Select
          value={String(options.target ?? '_blank')}
          onValueChange={(value) => onUpdate({ options: { ...options, target: value } })}
        >
          <SelectTrigger aria-label="Open in">
            <SelectValue placeholder="Open in" />
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

function FallbackSettings({ block, onUpdate }: { block: Block; onUpdate: (changes: Partial<Block>) => void }) {
  return (
    <NodeSettings
      nodeType={block.type}
      values={(block.options ?? {}) as Record<string, unknown>}
      onChange={(next) => onUpdate({ options: next })}
    />
  );
}
