export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] px-5 py-3">
        <div className="h-5 w-40 animate-pulse rounded bg-[var(--st-bg-muted)]" />
        <div className="h-7 w-48 animate-pulse rounded-lg bg-[var(--st-bg-muted)]" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-full max-w-sm shrink-0 space-y-px border-r border-[var(--st-border)] p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-2 py-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--st-bg-muted)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--st-bg-muted)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid flex-1 place-items-center">
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--st-bg-muted)]" />
        </div>
      </div>
    </div>
  );
}
