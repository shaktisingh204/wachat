import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruFeatureCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visual treatment. */
  variant?: "default" | "soft" | "outline";
}

export function ZoruFeatureCard({
  icon,
  title,
  description,
  variant = "default",
  className,
  children,
  ...props
}: ZoruFeatureCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--zoru-radius-lg)] p-6",
        variant === "default" && "border border-zoru-line bg-zoru-bg",
        variant === "soft" && "bg-zoru-surface",
        variant === "outline" && "border border-zoru-line-strong",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-5">
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold tracking-tight text-zoru-ink">
        {title}
      </h3>
      {description && (
        <p className="text-sm leading-relaxed text-zoru-ink-muted">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

export interface ZoruFeatureGridProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Grid column count at the lg+ breakpoint. Defaults to 3. */
  columns?: 2 | 3 | 4;
  /** Optional headline + subhead above the grid. */
  heading?: React.ReactNode;
  subhead?: React.ReactNode;
  /** Pass <ZoruFeatureCard /> entries as children. */
  children: React.ReactNode;
}

export function ZoruFeatureGrid({
  columns = 3,
  heading,
  subhead,
  className,
  children,
  ...props
}: ZoruFeatureGridProps) {
  return (
    <section className={cn("flex flex-col gap-10", className)} {...props}>
      {(heading || subhead) && (
        <div className="flex flex-col items-start gap-2">
          {heading && (
            <h2 className="text-3xl font-semibold tracking-tight text-zoru-ink">
              {heading}
            </h2>
          )}
          {subhead && (
            <p className="max-w-2xl text-base leading-relaxed text-zoru-ink-muted">
              {subhead}
            </p>
          )}
        </div>
      )}
      <div
        className={cn(
          "grid gap-4",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {children}
      </div>
    </section>
  );
}
