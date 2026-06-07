'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from 'lucide-react';

import { Button, IconButton, EmptyState } from '@/components/sabcrm/20ui';

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

/* Shared glass-control styling for the dark, full-screen image viewer. */
const GLASS_CONTROL =
  'text-white bg-transparent hover:bg-white/10 border-transparent';

/**
 * Full-screen image modal with backdrop blur and basic zoom / nav controls.
 *
 * - Escape key closes
 * - Click on backdrop (not on the image) closes
 * - Left/Right arrows navigate between images when more than one supplied
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

  /* Keyboard bindings */
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

  /* Prevent page scroll while open */
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/[0.78] p-4 backdrop-blur-xl"
    >
      {/* Top-right close */}
      <IconButton
        label="Close"
        icon={X}
        onClick={onClose}
        className={`absolute right-4 top-4 ${GLASS_CONTROL}`}
      />

      {/* Previous */}
      {hasMultiple && (
        <IconButton
          label="Previous image"
          icon={ChevronLeft}
          onClick={goPrev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 ${GLASS_CONTROL}`}
        />
      )}

      {/* Next */}
      {hasMultiple && (
        <IconButton
          label="Next image"
          icon={ChevronRight}
          onClick={goNext}
          className={`absolute right-4 top-1/2 -translate-y-1/2 ${GLASS_CONTROL}`}
        />
      )}

      {/* Image (or error placeholder) */}
      <div
        className="flex max-h-full max-w-full items-center justify-center overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {imgError ? (
          <div className="rounded-xl bg-white/[0.06] px-6 py-8 text-white">
            <EmptyState
              icon={ImageOff}
              title="Image failed to load"
              description="The file could not be displayed. It may have moved or been removed."
            />
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
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/[0.08] px-2 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          label="Zoom out"
          icon={ZoomOut}
          size="sm"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className={GLASS_CONTROL}
        />
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Maximize}
          onClick={zoomFit}
          aria-label="Reset zoom"
          className={GLASS_CONTROL}
        >
          {Math.round(zoom * 100)}%
        </Button>
        <IconButton
          label="Zoom in"
          icon={ZoomIn}
          size="sm"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className={GLASS_CONTROL}
        />
        {hasMultiple && (
          <div className="ml-1 border-l border-white/20 pl-2 text-[11px] text-white/70">
            {index + 1} / {safeImages.length}
          </div>
        )}
      </div>
    </div>
  );
}
