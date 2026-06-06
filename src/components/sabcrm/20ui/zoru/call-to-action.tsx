import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruCallToActionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Optional small eyebrow above the title. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action buttons rendered on the right of the headline (or below on small screens). */
  actions?: React.ReactNode;
  /** Surface treatment. `inverted` is black-on-white-flipped — used for hero CTAs. */
  variant?: "default" | "soft" | "inverted" | "outline";
}

/**
 * ZoruCallToAction — large headline + actions banner. Drop near the
 * end of marketing pages to anchor the next step.
 */
export function ZoruCallToAction({
  eyebrow,
  title,
  description,
  actions,
  variant = "default",
  className,
  ...props
}: ZoruCallToActionProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--zoru-radius-xl)] px-8 py-12 md:px-12 md:py-16",
        variant === "default" && "border border-zoru-line bg-zoru-bg",
        variant === "soft" && "bg-zoru-surface",
        variant === "outline" && "border border-zoru-line-strong bg-transparent",
        variant === "inverted" && "bg-zoru-ink text-zoru-on-primary",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          {eyebrow && (
            <p
              className={cn(
                "text-[11px] font-medium uppercase tracking-[0.2em]",
                variant === "inverted"
                  ? "text-zoru-on-primary/70"
                  : "text-zoru-ink-subtle",
              )}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className={cn(
              "text-3xl font-semibold tracking-tight md:text-4xl",
              variant === "inverted" ? "text-zoru-on-primary" : "text-zoru-ink",
            )}
          >
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "text-base leading-relaxed",
                variant === "inverted"
                  ? "text-zoru-on-primary/80"
                  : "text-zoru-ink-muted",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </section>
  );
}
