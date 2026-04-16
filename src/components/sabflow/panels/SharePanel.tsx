'use client';

import { useState, useCallback } from 'react';
import {
  LuCopy,
  LuCheck,
  LuLink,
  LuCode,
  LuShare2,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Props ───────────────────────────────────────────────── */

export interface SharePanelProps {
  flowId: string;
  flowName: string;
  /** Fully-qualified public chat URL, e.g. https://app.example.com/flow/abc123 */
  shareUrl: string;
  /** Whether the public link is currently enabled */
  isPublicLinkEnabled: boolean;
  /** Called when the user toggles the public link switch */
  onPublicLinkToggle: (enabled: boolean) => void;
}

/* ── Embed tab type ──────────────────────────────────────── */

type EmbedTab = 'standard' | 'popup' | 'bubble';

/* ── Helpers ─────────────────────────────────────────────── */

const ACCENT = '#f76808';

function buildStandardSnippet(shareUrl: string): string {
  return `<script type="module" src="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/embed/sabflow.js"></script>

<sabflow-standard
  flow-url="${shareUrl}"
  style="width: 100%; height: 600px;"
></sabflow-standard>`;
}

function buildPopupSnippet(shareUrl: string): string {
  return `<script type="module" src="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/embed/sabflow.js"></script>

<sabflow-popup
  flow-url="${shareUrl}"
  button-label="Chat with us"
  button-color="${ACCENT}"
></sabflow-popup>`;
}

function buildBubbleSnippet(shareUrl: string): string {
  return `<script type="module" src="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/embed/sabflow.js"></script>

<sabflow-bubble
  flow-url="${shareUrl}"
  button-color="${ACCENT}"
  position="right"
></sabflow-bubble>`;
}

/* ── CopyButton ──────────────────────────────────────────── */

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors shrink-0',
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
          : 'bg-[var(--gray-3)] text-[var(--gray-11)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]',
        className,
      )}
    >
      {copied ? (
        <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <LuCopy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ── ToggleSwitch ────────────────────────────────────────── */

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-[var(--gray-12)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
          checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
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

/* ── CodeSnippet ─────────────────────────────────────────── */

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className="relative rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--gray-4)] bg-[var(--gray-3)]">
        <span className="text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
          HTML
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] font-mono leading-relaxed text-[var(--gray-11)] whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

/* ── EmbedTabs ───────────────────────────────────────────── */

const TAB_CONFIG: { id: EmbedTab; label: string; description: string }[] = [
  {
    id: 'standard',
    label: 'Standard',
    description:
      'Embed the chat flow inline on your page. Ideal for dedicated chat pages or embedded sections. Renders as a full-height container.',
  },
  {
    id: 'popup',
    label: 'Popup',
    description:
      'Adds a button to your page that opens the flow in a centred modal dialog. Great for contextual help or lead capture without disrupting the page layout.',
  },
  {
    id: 'bubble',
    label: 'Bubble',
    description:
      'Renders a floating action button (bottom-right by default) that slides open the chat. Perfect for site-wide support or onboarding assistants.',
  },
];

function EmbedTabs({ shareUrl }: { shareUrl: string }) {
  const [activeTab, setActiveTab] = useState<EmbedTab>('standard');

  const snippetMap: Record<EmbedTab, string> = {
    standard: buildStandardSnippet(shareUrl),
    popup: buildPopupSnippet(shareUrl),
    bubble: buildBubbleSnippet(shareUrl),
  };

  const activeConfig = TAB_CONFIG.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-[var(--gray-3)] p-1">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[12.5px] font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white text-[var(--gray-12)] shadow-sm dark:bg-[var(--gray-2)]'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-11)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-[12.5px] text-[var(--gray-10)] leading-relaxed">
        {activeConfig.description}
      </p>

      {/* Code snippet */}
      <CodeSnippet code={snippetMap[activeTab]} />
    </div>
  );
}

/* ── SharePanel ──────────────────────────────────────────── */

export function SharePanel({
  flowId: _flowId,
  flowName,
  shareUrl,
  isPublicLinkEnabled,
  onPublicLinkToggle,
}: SharePanelProps) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">

      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <LuShare2 className="h-5 w-5" strokeWidth={1.8} style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-[var(--gray-12)]">Share</h1>
          <p className="text-[12.5px] text-[var(--gray-10)]">{flowName}</p>
        </div>
      </div>

      {/* ── Public link ──────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 bg-[var(--gray-2)]">
          <LuLink className="h-4 w-4 text-[var(--gray-9)] shrink-0" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
            Public link
          </span>
        </div>

        <div className="px-4 py-4 space-y-3">
          <ToggleSwitch
            checked={isPublicLinkEnabled}
            onChange={onPublicLinkToggle}
            label="Public link enabled"
          />

          {isPublicLinkEnabled && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2">
              <input
                readOnly
                value={shareUrl}
                aria-label="Public share URL"
                className="flex-1 bg-transparent text-[12.5px] font-mono text-[var(--gray-11)] outline-none truncate"
              />
              <CopyButton text={shareUrl} />
            </div>
          )}

          <p className="text-[12px] text-[var(--gray-9)] leading-relaxed">
            {isPublicLinkEnabled
              ? 'Anyone with this link can view and interact with your flow.'
              : 'Enable the public link to share this flow with others via a direct URL.'}
          </p>
        </div>
      </section>

      {/* ── Embed ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 bg-[var(--gray-2)]">
          <LuCode className="h-4 w-4 text-[var(--gray-9)] shrink-0" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
            Embed
          </span>
        </div>

        <div className="px-4 py-4">
          <p className="text-[12.5px] text-[var(--gray-10)] mb-4 leading-relaxed">
            Paste one of the snippets below into your website&apos;s HTML to embed this flow.
            The web component script is loaded once; you can use multiple components on the same page.
          </p>
          <EmbedTabs shareUrl={shareUrl} />
        </div>
      </section>
    </div>
  );
}
