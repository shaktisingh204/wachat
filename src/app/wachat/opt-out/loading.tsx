import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 animate-pulse rounded-full bg-zinc-100" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}
