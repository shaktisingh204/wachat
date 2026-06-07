'use client';

import { useState, useCallback } from 'react';
import {
  Copy,
  Check,
  Link2,
  Code2,
  ExternalLink,
  Share2,
  QrCode,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Badge,
  Alert,
  SegmentedControl,
  ColorPicker,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

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
  return `<!-- SabFlow Standard embed (inline iframe) -->
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
  return `<!-- SabFlow Popup embed (button opens a centred modal) -->
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
  return `<!-- SabFlow Bubble embed (floating chat button) -->
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

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [text, toast]);

  return (
    <Button
      variant={copied ? 'secondary' : 'ghost'}
      size="sm"
      onClick={handleCopy}
      iconLeft={copied ? Check : Copy}
      className={className}
    >
      {copied ? 'Copied' : label}
    </Button>
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
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="flex items-center gap-2.5">
        <span className="text-[var(--st-text-tertiary)] shrink-0" aria-hidden="true">
          {icon}
        </span>
        <CardTitle className="text-[13px] uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/* ── ShareLinkSection ────────────────────────────────────── */

function ShareLinkSection({ shareUrl }: { shareUrl: string }) {
  const openInNewTab = useCallback(() => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }, [shareUrl]);

  return (
    <SectionCard
      icon={<Link2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
      title="Share link"
    >
      <div className="space-y-3">
        {/* URL row */}
        <div className="flex items-center gap-2">
          <Field className="flex-1">
            <Input
              readOnly
              value={shareUrl}
              aria-label="Direct share URL"
              className="font-mono"
            />
          </Field>
          <CopyButton text={shareUrl} />
          <IconButton
            label="Open flow in new tab"
            icon={ExternalLink}
            variant="ghost"
            onClick={openInNewTab}
            className="shrink-0"
          />
        </div>

        {/* QR code placeholder */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-6">
          <QrCode className="h-8 w-8 text-[var(--st-text-tertiary)]" strokeWidth={1.4} aria-hidden="true" />
          <p className="text-[12px] text-[var(--st-text-secondary)] text-center leading-relaxed">
            QR code will appear here
          </p>
          <p className="text-[11px] text-[var(--st-text-tertiary)] font-mono break-all text-center max-w-xs">
            {shareUrl}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── EmbedCustomization ──────────────────────────────────── */

function StandardCustomization({
  opts,
  onChange,
}: {
  opts: StandardOpts;
  onChange: (patch: Partial<StandardOpts>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Height (px)">
        <Input
          type="number"
          min={200}
          max={1200}
          value={opts.height}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
        />
      </Field>
      <Field label="Border radius (px)">
        <Input
          type="number"
          min={0}
          max={32}
          value={opts.borderRadius}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
        />
      </Field>
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
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Button label">
        <Input
          type="text"
          value={opts.buttonLabel}
          onChange={(e) => onChange({ buttonLabel: e.target.value })}
          placeholder="Open chat"
        />
      </Field>
      <Field label="Button color">
        <div className="flex items-center gap-2">
          <ColorPicker
            value={opts.buttonColor}
            onChange={(color) => onChange({ buttonColor: color })}
            aria-label="Button color picker"
          />
          <span className="text-[12px] font-mono text-[var(--st-text-secondary)]">
            {opts.buttonColor}
          </span>
        </div>
      </Field>
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
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Button text">
        <Input
          type="text"
          value={opts.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          placeholder="Chat with us"
        />
      </Field>
      <Field label="Position">
        <Select
          value={opts.position}
          onValueChange={(value) =>
            onChange({ position: value as BubbleOpts['position'] })
          }
        >
          <SelectTrigger aria-label="Bubble position">
            <SelectValue placeholder="Pick a position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom right</SelectItem>
            <SelectItem value="bottom-left">Bottom left</SelectItem>
          </SelectContent>
        </Select>
      </Field>
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
      icon={<Code2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
      title="Embed on your site"
    >
      <div className="space-y-4">
        <p className="text-[12.5px] text-[var(--st-text-secondary)] leading-relaxed">
          Paste one of the snippets below into your website&apos;s HTML to embed this flow.
        </p>

        {/* Tab bar */}
        <SegmentedControl
          fullWidth
          aria-label="Embed mode"
          value={activeTab}
          onChange={(value) => setActiveTab(value as EmbedMode)}
          items={TAB_CONFIG.map((tab) => ({ value: tab.id, label: tab.label }))}
        />

        {/* Mode description */}
        <p className="text-[12px] text-[var(--st-text-secondary)] leading-relaxed">
          {activeDesc}
        </p>

        {/* Customization controls */}
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)] mb-3">
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
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
            <span className="text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
              HTML
            </span>
            <CopyButton text={snippet} label="Copy code" />
          </div>
          <pre className="overflow-x-auto p-4 text-[12px] font-mono leading-relaxed text-[var(--st-text-secondary)] whitespace-pre">
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
      icon={<Globe className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />}
      title="Publish status"
    >
      <div className="space-y-3">
        {/* Status badge + toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone={isPublished ? 'success' : 'neutral'} dot>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>

            {status === 'DRAFT' && (
              <span className="flex items-center gap-1 text-[11.5px] text-[var(--st-warn)]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Not publicly visible
              </span>
            )}
          </div>

          <Button
            variant={isPublished ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleToggle}
            loading={loading}
            className="shrink-0"
          >
            {isPublished ? 'Unpublish' : 'Publish'}
          </Button>
        </div>

        {/* Description */}
        <p className="text-[12px] text-[var(--st-text-secondary)] leading-relaxed">
          {isPublished
            ? 'This flow is live. Anyone with the link can view and interact with it.'
            : 'Publish this flow to make it accessible via the share link and embed code.'}
        </p>

        {/* Error */}
        {error && (
          <Alert tone="danger" icon={AlertTriangle}>
            {error}
          </Alert>
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
      <PageHeader bordered={false} compact>
        <PageHeaderHeading className="flex flex-row items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] shrink-0 bg-[var(--st-accent)]/10 text-[var(--st-accent)]"
            aria-hidden="true"
          >
            <Share2 className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className="flex flex-col">
            <PageTitle className="text-[16px]">Share</PageTitle>
            <PageDescription>{flowName}</PageDescription>
          </span>
        </PageHeaderHeading>
      </PageHeader>

      <ShareLinkSection shareUrl={shareUrl} />
      <EmbedSection shareUrl={shareUrl} />
      <PublishSection initialStatus={initialStatus} onPublishToggle={onPublishToggle} />
    </div>
  );
}
