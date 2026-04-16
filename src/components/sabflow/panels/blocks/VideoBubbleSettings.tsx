'use client';
import { useCallback, useMemo } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuVideo, LuLink, LuExternalLink } from 'react-icons/lu';

/* ── Shared primitives ──────────────────────────────────────── */
const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

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

const providerColors: Record<VideoProvider, string> = {
  youtube: 'bg-red-500/10 text-red-400 border-red-500/30',
  vimeo: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  direct: 'bg-green-500/10 text-green-400 border-green-500/30',
  variable: 'bg-[#f76808]/10 text-[#f76808] border-[#f76808]/30',
  unknown: 'bg-[var(--gray-3)] text-[var(--gray-8)] border-[var(--gray-5)]',
};

function ProviderBadge({ provider }: { provider: VideoProvider }) {
  if (provider === 'unknown') return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        providerColors[provider],
      )}
    >
      {providerLabels[provider]}
    </span>
  );
}

/* ── Video preview ──────────────────────────────────────────── */
function VideoPreview({ parsed }: { parsed: ParsedVideo }) {
  if (!parsed.embedUrl) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]" style={{ paddingBottom: '56.25%' }}>
      {parsed.provider === 'direct' ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={parsed.embedUrl}
          src={parsed.embedUrl}
          controls
          className="absolute inset-0 h-full w-full rounded-lg object-cover"
        />
      ) : (
        <iframe
          key={parsed.embedUrl}
          src={parsed.embedUrl}
          title="Video preview"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-lg"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  className?: string;
};

export function VideoBubbleSettings({ block, onBlockChange, className }: Props) {
  const options = block.options ?? {};
  const url = String(options.url ?? '');

  const parsed = useMemo(() => parseVideoUrl(url), [url]);

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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f76808]/10">
          <LuVideo className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
        </div>
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Video Bubble
        </span>
      </div>

      {/* Preview */}
      <VideoPreview parsed={parsed} />

      {/* URL input */}
      <Field label="Video URL">
        <div className="relative flex items-center">
          <LuLink
            className="absolute left-3 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="YouTube, Vimeo, or direct .mp4 URL"
            className={cn(inputClass, 'pl-8')}
          />
        </div>

        {/* Provider badge row */}
        {url && (
          <div className="flex items-center gap-2">
            <ProviderBadge provider={parsed.provider} />
            {parsed.provider === 'unknown' && url && (
              <span className="text-[11px] text-[var(--gray-8)]">
                Paste a YouTube, Vimeo, or direct video URL
              </span>
            )}
          </div>
        )}
      </Field>

      {/* Hint */}
      <div className="rounded-lg border border-dashed border-[var(--gray-6)] p-3 text-[12px] text-[var(--gray-9)] leading-relaxed">
        <div className="flex items-start gap-2">
          <LuExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span>
            Supports <strong>YouTube</strong>, <strong>Vimeo</strong>, direct{' '}
            <code className="font-mono bg-[var(--gray-3)] px-1 rounded">.mp4</code> URLs,
            or{' '}
            <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
              {'{{variable}}'}
            </code>
          </span>
        </div>
      </div>
    </div>
  );
}
