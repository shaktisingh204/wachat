'use client';

import { Send, Plus, X, Image as ImageIcon, FileText, Hash } from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Textarea,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';

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
  { type: 'text',        label: 'Text',        icon: <Hash className="h-3.5 w-3.5" aria-hidden="true" /> },
  { type: 'template',    label: 'Template',    icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
  { type: 'image',       label: 'Image',       icon: <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> },
  { type: 'document',    label: 'Document',    icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" /> },
  { type: 'audio',       label: 'Audio',       icon: <Hash className="h-3.5 w-3.5" aria-hidden="true" /> },
  { type: 'video',       label: 'Video',       icon: <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> },
];

/* ── Component ───────────────────────────────────────────── */

export function WhatsAppSendNode({ config, onChange, className }: WhatsAppSendNodeProps) {
  return (
    <div className={cn('ui20 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
          <Send className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Send WhatsApp Message</p>
          <p className="text-[11px] text-[var(--st-text-tertiary)]">Send a message via WhatsApp Business API</p>
        </div>
      </div>

      {/* To */}
      <Field label="To (phone number)" help="E.164 format or a variable referencing one">
        <Input
          value={config.to}
          onChange={(e) => onChange({ ...config, to: e.target.value })}
          placeholder="+919876543210 or {{contact.phone}}"
        />
      </Field>

      {/* From phone number ID */}
      <Field label="From Phone Number ID (optional)">
        <Input
          value={config.fromPhoneNumberId}
          onChange={(e) => onChange({ ...config, fromPhoneNumberId: e.target.value })}
          placeholder="Leave empty to use default"
        />
      </Field>

      {/* Message type */}
      <Field label="Message Type">
        <div className="grid grid-cols-3 gap-1.5">
          {MESSAGE_TYPES.map(({ type, label, icon }) => (
            <Button
              key={type}
              variant={config.messageType === type ? 'primary' : 'outline'}
              onClick={() => onChange({ ...config, messageType: type })}
              className="flex-col gap-1 py-2 text-[11px]"
            >
              {icon}
              {label}
            </Button>
          ))}
        </div>
      </Field>

      {/* Text message */}
      {config.messageType === 'text' && (
        <div className="space-y-3">
          <Field
            label="Message Body"
            help="Use {{variable}} for dynamic values. Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~"
          >
            <Textarea
              rows={4}
              className="min-h-[100px] resize-y"
              value={config.text.body}
              onChange={(e) => onChange({ ...config, text: { ...config.text, body: e.target.value } })}
              placeholder="Hello {{contact.name}}, your order {{order.id}} is confirmed!"
            />
          </Field>
          <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-medium text-[var(--st-text)]">Preview URL</p>
              <p className="text-[11px] text-[var(--st-text-tertiary)]">Show link preview if body contains a URL</p>
            </div>
            <Switch
              checked={config.text.previewUrl}
              onCheckedChange={(v) => onChange({ ...config, text: { ...config.text, previewUrl: v } })}
              aria-label="Toggle link preview"
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
      <Field label="Save Result to Variable">
        <Input
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="{{waResult}}"
        />
      </Field>

      <OutputSchema
        accent="var(--st-status-ok)"
        fields={[
          { key: 'messageId', type: 'string', description: 'Meta WABA message ID' },
          { key: 'status',    type: 'string', description: 'sent, queued, or failed' },
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
      <Field label="Template Name">
        <Input
          value={tpl.name}
          onChange={(e) => onChange({ ...config, template: { ...tpl, name: e.target.value } })}
          placeholder="order_confirmation"
        />
      </Field>

      <Field label="Language">
        <Select
          value={tpl.languageCode}
          onValueChange={(v) => onChange({ ...config, template: { ...tpl, languageCode: v } })}
        >
          <SelectTrigger aria-label="Template language">
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.label} ({l.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Components */}
      <Field label="Template Components">
        <div className="space-y-2">
          {tpl.components.map((comp, ci) => (
            <Card key={ci} variant="outlined" padding="sm" className="space-y-2 bg-[var(--st-bg-secondary)]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold capitalize text-[var(--st-text-secondary)]">{comp.type}</span>
                <IconButton
                  label={`Remove ${comp.type} component`}
                  icon={X}
                  size="sm"
                  onClick={() => removeComponent(ci)}
                />
              </div>

              {comp.parameters.map((p, pi) => (
                <Input
                  key={pi}
                  value={p.text ?? ''}
                  onChange={(e) => updateParamText(ci, pi, e.target.value)}
                  placeholder={`{{param${pi + 1}}}`}
                />
              ))}

              <Button
                variant="ghost"
                size="sm"
                iconLeft={Plus}
                onClick={() => addParam(ci)}
                className="text-[11.5px]"
              >
                Add parameter
              </Button>
            </Card>
          ))}

          <div className="flex gap-1.5">
            {(['header', 'body', 'button'] as TemplateComponent['type'][]).map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                block
                onClick={() => addComponent(t)}
                className="flex-1 capitalize"
              >
                + {t}
              </Button>
            ))}
          </div>
        </div>
      </Field>
    </div>
  );
}

/* ── Media editor ────────────────────────────────────────── */

function MediaEditor({ config, onChange }: WhatsAppSendNodeProps) {
  const media = config.media;
  return (
    <div className="space-y-3">
      <Field label="Media File" help="Pick from your SabFiles library or upload a new file.">
        <SabFileUrlInput
          value={media.source}
          onChange={(value) => onChange({ ...config, media: { ...media, source: value } })}
          accept={config.messageType === 'document' ? 'document' : config.messageType === 'image' ? 'image' : config.messageType === 'video' ? 'video' : 'audio'}
          pickerTitle="Choose media"
          placeholder="No media chosen"
        />
      </Field>

      {config.messageType !== 'audio' && (
        <Field label="Caption (optional)">
          <Input
            value={media.caption}
            onChange={(e) => onChange({ ...config, media: { ...media, caption: e.target.value } })}
            placeholder="Caption text..."
          />
        </Field>
      )}

      {config.messageType === 'document' && (
        <Field label="Filename">
          <Input
            value={media.filename}
            onChange={(e) => onChange({ ...config, media: { ...media, filename: e.target.value } })}
            placeholder="invoice.pdf"
          />
        </Field>
      )}
    </div>
  );
}

/* ── Output schema preview ───────────────────────────────── */

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <Card variant="outlined" padding="none">
      <CardHeader className="px-3 pt-3">
        <CardTitle className="text-[12px]">Output</CardTitle>
        <CardDescription className="text-[11px]">Fields written by this step.</CardDescription>
      </CardHeader>
      <CardBody className="divide-y divide-[var(--st-border)] p-0">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[90px] font-mono text-[11.5px] font-medium" style={{ color: accent }}>{f.key}</code>
            <span className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text-tertiary)]">{f.type}</span>
            <span className="flex-1 truncate text-[11px] text-[var(--st-text-tertiary)]">{f.description}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
