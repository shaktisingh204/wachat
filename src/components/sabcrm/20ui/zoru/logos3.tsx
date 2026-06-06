"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruLogo {
  id: string;
  /** Accessible label / company name. */
  description: string;
  /** Image URL — should be a single-color logo (svg / png with alpha). */
  image: string;
  className?: string;
  href?: string;
}

export interface ZoruLogos3Props {
  /** Optional headline rendered above the strip. */
  heading?: React.ReactNode;
  logos: ZoruLogo[];
  /** Animation duration in seconds. Defaults to 30. */
  duration?: number;
  /** Pause animation on hover. Defaults to true. */
  pauseOnHover?: boolean;
  className?: string;
}

/**
 * Auto-scrolling "trusted by" logo strip. Pure CSS marquee — no
 * embla-auto-scroll dependency. Logos are deliberately desaturated to
 * `text-zoru-ink-muted` to keep the strip visually quiet.
 */
export function ZoruLogos3({
  heading,
  logos,
  duration = 30,
  pauseOnHover = true,
  className,
}: ZoruLogos3Props) {
  return (
    <section className={cn("flex flex-col items-center gap-8", className)}>
      {heading && (
        <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle">
          {heading}
        </h3>
      )}

      <div
        className={cn(
          "group relative flex w-full overflow-hidden",
          "[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-12 pr-12 animate-zoru-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${duration}s` }}
        >
          {[...logos, ...logos].map((logo, idx) => (
            <LogoItem key={`${logo.id}-${idx}`} logo={logo} />
          ))}
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-12 pr-12 animate-zoru-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${duration}s` }}
          aria-hidden
        >
          {[...logos, ...logos].map((logo, idx) => (
            <LogoItem key={`d-${logo.id}-${idx}`} logo={logo} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes zoru-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }
        .animate-zoru-marquee {
          animation: zoru-marquee linear infinite;
        }
      `}</style>
    </section>
  );
}

function LogoItem({ logo }: { logo: ZoruLogo }) {
  const inner = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.image}
      alt={logo.description}
      className={cn(
        "h-7 w-auto object-contain opacity-70 grayscale transition-opacity hover:opacity-100",
        logo.className,
      )}
    />
  );

  return logo.href ? (
    <a
      href={logo.href}
      target="_blank"
      rel="noreferrer"
      aria-label={logo.description}
      className="inline-flex items-center"
    >
      {inner}
    </a>
  ) : (
    <span aria-label={logo.description} className="inline-flex items-center">
      {inner}
    </span>
  );
}
