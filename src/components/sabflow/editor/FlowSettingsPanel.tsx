'use client';

import { useState, useCallback } from 'react';
import type { SabFlowDoc, SabFlowTheme } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuSettings,
  LuX,
  LuLink,
  LuCopy,
  LuCheck,
  LuPalette,
  LuFileText,
  LuGlobe,
  LuAlignLeft,
  LuInfo,
} from 'react-icons/lu';

/* ── Types ──────────────────────────────────────────────── */

interface Props {
  flow: Pick<SabFlowDoc, '_id' | 'name' | 'settings' | 'theme' | 'publicId' | 'status'> & { _id: string };
  onUpdate: (changes: Partial<Pick<SabFlowDoc, 'name' | 'settings' | 'theme'>>) => void;
  onClose: () => void;
}

type TabId = 'general' | 'theme' | 'metadata';

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'general',  label: 'General',  Icon: LuFileText  },
  { id: 'theme',    label: 'Theme',    Icon: LuPalette   },
  { id: 'metadata', label: 'Metadata', Icon: LuInfo      },
];

/* ── Small form primitives ──────────────────────────────── */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--gray-9)]">{hint}</p>}
    </div>
  );
}

const inputCls = cn(
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
  'px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
  'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
);

/* ── Colour swatch picker ───────────────────────────────── */

const PALETTE = [
  '#ffffff', '#f5f5f5', '#f0f4ff', '#fff9f0',
  '#1a1a1a', '#0f172a', '#1e3a5f', '#3f1f00',
  '#f76808', '#0090ff', '#30a46c', '#e5484d',
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              'h-6 w-6 rounded-md border-2 transition-transform hover:scale-110',
              value === c
                ? 'border-[#f76808] scale-110'
                : 'border-transparent hover:border-[var(--gray-7)]',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Custom hex input */}
        <div className="relative flex items-center">
          <span
            className="h-6 w-6 rounded-md border border-[var(--gray-5)] shrink-0"
            style={{ backgroundColor: value }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#hex"
            maxLength={7}
            className={cn(
              'ml-1.5 w-[72px] rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)]',
              'px-2 py-0.5 text-[11px] font-mono text-[var(--gray-12)]',
              'outline-none focus:border-[#f76808] transition-colors',
            )}
          />
        </div>
      </div>
    </Field>
  );
}

/* ── Copy-to-clipboard helper ───────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
    >
      {copied
        ? <LuCheck className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />
        : <LuCopy className="h-3.5 w-3.5" strokeWidth={2} />}
    </button>
  );
}

/* ── Tab: General ───────────────────────────────────────── */

function GeneralTab({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = flow.publicId ? `${baseUrl}/flow/${flow.publicId}` : '';
  const webhookUrl = `${baseUrl}/api/sabflow/session`;

  return (
    <div className="space-y-5">
      <Field label="Flow name">
        <input
          type="text"
          className={inputCls}
          value={flow.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="My flow"
        />
      </Field>

      <Field
        label="Description"
        hint="Internal note — not shown to users."
      >
        <textarea
          className={cn(inputCls, 'min-h-[72px] resize-y')}
          value={String(flow.settings?.description ?? '')}
          onChange={(e) =>
            onUpdate({ settings: { ...flow.settings, description: e.target.value } })
          }
          placeholder="What does this flow do?"
        />
      </Field>

      {/* Public URL */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
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

      {/* Webhook endpoint */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          <LuLink className="h-3 w-3" strokeWidth={2} />
          API / Webhook endpoint
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[12px] font-mono text-[var(--gray-11)] truncate">
            {webhookUrl}
          </div>
          <CopyButton text={webhookUrl} />
        </div>
        <p className="text-[11px] text-[var(--gray-9)]">
          POST{' '}
          <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px]">
            {'{ "flowId": "..." }'}
          </code>{' '}
          to start a new session.
        </p>
      </div>
    </div>
  );
}

/* ── Tab: Theme ─────────────────────────────────────────── */

const FONTS = ['Inter', 'System UI', 'Roboto', 'Open Sans', 'Lato', 'Georgia', 'Courier New'];

function ThemeTab({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  const theme: SabFlowTheme = flow.theme ?? {};

  const setTheme = (partial: SabFlowTheme) => {
    const merged: SabFlowTheme = {
      ...theme,
      general: { ...theme.general, ...partial.general },
      chat: {
        ...theme.chat,
        ...partial.chat,
        hostBubble: { ...theme.chat?.hostBubble, ...partial.chat?.hostBubble },
        guestBubble: { ...theme.chat?.guestBubble, ...partial.chat?.guestBubble },
        input: { ...theme.chat?.input, ...partial.chat?.input },
      },
    };
    onUpdate({ theme: merged });
  };

  const bgColor = theme.general?.background?.content ?? '#ffffff';
  const font = theme.general?.font ?? 'Inter';
  const hostBg = theme.chat?.hostBubble?.backgroundColor ?? '#f5f5f5';
  const hostText = theme.chat?.hostBubble?.color ?? '#161616';
  const guestBg = theme.chat?.guestBubble?.backgroundColor ?? '#f76808';
  const guestText = theme.chat?.guestBubble?.color ?? '#ffffff';
  const inputBg = theme.chat?.input?.backgroundColor ?? '#ffffff';
  const inputText = theme.chat?.input?.color ?? '#161616';

  return (
    <div className="space-y-5">
      {/* Font */}
      <Field label="Font family">
        <select
          value={font}
          onChange={(e) => setTheme({ general: { font: e.target.value } })}
          className={inputCls}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </Field>

      {/* Background */}
      <ColorField
        label="Chat background"
        value={bgColor}
        onChange={(v) =>
          setTheme({ general: { background: { type: 'Color', content: v } } })
        }
      />

      {/* Host (bot) bubble */}
      <div className="space-y-3 rounded-xl border border-[var(--gray-5)] p-3.5 bg-[var(--gray-2)]">
        <p className="text-[11.5px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
          Bot bubble
        </p>
        <ColorField
          label="Background"
          value={hostBg}
          onChange={(v) => setTheme({ chat: { hostBubble: { backgroundColor: v } } })}
        />
        <ColorField
          label="Text colour"
          value={hostText}
          onChange={(v) => setTheme({ chat: { hostBubble: { color: v } } })}
        />
      </div>

      {/* Guest bubble */}
      <div className="space-y-3 rounded-xl border border-[var(--gray-5)] p-3.5 bg-[var(--gray-2)]">
        <p className="text-[11.5px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
          User bubble
        </p>
        <ColorField
          label="Background"
          value={guestBg}
          onChange={(v) => setTheme({ chat: { guestBubble: { backgroundColor: v } } })}
        />
        <ColorField
          label="Text colour"
          value={guestText}
          onChange={(v) => setTheme({ chat: { guestBubble: { color: v } } })}
        />
      </div>

      {/* Input */}
      <div className="space-y-3 rounded-xl border border-[var(--gray-5)] p-3.5 bg-[var(--gray-2)]">
        <p className="text-[11.5px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
          Input field
        </p>
        <ColorField
          label="Background"
          value={inputBg}
          onChange={(v) => setTheme({ chat: { input: { backgroundColor: v } } })}
        />
        <ColorField
          label="Text colour"
          value={inputText}
          onChange={(v) => setTheme({ chat: { input: { color: v } } })}
        />
      </div>
    </div>
  );
}

/* ── Tab: Metadata ──────────────────────────────────────── */

function MetadataTab({ flow, onUpdate }: Pick<Props, 'flow' | 'onUpdate'>) {
  return (
    <div className="space-y-5">
      <Field label="SEO title" hint="Shown in browser tab when flow is embedded as a full page.">
        <input
          type="text"
          className={inputCls}
          value={String(flow.settings?.seoTitle ?? '')}
          onChange={(e) =>
            onUpdate({ settings: { ...flow.settings, seoTitle: e.target.value } })
          }
          placeholder="My Flow"
        />
      </Field>

      <Field label="SEO description">
        <textarea
          className={cn(inputCls, 'min-h-[72px] resize-y')}
          value={String(flow.settings?.seoDescription ?? '')}
          onChange={(e) =>
            onUpdate({ settings: { ...flow.settings, seoDescription: e.target.value } })
          }
          placeholder="A short description for search engines."
        />
      </Field>

      <Field label="OG image URL" hint="Social sharing preview image.">
        <input
          type="url"
          className={inputCls}
          value={String(flow.settings?.ogImageUrl ?? '')}
          onChange={(e) =>
            onUpdate({ settings: { ...flow.settings, ogImageUrl: e.target.value } })
          }
          placeholder="https://example.com/image.png"
        />
      </Field>

      <Field label="Custom head script" hint="Injected into the <head> of the full-page embed only.">
        <textarea
          className={cn(inputCls, 'min-h-[90px] resize-y font-mono text-[12px]')}
          value={String(flow.settings?.customHeadScript ?? '')}
          onChange={(e) =>
            onUpdate({ settings: { ...flow.settings, customHeadScript: e.target.value } })
          }
          placeholder={'<!-- Google Analytics, etc. -->'}
        />
      </Field>
    </div>
  );
}

/* ── FlowSettingsPanel ──────────────────────────────────── */

export function FlowSettingsPanel({ flow, onUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  return (
    <div className="w-[340px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--gray-3)] text-[var(--gray-9)] shrink-0">
          <LuSettings className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Flow settings</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-[var(--gray-4)] px-2 pt-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-medium rounded-t-lg transition-colors',
              activeTab === id
                ? 'text-[#f76808] border-b-2 border-[#f76808] -mb-px bg-[#f76808]/5'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)] hover:bg-[var(--gray-3)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'general'  && <GeneralTab  flow={flow} onUpdate={onUpdate} />}
        {activeTab === 'theme'    && <ThemeTab    flow={flow} onUpdate={onUpdate} />}
        {activeTab === 'metadata' && <MetadataTab flow={flow} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
