'use client';

import { useCallback, useState } from 'react';
import {
  LuSparkles,
  LuKey,
  LuBuilding2,
  LuChevronDown,
  LuChevronUp,
  LuPlus,
  LuTrash2,
  LuBraces,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider, toggleClass } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

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
  useWorkspaceKey?: boolean;
  apiKey?: string;
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
  const useWorkspaceKey = opts.useWorkspaceKey ?? false;
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
      <PanelHeader icon={LuSparkles} title="OpenAI" />

      {/* ── Credentials ───────────────────────────────── */}
      <SectionLabel>Credentials</SectionLabel>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide flex items-center gap-1.5">
            <LuBuilding2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            Use workspace key
          </span>
          <p className="text-[11px] text-[var(--gray-8)]">
            Inherit the API key from your workspace settings.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={useWorkspaceKey}
          onClick={() => update({ useWorkspaceKey: !useWorkspaceKey })}
          className={toggleClass(useWorkspaceKey)}
        >
          <span
            className={cn(
              'block h-4 w-4 rounded-full bg-white shadow transition-transform',
              useWorkspaceKey ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {!useWorkspaceKey && (
        <Field label="API Key">
          <div className="relative flex items-center">
            <LuKey
              className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
              strokeWidth={1.8}
            />
            <input
              type="password"
              value={opts.apiKey ?? ''}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
              className={cn(inputClass, 'pl-8')}
            />
          </div>
          <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
            Stored in the flow. Never exposed to end-users.
          </p>
        </Field>
      )}

      <Divider />

      {/* ── Model + Task ──────────────────────────────── */}
      <SectionLabel>Configuration</SectionLabel>

      <Field label="Model">
        <select
          value={model}
          onChange={(e) => update({ model: e.target.value as OpenAIModel })}
          className={selectClass}
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Task">
        <select
          value={task}
          onChange={(e) => update({ task: e.target.value as OpenAITask })}
          className={selectClass}
        >
          {TASKS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
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
        <textarea
          value={opts.systemPrompt ?? ''}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
          rows={4}
          spellCheck
          className={cn(inputClass, 'resize-y min-h-[80px]')}
        />
        <VariableHint />
      </Field>

      <Field label="Messages format">
        <select
          value={messagesFormat}
          onChange={(e) => update({ messagesFormat: e.target.value as MessagesFormat })}
          className={selectClass}
        >
          {MESSAGE_FORMAT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {selectedFormat && (
          <p className="text-[10.5px] text-[var(--gray-8)] mt-1">{selectedFormat.hint}</p>
        )}
      </Field>

      {/* Custom messages list */}
      {messagesFormat === 'custom' && (
        <div className="space-y-2">
          <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Messages
          </label>

          {customMessages.length === 0 && (
            <p className="text-[11px] text-[var(--gray-8)] rounded-lg border border-dashed border-[var(--gray-5)] px-3 py-2">
              No messages yet. Add one below.
            </p>
          )}

          {customMessages.map((msg, idx) => (
            <CustomMessageRow
              key={msg.id}
              index={idx}
              message={msg}
              onRemove={() => removeMessage(msg.id)}
              onPatch={(patch) => patchMessage(msg.id, patch)}
            />
          ))}

          <button
            type="button"
            onClick={addMessage}
            className="flex items-center gap-1.5 text-[11.5px] text-[#f76808] hover:text-[#e05500] transition-colors"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Add message
          </button>
        </div>
      )}

      <Divider />

      <SectionLabel>Output</SectionLabel>

      <Field label="Save response to">
        <VariableSelect
          variables={variables}
          value={opts.responseVariableId}
          onChange={(id) => update({ responseVariableId: id })}
          placeholder="— select variable —"
        />
      </Field>

      <Divider />

      {/* Advanced collapsible */}
      <button
        type="button"
        onClick={() => setAdvancedOpen(!advancedOpen)}
        className="flex w-full items-center justify-between text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide hover:text-[var(--gray-12)] transition-colors"
      >
        <span>Advanced</span>
        {advancedOpen ? (
          <LuChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <LuChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </button>

      {advancedOpen && (
        <div className="space-y-4 pl-1 border-l-2 border-[var(--gray-4)]">
          <Field label={`Temperature — ${temperature.toFixed(1)}`}>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0">0</span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="flex-1 accent-[#f76808]"
              />
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0 text-right">2</span>
            </div>
            <p className="text-[10.5px] text-[var(--gray-8)]">
              Lower = more deterministic; higher = more creative.
            </p>
          </Field>

          <Field label="Max tokens">
            <input
              type="number"
              min={1}
              max={128000}
              step={256}
              value={maxTokens}
              onChange={(e) =>
                update({ maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="1024"
              className={inputClass}
            />
          </Field>

          <Field label={`Frequency penalty — ${frequencyPenalty.toFixed(1)}`}>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0">-2</span>
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={frequencyPenalty}
                onChange={(e) => update({ frequencyPenalty: parseFloat(e.target.value) })}
                className="flex-1 accent-[#f76808]"
              />
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0 text-right">2</span>
            </div>
            <p className="text-[10.5px] text-[var(--gray-8)]">
              Reduces repetition of tokens already in the text.
            </p>
          </Field>

          <Field label={`Presence penalty — ${presencePenalty.toFixed(1)}`}>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0">-2</span>
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={presencePenalty}
                onChange={(e) => update({ presencePenalty: parseFloat(e.target.value) })}
                className="flex-1 accent-[#f76808]"
              />
              <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0 text-right">2</span>
            </div>
            <p className="text-[10.5px] text-[var(--gray-8)]">
              Encourages the model to introduce new topics.
            </p>
          </Field>
        </div>
      )}
    </div>
  );
}

/* ── Custom message row ──────────────────────────────────── */

type CustomMessageRowProps = {
  index: number;
  message: CustomMessage;
  onRemove: () => void;
  onPatch: (patch: Partial<Omit<CustomMessage, 'id'>>) => void;
};

function CustomMessageRow({ index, message, onRemove, onPatch }: CustomMessageRowProps) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={message.role}
          onChange={(e) => onPatch({ role: e.target.value as MessageRole })}
          className={cn(selectClass, 'text-[11.5px] py-1 flex-1')}
          aria-label={`Message ${index + 1} role`}
        >
          <option value="system">system</option>
          <option value="user">user</option>
          <option value="assistant">assistant</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="h-6 w-6 flex items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 hover:bg-[var(--gray-3)] transition-colors shrink-0"
          aria-label="Remove message"
        >
          <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>
      <textarea
        value={message.content}
        onChange={(e) => onPatch({ content: e.target.value })}
        placeholder="Message content… {{variable}} supported"
        rows={2}
        spellCheck={false}
        className={cn(inputClass, 'resize-y min-h-[52px] text-[12px]')}
        aria-label={`Message ${index + 1} content`}
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
        <textarea
          value={opts.imagePrompt ?? ''}
          onChange={(e) => update({ imagePrompt: e.target.value })}
          placeholder="A photo of a cat wearing a space suit…"
          rows={3}
          spellCheck={false}
          className={cn(inputClass, 'resize-y min-h-[70px]')}
        />
        <VariableHint />
      </Field>

      <Field label="Image size">
        <select
          value={opts.imageSize ?? '1024x1024'}
          onChange={(e) => update({ imageSize: e.target.value as ImageSize })}
          className={selectClass}
        >
          {IMAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Quality">
        <select
          value={opts.imageQuality ?? 'standard'}
          onChange={(e) => update({ imageQuality: e.target.value as ImageQuality })}
          className={selectClass}
        >
          <option value="standard">Standard</option>
          <option value="hd">HD</option>
        </select>
      </Field>

      <Divider />

      <Field label="Save image URL to">
        <VariableSelect
          variables={variables}
          value={opts.imageUrlVariableId}
          onChange={(id) => update({ imageUrlVariableId: id })}
          placeholder="— select variable —"
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

      <Field label="Audio URL variable">
        <VariableSelect
          variables={variables}
          value={opts.audioUrlVariableId}
          onChange={(id) => update({ audioUrlVariableId: id })}
          placeholder="— select variable holding audio URL —"
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          The variable must contain a publicly accessible audio URL.
        </p>
      </Field>

      <Field label="Language (optional)">
        <input
          type="text"
          value={opts.transcriptionLanguage ?? ''}
          onChange={(e) => update({ transcriptionLanguage: e.target.value })}
          placeholder="en, fr, es…"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          ISO-639-1 code. Leave blank for auto-detection.
        </p>
      </Field>

      <Divider />

      <Field label="Save result to">
        <VariableSelect
          variables={variables}
          value={opts.transcriptionVariableId}
          onChange={(id) => update({ transcriptionVariableId: id })}
          placeholder="— select variable —"
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
        <textarea
          value={opts.speechText ?? ''}
          onChange={(e) => update({ speechText: e.target.value })}
          placeholder="Hello {{name}}, welcome!"
          rows={3}
          spellCheck={false}
          className={cn(inputClass, 'resize-y min-h-[70px]')}
        />
        <VariableHint />
      </Field>

      <Field label="Voice">
        <select
          value={opts.speechVoice ?? 'alloy'}
          onChange={(e) => update({ speechVoice: e.target.value })}
          className={selectClass}
        >
          {SPEECH_VOICES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      <Divider />

      <Field label="Save audio URL to">
        <VariableSelect
          variables={variables}
          value={opts.speechUrlVariableId}
          onChange={(id) => update({ speechUrlVariableId: id })}
          placeholder="— select variable —"
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
        <textarea
          value={opts.embeddingInput ?? ''}
          onChange={(e) => update({ embeddingInput: e.target.value })}
          placeholder="Text to embed… {{variable}} supported"
          rows={3}
          spellCheck={false}
          className={cn(inputClass, 'resize-y min-h-[70px]')}
        />
        <VariableHint />
      </Field>

      <Divider />

      <Field label="Save embedding to">
        <VariableSelect
          variables={variables}
          value={opts.embeddingVariableId}
          onChange={(id) => update({ embeddingVariableId: id })}
          placeholder="— select variable —"
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
    <p className="text-[10.5px] font-semibold text-[var(--gray-9)] uppercase tracking-widest">
      {children}
    </p>
  );
}

function VariableHint() {
  return (
    <p className="text-[10.5px] text-[var(--gray-8)] mt-1 flex items-center gap-1">
      <LuBraces className="h-3 w-3 shrink-0" strokeWidth={1.8} />
      Use{' '}
      <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
        {'{{variable}}'}
      </code>{' '}
      to reference collected values.
    </p>
  );
}
