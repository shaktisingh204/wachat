"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "./lib/cn";

export interface ZoruTestimonial {
  text: React.ReactNode;
  name: React.ReactNode;
  role?: React.ReactNode;
  /** Optional avatar URL. */
  image?: string;
}

export interface ZoruTestimonialsColumnProps {
  testimonials: ZoruTestimonial[];
  /** Loop duration (seconds). Defaults to 20. */
  duration?: number;
  className?: string;
}

/**
 * Single auto-scrolling vertical column of testimonial cards.
 * Compose three of these side-by-side with different durations for
 * the classic "marquee wall of love" effect.
 */
export function ZoruTestimonialsColumn({
  testimonials,
  duration = 20,
  className,
}: ZoruTestimonialsColumnProps) {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...Array(2)].map((_, dupIndex) => (
          <React.Fragment key={dupIndex}>
            {testimonials.map((t, i) => (
              <ZoruTestimonialCard key={`${dupIndex}-${i}`} testimonial={t} />
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}

export function ZoruTestimonialCard({
  testimonial,
  className,
}: {
  testimonial: ZoruTestimonial;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "w-full max-w-xs rounded-[var(--zoru-radius-xl)] border border-zoru-line bg-zoru-bg p-8 shadow-[var(--zoru-shadow-sm)]",
        className,
      )}
    >
      <blockquote className="text-sm leading-relaxed text-zoru-ink">
        {testimonial.text}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        {testimonial.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={testimonial.image}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-zoru-ink">
            {testimonial.name}
          </span>
          {testimonial.role && (
            <span className="text-[11px] text-zoru-ink-muted">
              {testimonial.role}
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export interface ZoruTestimonialsColumnsProps {
  /** Slug of testimonials. Will be split equally across `columnCount` columns. */
  testimonials: ZoruTestimonial[];
  columnCount?: 2 | 3 | 4;
  /** Loop durations per column — staggered effect. */
  durations?: number[];
  /** Total height of the marquee viewport. Defaults to 600px. */
  height?: number | string;
  className?: string;
}

/**
 * Multi-column marquee wall — auto-scrolls each column at a different
 * speed. Pass at least `columnCount` testimonials.
 */
export function ZoruTestimonialsColumns({
  testimonials,
  columnCount = 3,
  durations = [20, 26, 22, 30],
  height = 600,
  className,
}: ZoruTestimonialsColumnsProps) {
  const columns = React.useMemo(() => {
    const cols: ZoruTestimonial[][] = Array.from(
      { length: columnCount },
      () => [],
    );
    testimonials.forEach((t, idx) => {
      cols[idx % columnCount].push(t);
    });
    return cols;
  }, [testimonials, columnCount]);

  return (
    <div
      className={cn(
        "relative flex justify-center gap-6 overflow-hidden",
        className,
      )}
      style={{ height }}
    >
      {columns.map((col, idx) => (
        <ZoruTestimonialsColumn
          key={idx}
          testimonials={col}
          duration={durations[idx % durations.length]}
          className={cn(idx > 0 && "hidden", idx > 0 && "md:block", idx > 1 && "lg:block")}
        />
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zoru-bg to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zoru-bg to-transparent"
      />
    </div>
  );
}
