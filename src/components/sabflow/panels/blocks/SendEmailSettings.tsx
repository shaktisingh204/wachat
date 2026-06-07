'use client';

import { useCallback, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  Mail,
  ChevronDown,
  Lock,
  Paperclip,
  Trash2,
  Plus,
  Server,
} from 'lucide-react';
import type { Block, Variable, SendEmailOptions, SmtpConfig, EmailAttachment } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Switch,
  Button,
  IconButton,
  Card,
  CardBody,
  Separator,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';

/* Sub-components */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
      {children}
    </span>
  );
}

function HintText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--st-text-tertiary)]">{children}</p>
  );
}

function VarBadge() {
  return (
    <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
      {'{{variable}}'}
    </code>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ id, label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer select-none text-[12px] text-[var(--st-text-secondary)]">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/* Props */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* Main component */

export function SendEmailSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts         = (block.options ?? {}) as SendEmailOptions;
  const smtp         = opts.smtp ?? {};
  const attachments  = opts.attachments ?? [];
  const bodyType     = opts.bodyType ?? 'richtext';
  const useCustom    = opts.useCustomSmtp ?? false;

  const [smtpOpen, setSmtpOpen] = useState(false);

  /* Updaters */

  const update = useCallback(
    (patch: Partial<SendEmailOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const updateSmtp = useCallback(
    (patch: Partial<SmtpConfig>) => {
      update({ smtp: { ...smtp, ...patch } });
    },
    [smtp, update],
  );

  /* Attachment list */

  const addAttachment = () =>
    update({ attachments: [...attachments, { id: createId(), url: '' }] });

  const updateAttachment = (id: string, patch: Partial<Omit<EmailAttachment, 'id'>>) =>
    update({
      attachments: attachments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeAttachment = (id: string) =>
    update({ attachments: attachments.filter((a) => a.id !== id) });

  /* Render */

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <Mail className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Send Email
        </h3>
      </div>

      {/* Sender */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From name">
          <Input
            type="text"
            value={opts.fromName ?? ''}
            onChange={(e) => update({ fromName: e.target.value })}
            placeholder="My Bot"
          />
        </Field>
        <Field label="From email">
          <Input
            type="email"
            value={opts.fromEmail ?? ''}
            onChange={(e) => update({ fromEmail: e.target.value })}
            placeholder="no-reply@myapp.com"
            autoComplete="off"
          />
        </Field>
      </div>

      {/* Reply-to */}
      <Field label="Reply-to (optional)">
        <Input
          type="text"
          value={opts.replyTo ?? ''}
          onChange={(e) => update({ replyTo: e.target.value })}
          placeholder="support@myapp.com"
        />
      </Field>

      <Separator />

      {/* Recipients */}
      <Field label="To">
        <VariableAutocompleteInput
          value={opts.to ?? ''}
          onChange={(v) => update({ to: v })}
          variables={variables}
          placeholder="recipient@example.com or {{email}}"
          aria-label="To"
        />
        <HintText>
          Multiple addresses separated by commas. Supports <VarBadge />.
        </HintText>
      </Field>

      {/* Subject */}
      <Field label="Subject">
        <VariableAutocompleteInput
          value={opts.subject ?? ''}
          onChange={(v) => update({ subject: v })}
          variables={variables}
          placeholder="Your order is confirmed, supports {{variable}}"
          aria-label="Email subject"
        />
      </Field>

      <Separator />

      {/* Body */}
      <Field label="Body type">
        <Select
          value={bodyType}
          onValueChange={(v) => update({ bodyType: v as SendEmailOptions['bodyType'] })}
        >
          <SelectTrigger aria-label="Body type">
            <SelectValue placeholder="Select a body type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="richtext">Rich text</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Body">
        {bodyType === 'html' ? (
          <>
            <VariableAutocompleteInput
              type="textarea"
              value={opts.body ?? ''}
              onChange={(v) => update({ body: v })}
              variables={variables}
              placeholder={`<p>Hello {{name}},</p>\n<p>Your booking is confirmed.</p>`}
              rows={8}
              spellCheck={false}
              aria-label="Email HTML body"
              className="min-h-[160px] font-mono text-[12px] leading-relaxed"
            />
            <HintText>
              Raw HTML. Use <VarBadge /> for dynamic content.
            </HintText>
          </>
        ) : (
          <>
            <VariableAutocompleteInput
              type="textarea"
              value={opts.body ?? ''}
              onChange={(v) => update({ body: v })}
              variables={variables}
              placeholder={`Hello {{name}},\n\nYour booking is confirmed.\n\nThanks,\nThe Team`}
              rows={7}
              aria-label="Email body"
              className="min-h-[140px]"
            />
            <HintText>
              Plain text with line breaks. Use <VarBadge /> for dynamic content. Basic HTML tags
              (bold, italic, links) are supported by most email clients.
            </HintText>
          </>
        )}
      </Field>

      <Separator />

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" strokeWidth={1.8} aria-hidden="true" />
            <SectionHeading>Attach files</SectionHeading>
          </div>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addAttachment}>
            Add file
          </Button>
        </div>

        {attachments.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            size="sm"
            title="No attachments"
            description="Add a file URL to attach it to the email."
          />
        ) : (
          attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-1.5">
              <div className="flex-1">
                <VariableAutocompleteInput
                  value={att.url}
                  onChange={(v) => updateAttachment(att.id, { url: v })}
                  variables={variables}
                  placeholder="https://example.com/file.pdf or {{fileUrl}}"
                  spellCheck={false}
                  aria-label="Attachment URL"
                />
              </div>
              <IconButton
                label="Remove attachment"
                icon={Trash2}
                variant="ghost"
                size="sm"
                onClick={() => removeAttachment(att.id)}
              />
            </div>
          ))
        )}
      </div>

      <Separator />

      {/* SMTP */}
      <div className="space-y-3">
        {/* Collapsible header */}
        <Button
          variant="ghost"
          block
          onClick={() => setSmtpOpen((v) => !v)}
          aria-expanded={smtpOpen}
          className="justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" strokeWidth={1.8} aria-hidden="true" />
            <SectionHeading>SMTP settings</SectionHeading>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[var(--st-text-secondary)] transition-transform duration-200 ${
              smtpOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Button>

        {smtpOpen && (
          <Card padding="none">
            <CardBody className="space-y-3">
              {/* Use workspace SMTP toggle */}
              <ToggleRow
                id="use-workspace-smtp"
                label="Use workspace SMTP settings"
                checked={!useCustom}
                onChange={(next) => update({ useCustomSmtp: !next })}
              />

              {useCustom && (
                <>
                  <Separator />

                  <div className="mb-1 flex items-center gap-1.5">
                    <Server className="h-3 w-3 text-[var(--st-text-tertiary)]" strokeWidth={1.8} aria-hidden="true" />
                    <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                      Custom SMTP
                    </span>
                  </div>

                  <Field label="Host">
                    <Input
                      type="text"
                      value={smtp.host ?? ''}
                      onChange={(e) => updateSmtp({ host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Port">
                      <Input
                        type="number"
                        value={smtp.port ?? ''}
                        onChange={(e) =>
                          updateSmtp({
                            port: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="587"
                      />
                    </Field>

                    <Field label="STARTTLS">
                      <div className="flex h-[38px] items-center gap-2">
                        <Switch
                          checked={smtp.useStartTls ?? false}
                          onCheckedChange={(next) => updateSmtp({ useStartTls: next })}
                          aria-label="STARTTLS"
                        />
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                          {smtp.useStartTls ? 'On' : 'Off'}
                        </span>
                      </div>
                    </Field>
                  </div>

                  <Field label="Username">
                    <Input
                      type="text"
                      value={smtp.username ?? ''}
                      onChange={(e) => updateSmtp({ username: e.target.value })}
                      placeholder="you@example.com"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </Field>

                  <Field label="Password">
                    <Input
                      type="password"
                      value={smtp.password ?? ''}
                      onChange={(e) => updateSmtp({ password: e.target.value })}
                      placeholder="Enter SMTP password"
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
