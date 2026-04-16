'use client';

import { useState } from 'react';
import { LuMessageSquare, LuPlus, LuX, LuPhone, LuHash, LuFilter } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type WhatsAppEventType =
  | 'message'         // any incoming message
  | 'message_read'    // message read receipt
  | 'message_delivered'
  | 'button_reply'    // button/quick-reply tapped
  | 'list_reply';     // list item selected

export interface WhatsAppKeywordFilter {
  /** keywords to match (case-insensitive, OR logic) */
  keywords: string[];
  /** 'contains' | 'exact' | 'starts_with' */
  matchType: 'contains' | 'exact' | 'starts_with';
}

export interface WhatsAppTriggerConfig {
  /** Which WABA account / phone number ID to listen on (empty = all) */
  phoneNumberId: string;
  /** Allowed sender phone numbers in E.164 format, empty = any */
  allowedSenders: string[];
  /** Event types to trigger on */
  eventTypes: WhatsAppEventType[];
  /** Optional keyword filter — only fires when the message text matches */
  keywordFilter: WhatsAppKeywordFilter | null;
  /** Group name / label for display purposes only */
  label: string;
}

/** Shape of data emitted when the trigger fires */
export interface WhatsAppTriggerOutput {
  from: string;          // sender phone number
  to: string;            // receiving phone number ID
  messageId: string;
  timestamp: string;     // ISO-8601
  type: string;          // text | image | document | …
  text?: string;         // body of a text message
  media?: {
    id: string;
    mimeType: string;
    sha256: string;
    url?: string;
  };
  context?: {
    from: string;
    id: string;
  };
  buttonReply?: { id: string; title: string };
  listReply?:   { id: string; title: string; description: string };
  rawPayload: Record<string, unknown>;
}

export type WhatsAppTriggerProps = {
  config: WhatsAppTriggerConfig;
  onChange: (config: WhatsAppTriggerConfig) => void;
  className?: string;
};

/* ── Constants ───────────────────────────────────────────── */

const EVENT_TYPE_LABELS: Record<WhatsAppEventType, string> = {
  message:            'Incoming Message',
  message_read:       'Message Read',
  message_delivered:  'Message Delivered',
  button_reply:       'Button Reply',
  list_reply:         'List Reply',
};

const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as WhatsAppEventType[];

/* ── Component ───────────────────────────────────────────── */

export function WhatsAppTrigger({ config, onChange, className }: WhatsAppTriggerProps) {
  const [newSender, setNewSender] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  /* --- event type toggle ---------------------------------- */
  const toggleEvent = (type: WhatsAppEventType) => {
    const current = config.eventTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ ...config, eventTypes: next });
  };

  /* --- allowed senders ----------------------------------- */
  const addSender = () => {
    const trimmed = newSender.trim();
    if (!trimmed || config.allowedSenders.includes(trimmed)) return;
    onChange({ ...config, allowedSenders: [...config.allowedSenders, trimmed] });
    setNewSender('');
  };

  const removeSender = (s: string) =>
    onChange({ ...config, allowedSenders: config.allowedSenders.filter((x) => x !== s) });

  /* --- keyword filter ------------------------------------ */
  const ensureFilter = (): WhatsAppKeywordFilter =>
    config.keywordFilter ?? { keywords: [], matchType: 'contains' };

  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed) return;
    const f = ensureFilter();
    if (f.keywords.includes(trimmed)) return;
    onChange({ ...config, keywordFilter: { ...f, keywords: [...f.keywords, trimmed] } });
    setNewKeyword('');
  };

  const removeKeyword = (k: string) => {
    const f = ensureFilter();
    const next = f.keywords.filter((x) => x !== k);
    onChange({ ...config, keywordFilter: next.length ? { ...f, keywords: next } : null });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25d366]/10 text-[#25d366]">
          <LuMessageSquare className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">WhatsApp Trigger</p>
          <p className="text-[11px] text-[var(--gray-9)]">Fires on incoming WhatsApp messages</p>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label>Node Label</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.label}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g. Order bot trigger"
        />
      </div>

      {/* Phone number ID */}
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <LuPhone className="h-3.5 w-3.5" strokeWidth={2} />
            WABA Phone Number ID
          </span>
        </Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.phoneNumberId}
          onChange={(e) => onChange({ ...config, phoneNumberId: e.target.value })}
          placeholder="Leave empty for all accounts"
        />
        <p className="text-[11px] text-[var(--gray-9)]">
          The Meta phone number ID from your WABA account settings
        </p>
      </div>

      {/* Event types */}
      <div className="space-y-1.5">
        <Label>Trigger on Events</Label>
        <div className="grid grid-cols-1 gap-1">
          {ALL_EVENT_TYPES.map((type) => {
            const active = config.eventTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleEvent(type)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors',
                  active
                    ? 'border-[#25d366]/40 bg-[#25d366]/8 text-[var(--gray-12)]'
                    : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-10)] hover:border-[var(--gray-6)]',
                )}
              >
                <span
                  className={cn(
                    'h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0',
                    active ? 'border-[#25d366] bg-[#25d366]' : 'border-[var(--gray-6)]',
                  )}
                >
                  {active && (
                    <svg viewBox="0 0 10 10" className="h-2 w-2 fill-white">
                      <path d="M1.5 5L4 7.5L8.5 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                {EVENT_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Allowed senders */}
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <LuFilter className="h-3.5 w-3.5" strokeWidth={2} />
            Filter by Sender (E.164)
          </span>
        </Label>
        <p className="text-[11px] text-[var(--gray-9)]">
          Only trigger for these phone numbers. Leave empty to allow all.
        </p>

        {config.allowedSenders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {config.allowedSenders.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1 rounded-full border border-[var(--gray-5)] bg-[var(--gray-3)] pl-2.5 pr-1.5 py-0.5 text-[11.5px] font-mono text-[var(--gray-11)]"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSender(s)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--gray-8)] hover:text-[var(--gray-12)] transition-colors"
                >
                  <LuX className="h-2.5 w-2.5" strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="tel"
            className={cn(INPUT_CLS, 'flex-1')}
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSender())}
            placeholder="+919876543210"
          />
          <button
            type="button"
            onClick={addSender}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuPlus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Keyword filter */}
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <LuHash className="h-3.5 w-3.5" strokeWidth={2} />
            Keyword Filter
          </span>
        </Label>

        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-3">
          {/* Match type */}
          <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
            {(['contains', 'exact', 'starts_with'] as const).map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => onChange({ ...config, keywordFilter: { ...ensureFilter(), matchType: mt } })}
                className={cn(
                  'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors capitalize',
                  config.keywordFilter?.matchType === mt
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                )}
              >
                {mt.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Keyword chips */}
          {(config.keywordFilter?.keywords ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {config.keywordFilter!.keywords.map((k) => (
                <span
                  key={k}
                  className="flex items-center gap-1 rounded-full border border-[#25d366]/30 bg-[#25d366]/10 pl-2.5 pr-1.5 py-0.5 text-[11.5px] text-[#25d366]"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:opacity-70 transition-opacity"
                  >
                    <LuX className="h-2.5 w-2.5" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add keyword */}
          <div className="flex gap-2">
            <input
              type="text"
              className={cn(INPUT_CLS, 'flex-1 text-[12px]')}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="order, help, start…"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            >
              <LuPlus className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {!config.keywordFilter && (
            <p className="text-[11px] text-[var(--gray-9)] text-center italic">
              No keyword filter — all messages will trigger this node
            </p>
          )}
        </div>
      </div>

      {/* Output schema */}
      <OutputSchema
        fields={[
          { key: 'from',       type: 'string',  description: 'Sender phone number (E.164)' },
          { key: 'to',         type: 'string',  description: 'Receiving phone number ID' },
          { key: 'messageId',  type: 'string',  description: 'WABA message ID' },
          { key: 'timestamp',  type: 'string',  description: 'ISO-8601 receive time' },
          { key: 'type',       type: 'string',  description: 'Message type: text | image | …' },
          { key: 'text',       type: 'string?', description: 'Text body (for text messages)' },
          { key: 'media',      type: 'object?', description: 'Media metadata (id, mimeType, url)' },
          { key: 'rawPayload', type: 'object',  description: 'Full webhook payload from Meta' },
        ]}
      />
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

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[90px] text-[11.5px] font-mono font-medium text-[#25d366]">{f.key}</code>
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
