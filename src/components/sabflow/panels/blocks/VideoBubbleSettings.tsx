'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Video, Link as LinkIcon, ExternalLink, Upload } from 'lucide-react';
import {
  Badge,
  Callout,
  Field,
  Input,
  SegmentedControl,
  type BadgeTone,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';
import { FileUploadInput } from './shared/FileUploadInput';

/* ── Provider detection ─────────────────────────────────────── */
type VideoProvider = 'youtube' | 'vimeo' | 'direct' | 'variable' | 'unknown';

type ParsedVideo = {
  provider: VideoProvider;
  embedUrl: string | null;
  /** Extracted video ID if applicable */
  videoId: string | null;
};

function parseVideoUrl(raw: string): ParsedVideo {
  const url = raw.trim();

  if (!url) return { provider: 'unknown', embedUrl: null, videoId: null };

  // Variable reference
  if (/^{{.*}}$/.test(url)) {
    return { provider: 'variable', embedUrl: null, videoId: null };
  }

  // YouTube
  const ytMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ??
    url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      videoId,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      videoId,
    };
  }

  // Direct video URL (mp4, webm, ogg, mov)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.startsWith('blob:')) {
    return { provider: 'direct', embedUrl: url, videoId: null };
  }

  return { provider: 'unknown', embedUrl: null, videoId: null };
}

/* ── Provider badge ─────────────────────────────────────────── */
const providerLabels: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  direct: 'Direct URL',
  variable: 'Variable',
  unknown: 'Unknown',
};

const providerTones: Record<VideoProvider, BadgeTone> = {
  youtube: 'neutral',
  vimeo: 'neutral',
  direct: 'neutral',
  variable: 'accent',
  unknown: 'neutral',
};

function ProviderBadge({ provider }: { provider: VideoProvider }) {
  if (provider === 'unknown') return null;
  return <Badge tone={providerTones[provider]}>{providerLabels[provider]}</Badge>;
}

/* ── Video preview ──────────────────────────────────────────── */
function VideoPreview({ parsed }: { parsed: ParsedVideo }) {
  if (!parsed.embedUrl) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
      {parsed.provider === 'direct' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={parsed.embedUrl}
          src={parsed.embedUrl}
          controls
          className="absolute inset-0 h-full w-full rounded-[var(--st-radius)] object-cover"
        />
      ) : (
        <iframe
          key={parsed.embedUrl}
          src={parsed.embedUrl}
          title="Video preview"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="pointer-events-none absolute inset-0 h-full w-full rounded-[var(--st-radius)]"
        />
      )}
    </div>
  );
}

/* ── Tab switcher ───────────────────────────────────────────── */
type Tab = 'upload' | 'url';

const TAB_ITEMS: ReadonlyArray<SegmentedItem<Tab>> = [
  { value: 'upload', label: 'Upload', icon: Upload },
  { value: 'url', label: 'URL', icon: LinkIcon },
];

/* ── Main component ─────────────────────────────────────────── */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  workspaceId?: string;
  flowId?: string;
  className?: string;
};

export function VideoBubbleSettings({
  block,
  onBlockChange,
  workspaceId,
  flowId,
  className,
}: Props) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');

  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  const [tab, setTab] = useState<Tab>(
    !url && workspaceId ? 'upload' : url.startsWith('/uploads/') ? 'upload' : 'url',
  );

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onBlockChange({ ...block, options: { ...options, ...patch } });
    },
    [block, options, onBlockChange],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
          <Video className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Video Bubble
        </span>
      </div>

      {/* Preview */}
      {tab === 'url' && <VideoPreview parsed={parsed} />}

      {/* Tabs */}
      {workspaceId && (
        <SegmentedControl
          items={TAB_ITEMS}
          value={tab}
          onChange={setTab}
          fullWidth
          aria-label="Video source"
        />
      )}

      {tab === 'upload' && workspaceId ? (
        <FileUploadInput
          label="Video file"
          value={url}
          onChange={(u) => update({ url: u })}
          accept="video/*"
          flowId={flowId}
          workspaceId={workspaceId}
        />
      ) : (
        <>
          {/* URL input */}
          <Field label="Video URL">
            <Input
              type="url"
              value={url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="YouTube, Vimeo, or direct .mp4 URL"
              iconLeft={LinkIcon}
            />

            {/* Provider badge row */}
            {url && (
              <div className="flex items-center gap-2">
                <ProviderBadge provider={parsed.provider} />
                {parsed.provider === 'unknown' && (
                  <span className="text-[11px] text-[var(--st-text-tertiary)]">
                    Paste a YouTube, Vimeo, or direct video URL
                  </span>
                )}
              </div>
            )}
          </Field>

          {/* Hint */}
          <Callout icon={ExternalLink} tone="neutral">
            Supports <strong>YouTube</strong>, <strong>Vimeo</strong>, direct{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono">.mp4</code> URLs,
            or{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-accent)]">
              {'{{variable}}'}
            </code>
          </Callout>
        </>
      )}
    </div>
  );
}
