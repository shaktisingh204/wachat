export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-[180px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
