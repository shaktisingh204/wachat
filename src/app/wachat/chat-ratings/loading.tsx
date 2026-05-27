import { WaPage } from '@/components/wachat-ui';

export default function ChatRatingsLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-56 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <section aria-hidden className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-20 rounded-lg bg-zinc-100" />
          </div>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-40 rounded-full bg-zinc-100" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-full rounded-full bg-zinc-100" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-zinc-50" />
            ))}
          </div>
        </div>
      </div>
    </WaPage>
  );
}
