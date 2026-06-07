'use client';

/**
 * FlowSettingsPanel
 *
 * Right-side sliding panel for per-flow configuration.
 * Sections: General, Behaviour, Concurrency, Metadata, Custom Domain, Custom CSS.
 *
 * Built entirely on the 20ui design system: Collapsible sections, Field-wrapped
 * Input/Textarea/Select controls, Switch toggles and Callout notices. Motion is
 * supplied by 20ui (Collapsible height animation), not hand-rolled. Icons:
 * lucide-react.
 */

import { useState, useCallback } from 'react';
import {
  Settings2,
  X,
  Globe,
  Link as LinkIcon,
  Copy,
  Check,
  Info,
  ToggleRight,
  Code,
} from 'lucide-react';
import type { SabFlowDoc, FlowSettings } from '@/lib/sabflow/types';
import {
  IconButton,
  Field,
  Input,
  Textarea,
  Switch,
  Callout,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';

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
        <p className="text-[12.5px] text-[var(--st-text)]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
            {hint}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        size="sm"
        aria-label={label}
        className="shrink-0"
      />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [text]);

  return (
    <IconButton
      label={copied ? 'Copied' : 'Copy to clipboard'}
      icon={copied ? Check : Copy}
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
    />
  );
}

/* ══════════════════════════════════════════════════════════
   Collapsible Section (20ui Collapsible)
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
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between bg-[var(--st-bg-secondary)] px-4 py-3 text-[12.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-tertiary)]">
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 bg-[var(--st-bg)] px-4 py-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
        <Input
          type="text"
          value={flow.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Onboarding assistant"
        />
      </Field>

      {/* Description */}
      <Field label="Description" help="Internal note, not shown to users.">
        <Textarea
          rows={3}
          className="resize-y"
          value={String(settings.description ?? '')}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What does this flow do?"
        />
      </Field>

      {/* Language */}
      <Field label="Language" help="Primary language for the flow's UI labels.">
        <Select
          value={String(settings.language ?? 'en')}
          onValueChange={(value) => patch({ language: value })}
        >
          <SelectTrigger aria-label="Language">
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Public URL */}
      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
            Public URL
          </span>
        }
      >
        {publicUrl ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-[12px] text-[var(--st-text-secondary)]">
              {publicUrl}
            </div>
            <CopyButton text={publicUrl} />
          </div>
        ) : (
          <Callout tone="neutral" icon={LinkIcon}>
            Publish the flow to get a public URL.
          </Callout>
        )}
      </Field>
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
        hint="Display a dismiss button inside the chat widget."
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

/* ── Concurrency / throttling ────────────────────────────── */

function ConcurrencySection({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const settings = flow.settings ?? {};

  const patch = useCallback(
    (partial: Partial<FlowSettings>) =>
      onUpdate({ settings: { ...settings, ...partial } }),
    [settings, onUpdate],
  );

  const cap = Number(settings.maxConcurrentRuns ?? 0);
  const queueCap = Number(settings.maxQueuedRuns ?? 0);
  const mode = (settings.onConcurrencyExceeded ?? 'queue') as 'queue' | 'reject';
  const enabled = cap > 0;

  return (
    <Section title="Concurrency" defaultOpen={false}>
      <Callout tone="info" icon={Info}>
        Cap how many runs of this flow can execute in parallel. Extra runs either
        queue (FIFO) or get rejected, useful for rate-limited APIs.
      </Callout>

      <Field
        label="Max concurrent runs"
        help="Maximum simultaneous in-flight runs. Set to 0 to disable throttling."
      >
        <Input
          type="number"
          min={0}
          max={500}
          step={1}
          value={cap || ''}
          onChange={(e) =>
            patch({
              maxConcurrentRuns:
                e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          placeholder="0 (no limit)"
        />
      </Field>

      <Field
        label="When the limit is reached"
        help="Queue waits for a free slot. Reject returns an error to the caller immediately."
      >
        <Select
          value={mode}
          disabled={!enabled}
          onValueChange={(value) =>
            patch({ onConcurrencyExceeded: value as 'queue' | 'reject' })
          }
        >
          <SelectTrigger aria-label="When the limit is reached">
            <SelectValue placeholder="Select behaviour" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="queue">Queue (FIFO)</SelectItem>
            <SelectItem value="reject">Reject with 429</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {enabled && mode === 'queue' && (
        <Field
          label="Max queued runs"
          help="Hard cap on the FIFO wait queue. Surplus runs are rejected. Leave blank for unbounded."
        >
          <Input
            type="number"
            min={0}
            max={10000}
            step={1}
            value={queueCap || ''}
            onChange={(e) =>
              patch({
                maxQueuedRuns:
                  e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            placeholder="Unbounded"
          />
        </Field>
      )}
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
      <Callout tone="info" icon={Info}>
        These fields apply to the full-page embed only (when the flow is opened at
        its public URL).
      </Callout>

      <Field label="Custom title" help="Shown in the browser tab and used as og:title.">
        <Input
          type="text"
          value={String(settings.seoTitle ?? '')}
          onChange={(e) => patch({ seoTitle: e.target.value })}
          placeholder="Product onboarding flow"
        />
      </Field>

      <Field
        label="Custom description"
        help="Used as the meta description and og:description."
      >
        <Textarea
          rows={3}
          className="resize-y"
          value={String(settings.seoDescription ?? '')}
          onChange={(e) => patch({ seoDescription: e.target.value })}
          placeholder="A short description for search engines and social cards."
        />
      </Field>

      <Field label="Favicon URL" help="Absolute URL to a .ico, .png, or .svg file.">
        <Input
          type="url"
          value={String(settings.faviconUrl ?? '')}
          onChange={(e) => patch({ faviconUrl: e.target.value })}
          placeholder="https://example.com/favicon.ico"
        />
      </Field>

      <Field
        label="Social preview image URL"
        help="Displayed when the flow URL is shared on social media (og:image)."
      >
        <Input
          type="url"
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
        <Input
          type="text"
          value={String(settings.customDomain ?? '')}
          onChange={(e) => patch({ customDomain: e.target.value })}
          placeholder="chat.yoursite.com"
        />
      </Field>

      <div className="space-y-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
        <p className="text-[11.5px] font-medium text-[var(--st-text)]">
          DNS configuration
        </p>
        <p className="text-[11.5px] leading-relaxed text-[var(--st-text-secondary)]">
          Point a{' '}
          <code className="rounded bg-[var(--st-bg-tertiary)] px-1 font-mono text-[10.5px] text-[var(--st-text)]">
            CNAME
          </code>{' '}
          record for{' '}
          <code className="rounded bg-[var(--st-bg-tertiary)] px-1 font-mono text-[10.5px] text-[var(--st-text)]">
            {String(settings.customDomain || 'chat.yoursite.com')}
          </code>{' '}
          to{' '}
          <code className="rounded bg-[var(--st-bg-tertiary)] px-1 font-mono text-[10.5px] text-[var(--st-text)]">
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
      <Callout tone="warning" icon={Code}>
        CSS injected into the <code>{'<head>'}</code> of the full-page embed. Use
        with caution.
      </Callout>

      <Field label="Custom CSS">
        <Textarea
          rows={6}
          className="resize-y font-mono text-[12px] leading-relaxed"
          value={String(settings.customCss ?? '')}
          onChange={(e) => patch({ customCss: e.target.value })}
          placeholder={'.flow-button {\n  border-radius: 8px;\n}'}
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
    <div className="z-20 flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-[var(--st-border)] bg-[var(--st-bg)]">
      {/* ── Panel header ──────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-tertiary)] text-[var(--st-text-secondary)]">
          <Settings2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">
          Flow settings
        </span>
        <IconButton
          label="Close settings panel"
          icon={X}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </div>

      {/* ── Scrollable body: collapsible sections ─────────── */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <GeneralSection flow={flow} onUpdate={onUpdate} />
        <BehaviourSection flow={flow} onUpdate={onUpdate} />
        <ConcurrencySection flow={flow} onUpdate={onUpdate} />
        <MetadataSection flow={flow} onUpdate={onUpdate} />
        <CustomDomainSection flow={flow} onUpdate={onUpdate} />
        <CustomCssSection flow={flow} onUpdate={onUpdate} />
      </div>

      {/* ── Footer hint ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-[var(--st-border)] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <ToggleRight
            className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)]"
            aria-hidden="true"
            strokeWidth={1.8}
          />
          <p className="text-[11px] text-[var(--st-text-tertiary)]">
            Changes apply after you{' '}
            <span className="font-medium text-[var(--st-text-secondary)]">Save</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
