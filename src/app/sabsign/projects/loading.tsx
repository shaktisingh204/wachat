export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 h-11 w-64 animate-pulse rounded-xl bg-[var(--st-border,#eee)]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-[var(--st-border,#eee)]"
          />
        ))}
      </div>
    </div>
  );
}
