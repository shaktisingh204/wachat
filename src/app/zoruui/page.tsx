/**
 * /zoruui — component gallery.
 *
 * Step 1 mounts the foundation only: tokens, scope, dock re-export.
 * Steps 2–6 will render every primitive on this page in clearly
 * labelled sections (atoms, overlays, layout, data, marketing).
 */
export default function ZoruuiGalleryPage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-16">
      <header className="border-b pb-10" style={{ borderColor: "hsl(var(--zoru-line))" }}>
        <p
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: "hsl(var(--zoru-ink-muted))" }}
        >
          ZoruUI · Step 1 / 10
        </p>
        <h1
          className="mt-3 text-4xl font-semibold tracking-tight"
          style={{ color: "hsl(var(--zoru-ink))" }}
        >
          Foundation is live.
        </h1>
        <p
          className="mt-3 max-w-2xl text-base leading-relaxed"
          style={{ color: "hsl(var(--zoru-ink-muted))" }}
        >
          Tokens, scope provider, and the reused dock are wired. Atoms,
          overlays, layout, data, and marketing primitives land in
          steps 2 through 6 and will render below this line.
        </p>
      </header>

      <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <SwatchCard label="bg" varName="--zoru-bg" />
        <SwatchCard label="surface" varName="--zoru-surface" />
        <SwatchCard label="surface-2" varName="--zoru-surface-2" />
        <SwatchCard label="line" varName="--zoru-line" />
        <SwatchCard label="ink-muted" varName="--zoru-ink-muted" />
        <SwatchCard label="ink (primary)" varName="--zoru-ink" />
      </section>
    </div>
  );
}

function SwatchCard({ label, varName }: { label: string; varName: string }) {
  return (
    <div
      className="rounded-[var(--zoru-radius)] border p-4"
      style={{
        borderColor: "hsl(var(--zoru-line))",
        backgroundColor: "hsl(var(--zoru-bg))",
      }}
    >
      <div
        className="h-16 w-full rounded-[var(--zoru-radius-sm)] border"
        style={{
          backgroundColor: `hsl(var(${varName}))`,
          borderColor: "hsl(var(--zoru-line))",
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span
          className="text-sm font-medium"
          style={{ color: "hsl(var(--zoru-ink))" }}
        >
          {label}
        </span>
        <code
          className="text-[11px]"
          style={{ color: "hsl(var(--zoru-ink-muted))" }}
        >
          {varName}
        </code>
      </div>
    </div>
  );
}
