import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-20 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="mb-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="mt-4 h-12 w-full rounded-lg bg-zinc-100" />
          <div className="mt-2 h-12 w-3/4 rounded-lg bg-zinc-100" />
        </div>
        <div className="h-[420px] animate-pulse rounded-3xl bg-zinc-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}
