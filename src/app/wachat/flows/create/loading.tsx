export default function FlowsCreateLoading() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
      </div>
      <div className="grid flex-1 grid-cols-12 gap-3">
        <div className="col-span-2 h-full animate-pulse rounded-xl bg-zinc-100" />
        <div className="col-span-7 h-full animate-pulse rounded-xl bg-zinc-100" />
        <div className="col-span-3 h-full animate-pulse rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}
