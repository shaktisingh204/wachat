'use client';

import { useState } from 'react';
import { MessageSquare, Plus, Phone, Hash, Filter } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Field,
  Input,
  Label,
  Checkbox,
  Tag,
  IconButton,
  SegmentedControl,
  Card,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

/* -- Types -------------------------------------------------- */

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
  /** Optional keyword filter, only fires when the message text matches */
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
  type: string;          // text | image | document ...
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

/* -- Constants ---------------------------------------------- */

const EVENT_TYPE_LABELS: Record<WhatsAppEventType, string> = {
  message:            'Incoming Message',
  message_read:       'Message Read',
  message_delivered:  'Message Delivered',
  button_reply:       'Button Reply',
  list_reply:         'List Reply',
};

const ALL_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as WhatsAppEventType[];

const MATCH_TYPE_ITEMS = [
  { value: 'contains' as const, label: 'Contains' },
  { value: 'exact' as const, label: 'Exact' },
  { value: 'starts_with' as const, label: 'Starts with' },
];

/* -- Component ---------------------------------------------- */

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
    <div className={cn('ui20 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/10 text-[var(--st-accent)]">
          <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">WhatsApp Trigger</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Fires on incoming WhatsApp messages</p>
        </div>
      </div>

      {/* Label */}
      <Field label="Node Label">
        <Input
          value={config.label}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g. Order bot trigger"
        />
      </Field>

      {/* Phone number ID */}
      <Field
        label={
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            WABA Phone Number ID
          </span>
        }
        help="The Meta phone number ID from your WABA account settings"
      >
        <Input
          value={config.phoneNumberId}
          onChange={(e) => onChange({ ...config, phoneNumberId: e.target.value })}
          placeholder="Leave empty for all accounts"
        />
      </Field>

      {/* Event types */}
      <div className="space-y-1.5">
        <Label>Trigger on Events</Label>
        <div className="grid grid-cols-1 gap-1">
          {ALL_EVENT_TYPES.map((type) => {
            const active = config.eventTypes.includes(type);
            return (
              <Checkbox
                key={type}
                size="sm"
                checked={active}
                onChange={() => toggleEvent(type)}
                label={EVENT_TYPE_LABELS[type]}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px] text-[var(--st-text)]"
              />
            );
          })}
        </div>
      </div>

      {/* Allowed senders */}
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Filter by Sender (E.164)
          </span>
        </Label>
        <p className="text-[11px] text-[var(--st-text-secondary)]">
          Only trigger for these phone numbers. Leave empty to allow all.
        </p>

        {config.allowedSenders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {config.allowedSenders.map((s) => (
              <Tag
                key={s}
                onRemove={() => removeSender(s)}
                removeLabel={`Remove sender ${s}`}
                className="font-mono"
              >
                {s}
              </Tag>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            type="tel"
            className="flex-1"
            value={newSender}
            onChange={(e) => setNewSender(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSender())}
            placeholder="+919876543210"
          />
          <IconButton
            label="Add sender"
            icon={Plus}
            variant="outline"
            onClick={addSender}
          />
        </div>
      </div>

      {/* Keyword filter */}
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Keyword Filter
          </span>
        </Label>

        <Card padding="sm" className="space-y-3">
          {/* Match type */}
          <SegmentedControl
            aria-label="Keyword match type"
            fullWidth
            size="sm"
            items={MATCH_TYPE_ITEMS}
            value={config.keywordFilter?.matchType ?? 'contains'}
            onChange={(mt) =>
              onChange({ ...config, keywordFilter: { ...ensureFilter(), matchType: mt } })
            }
          />

          {/* Keyword chips */}
          {(config.keywordFilter?.keywords ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {config.keywordFilter!.keywords.map((k) => (
                <Tag
                  key={k}
                  onRemove={() => removeKeyword(k)}
                  removeLabel={`Remove keyword ${k}`}
                >
                  {k}
                </Tag>
              ))}
            </div>
          )}

          {/* Add keyword */}
          <div className="flex gap-2">
            <Input
              inputSize="sm"
              className="flex-1"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="order, help, start"
            />
            <IconButton
              label="Add keyword"
              icon={Plus}
              size="sm"
              variant="outline"
              onClick={addKeyword}
            />
          </div>

          {!config.keywordFilter && (
            <p className="text-[11px] text-[var(--st-text-secondary)] text-center italic">
              No keyword filter, all messages will trigger this node
            </p>
          )}
        </Card>
      </div>

      {/* Output schema */}
      <OutputSchema
        fields={[
          { key: 'from',       type: 'string',  description: 'Sender phone number (E.164)' },
          { key: 'to',         type: 'string',  description: 'Receiving phone number ID' },
          { key: 'messageId',  type: 'string',  description: 'WABA message ID' },
          { key: 'timestamp',  type: 'string',  description: 'ISO-8601 receive time' },
          { key: 'type',       type: 'string',  description: 'Message type: text | image' },
          { key: 'text',       type: 'string?', description: 'Text body (for text messages)' },
          { key: 'media',      type: 'object?', description: 'Media metadata (id, mimeType, url)' },
          { key: 'rawPayload', type: 'object',  description: 'Full webhook payload from Meta' },
        ]}
      />
    </div>
  );
}

/* -- Shared primitives -------------------------------------- */

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <Card padding="none">
        <Table density="compact" hover={false}>
          <THead>
            <Tr>
              <Th>Field</Th>
              <Th>Type</Th>
              <Th>Description</Th>
            </Tr>
          </THead>
          <TBody>
            {fields.map((f) => (
              <Tr key={f.key}>
                <Td>
                  <code className="font-mono text-[11.5px] font-medium text-[var(--st-accent)]">
                    {f.key}
                  </code>
                </Td>
                <Td>
                  <span className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text-secondary)]">
                    {f.type}
                  </span>
                </Td>
                <Td className="text-[var(--st-text-secondary)]">{f.description}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
