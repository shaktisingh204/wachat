'use client';

/**
 * 20ui — Carousel.
 *
 * A token-skinned wrapper around `embla-carousel-react` v8. Embla owns the hard
 * parts (drag physics, snap math, momentum, resize handling); 20ui supplies the
 * structure, the look, and the accessibility wiring:
 *   - `Carousel` creates the embla instance, exposes it through context, and is a
 *     focusable region (`role="region"`, `aria-roledescription="carousel"`) that
 *     handles arrow-key navigation;
 *   - `CarouselContent` is the embla viewport + a flex track;
 *   - `CarouselItem` is one snap-aligned slide (`role="group"`,
 *     `aria-roledescription="slide"`);
 *   - `CarouselPrevious` / `CarouselNext` are `IconButton`s that disable at the
 *     ends (unless looping) and carry an `aria-label`.
 *
 * Horizontal (default) or vertical via `orientation`. Extra embla options pass
 * through `opts`. Motion lives entirely inside embla's transform-driven scroll;
 * `carousel.css` adds only a reduced-motion guard so a press never animates the
 * track for users who opted out.
 *
 *   <Carousel className="u-shadow" opts={{ align: 'start' }}>
 *     <CarouselContent>
 *       <CarouselItem className="basis-1/3">Acme renewal</CarouselItem>
 *       <CarouselItem className="basis-1/3">Globex onboarding</CarouselItem>
 *       <CarouselItem className="basis-1/3">Initech upsell</CarouselItem>
 *     </CarouselContent>
 *     <CarouselPrevious />
 *     <CarouselNext />
 *   </Carousel>
 */

import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

import { IconButton } from './button';
import './carousel.css';

export type CarouselOrientation = 'horizontal' | 'vertical';

/** The embla API instance, or `undefined` until the viewport mounts. */
export type CarouselApi = EmblaCarouselType | undefined;

interface CarouselContextValue {
  /** Viewport ref callback to attach to `CarouselContent`. */
  viewportRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  orientation: CarouselOrientation;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

/** Read the surrounding carousel's embla API + scroll state. */
export function useCarousel(): CarouselContextValue {
  const ctx = React.useContext(CarouselContext);
  if (!ctx) {
    throw new Error('useCarousel must be used within a <Carousel>.');
  }
  return ctx;
}

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: CarouselOrientation;
  /** Extra embla options merged on top of the orientation-derived defaults. */
  opts?: EmblaOptionsType;
  /** Embla plugins (e.g. Autoplay) — passed straight through. */
  plugins?: EmblaPluginType[];
  /** Receive the embla API once it is ready (and on re-init). */
  setApi?: (api: CarouselApi) => void;
}

export const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  function Carousel(
    {
      orientation = 'horizontal',
      opts,
      plugins,
      setApi,
      className,
      children,
      'aria-label': ariaLabel,
      role,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const [viewportRef, api] = useEmblaCarousel(
      { ...opts, axis: orientation === 'horizontal' ? 'x' : 'y' },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
    const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);

    const onSelect = React.useCallback((embla: EmblaCarouselType) => {
      setCanScrollPrev(embla.canScrollPrev());
      setCanScrollNext(embla.canScrollNext());
    }, []);

    // Hand the live API to the caller (and clear it on teardown / re-init).
    React.useEffect(() => {
      setApi?.(api);
    }, [api, setApi]);

    // Subscribe to embla state. `reInit` covers slide/option changes so the
    // disabled state of the arrows never goes stale, and we always clean up.
    React.useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on('reInit', onSelect);
      api.on('select', onSelect);
      return () => {
        api.off('reInit', onSelect);
        api.off('select', onSelect);
      };
    }, [api, onSelect]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
        const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
        if (e.key === prevKey) {
          e.preventDefault();
          scrollPrev();
        } else if (e.key === nextKey) {
          e.preventDefault();
          scrollNext();
        }
      },
      [orientation, scrollPrev, scrollNext, onKeyDown],
    );

    const value = React.useMemo<CarouselContextValue>(
      () => ({
        viewportRef,
        api,
        orientation,
        canScrollPrev,
        canScrollNext,
        scrollPrev,
        scrollNext,
      }),
      [viewportRef, api, orientation, canScrollPrev, canScrollNext, scrollPrev, scrollNext],
    );

    return (
      <CarouselContext.Provider value={value}>
        <div
          ref={ref}
          className={['u-carousel', `u-carousel--${orientation}`, className]
            .filter(Boolean)
            .join(' ')}
          role={role ?? 'region'}
          aria-roledescription="carousel"
          aria-label={ariaLabel ?? 'Carousel'}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);

export interface CarouselContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra class on the inner flex track (the element embla translates). */
  trackClassName?: string;
}

/** The scroll viewport + the flex track that embla translates. */
export const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  function CarouselContent({ className, trackClassName, children, ...rest }, ref) {
    const { viewportRef, orientation } = useCarousel();
    return (
      <div
        ref={viewportRef}
        className={['u-carousel__viewport', className].filter(Boolean).join(' ')}
      >
        <div
          ref={ref}
          className={[
            'u-carousel__track',
            `u-carousel__track--${orientation}`,
            trackClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {children}
        </div>
      </div>
    );
  },
);

export type CarouselItemProps = React.HTMLAttributes<HTMLDivElement>;

/** One snap-aligned slide. Set its width/height with a `basis-*` utility class. */
export const CarouselItem = React.forwardRef<HTMLDivElement, CarouselItemProps>(
  function CarouselItem({ className, role, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role={role ?? 'group'}
        aria-roledescription="slide"
        className={['u-carousel__item', className].filter(Boolean).join(' ')}
        {...rest}
      />
    );
  },
);

export interface CarouselArrowProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the default accessible name ("Previous slide" / "Next slide"). */
  label?: string;
}

/** Step to the previous slide. Disables at the start unless the carousel loops. */
export const CarouselPrevious = React.forwardRef<HTMLButtonElement, CarouselArrowProps>(
  function CarouselPrevious({ className, label, disabled, onClick, ...rest }, ref) {
    const { orientation, canScrollPrev, scrollPrev } = useCarousel();
    return (
      <IconButton
        ref={ref}
        variant="outline"
        size="sm"
        label={label ?? 'Previous slide'}
        icon={orientation === 'horizontal' ? ChevronLeft : ChevronUp}
        className={['u-carousel__arrow', 'u-carousel__arrow--prev', className]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled ?? !canScrollPrev}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) scrollPrev();
        }}
        {...rest}
      />
    );
  },
);

/** Step to the next slide. Disables at the end unless the carousel loops. */
export const CarouselNext = React.forwardRef<HTMLButtonElement, CarouselArrowProps>(
  function CarouselNext({ className, label, disabled, onClick, ...rest }, ref) {
    const { orientation, canScrollNext, scrollNext } = useCarousel();
    return (
      <IconButton
        ref={ref}
        variant="outline"
        size="sm"
        label={label ?? 'Next slide'}
        icon={orientation === 'horizontal' ? ChevronRight : ChevronDown}
        className={['u-carousel__arrow', 'u-carousel__arrow--next', className]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled ?? !canScrollNext}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) scrollNext();
        }}
        {...rest}
      />
    );
  },
);

export default Carousel;
