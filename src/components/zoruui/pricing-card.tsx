import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruBadge } from "./badge";

export interface ZoruPricingFeature {
  label: React.ReactNode;
  included?: boolean;
}

export interface ZoruPricingCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Plan name. */
  name: React.ReactNode;
  /** Short tagline beneath the name. */
  tagline?: React.ReactNode;
  /** Headline price (formatted by the caller, e.g. "$29"). */
  price: React.ReactNode;
  /** Period label, e.g. "/ month". */
  period?: React.ReactNode;
  /** Feature list. */
  features?: ZoruPricingFeature[];
  /** CTA button — pass any node, typically <ZoruButton>. */
  cta?: React.ReactNode;
  /** Highlight the plan as recommended (inverted surface). */
  featured?: boolean;
  /** Optional badge text for featured plans. Defaults to "Most popular". */
  featuredLabel?: React.ReactNode;
}

export function ZoruPricingCard({
  name,
  tagline,
  price,
  period,
  features = [],
  cta,
  featured,
  featuredLabel = "Most popular",
  className,
  ...props
}: ZoruPricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-6 rounded-[var(--zoru-radius-xl)] p-8",
        featured
          ? "bg-zoru-ink text-zoru-on-primary shadow-[var(--zoru-shadow-lg)]"
          : "border border-zoru-line bg-zoru-bg text-zoru-ink",
        className,
      )}
      {...props}
    >
      {featured && (
        <ZoruBadge
          variant="ghost"
          className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-zoru-on-primary text-zoru-ink"
        >
          {featuredLabel}
        </ZoruBadge>
      )}

      <header className="flex flex-col gap-1">
        <h3
          className={cn(
            "text-base font-semibold tracking-tight",
            featured ? "text-zoru-on-primary" : "text-zoru-ink",
          )}
        >
          {name}
        </h3>
        {tagline && (
          <p
            className={cn(
              "text-sm",
              featured ? "text-zoru-on-primary/70" : "text-zoru-ink-muted",
            )}
          >
            {tagline}
          </p>
        )}
      </header>

      <div className="flex items-end gap-1">
        <span
          className={cn(
            "text-4xl font-semibold tracking-tight",
            featured ? "text-zoru-on-primary" : "text-zoru-ink",
          )}
        >
          {price}
        </span>
        {period && (
          <span
            className={cn(
              "pb-1 text-sm",
              featured ? "text-zoru-on-primary/70" : "text-zoru-ink-muted",
            )}
          >
            {period}
          </span>
        )}
      </div>

      {cta}

      {features.length > 0 && (
        <ul className="flex flex-col gap-2.5 border-t border-zoru-line/30 pt-6">
          {features.map((f, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 text-sm",
                f.included === false && "opacity-50",
                featured ? "text-zoru-on-primary/85" : "text-zoru-ink-muted",
              )}
            >
              <Check
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  featured ? "text-zoru-on-primary" : "text-zoru-ink",
                )}
              />
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ZoruPricingTierProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Pass a list of <ZoruPricingCard /> as children. */
  children: React.ReactNode;
  /** Optional headline above the tier grid. */
  heading?: React.ReactNode;
  /** Optional subhead. */
  subhead?: React.ReactNode;
}

/**
 * ZoruPricingTier — convenience wrapper that lays out 2–4 PricingCards
 * in a responsive grid. Pass cards directly as children.
 */
export function ZoruPricingTier({
  children,
  heading,
  subhead,
  className,
  ...props
}: ZoruPricingTierProps) {
  const count = React.Children.count(children);
  return (
    <section className={cn("flex flex-col gap-10", className)} {...props}>
      {(heading || subhead) && (
        <div className="flex flex-col items-center gap-2 text-center">
          {heading && (
            <h2 className="text-3xl font-semibold tracking-tight text-zoru-ink">
              {heading}
            </h2>
          )}
          {subhead && (
            <p className="max-w-xl text-base leading-relaxed text-zoru-ink-muted">
              {subhead}
            </p>
          )}
        </div>
      )}
      <div
        className={cn(
          "grid gap-6",
          count <= 2 && "sm:grid-cols-2",
          count === 3 && "md:grid-cols-3",
          count >= 4 && "md:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {children}
      </div>
    </section>
  );
}
