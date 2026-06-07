'use client';

import { useCallback, useState } from 'react';
import { Braces, Plus, Sparkles, Trash2, MessageSquare } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Slider,
  Button,
  IconButton,
  EmptyState,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { PanelHeader, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';
import { CredentialSelect } from './shared/CredentialSelect';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'o1'
  | 'o1-mini'
  | 'o3-mini';

type OpenAITask =
  | 'ask_assistant'
  | 'create_image'
  | 'create_transcription'
  | 'create_speech'
  | 'create_embedding';

type MessagesFormat = 'last' | 'all' | 'custom';

type MessageRole = 'system' | 'user' | 'assistant';

interface CustomMessage {
  id: string;
  role: MessageRole;
  content: string;
}

type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
type ImageQuality = 'standard' | 'hd';

interface OpenAIOptions {
  /* Credentials */
  credentialId?: string;
  /* Core */
  model?: OpenAIModel;
  task?: OpenAITask;
  /* Ask assistant */
  systemPrompt?: string;
  messagesFormat?: MessagesFormat;
  customMessages?: CustomMessage[];
  responseVariableId?: string;
  /* Advanced (ask assistant) */
  temperature?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  /* Create image */
  imagePrompt?: string;
  imageSize?: ImageSize;
  imageQuality?: ImageQuality;
  imageUrlVariableId?: string;
  /* Create transcription */
  audioUrlVariableId?: string;
  transcriptionLanguage?: string;
  transcriptionVariableId?: string;
  /* Create speech */
  speechText?: string;
  speechVoice?: string;
  speechUrlVariableId?: string;
  /* Create embedding */
  embeddingInput?: string;
  embeddingVariableId?: string;
}

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

const MODELS: { value: OpenAIModel; label: string }[] = [
  { value: 'gpt-4o',        label: 'GPT-4o' },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini' },
  { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'o1',            label: 'o1' },
  { value: 'o1-mini',       label: 'o1-mini' },
  { value: 'o3-mini',       label: 'o3-mini' },
];

const TASKS: { value: OpenAITask; label: string }[] = [
  { value: 'ask_assistant',       label: 'Ask assistant' },
  { value: 'create_image',        label: 'Create image' },
  { value: 'create_transcription', label: 'Create transcription' },
  { value: 'create_speech',       label: 'Create speech' },
  { value: 'create_embedding',    label: 'Create embedding' },
];

const MESSAGE_FORMAT_OPTIONS: { value: MessagesFormat; label: string; hint: string }[] = [
  { value: 'last',   label: 'Last message only', hint: 'Sends only the most recent user message.' },
  { value: 'all',    label: 'All messages',       hint: 'Sends the full conversation history as the user turn.' },
  { value: 'custom', label: 'Custom messages',    hint: 'Define an explicit messages array with roles.' },
];

const IMAGE_SIZES: ImageSize[] = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'];

const SPEECH_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/* ══════════════════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════════════════ */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ══════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════ */

export function OpenAISettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as OpenAIOptions;
  const task: OpenAITask = opts.task ?? 'ask_assistant';
  const model: OpenAIModel = opts.model ?? 'gpt-4o';
  const messagesFormat: MessagesFormat = opts.messagesFormat ?? 'last';
  const temperature = opts.temperature ?? 1;
  const maxTokens = opts.maxTokens ?? 1024;
  const frequencyPenalty = opts.frequencyPenalty ?? 0;
  const presencePenalty = opts.presencePenalty ?? 0;
  const customMessages: CustomMessage[] = opts.customMessages ?? [];

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<OpenAIOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  /* ── Custom messages helpers ─────────────────────────── */

  const addMessage = useCallback(() => {
    const next: CustomMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: '',
    };
    update({ customMessages: [...customMessages, next] });
  }, [customMessages, update]);

  const removeMessage = useCallback(
    (id: string) => {
      update({ customMessages: customMessages.filter((m) => m.id !== id) });
    },
    [customMessages, update],
  );

  const patchMessage = useCallback(
    (id: string, patch: Partial<Omit<CustomMessage, 'id'>>) => {
      update({
        customMessages: customMessages.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      });
    },
    [customMessages, update],
  );

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <PanelHeader icon={Sparkles} title="OpenAI" />

      {/* ── Credentials ───────────────────────────────── */}
      <SectionLabel>Credentials</SectionLabel>

      <Field label="OpenAI credential">
        <CredentialSelect
          credentialType="openai"
          value={opts.credentialId}
          onChange={(id) => update({ credentialId: id })}
        />
      </Field>

      <Divider />

      {/* ── Model + Task ──────────────────────────────── */}
      <SectionLabel>Configuration</SectionLabel>

      <Field label="Model">
        <Select value={model} onValueChange={(v) => update({ model: v as OpenAIModel })}>
          <SelectTrigger aria-label="Model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Task">
        <Select value={task} onValueChange={(v) => update({ task: v as OpenAITask })}>
          <SelectTrigger aria-label="Task">
            <SelectValue placeholder="Select a task" />
          </SelectTrigger>
          <SelectContent>
            {TASKS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Divider />

      {/* ══════════════════════════════════════════════════
          Task-specific sections
          ══════════════════════════════════════════════════ */}

      {task === 'ask_assistant' && (
        <AskAssistantSection
          opts={opts}
          update={update}
          variables={variables}
          messagesFormat={messagesFormat}
          customMessages={customMessages}
          temperature={temperature}
          maxTokens={maxTokens}
          frequencyPenalty={frequencyPenalty}
          presencePenalty={presencePenalty}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          addMessage={addMessage}
          removeMessage={removeMessage}
          patchMessage={patchMessage}
        />
      )}

      {task === 'create_image' && (
        <CreateImageSection opts={opts} update={update} variables={variables} />
      )}

      {task === 'create_transcription' && (
        <CreateTranscriptionSection opts={opts} update={update} variables={variables} />
      )}

      {task === 'create_speech' && (
        <CreateSpeechSection opts={opts} update={update} variables={variables} />
      )}

      {task === 'create_embedding' && (
        <CreateEmbeddingSection opts={opts} update={update} variables={variables} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Ask assistant section
   ══════════════════════════════════════════════════════════ */

type AskAssistantSectionProps = {
  opts: OpenAIOptions;
  update: (patch: Partial<OpenAIOptions>) => void;
  variables: Variable[];
  messagesFormat: MessagesFormat;
  customMessages: CustomMessage[];
  temperature: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean) => void;
  addMessage: () => void;
  removeMessage: (id: string) => void;
  patchMessage: (id: string, patch: Partial<Omit<CustomMessage, 'id'>>) => void;
};

function AskAssistantSection({
  opts,
  update,
  variables,
  messagesFormat,
  customMessages,
  temperature,
  maxTokens,
  frequencyPenalty,
  presencePenalty,
  advancedOpen,
  setAdvancedOpen,
  addMessage,
  removeMessage,
  patchMessage,
}: AskAssistantSectionProps) {
  const selectedFormat = MESSAGE_FORMAT_OPTIONS.find((f) => f.value === messagesFormat);

  return (
    <div className="space-y-4">
      <SectionLabel>Prompt</SectionLabel>

      <Field label="System prompt">
        <VariableAutocompleteInput
          type="textarea"
          value={opts.systemPrompt ?? ''}
          onChange={(v) => update({ systemPrompt: v })}
          variables={variables}
          placeholder="You are a helpful assistant."
          rows={4}
          aria-label="System prompt"
          className="min-h-[80px]"
        />
        <VariableHint />
      </Field>

      <Field label="Messages format" help={selectedFormat?.hint}>
        <Select
          value={messagesFormat}
          onValueChange={(v) => update({ messagesFormat: v as MessagesFormat })}
        >
          <SelectTrigger aria-label="Messages format">
            <SelectValue placeholder="Select a format" />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_FORMAT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Custom messages list */}
      {messagesFormat === 'custom' && (
        <div className="space-y-2">
          <SectionLabel>Messages</SectionLabel>

          {customMessages.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              size="sm"
              title="No messages yet"
              description="Add a message to define the conversation explicitly."
            />
          )}

          {customMessages.map((msg, idx) => (
            <CustomMessageRow
              key={msg.id}
              index={idx}
              message={msg}
              variables={variables}
              onRemove={() => removeMessage(msg.id)}
              onPatch={(patch) => patchMessage(msg.id, patch)}
            />
          ))}

          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addMessage}>
            Add message
          </Button>
        </div>
      )}

      <Divider />

      <SectionLabel>Output</SectionLabel>

      <Field label="Save response to">
        <VariableSelect
          variables={variables}
          value={opts.responseVariableId}
          onChange={(id) => update({ responseVariableId: id })}
          placeholder="Select variable"
        />
      </Field>

      <Divider />

      {/* Advanced collapsible */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 pl-1 border-l-2 border-[var(--st-border)]">
            <Field
              label={`Temperature: ${temperature.toFixed(1)}`}
              help="Lower is more deterministic, higher is more creative."
            >
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onValueChange={(v) =>
                  update({ temperature: Array.isArray(v) ? v[0] : v })
                }
                ariaLabel="Temperature"
              />
            </Field>

            <Field label="Max tokens">
              <Input
                type="number"
                min={1}
                max={128000}
                step={256}
                value={maxTokens}
                onChange={(e) =>
                  update({ maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                placeholder="1024"
              />
            </Field>

            <Field
              label={`Frequency penalty: ${frequencyPenalty.toFixed(1)}`}
              help="Reduces repetition of tokens already in the text."
            >
              <Slider
                min={-2}
                max={2}
                step={0.1}
                value={frequencyPenalty}
                onValueChange={(v) =>
                  update({ frequencyPenalty: Array.isArray(v) ? v[0] : v })
                }
                ariaLabel="Frequency penalty"
              />
            </Field>

            <Field
              label={`Presence penalty: ${presencePenalty.toFixed(1)}`}
              help="Encourages the model to introduce new topics."
            >
              <Slider
                min={-2}
                max={2}
                step={0.1}
                value={presencePenalty}
                onValueChange={(v) =>
                  update({ presencePenalty: Array.isArray(v) ? v[0] : v })
                }
                ariaLabel="Presence penalty"
              />
            </Field>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ── Custom message row ──────────────────────────────────── */

type CustomMessageRowProps = {
  index: number;
  message: CustomMessage;
  variables: Variable[];
  onRemove: () => void;
  onPatch: (patch: Partial<Omit<CustomMessage, 'id'>>) => void;
};

function CustomMessageRow({ index, message, variables, onRemove, onPatch }: CustomMessageRowProps) {
  return (
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={message.role}
            onValueChange={(v) => onPatch({ role: v as MessageRole })}
          >
            <SelectTrigger aria-label={`Message ${index + 1} role`}>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">system</SelectItem>
              <SelectItem value="user">user</SelectItem>
              <SelectItem value="assistant">assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <IconButton
          label="Remove message"
          icon={Trash2}
          variant="ghost"
          size="sm"
          onClick={onRemove}
        />
      </div>
      <VariableAutocompleteInput
        type="textarea"
        value={message.content}
        onChange={(v) => onPatch({ content: v })}
        variables={variables}
        placeholder="Message content, {{variable}} supported"
        rows={2}
        spellCheck={false}
        aria-label={`Message ${index + 1} content`}
        className="min-h-[52px] text-[12px]"
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create image section
   ══════════════════════════════════════════════════════════ */

type CreateImageSectionProps = {
  opts: OpenAIOptions;
  update: (patch: Partial<OpenAIOptions>) => void;
  variables: Variable[];
};

function CreateImageSection({ opts, update, variables }: CreateImageSectionProps) {
  return (
    <div className="space-y-4">
      <SectionLabel>Image generation</SectionLabel>

      <Field label="Prompt">
        <VariableAutocompleteInput
          type="textarea"
          value={opts.imagePrompt ?? ''}
          onChange={(v) => update({ imagePrompt: v })}
          variables={variables}
          placeholder="A photo of a cat wearing a space suit"
          rows={3}
          spellCheck={false}
          aria-label="Image prompt"
          className="min-h-[70px]"
        />
        <VariableHint />
      </Field>

      <Field label="Image size">
        <Select
          value={opts.imageSize ?? '1024x1024'}
          onValueChange={(v) => update({ imageSize: v as ImageSize })}
        >
          <SelectTrigger aria-label="Image size">
            <SelectValue placeholder="Select a size" />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Quality">
        <Select
          value={opts.imageQuality ?? 'standard'}
          onValueChange={(v) => update({ imageQuality: v as ImageQuality })}
        >
          <SelectTrigger aria-label="Quality">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="hd">HD</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Divider />

      <Field label="Save image URL to">
        <VariableSelect
          variables={variables}
          value={opts.imageUrlVariableId}
          onChange={(id) => update({ imageUrlVariableId: id })}
          placeholder="Select variable"
        />
      </Field>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create transcription section
   ══════════════════════════════════════════════════════════ */

type CreateTranscriptionSectionProps = {
  opts: OpenAIOptions;
  update: (patch: Partial<OpenAIOptions>) => void;
  variables: Variable[];
};

function CreateTranscriptionSection({ opts, update, variables }: CreateTranscriptionSectionProps) {
  return (
    <div className="space-y-4">
      <SectionLabel>Transcription</SectionLabel>

      <Field
        label="Audio URL variable"
        help="The variable must contain a publicly accessible audio URL."
      >
        <VariableSelect
          variables={variables}
          value={opts.audioUrlVariableId}
          onChange={(id) => update({ audioUrlVariableId: id })}
          placeholder="Select variable holding audio URL"
        />
      </Field>

      <Field label="Language (optional)" help="ISO-639-1 code. Leave blank for auto-detection.">
        <Input
          type="text"
          value={opts.transcriptionLanguage ?? ''}
          onChange={(e) => update({ transcriptionLanguage: e.target.value })}
          placeholder="en, fr, es"
        />
      </Field>

      <Divider />

      <Field label="Save result to">
        <VariableSelect
          variables={variables}
          value={opts.transcriptionVariableId}
          onChange={(id) => update({ transcriptionVariableId: id })}
          placeholder="Select variable"
        />
      </Field>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create speech section
   ══════════════════════════════════════════════════════════ */

type CreateSpeechSectionProps = {
  opts: OpenAIOptions;
  update: (patch: Partial<OpenAIOptions>) => void;
  variables: Variable[];
};

function CreateSpeechSection({ opts, update, variables }: CreateSpeechSectionProps) {
  return (
    <div className="space-y-4">
      <SectionLabel>Text to speech</SectionLabel>

      <Field label="Text">
        <VariableAutocompleteInput
          type="textarea"
          value={opts.speechText ?? ''}
          onChange={(v) => update({ speechText: v })}
          variables={variables}
          placeholder="Hello {{name}}, welcome!"
          rows={3}
          spellCheck={false}
          aria-label="Speech text"
          className="min-h-[70px]"
        />
        <VariableHint />
      </Field>

      <Field label="Voice">
        <Select
          value={opts.speechVoice ?? 'alloy'}
          onValueChange={(v) => update({ speechVoice: v })}
        >
          <SelectTrigger aria-label="Voice">
            <SelectValue placeholder="Select a voice" />
          </SelectTrigger>
          <SelectContent>
            {SPEECH_VOICES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Divider />

      <Field label="Save audio URL to">
        <VariableSelect
          variables={variables}
          value={opts.speechUrlVariableId}
          onChange={(id) => update({ speechUrlVariableId: id })}
          placeholder="Select variable"
        />
      </Field>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create embedding section
   ══════════════════════════════════════════════════════════ */

type CreateEmbeddingSectionProps = {
  opts: OpenAIOptions;
  update: (patch: Partial<OpenAIOptions>) => void;
  variables: Variable[];
};

function CreateEmbeddingSection({ opts, update, variables }: CreateEmbeddingSectionProps) {
  return (
    <div className="space-y-4">
      <SectionLabel>Embedding</SectionLabel>

      <Field label="Input text">
        <VariableAutocompleteInput
          type="textarea"
          value={opts.embeddingInput ?? ''}
          onChange={(v) => update({ embeddingInput: v })}
          variables={variables}
          placeholder="Text to embed, {{variable}} supported"
          rows={3}
          spellCheck={false}
          aria-label="Embedding input text"
          className="min-h-[70px]"
        />
        <VariableHint />
      </Field>

      <Divider />

      <Field label="Save embedding to">
        <VariableSelect
          variables={variables}
          value={opts.embeddingVariableId}
          onChange={(id) => update({ embeddingVariableId: id })}
          placeholder="Select variable"
        />
      </Field>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared micro-components
   ══════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold text-[var(--st-text-tertiary)] uppercase tracking-widest">
      {children}
    </p>
  );
}

function VariableHint() {
  return (
    <p className="text-[10.5px] text-[var(--st-text-secondary)] mt-1 flex items-center gap-1">
      <Braces className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      Use{' '}
      <code className="font-mono bg-[var(--st-bg-secondary)] px-1 rounded text-[var(--st-text)]">
        {'{{variable}}'}
      </code>{' '}
      to reference collected values.
    </p>
  );
}
