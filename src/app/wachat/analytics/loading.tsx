import { WaPage } from '@/components/wachat-ui';

export default function AnalyticsLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-44 rounded-full bg-zinc-100" />
          <div className="h-9 w-24 rounded-full bg-zinc-100" />
        </div>
      </div>
      <div aria-hidden className="h-32 rounded-2xl border border-zinc-200 bg-white" />
      <section aria-hidden className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[100px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </section>
      <div aria-hidden className="h-[280px] rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}
