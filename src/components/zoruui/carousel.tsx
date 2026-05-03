"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";

/**
 * Lightweight CSS-snap carousel — zero external dependencies. Each
 * direct child of <ZoruCarouselContent> becomes a snap-aligned slide.
 * For touch swipes the browser's native scroll inertia handles it.
 */
export interface ZoruCarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Slide gap in px. Defaults to 16. */
  gap?: number;
  /** Pixels to scroll per click. Defaults to viewport-width × 0.8. */
  scrollBy?: number;
  /** Show the prev/next arrows overlaid on the rail. Defaults to true. */
  showArrows?: boolean;
}

export function ZoruCarousel({
  gap = 16,
  scrollBy,
  showArrows = true,
  className,
  children,
  ...props
}: ZoruCarouselProps) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(true);

  const update = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 0);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    update();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const amount = scrollBy ?? el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)} {...props}>
      <div
        ref={railRef}
        className="hide-scrollbar flex snap-x snap-mandatory scroll-px-4 overflow-x-auto pb-1"
        style={{ gap: `${gap}px`, scrollbarWidth: "none" }}
      >
        {React.Children.map(children, (child) => (
          <div className="snap-start shrink-0">{child}</div>
        ))}
      </div>
      {showArrows && (
        <>
          <ZoruButton
            variant="outline"
            size="icon-sm"
            aria-label="Previous"
            onClick={() => step(-1)}
            disabled={!canPrev}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-zoru-bg shadow-[var(--zoru-shadow-sm)] disabled:opacity-0"
          >
            <ChevronLeft />
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="icon-sm"
            aria-label="Next"
            onClick={() => step(1)}
            disabled={!canNext}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-zoru-bg shadow-[var(--zoru-shadow-sm)] disabled:opacity-0"
          >
            <ChevronRight />
          </ZoruButton>
        </>
      )}
    </div>
  );
}

export function ZoruCarouselItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-full", className)} {...props} />;
}
