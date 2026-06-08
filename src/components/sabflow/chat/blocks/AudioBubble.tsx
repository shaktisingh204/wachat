'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  AudioWaveform,
} from 'lucide-react';
import { Button, IconButton } from '@/components/sabcrm/20ui';

export interface AudioBubbleProps {
  /** Audio file URL. */
  url: string;
  /** Autoplay the audio on mount (muted for browsers that block autoplay). */
  isAutoplayEnabled?: boolean;
  /** Max CSS width. Defaults to `320px`. */
  maxWidth?: string;
  /** Bubble background colour. */
  backgroundColor?: string;
  /** Foreground text / icon colour. */
  color?: string;
  /** Accent colour for the progress bar / play icon. */
  accentColor?: string;
}

/* Constants for the fake waveform (stable between renders). */

const BAR_COUNT = 28;
const BAR_HEIGHTS: number[] = (() => {
  // Deterministic pseudo-random heights so the waveform stays stable between
  // renders without depending on Math.random each mount.
  const out: number[] = [];
  let seed = 7;
  for (let i = 0; i < BAR_COUNT; i += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    out.push(0.35 + r * 0.65); // 0.35..1.0
  }
  return out;
})();

/** Format seconds as `m:ss` / `h:mm:ss`. */
function formatTime(raw: number): string {
  if (!Number.isFinite(raw) || raw < 0) return '0:00';
  const total = Math.floor(raw);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Custom audio bubble with a fake waveform, play/pause, clickable
 * progress bar, volume toggle, and download button.
 */
export function AudioBubble({
  url,
  isAutoplayEnabled = false,
  maxWidth = '320px',
  backgroundColor = 'var(--st-bg-secondary)',
  color = 'var(--st-text)',
  accentColor = 'var(--st-accent)',
}: AudioBubbleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  /* Attach audio listeners. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onLoaded = () => {
      setLoaded(true);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const onTime = () => setCurrent(el.currentTime);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setErrored(true);

    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
    };
  }, [url]);

  /* Autoplay (muted). */
  useEffect(() => {
    if (!isAutoplayEnabled) return;
    const el = audioRef.current;
    if (!el) return;
    el.muted = true;
    setMuted(true);
    void el.play().catch(() => {
      /* Browsers may still block, ignore. */
    });
  }, [isAutoplayEnabled]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || errored) return;
    if (el.paused) {
      void el.play().catch(() => setErrored(true));
    } else {
      el.pause();
    }
  }, [errored]);

  const toggleMute = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  const handleDownload = useCallback(() => {
    if (typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [url]);

  const handleSeek = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const el = audioRef.current;
      if (!bar || !el || !Number.isFinite(duration) || duration <= 0) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (e.clientX - rect.left) / rect.width),
      );
      el.currentTime = ratio * duration;
      setCurrent(el.currentTime);
    },
    [duration],
  );

  const percent = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }, [current, duration]);

  /* Missing URL / load error. */
  if (!url || typeof url !== 'string' || !url.trim() || errored) {
    return (
      <div className="20ui flex justify-start">
        <div
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <AudioWaveform className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>Audio unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="20ui flex justify-start">
      <div
        className="flex w-full flex-col gap-2.5 rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-sm"
        style={{ backgroundColor, color, maxWidth }}
      >
        <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

        <div className="flex items-center gap-2.5">
          {/* Play / Pause */}
          <Button
            onClick={togglePlay}
            aria-label={playing ? 'Pause audio' : 'Play audio'}
            disabled={!loaded}
            loading={!loaded}
            iconLeft={playing ? Pause : Play}
            className="h-9 w-9 shrink-0 rounded-full p-0 text-white"
            style={{ backgroundColor: accentColor }}
          />

          {/* Waveform bars */}
          <div
            className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden"
            aria-hidden="true"
          >
            {BAR_HEIGHTS.map((h, i) => {
              const activeFraction = percent / 100;
              const barPosition = i / BAR_COUNT;
              const isActive = barPosition <= activeFraction;
              return (
                <span
                  key={i}
                  className={`block w-[3px] rounded-full transition-colors bg-[color-mix(in_srgb,currentColor_25%,transparent)]${
                    playing ? ` sabflow-wave sabflow-wave-${i % 4}` : ''
                  }`}
                  style={{
                    height: `${Math.round(h * 100)}%`,
                    backgroundColor: isActive ? accentColor : undefined,
                    animationDelay: playing ? `${i * 40}ms` : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* Volume toggle */}
          <IconButton
            label={muted ? 'Unmute' : 'Mute'}
            icon={muted ? VolumeX : Volume2}
            size="sm"
            onClick={toggleMute}
            className="shrink-0 rounded-full"
          />

          {/* Download */}
          <IconButton
            label="Download audio"
            icon={Download}
            size="sm"
            onClick={handleDownload}
            className="shrink-0 rounded-full"
          />
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] tabular-nums opacity-70">
            {formatTime(current)}
          </span>
          <div
            ref={progressRef}
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            tabIndex={0}
            onClick={handleSeek}
            className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-[color-mix(in_srgb,currentColor_18%,transparent)]"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
              style={{ width: `${percent}%`, backgroundColor: accentColor }}
            />
          </div>
          <span className="font-mono text-[10.5px] tabular-nums opacity-70">
            {formatTime(duration)}
          </span>
        </div>

        {/* Waveform equaliser keyframes, scoped to this component. */}
        <style jsx>{`
          .sabflow-wave {
            animation-duration: 1.1s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
          .sabflow-wave-0 {
            animation-name: sabflow-wave-0;
          }
          .sabflow-wave-1 {
            animation-name: sabflow-wave-1;
          }
          .sabflow-wave-2 {
            animation-name: sabflow-wave-2;
          }
          .sabflow-wave-3 {
            animation-name: sabflow-wave-3;
          }
          @keyframes sabflow-wave-0 {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.55); }
          }
          @keyframes sabflow-wave-1 {
            0%, 100% { transform: scaleY(0.7); }
            50% { transform: scaleY(1); }
          }
          @keyframes sabflow-wave-2 {
            0%, 100% { transform: scaleY(0.85); }
            50% { transform: scaleY(0.4); }
          }
          @keyframes sabflow-wave-3 {
            0%, 100% { transform: scaleY(0.5); }
            50% { transform: scaleY(0.95); }
          }
          @media (prefers-reduced-motion: reduce) {
            .sabflow-wave {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
