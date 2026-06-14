export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-16">
      <div className="mb-6 h-11 w-72 animate-pulse rounded-xl bg-[var(--st-border,#eee)]" />
      <div className="mb-6 h-12 w-full animate-pulse rounded-xl bg-[var(--st-border,#eee)]" />
      <div className="h-10 w-44 animate-pulse rounded-xl bg-[var(--st-border,#eee)]" />
    </div>
  );
}
