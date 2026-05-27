import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 animate-pulse rounded-full bg-zinc-100" />
      </div>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
            <div className="h-3 w-3 animate-pulse rounded-full bg-zinc-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </WaPage>
  );
}
