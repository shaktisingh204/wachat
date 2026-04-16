'use client';

import { useState } from 'react';
import { LuSend, LuPlus, LuX, LuImage, LuFileText, LuHash } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type WaMessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'reaction' | 'interactive';

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{ type: 'text' | 'image' | 'document' | 'video'; text?: string; image?: { link: string }; document?: { link: string; filename: string } }>;
}

export interface WhatsAppSendConfig {
  /** To: phone number in E.164 or {{variable}} */
  to: string;
  messageType: WaMessageType;
  /** For messageType === 'text' */
  text: {
    body: string;
    previewUrl: boolean;
  };
  /** For messageType === 'template' */
  template: {
    name: string;
    languageCode: string;
    components: TemplateComponent[];
  };
  /** For media types (image / document / audio / video) */
  media: {
    /** URL or media ID */
    source: string;
    caption: string;
    filename: string;
  };
  /** For 'reaction' */
  reaction: {
    messageId: string;
    emoji: string;
  };
  /** Phone number ID to send from (overrides account default) */
  fromPhoneNumberId: string;
  /** Variable to save message ID result */
  outputVariable: string;
}

export interface WhatsAppSendOutput {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  to: string;
  timestamp: string;
}

export type WhatsAppSendNodeProps = {
  config: WhatsAppSendConfig;
  onChange: (config: WhatsAppSendConfig) => void;
  className?: string;
};

/* ── Language codes ──────────────────────────────────────── */

const TEMPLATE_LANGUAGES = [
  { code: 'en',    label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'es',    label: 'Spanish' },
  { code: 'fr',    label: 'French' },
  { code: 'de',    label: 'German' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
];

const MESSAGE_TYPES: { type: WaMessageType; label: string; icon: React.ReactNode }[] = [
  { type: 'text',        label: 'Text',        icon: <LuHash className="h-3.5 w-3.5" strokeWidth={2} /> },
  { type: 'template',    label: 'Template',    icon: <LuFileText className="h-3.5 w-3.5" strokeWidth={2} /> },
  { type: 'image',       label: 'Image',       icon: <LuImage className="h-3.5 w-3.5" strokeWidth={2} /> },
  { type: 'document',    label: 'Document',    icon: <LuFileText className="h-3.5 w-3.5" strokeWidth={2} /> },
  { type: 'audio',       label: 'Audio',       icon: <LuHash className="h-3.5 w-3.5" strokeWidth={2} /> },
  { type: 'video',       label: 'Video',       icon: <LuImage className="h-3.5 w-3.5" strokeWidth={2} /> },
];

/* ── Component ───────────────────────────────────────────── */

export function WhatsAppSendNode({ config, onChange, className }: WhatsAppSendNodeProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25d366]/10 text-[#25d366]">
          <LuSend className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Send WhatsApp Message</p>
          <p className="text-[11px] text-[var(--gray-9)]">Send a message via WhatsApp Business API</p>
        </div>
      </div>

      {/* To */}
      <div className="space-y-1.5">
        <Label>To (phone number)</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.to}
          onChange={(e) => onChange({ ...config, to: e.target.value })}
          placeholder="+919876543210 or {{contact.phone}}"
        />
        <p className="text-[11px] text-[var(--gray-9)]">
          E.164 format or a variable referencing one
        </p>
      </div>

      {/* From phone number ID */}
      <div className="space-y-1.5">
        <Label>From Phone Number ID (optional)</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.fromPhoneNumberId}
          onChange={(e) => onChange({ ...config, fromPhoneNumberId: e.target.value })}
          placeholder="Leave empty to use default"
        />
      </div>

      {/* Message type */}
      <div className="space-y-1.5">
        <Label>Message Type</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {MESSAGE_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ ...config, messageType: type })}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border py-2 px-1 text-[11px] font-medium transition-colors',
                config.messageType === type
                  ? 'border-[#25d366]/40 bg-[#25d366]/8 text-[#25d366]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[var(--gray-6)]',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Text message */}
      {config.messageType === 'text' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Message Body</Label>
            <textarea
              className={cn(INPUT_CLS, 'min-h-[100px] resize-y')}
              value={config.text.body}
              onChange={(e) => onChange({ ...config, text: { ...config.text, body: e.target.value } })}
              placeholder="Hello {{contact.name}}, your order {{order.id}} is confirmed!"
            />
            <p className="text-[11px] text-[var(--gray-9)]">
              Use {`{{variable}}`} for dynamic values. Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-medium text-[var(--gray-12)]">Preview URL</p>
              <p className="text-[11px] text-[var(--gray-9)]">Show link preview if body contains a URL</p>
            </div>
            <Toggle
              checked={config.text.previewUrl}
              onChange={(v) => onChange({ ...config, text: { ...config.text, previewUrl: v } })}
            />
          </div>
        </div>
      )}

      {/* Template message */}
      {config.messageType === 'template' && (
        <TemplateEditor config={config} onChange={onChange} />
      )}

      {/* Media messages */}
      {(['image', 'document', 'audio', 'video'] as WaMessageType[]).includes(config.messageType) && (
        <MediaEditor config={config} onChange={onChange} />
      )}

      {/* Output */}
      <div className="space-y-1.5">
        <Label>Save Result to Variable</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="{{waResult}}"
        />
      </div>

      <OutputSchema
        accent="#25d366"
        fields={[
          { key: 'messageId', type: 'string', description: 'Meta WABA message ID' },
          { key: 'status',    type: 'string', description: 'sent | queued | failed' },
          { key: 'to',        type: 'string', description: 'Recipient phone number' },
          { key: 'timestamp', type: 'string', description: 'ISO-8601 send time' },
        ]}
      />
    </div>
  );
}

/* ── Template editor ─────────────────────────────────────── */

function TemplateEditor({ config, onChange }: WhatsAppSendNodeProps) {
  const tpl = config.template;

  const addComponent = (type: TemplateComponent['type']) => {
    const next: TemplateComponent = { type, parameters: [] };
    onChange({ ...config, template: { ...tpl, components: [...tpl.components, next] } });
  };

  const removeComponent = (idx: number) => {
    const components = tpl.components.filter((_, i) => i !== idx);
    onChange({ ...config, template: { ...tpl, components } });
  };

  const addParam = (compIdx: number) => {
    const components = tpl.components.map((c, i) =>
      i === compIdx
        ? { ...c, parameters: [...c.parameters, { type: 'text' as const, text: '' }] }
        : c,
    );
    onChange({ ...config, template: { ...tpl, components } });
  };

  const updateParamText = (compIdx: number, paramIdx: number, text: string) => {
    const components = tpl.components.map((c, ci) =>
      ci === compIdx
        ? {
            ...c,
            parameters: c.parameters.map((p, pi) =>
              pi === paramIdx ? { ...p, text } : p,
            ),
          }
        : c,
    );
    onChange({ ...config, template: { ...tpl, components } });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Template Name</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={tpl.name}
          onChange={(e) => onChange({ ...config, template: { ...tpl, name: e.target.value } })}
          placeholder="order_confirmation"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Language</Label>
        <select
          className={INPUT_CLS}
          value={tpl.languageCode}
          onChange={(e) => onChange({ ...config, template: { ...tpl, languageCode: e.target.value } })}
        >
          {TEMPLATE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
          ))}
        </select>
      </div>

      {/* Components */}
      <div className="space-y-2">
        <Label>Template Components</Label>
        {tpl.components.map((comp, ci) => (
          <div key={ci} className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--gray-11)] capitalize">{comp.type}</span>
              <button
                type="button"
                onClick={() => removeComponent(ci)}
                className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
              >
                <LuX className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            {comp.parameters.map((p, pi) => (
              <input
                key={pi}
                type="text"
                className={INPUT_CLS}
                value={p.text ?? ''}
                onChange={(e) => updateParamText(ci, pi, e.target.value)}
                placeholder={`{{param${pi + 1}}}`}
              />
            ))}

            <button
              type="button"
              onClick={() => addParam(ci)}
              className="flex items-center gap-1 text-[11.5px] text-[#f76808] hover:text-[#e25c00] transition-colors"
            >
              <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
              Add parameter
            </button>
          </div>
        ))}

        <div className="flex gap-1.5">
          {(['header', 'body', 'button'] as TemplateComponent['type'][]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addComponent(t)}
              className="flex-1 rounded-lg border border-dashed border-[var(--gray-5)] py-1.5 text-[11.5px] text-[var(--gray-9)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)] transition-colors capitalize"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Media editor ────────────────────────────────────────── */

function MediaEditor({ config, onChange }: WhatsAppSendNodeProps) {
  const media = config.media;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Media URL or ID</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={media.source}
          onChange={(e) => onChange({ ...config, media: { ...media, source: e.target.value } })}
          placeholder="https://example.com/image.jpg or {{media.id}}"
        />
      </div>

      {config.messageType !== 'audio' && (
        <div className="space-y-1.5">
          <Label>Caption (optional)</Label>
          <input
            type="text"
            className={INPUT_CLS}
            value={media.caption}
            onChange={(e) => onChange({ ...config, media: { ...media, caption: e.target.value } })}
            placeholder="Caption text…"
          />
        </div>
      )}

      {config.messageType === 'document' && (
        <div className="space-y-1.5">
          <Label>Filename</Label>
          <input
            type="text"
            className={INPUT_CLS}
            value={media.filename}
            onChange={(e) => onChange({ ...config, media: { ...media, filename: e.target.value } })}
            placeholder="invoice.pdf"
          />
        </div>
      )}
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
      )}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[90px] text-[11.5px] font-mono font-medium" style={{ color: accent }}>{f.key}</code>
            <span className="rounded bg-[var(--gray-4)] px-1 py-0.5 text-[10px] font-mono text-[var(--gray-9)]">{f.type}</span>
            <span className="flex-1 text-[11px] text-[var(--gray-9)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
