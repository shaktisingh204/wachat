'use client';

import { useCallback, useState } from 'react';
import { LuMail, LuChevronDown, LuLock } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, Divider } from './shared/primitives';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  secure?: boolean;
}

interface SendEmailOptions {
  to?: string;
  subject?: string;
  body?: string;
  replyTo?: string;
  smtp?: SmtpConfig;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function SendEmailSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const opts = (block.options ?? {}) as SendEmailOptions;
  const smtp = opts.smtp ?? {};

  const [smtpOpen, setSmtpOpen] = useState(false);

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

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuMail} title="Send Email" />

      <Field label="To">
        <input
          type="text"
          value={opts.to ?? ''}
          onChange={(e) => update({ to: e.target.value })}
          placeholder="recipient@example.com or {{email}}"
          className={inputClass}
        />
      </Field>

      <Field label="Reply-to (optional)">
        <input
          type="text"
          value={opts.replyTo ?? ''}
          onChange={(e) => update({ replyTo: e.target.value })}
          placeholder="noreply@example.com or {{email}}"
          className={inputClass}
        />
      </Field>

      <Field label="Subject">
        <input
          type="text"
          value={opts.subject ?? ''}
          onChange={(e) => update({ subject: e.target.value })}
          placeholder="Your subject — supports {{variable}}"
          className={inputClass}
        />
      </Field>

      <Field label="Body (HTML supported)">
        <textarea
          value={opts.body ?? ''}
          onChange={(e) => update({ body: e.target.value })}
          placeholder={`<p>Hello {{name}},</p>\n<p>Your order is confirmed.</p>`}
          rows={7}
          spellCheck={false}
          className={`${inputClass} resize-y min-h-[140px] font-mono text-[12px]`}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          HTML tags are rendered. Use{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>{' '}
          for dynamic values.
        </p>
      </Field>

      <Divider />

      {/* SMTP config — collapsible */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSmtpOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <LuLock className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={1.8} />
            <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
              SMTP configuration
            </span>
          </div>
          <LuChevronDown
            className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform ${smtpOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        {smtpOpen && (
          <div className="space-y-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">
            <Field label="SMTP host">
              <input
                type="text"
                value={smtp.host ?? ''}
                onChange={(e) => updateSmtp({ host: e.target.value })}
                placeholder="smtp.gmail.com"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Port">
                <input
                  type="number"
                  value={smtp.port ?? ''}
                  onChange={(e) =>
                    updateSmtp({ port: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  placeholder="587"
                  className={inputClass}
                />
              </Field>

              <Field label="TLS / SSL">
                <div className="flex items-center gap-2 h-[38px]">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={smtp.secure ?? false}
                    onClick={() => updateSmtp({ secure: !(smtp.secure ?? false) })}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      smtp.secure ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
                        smtp.secure ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-[12px] text-[var(--gray-10)]">
                    {smtp.secure ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </Field>
            </div>

            <Field label="SMTP username">
              <input
                type="text"
                value={smtp.user ?? ''}
                onChange={(e) => updateSmtp({ user: e.target.value })}
                placeholder="you@example.com"
                className={inputClass}
                autoComplete="off"
              />
            </Field>

            <Field label="SMTP password">
              <input
                type="password"
                value={smtp.password ?? ''}
                onChange={(e) => updateSmtp({ password: e.target.value })}
                placeholder="••••••••"
                className={inputClass}
                autoComplete="new-password"
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
