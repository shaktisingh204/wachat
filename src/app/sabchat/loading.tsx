export default function SabchatLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-7 w-48 animate-pulse rounded-md bg-[var(--st-bg-muted)]" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded-md bg-[var(--st-bg-muted)]" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-lg bg-[var(--st-bg-muted)]"
          />
        ))}
      </div>
    </div>
  );
}
