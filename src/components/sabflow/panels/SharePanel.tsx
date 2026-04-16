'use client';

import { useState, useCallback, useId } from 'react';
import {
  LuCopy,
  LuCheck,
  LuLink,
  LuCode,
  LuExternalLink,
  LuShare2,
  LuQrCode,
  LuGlobe,
  LuTriangleAlert as LuAlertTriangle,
  LuLoader,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Constants ───────────────────────────────────────────── */

const ACCENT = '#f76808';

/* ── Types ───────────────────────────────────────────────── */

export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SharePanelProps {
  flowId: string;
  flowName: string;
  /** Fully-qualified public chat URL e.g. https://app.example.com/flow/abc123 */
  shareUrl: string;
  /** Current publish status */
  initialStatus: FlowStatus;
  /** Called when user toggles publish; resolves to new status or throws */
  onPublishToggle: () => Promise<FlowStatus>;
}

type EmbedMode = 'standard' | 'popup' | 'bubble';

/* ── Embed customisation state ───────────────────────────── */

interface StandardOpts {
  height: number;
  borderRadius: number;
}

interface PopupOpts {
  buttonLabel: string;
  buttonColor: string;
}

interface BubbleOpts {
  buttonText: string;
  position: 'bottom-right' | 'bottom-left';
}

/* ── Snippet builders ────────────────────────────────────── */

/** Derive the app origin + flow id from the public share URL. */
function parseShareUrl(shareUrl: string): { origin: string; flowId: string } {
  try {
    const url = new URL(shareUrl);
    const flowId = url.pathname.split('/').filter(Boolean).pop() ?? '';
    return { origin: url.origin, flowId };
  } catch {
    // Fallback for SSR / malformed URL
    const flowId = shareUrl.split('/').filter(Boolean).pop() ?? '';
    return { origin: '', flowId };
  }
}

function buildStandardSnippet(shareUrl: string, opts: StandardOpts): string {
  const { origin, flowId } = parseShareUrl(shareUrl);
  // Two options shown: direct iframe, or data-* standard mode via embed.js
  return `<!-- SabFlow — Standard embed (inline iframe) -->
<div id="sabflow-container" style="width:100%;height:${opts.height}px;border-radius:${opts.borderRadius}px;overflow:hidden;"></div>
<script
  src="${origin}/embed.js"
  data-flow-id="${flowId}"
  data-mode="standard"
  data-container="#sabflow-container"
  data-height="${opts.height}px"
  data-border-radius="${opts.borderRadius}"
></script>`;
}

function buildPopupSnippet(shareUrl: string, opts: PopupOpts): string {
  const { origin, flowId } = parseShareUrl(shareUrl);
  return `<!-- SabFlow — Popup embed (button opens a centred modal) -->
<script
  src="${origin}/embed.js"
  data-flow-id="${flowId}"
  data-mode="popup"
  data-button-label="${opts.buttonLabel}"
  data-button-color="${opts.buttonColor}"
></script>`;
}

function buildBubbleSnippet(shareUrl: string, opts: BubbleOpts): string {
  const { origin, flowId } = parseShareUrl(shareUrl);
  return `<!-- SabFlow — Bubble embed (floating chat button) -->
<script
  src="${origin}/embed.js"
  data-flow-id="${flowId}"
  data-mode="bubble"
  data-button-text="${opts.buttonText}"
  data-button-color="${ACCENT}"
  data-button-position="${opts.position}"
></script>`;
}

/* ── CopyButton ──────────────────────────────────────────── */

function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
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
      {copied ? 'Copied!' : label}
    </button>
  );
}

/* ── SectionCard ─────────────────────────────────────────── */

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 bg-[var(--gray-2)]">
        <span className="text-[var(--gray-9)] shrink-0">{icon}</span>
        <span className="text-[13px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

/* ── ShareLinkSection ────────────────────────────────────── */

function ShareLinkSection({ shareUrl }: { shareUrl: string }) {
  return (
    <SectionCard
      icon={<LuLink className="h-4 w-4" strokeWidth={1.8} />}
      title="Share link"
    >
      <div className="space-y-3">
        {/* URL row */}
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2">
          <input
            readOnly
            value={shareUrl}
            aria-label="Direct share URL"
            className="flex-1 bg-transparent text-[12.5px] font-mono text-[var(--gray-11)] outline-none truncate"
          />
          <CopyButton text={shareUrl} />
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            aria-label="Open flow in new tab"
            className="flex items-center justify-center rounded-lg p-1.5 text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)] transition-colors shrink-0"
          >
            <LuExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>

        {/* QR code placeholder */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] px-4 py-6">
          <LuQrCode className="h-8 w-8 text-[var(--gray-7)]" strokeWidth={1.4} />
          <p className="text-[12px] text-[var(--gray-9)] text-center leading-relaxed">
            QR code will appear here
          </p>
          <p className="text-[11px] text-[var(--gray-7)] font-mono break-all text-center max-w-xs">
            {shareUrl}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── EmbedCustomization ──────────────────────────────────── */

function LabeledField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-[11.5px] font-medium text-[var(--gray-10)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12.5px] text-[var(--gray-12)] outline-none focus:border-[var(--gray-8)] focus:ring-1 focus:ring-[var(--gray-6)] transition-colors w-full';

function StandardCustomization({
  opts,
  onChange,
}: {
  opts: StandardOpts;
  onChange: (patch: Partial<StandardOpts>) => void;
}) {
  const heightId = useId();
  const radiusId = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledField label="Height (px)" htmlFor={heightId}>
        <input
          id={heightId}
          type="number"
          min={200}
          max={1200}
          value={opts.height}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
          className={inputCls}
        />
      </LabeledField>
      <LabeledField label="Border radius (px)" htmlFor={radiusId}>
        <input
          id={radiusId}
          type="number"
          min={0}
          max={32}
          value={opts.borderRadius}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className={inputCls}
        />
      </LabeledField>
    </div>
  );
}

function PopupCustomization({
  opts,
  onChange,
}: {
  opts: PopupOpts;
  onChange: (patch: Partial<PopupOpts>) => void;
}) {
  const labelId = useId();
  const colorId = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledField label="Button label" htmlFor={labelId}>
        <input
          id={labelId}
          type="text"
          value={opts.buttonLabel}
          onChange={(e) => onChange({ buttonLabel: e.target.value })}
          placeholder="Open chat"
          className={inputCls}
        />
      </LabeledField>
      <LabeledField label="Button color" htmlFor={colorId}>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1 h-[34px]">
          <input
            id={colorId}
            type="color"
            value={opts.buttonColor}
            onChange={(e) => onChange({ buttonColor: e.target.value })}
            aria-label="Button color picker"
            className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="text-[12px] font-mono text-[var(--gray-11)]">
            {opts.buttonColor}
          </span>
        </div>
      </LabeledField>
    </div>
  );
}

function BubbleCustomization({
  opts,
  onChange,
}: {
  opts: BubbleOpts;
  onChange: (patch: Partial<BubbleOpts>) => void;
}) {
  const textId = useId();
  const posId = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <LabeledField label="Button text" htmlFor={textId}>
        <input
          id={textId}
          type="text"
          value={opts.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder="Chat with us"
          className={inputCls}
        />
      </LabeledField>
      <LabeledField label="Position" htmlFor={posId}>
        <select
          id={posId}
          value={opts.position}
          onChange={(e) =>
            onChange({ position: e.target.value as BubbleOpts['position'] })
          }
          className={inputCls}
        >
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
        </select>
      </LabeledField>
    </div>
  );
}

/* ── EmbedSection ────────────────────────────────────────── */

const TAB_CONFIG: { id: EmbedMode; label: string; description: string }[] = [
  {
    id: 'standard',
    label: 'Standard',
    description:
      'Embed the chat flow inline with a full-page iframe. Best for dedicated chat pages or embedded sections.',
  },
  {
    id: 'popup',
    label: 'Popup',
    description:
      'A button that opens the flow in a centred modal. Great for contextual help or lead capture without disrupting layout.',
  },
  {
    id: 'bubble',
    label: 'Bubble',
    description:
      'A fixed floating action button that slides open the chat. Perfect for site-wide support or onboarding.',
  },
];

function EmbedSection({ shareUrl }: { shareUrl: string }) {
  const [activeTab, setActiveTab] = useState<EmbedMode>('standard');

  const [standardOpts, setStandardOpts] = useState<StandardOpts>({
    height: 600,
    borderRadius: 8,
  });
  const [popupOpts, setPopupOpts] = useState<PopupOpts>({
    buttonLabel: 'Open chat',
    buttonColor: ACCENT,
  });
  const [bubbleOpts, setBubbleOpts] = useState<BubbleOpts>({
    buttonText: 'Chat with us',
    position: 'bottom-right',
  });

  const snippet =
    activeTab === 'standard'
      ? buildStandardSnippet(shareUrl, standardOpts)
      : activeTab === 'popup'
        ? buildPopupSnippet(shareUrl, popupOpts)
        : buildBubbleSnippet(shareUrl, bubbleOpts);

  const activeDesc = TAB_CONFIG.find((t) => t.id === activeTab)!.description;

  return (
    <SectionCard
      icon={<LuCode className="h-4 w-4" strokeWidth={1.8} />}
      title="Embed on your site"
    >
      <div className="space-y-4">
        <p className="text-[12.5px] text-[var(--gray-10)] leading-relaxed">
          Paste one of the snippets below into your website&apos;s HTML to embed this flow.
        </p>

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

        {/* Mode description */}
        <p className="text-[12px] text-[var(--gray-10)] leading-relaxed">
          {activeDesc}
        </p>

        {/* Customization controls */}
        <div className="rounded-xl border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-8)] mb-3">
            Customise
          </p>
          {activeTab === 'standard' && (
            <StandardCustomization
              opts={standardOpts}
              onChange={(p) => setStandardOpts((prev) => ({ ...prev, ...p }))}
            />
          )}
          {activeTab === 'popup' && (
            <PopupCustomization
              opts={popupOpts}
              onChange={(p) => setPopupOpts((prev) => ({ ...prev, ...p }))}
            />
          )}
          {activeTab === 'bubble' && (
            <BubbleCustomization
              opts={bubbleOpts}
              onChange={(p) => setBubbleOpts((prev) => ({ ...prev, ...p }))}
            />
          )}
        </div>

        {/* Code block */}
        <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--gray-4)] bg-[var(--gray-3)]">
            <span className="text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
              HTML
            </span>
            <CopyButton text={snippet} label="Copy code" />
          </div>
          <pre className="overflow-x-auto p-4 text-[12px] font-mono leading-relaxed text-[var(--gray-11)] whitespace-pre">
            <code>{snippet}</code>
          </pre>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── PublishSection ──────────────────────────────────────── */

function PublishSection({
  initialStatus,
  onPublishToggle,
}: {
  initialStatus: FlowStatus;
  onPublishToggle: () => Promise<FlowStatus>;
}) {
  const [status, setStatus] = useState<FlowStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = status === 'PUBLISHED';

  const handleToggle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await onPublishToggle();
      setStatus(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [onPublishToggle]);

  return (
    <SectionCard
      icon={<LuGlobe className="h-4 w-4" strokeWidth={1.8} />}
      title="Publish status"
    >
      <div className="space-y-3">
        {/* Status badge + toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
                isPublished
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                  : 'bg-[var(--gray-3)] text-[var(--gray-10)]',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isPublished ? 'bg-green-500' : 'bg-[var(--gray-7)]',
                )}
              />
              {isPublished ? 'Published' : 'Draft'}
            </span>

            {status === 'DRAFT' && (
              <span className="flex items-center gap-1 text-[11.5px] text-amber-600 dark:text-amber-400">
                <LuAlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                Not publicly visible
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            style={isPublished ? {} : { backgroundColor: ACCENT }}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors shrink-0 disabled:opacity-60',
              isPublished
                ? 'bg-[var(--gray-3)] text-[var(--gray-11)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]'
                : 'text-white hover:opacity-90',
            )}
          >
            {loading ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : null}
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </div>

        {/* Description */}
        <p className="text-[12px] text-[var(--gray-9)] leading-relaxed">
          {isPublished
            ? 'This flow is live. Anyone with the link can view and interact with it.'
            : 'Publish this flow to make it accessible via the share link and embed code.'}
        </p>

        {/* Error */}
        {error && (
          <p className="flex items-center gap-1.5 text-[12px] text-red-600 dark:text-red-400">
            <LuAlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

/* ── SharePanel ──────────────────────────────────────────── */

export function SharePanel({
  flowId: _flowId,
  flowName,
  shareUrl,
  initialStatus,
  onPublishToggle,
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

      <ShareLinkSection shareUrl={shareUrl} />
      <EmbedSection shareUrl={shareUrl} />
      <PublishSection initialStatus={initialStatus} onPublishToggle={onPublishToggle} />
    </div>
  );
}
