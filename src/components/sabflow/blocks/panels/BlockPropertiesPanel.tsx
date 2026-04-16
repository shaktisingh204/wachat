'use client';
import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { getBlockLabel, getBlockIcon, getBlockColor, getBlockCategory } from '@/lib/sabflow/blocks';
import { cn } from '@/lib/utils';
import { LuX, LuSettings, LuCode2, LuGlobe } from 'react-icons/lu';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
};

export function BlockPropertiesPanel({ block, onUpdate }: Props) {
  const { setOpenedNodeId } = useGraph();
  const category = getBlockCategory(block.type);
  const isIntegration = category === 'integrations';
  const Icon = getBlockIcon(block.type);
  const label = getBlockLabel(block.type);
  const color = getBlockColor(block.type);

  return (
    <div className="w-[340px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)] truncate">{label}</span>
        <button
          onClick={() => setOpenedNodeId(undefined)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isIntegration ? (
          <IntegrationPanel block={block} onUpdate={onUpdate} />
        ) : (
          <TypebotStylePanel block={block} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

/* ── Typebot-style panel (bubbles, inputs, logic) ─────── */
function TypebotStylePanel({ block, onUpdate }: Props) {
  const options = block.options ?? {};

  return (
    <div className="space-y-4">
      {/* Content field for bubble types */}
      {['text', 'image', 'video', 'audio', 'embed'].includes(block.type) && (
        <Field label="Content">
          {block.type === 'text' ? (
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808] resize-y"
              value={String(options.content ?? '')}
              onChange={(e) => onUpdate({ options: { ...options, content: e.target.value } })}
              placeholder="Enter text…"
            />
          ) : (
            <input
              type="text"
              className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
              value={String(options.url ?? '')}
              onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
              placeholder="Enter URL…"
            />
          )}
        </Field>
      )}

      {/* Placeholder for input blocks */}
      {block.type.endsWith('_input') && (
        <Field label="Placeholder">
          <input
            type="text"
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
            value={String(options.placeholder ?? '')}
            onChange={(e) => onUpdate({ options: { ...options, placeholder: e.target.value } })}
            placeholder="Enter placeholder…"
          />
        </Field>
      )}

      {/* Variable to save */}
      {block.type.endsWith('_input') && (
        <Field label="Save answer in variable">
          <input
            type="text"
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
            value={String(options.variableName ?? '')}
            onChange={(e) => onUpdate({ options: { ...options, variableName: e.target.value } })}
            placeholder="{{variableName}}"
          />
        </Field>
      )}

      {/* Logic blocks */}
      {block.type === 'condition' && (
        <Field label="Conditions">
          <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 text-[12px] text-[var(--gray-9)] italic">
            Condition builder coming soon
          </div>
        </Field>
      )}

      {block.type === 'set_variable' && (
        <>
          <Field label="Variable">
            <input
              type="text"
              className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
              value={String(options.variableName ?? '')}
              onChange={(e) => onUpdate({ options: { ...options, variableName: e.target.value } })}
              placeholder="{{variableName}}"
            />
          </Field>
          <Field label="Value">
            <textarea
              className="w-full min-h-[80px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808] resize-y"
              value={String(options.value ?? '')}
              onChange={(e) => onUpdate({ options: { ...options, value: e.target.value } })}
              placeholder="Enter value or {{variable}}"
            />
          </Field>
        </>
      )}

      {block.type === 'wait' && (
        <Field label="Wait duration (seconds)">
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
            value={Number(options.seconds ?? 1)}
            onChange={(e) => onUpdate({ options: { ...options, seconds: Number(e.target.value) } })}
          />
        </Field>
      )}

      {block.type === 'redirect' && (
        <Field label="URL">
          <input
            type="text"
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
            value={String(options.url ?? '')}
            onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
            placeholder="https://…"
          />
        </Field>
      )}
    </div>
  );
}

/* ── n8n-style integration panel ─────────────────────── */
function IntegrationPanel({ block, onUpdate }: Props) {
  const options = block.options ?? {};
  const [activeTab, setActiveTab] = useState<'params' | 'output'>('params');

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
        {(['params', 'output'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
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
        <div className="space-y-3">
          {/* Webhook / HTTP Request */}
          {block.type === 'webhook' && (
            <>
              <Field label="URL">
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
                  value={String(options.url ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, url: e.target.value } })}
                  placeholder="https://api.example.com/…"
                />
              </Field>
              <Field label="Method">
                <select
                  className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
                  value={String(options.method ?? 'POST')}
                  onChange={(e) => onUpdate({ options: { ...options, method: e.target.value } })}
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Body (JSON)">
                <textarea
                  className="w-full min-h-[100px] font-mono rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[12px] outline-none focus:border-[#f76808] resize-y"
                  value={String(options.body ?? '{}')}
                  onChange={(e) => onUpdate({ options: { ...options, body: e.target.value } })}
                  placeholder='{"key": "value"}'
                />
              </Field>
            </>
          )}

          {/* Send Email */}
          {block.type === 'send_email' && (
            <>
              <Field label="To">
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
                  value={String(options.to ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, to: e.target.value } })}
                  placeholder="recipient@example.com"
                />
              </Field>
              <Field label="Subject">
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
                  value={String(options.subject ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, subject: e.target.value } })}
                />
              </Field>
              <Field label="Body">
                <textarea
                  className="w-full min-h-[100px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808] resize-y"
                  value={String(options.body ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, body: e.target.value } })}
                />
              </Field>
            </>
          )}

          {/* OpenAI / Anthropic / AI */}
          {['open_ai', 'anthropic', 'together_ai', 'mistral'].includes(block.type) && (
            <>
              <Field label="System prompt">
                <textarea
                  className="w-full min-h-[80px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808] resize-y"
                  value={String(options.systemPrompt ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, systemPrompt: e.target.value } })}
                  placeholder="You are a helpful assistant…"
                />
              </Field>
              <Field label="User message">
                <textarea
                  className="w-full min-h-[60px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808] resize-y"
                  value={String(options.userMessage ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, userMessage: e.target.value } })}
                  placeholder="{{userMessage}}"
                />
              </Field>
              <Field label="Save response to">
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
                  value={String(options.responseVariable ?? '')}
                  onChange={(e) => onUpdate({ options: { ...options, responseVariable: e.target.value } })}
                  placeholder="{{aiResponse}}"
                />
              </Field>
            </>
          )}

          {/* Generic fallback */}
          {!['webhook', 'send_email', 'open_ai', 'anthropic', 'together_ai', 'mistral'].includes(block.type) && (
            <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 text-center text-[12px] text-[var(--gray-9)]">
              <LuSettings className="mx-auto mb-2 h-5 w-5 opacity-40" strokeWidth={1.5} />
              Configuration for <strong>{getBlockLabel(block.type)}</strong> coming soon.
            </div>
          )}
        </div>
      )}

      {activeTab === 'output' && (
        <div className="space-y-3">
          <Field label="Save response to variable">
            <input
              type="text"
              className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] outline-none focus:border-[#f76808]"
              value={String(options.outputVariable ?? '')}
              onChange={(e) => onUpdate({ options: { ...options, outputVariable: e.target.value } })}
              placeholder="{{responseData}}"
            />
          </Field>
          <div className="rounded-lg border border-dashed border-[var(--gray-6)] p-3 text-[12px] text-[var(--gray-9)]">
            Response data will be saved to the variable above and available in subsequent blocks.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared field wrapper ─────────────────────────────── */
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
