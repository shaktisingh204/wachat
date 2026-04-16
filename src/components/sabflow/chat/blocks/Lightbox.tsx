'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  LuX,
  LuZoomIn,
  LuZoomOut,
  LuMaximize,
  LuChevronLeft,
  LuChevronRight,
  LuImageOff,
} from 'react-icons/lu';

export interface LightboxImage {
  url: string;
  alt?: string;
}

export interface LightboxProps {
  /** All images available in the lightbox (for prev/next nav). */
  images: LightboxImage[];
  /** Index of the image currently shown. */
  startIndex?: number;
  /** Called when the user closes the lightbox. */
  onClose: () => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

/**
 * Full-screen image modal with backdrop blur and basic zoom / nav controls.
 *
 * - Escape key closes
 * - Click on backdrop (not on the image) closes
 * - Left/Right arrows navigate between images when >1 supplied
 * - +, -, 0 keys zoom in / out / reset
 */
export function Lightbox({
  images,
  startIndex = 0,
  onClose,
}: LightboxProps) {
  const safeImages = images.filter((img) => img.url);
  const initialIndex = Math.min(
    Math.max(0, startIndex),
    Math.max(0, safeImages.length - 1),
  );

  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);

  const hasMultiple = safeImages.length > 1;
  const current = safeImages[index];

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setZoom(1);
    setImgError(false);
    setIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
  }, [hasMultiple, safeImages.length]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setZoom(1);
    setImgError(false);
    setIndex((i) => (i + 1) % safeImages.length);
  }, [hasMultiple, safeImages.length]);

  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))),
    [],
  );
  const zoomFit = useCallback(() => setZoom(1), []);

  /* ── Keyboard bindings ───────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        zoomFit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, zoomFit]);

  /* ── Prevent page scroll while open ─────────────────────────────── */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const backdropRef = useRef<HTMLDivElement>(null);
  const handleBackdropClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!current) {
    // Nothing to show.
    return null;
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt ?? 'Image preview'}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Top-right close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <LuX className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Previous */}
      {hasMultiple && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <LuChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
      )}

      {/* Next */}
      {hasMultiple && (
        <button
          type="button"
          onClick={goNext}
          aria-label="Next image"
          className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <LuChevronRight className="h-6 w-6" strokeWidth={2} />
        </button>
      )}

      {/* Image (or error placeholder) */}
      <div
        className="flex max-h-full max-w-full items-center justify-center overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {imgError ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl px-6 py-8 text-white/80"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <LuImageOff className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-[13px]">Image failed to load.</p>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.url}
            alt={current.alt ?? 'Image'}
            onError={() => setImgError(true)}
            draggable={false}
            className="max-h-[90vh] max-w-[90vw] select-none rounded-xl shadow-2xl transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          />
        )}
      </div>

      {/* Bottom toolbar */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2 py-1.5"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <LuZoomOut className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={zoomFit}
          aria-label="Reset zoom"
          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <LuMaximize className="h-3.5 w-3.5" strokeWidth={2} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <LuZoomIn className="h-4 w-4" strokeWidth={2} />
        </button>
        {hasMultiple && (
          <div className="ml-1 pl-2 text-[11px] text-white/70 border-l border-white/20">
            {index + 1} / {safeImages.length}
          </div>
        )}
      </div>
    </div>
  );
}
