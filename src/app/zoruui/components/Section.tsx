import React from "react";

export function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-zoru-line/80 pt-10 first:mt-0 first:border-t-0 first:pt-0">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zoru-ink-subtle">
            {step}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zoru-ink">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="max-w-xl text-sm leading-relaxed text-zoru-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
