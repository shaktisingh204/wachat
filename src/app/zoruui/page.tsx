"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { HeroPill } from '@/components/sabcrm/20ui';
import { Section } from "./components/Section";
import { SnippetDemo } from "./components/SnippetDemo";

function Header() {
  return (
    <header className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]/95 shadow-[var(--st-shadow-lg)]">
      <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/70 px-5 py-3 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--st-text-secondary)]">
            ZoruUI · component gallery
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            <span className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1">
              10-step rollout
            </span>
            <span className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1">
              Neutral system
            </span>
          </div>
        </div>
      </div>
      <div className="grid gap-8 px-5 py-8 sm:px-7 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <HeroPill icon={<Sparkles className="size-3" />} text="Minimal premium refresh" />
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--st-text)] sm:text-5xl">
            ZoruUI component showcase
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--st-text-secondary)]">
            Tokens, atoms, overlays, layout, data, and marketing primitives in a
            calmer gallery with sharper hierarchy and more breathing room.
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          {[
            ["60+", "Primitives"],
            ["6", "Steps shown"],
            ["B/W", "Palette"],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-[var(--st-border)] p-4 last:border-r-0">
              <p className="text-2xl font-semibold text-[var(--st-text)]">{value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--st-text-secondary)]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function SwatchCard({ label, varName }: { label: string; varName: string }) {
  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 shadow-[var(--st-shadow-sm)]">
      <div
        className="h-16 w-full rounded-[var(--st-radius-sm)] border border-[var(--st-border)]"
        style={{ backgroundColor: `hsl(var(${varName}))` }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--st-text)]">{label}</span>
        <code className="text-[11px] text-[var(--st-text-secondary)]">{varName}</code>
      </div>
    </div>
  );
}

export default function ZoruuiOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <Header />
      
      <Section
        step="Step 1"
        title="Foundation"
        subtitle="Tokens scoped under .zoruui — black ink, neutral surfaces, no dark mode."
      >
        <SnippetDemo code={`<SwatchCard label="bg" varName="--zoru-bg" />
<SwatchCard label="surface" varName="--zoru-surface" />
<SwatchCard label="surface-2" varName="--zoru-surface-2" />
<SwatchCard label="line" varName="--zoru-line" />
<SwatchCard label="ink-muted" varName="--zoru-ink-muted" />
<SwatchCard label="ink (primary)" varName="--zoru-ink" />`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SwatchCard label="bg" varName="--zoru-bg" />
            <SwatchCard label="surface" varName="--zoru-surface" />
            <SwatchCard label="surface-2" varName="--zoru-surface-2" />
            <SwatchCard label="line" varName="--zoru-line" />
            <SwatchCard label="ink-muted" varName="--zoru-ink-muted" />
            <SwatchCard label="ink (primary)" varName="--zoru-ink" />
          </div>
        </SnippetDemo>
      </Section>
    </div>
  );
}
