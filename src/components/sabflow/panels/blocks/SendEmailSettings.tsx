'use client';

import { useCallback, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  LuMail,
  LuChevronDown,
  LuLock,
  LuPaperclip,
  LuTrash2,
  LuPlus,
  LuServer,
} from 'react-icons/lu';
import type { Block, Variable, SendEmailOptions, SmtpConfig, EmailAttachment } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider, toggleClass } from './shared/primitives';

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-[var(--gray-9)] uppercase tracking-wider">
      {children}
    </span>
  );
}

function HintText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] text-[var(--gray-8)] mt-1 leading-relaxed">{children}</p>
  );
}

function VarBadge() {
  return (
    <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
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
      <label htmlFor={id} className="text-[12px] text-[var(--gray-11)] cursor-pointer select-none">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={toggleClass(checked)}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function SendEmailSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const opts         = (block.options ?? {}) as SendEmailOptions;
  const smtp         = opts.smtp ?? {};
  const attachments  = opts.attachments ?? [];
  const bodyType     = opts.bodyType ?? 'richtext';
  const useCustom    = opts.useCustomSmtp ?? false;

  const [smtpOpen, setSmtpOpen] = useState(false);

  /* ── Updater ─────────────────────────────────────────────────────────── */

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

  /* ── Attachment list ─────────────────────────────────────────────────── */

  const addAttachment = () =>
    update({ attachments: [...attachments, { id: createId(), url: '' }] });

  const updateAttachment = (id: string, patch: Partial<Omit<EmailAttachment, 'id'>>) =>
    update({
      attachments: attachments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeAttachment = (id: string) =>
    update({ attachments: attachments.filter((a) => a.id !== id) });

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuMail} title="Send Email" />

      {/* ── Sender ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From name">
          <input
            type="text"
            value={opts.fromName ?? ''}
            onChange={(e) => update({ fromName: e.target.value })}
            placeholder="My Bot"
            className={inputClass}
          />
        </Field>
        <Field label="From email">
          <input
            type="email"
            value={opts.fromEmail ?? ''}
            onChange={(e) => update({ fromEmail: e.target.value })}
            placeholder="no-reply@myapp.com"
            className={inputClass}
            autoComplete="off"
          />
        </Field>
      </div>

      {/* ── Reply-to ─────────────────────────────────────────────── */}
      <Field label="Reply-to (optional)">
        <input
          type="text"
          value={opts.replyTo ?? ''}
          onChange={(e) => update({ replyTo: e.target.value })}
          placeholder="support@myapp.com"
          className={inputClass}
        />
      </Field>

      <Divider />

      {/* ── Recipients ───────────────────────────────────────────── */}
      <Field label="To">
        <input
          type="text"
          value={opts.to ?? ''}
          onChange={(e) => update({ to: e.target.value })}
          placeholder="recipient@example.com or {{email}}"
          className={inputClass}
        />
        <HintText>
          Multiple addresses separated by commas. Supports <VarBadge />.
        </HintText>
      </Field>

      {/* ── Subject ──────────────────────────────────────────────── */}
      <Field label="Subject">
        <input
          type="text"
          value={opts.subject ?? ''}
          onChange={(e) => update({ subject: e.target.value })}
          placeholder="Your order is confirmed — supports {{variable}}"
          className={inputClass}
        />
      </Field>

      <Divider />

      {/* ── Body ─────────────────────────────────────────────────── */}
      <Field label="Body type">
        <select
          value={bodyType}
          onChange={(e) => update({ bodyType: e.target.value as SendEmailOptions['bodyType'] })}
          className={selectClass}
        >
          <option value="richtext">Rich text</option>
          <option value="html">HTML</option>
        </select>
      </Field>

      <Field label="Body">
        {bodyType === 'html' ? (
          <>
            <textarea
              value={opts.body ?? ''}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={`<p>Hello {{name}},</p>\n<p>Your booking is confirmed.</p>`}
              rows={8}
              spellCheck={false}
              className={`${inputClass} resize-y min-h-[160px] font-mono text-[12px] leading-relaxed`}
            />
            <HintText>
              Raw HTML. Use <VarBadge /> for dynamic content.
            </HintText>
          </>
        ) : (
          <>
            <textarea
              value={opts.body ?? ''}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={`Hello {{name}},\n\nYour booking is confirmed.\n\nThanks,\nThe Team`}
              rows={7}
              className={`${inputClass} resize-y min-h-[140px]`}
            />
            <HintText>
              Plain text with line breaks. Use <VarBadge /> for dynamic content. Basic HTML tags
              (bold, italic, links) are supported by most email clients.
            </HintText>
          </>
        )}
      </Field>

      <Divider />

      {/* ── Attachments ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <LuPaperclip className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={1.8} />
            <SectionHeading>Attach files</SectionHeading>
          </div>
          <button
            type="button"
            onClick={addAttachment}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f7680814] transition-colors"
          >
            <LuPlus className="h-3 w-3" strokeWidth={2.5} />
            Add file
          </button>
        </div>

        {attachments.length === 0 && (
          <p className="text-[11px] text-[var(--gray-8)] italic">
            No attachments — add a file URL to attach it to the email.
          </p>
        )}

        {attachments.map((att) => (
          <div key={att.id} className="flex gap-1.5 items-center">
            <input
              type="text"
              value={att.url}
              onChange={(e) => updateAttachment(att.id, { url: e.target.value })}
              placeholder="https://example.com/file.pdf or {{fileUrl}}"
              spellCheck={false}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => removeAttachment(att.id)}
              aria-label="Remove attachment"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
            >
              <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      <Divider />

      {/* ── SMTP ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setSmtpOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <LuLock className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={1.8} />
            <SectionHeading>SMTP settings</SectionHeading>
          </div>
          <LuChevronDown
            className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform duration-200 ${
              smtpOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </button>

        {smtpOpen && (
          <div className="space-y-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">

            {/* Use workspace SMTP toggle */}
            <ToggleRow
              id="use-workspace-smtp"
              label="Use workspace SMTP settings"
              checked={!useCustom}
              onChange={(next) => update({ useCustomSmtp: !next })}
            />

            {useCustom && (
              <>
                <Divider />

                <div className="flex items-center gap-1.5 mb-1">
                  <LuServer className="h-3 w-3 text-[var(--gray-8)]" strokeWidth={1.8} />
                  <span className="text-[10.5px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
                    Custom SMTP
                  </span>
                </div>

                <Field label="Host">
                  <input
                    type="text"
                    value={smtp.host ?? ''}
                    onChange={(e) => updateSmtp({ host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    spellCheck={false}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Port">
                    <input
                      type="number"
                      value={smtp.port ?? ''}
                      onChange={(e) =>
                        updateSmtp({
                          port: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="587"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="STARTTLS">
                    <div className="flex items-center gap-2 h-[38px]">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={smtp.useStartTls ?? false}
                        onClick={() => updateSmtp({ useStartTls: !(smtp.useStartTls ?? false) })}
                        className={toggleClass(smtp.useStartTls ?? false)}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
                            smtp.useStartTls ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-[12px] text-[var(--gray-10)]">
                        {smtp.useStartTls ? 'On' : 'Off'}
                      </span>
                    </div>
                  </Field>
                </div>

                <Field label="Username">
                  <input
                    type="text"
                    value={smtp.username ?? ''}
                    onChange={(e) => updateSmtp({ username: e.target.value })}
                    placeholder="you@example.com"
                    spellCheck={false}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>

                <Field label="Password">
                  <input
                    type="password"
                    value={smtp.password ?? ''}
                    onChange={(e) => updateSmtp({ password: e.target.value })}
                    placeholder="••••••••"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
