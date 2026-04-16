'use client';

/**
 * FlowSettingsPanel
 *
 * Right-side sliding panel for per-flow configuration.
 * Sections: General · Behaviour · Metadata · Custom Domain · Custom CSS
 *
 * Follows the same collapsible-Section pattern as ThemePanel.
 * Uses react-icons/lu only. No lucide-react.
 */

import { useState, useCallback } from 'react';
import {
  LuSettings2,
  LuX,
  LuChevronDown,
  LuChevronRight,
  LuGlobe,
  LuLink,
  LuCopy,
  LuCheck,
  LuInfo,
  LuToggleRight,
  LuCode,
} from 'react-icons/lu';
import type { SabFlowDoc, FlowSettings } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface Props {
  flow: Pick<SabFlowDoc, '_id' | 'name' | 'settings' | 'publicId' | 'status'> & {
    _id: string;
  };
  onUpdate: (changes: Partial<Pick<SabFlowDoc, 'name' | 'settings'>>) => void;
  onClose: () => void;
}

/* ══════════════════════════════════════════════════════════
   Shared primitives
   ══════════════════════════════════════════════════════════ */

const inputCls = cn(
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
  'px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
  'outline-none focus:border-[var(--orange-8)] focus:ring-1 focus:ring-[var(--orange-8)]/20',
  'transition-colors',
);

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--gray-9)] leading-relaxed">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12.5px] text-[var(--gray-12)]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] text-[var(--gray-9)] leading-relaxed">{hint}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-[var(--orange-8)]' : 'bg-[var(--gray-5)]',
        )}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
    >
      {copied ? (
        <LuCheck className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />
      ) : (
        <LuCopy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   Collapsible Section (matches ThemePanel style)
   ══════════════════════════════════════════════════════════ */

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--gray-5)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 bg-[var(--gray-2)] hover:bg-[var(--gray-3)] transition-colors"
      >
        <span className="text-[12.5px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
          {title}
        </span>
        {open ? (
          <LuChevronDown className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={2.5} />
        ) : (
          <LuChevronRight className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={2.5} />
        )}
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4 bg-[var(--gray-1)]">{children}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Section components
   ══════════════════════════════════════════════════════════ */

/* ── General ─────────────────────────────────────────────── */

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'hi', label: 'Hindi' },
];

function GeneralSection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = flow.publicId ? `${baseUrl}/flow/${flow.publicId}` : '';

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  return (
    <Section title="General" defaultOpen>
      {/* Flow name */}
      <Field label="Flow name">
        <input
          type="text"
          className={inputCls}
          value={flow.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="My flow"
        />
      </Field>

      {/* Description */}
      <Field label="Description" hint="Internal note — not shown to users.">
        <textarea
          className={cn(inputCls, 'min-h-[72px] resize-y')}
          value={String(settings.description ?? '')}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What does this flow do?"
        />
      </Field>

      {/* Language */}
      <Field label="Language" hint="Primary language for the flow's UI labels.">
        <select
          className={inputCls}
          value={String(settings.language ?? 'en')}
          onChange={(e) => patch({ language: e.target.value })}
        >
          {LANGUAGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {/* Public URL */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
          <LuGlobe className="h-3 w-3" strokeWidth={2} />
          Public URL
        </label>
        {publicUrl ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[12px] font-mono text-[var(--gray-11)] truncate">
              {publicUrl}
            </div>
            <CopyButton text={publicUrl} />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] px-3 py-2.5">
            <LuLink className="h-3.5 w-3.5 text-[var(--gray-8)] shrink-0" strokeWidth={2} />
            <span className="text-[12px] text-[var(--gray-9)]">
              Publish the flow to get a public URL.
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Behaviour ───────────────────────────────────────────── */

function BehaviourSection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  return (
    <Section title="Behaviour" defaultOpen={false}>
      <ToggleRow
        label="Remember user"
        hint="Keep the user's session across visits so they can resume where they left off."
        checked={Boolean(settings.rememberUser)}
        onChange={(v) => patch({ rememberUser: v })}
      />
      <ToggleRow
        label="Show close button"
        hint="Display a dismiss / close button inside the chat widget."
        checked={Boolean(settings.showCloseButton)}
        onChange={(v) => patch({ showCloseButton: v })}
      />
      <ToggleRow
        label="Allow restart"
        hint="Show a restart button so users can start the flow from the beginning."
        checked={Boolean(settings.allowRestart)}
        onChange={(v) => patch({ allowRestart: v })}
      />
      <ToggleRow
        label="Hide query string on share"
        hint="Strip UTM and other query parameters from the share URL."
        checked={Boolean(settings.hideQueryString)}
        onChange={(v) => patch({ hideQueryString: v })}
      />
      <ToggleRow
        label="Close on Escape key"
        hint="Allow pressing Escape to dismiss the chat widget."
        checked={Boolean(settings.closeOnEscapeKey)}
        onChange={(v) => patch({ closeOnEscapeKey: v })}
      />
    </Section>
  );
}

/* ── Metadata (SEO) ──────────────────────────────────────── */

function MetadataSection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  return (
    <Section title="Metadata (SEO)" defaultOpen={false}>
      <div className="flex items-start gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
        <LuInfo className="h-3.5 w-3.5 text-[var(--gray-8)] shrink-0 mt-px" strokeWidth={2} />
        <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
          These fields apply to the full-page embed only (when the flow is opened at its public URL).
        </p>
      </div>

      <Field label="Custom title" hint="Shown in the browser tab and used as og:title.">
        <input
          type="text"
          className={inputCls}
          value={String(settings.seoTitle ?? '')}
          onChange={(e) => patch({ seoTitle: e.target.value })}
          placeholder="My Awesome Flow"
        />
      </Field>

      <Field label="Custom description" hint="Used as the meta description and og:description.">
        <textarea
          className={cn(inputCls, 'min-h-[72px] resize-y')}
          value={String(settings.seoDescription ?? '')}
          onChange={(e) => patch({ seoDescription: e.target.value })}
          placeholder="A short description for search engines and social cards."
        />
      </Field>

      <Field label="Favicon URL" hint="Absolute URL to a .ico, .png, or .svg file.">
        <input
          type="url"
          className={inputCls}
          value={String(settings.faviconUrl ?? '')}
          onChange={(e) => patch({ faviconUrl: e.target.value })}
          placeholder="https://example.com/favicon.ico"
        />
      </Field>

      <Field label="Social preview image URL" hint="Displayed when the flow URL is shared on social media (og:image).">
        <input
          type="url"
          className={inputCls}
          value={String(settings.ogImageUrl ?? '')}
          onChange={(e) => patch({ ogImageUrl: e.target.value })}
          placeholder="https://example.com/preview.png"
        />
      </Field>
    </Section>
  );
}

/* ── Custom Domain ───────────────────────────────────────── */

function CustomDomainSection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  return (
    <Section title="Custom Domain" defaultOpen={false}>
      <Field label="Custom domain">
        <input
          type="text"
          className={inputCls}
          value={String(settings.customDomain ?? '')}
          onChange={(e) => patch({ customDomain: e.target.value })}
          placeholder="chat.yoursite.com"
        />
      </Field>

      <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5 space-y-1.5">
        <p className="text-[11.5px] font-medium text-[var(--gray-10)]">DNS configuration</p>
        <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
          Point a{' '}
          <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-11)]">
            CNAME
          </code>{' '}
          record for{' '}
          <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-11)]">
            {String(settings.customDomain || 'chat.yoursite.com')}
          </code>{' '}
          to{' '}
          <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-11)]">
            flow.sabnode.com
          </code>
          .
        </p>
      </div>
    </Section>
  );
}

/* ── Custom CSS ──────────────────────────────────────────── */

function CustomCssSection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  return (
    <Section title="Custom CSS" defaultOpen={false}>
      <div className="flex items-start gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
        <LuCode className="h-3.5 w-3.5 text-[var(--gray-8)] shrink-0 mt-px" strokeWidth={2} />
        <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
          CSS injected into the{' '}
          <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-11)]">
            {'<head>'}
          </code>{' '}
          of the full-page embed. Use with caution.
        </p>
      </div>

      <Field label="Custom CSS">
        <textarea
          className={cn(
            inputCls,
            'min-h-[140px] resize-y font-mono text-[12px] leading-relaxed',
          )}
          value={String(settings.customCss ?? '')}
          onChange={(e) => patch({ customCss: e.target.value })}
          placeholder={'.typebot-button {\n  border-radius: 8px;\n}'}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </Field>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════
   FlowSettingsPanel
   ══════════════════════════════════════════════════════════ */

export function FlowSettingsPanel({ flow, onUpdate, onClose }: Props) {
  return (
    <div className="w-[340px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* ── Panel header ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--gray-3)] text-[var(--gray-9)] shrink-0">
          <LuSettings2 className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">
          Flow settings
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings panel"
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Scrollable body: collapsible sections ─────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <GeneralSection flow={flow} onUpdate={onUpdate} />
        <BehaviourSection flow={flow} onUpdate={onUpdate} />
        <MetadataSection flow={flow} onUpdate={onUpdate} />
        <CustomDomainSection flow={flow} onUpdate={onUpdate} />
        <CustomCssSection flow={flow} onUpdate={onUpdate} />
      </div>

      {/* ── Footer hint ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--gray-4)] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <LuToggleRight className="h-3.5 w-3.5 text-[var(--gray-7)] shrink-0" strokeWidth={1.8} />
          <p className="text-[11px] text-[var(--gray-8)]">
            Changes apply after you{' '}
            <span className="font-medium text-[var(--gray-10)]">Save</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
