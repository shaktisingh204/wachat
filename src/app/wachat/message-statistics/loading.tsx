import { WaPage } from '@/components/wachat-ui';

export default function MessageStatisticsLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-48 rounded-full bg-zinc-100" />
          <div className="h-9 w-24 rounded-full bg-zinc-100" />
        </div>
      </div>
      <section aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] rounded-2xl border border-zinc-200 bg-white p-5" />
        ))}
      </section>
      <section aria-hidden className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-[280px] rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-[280px] rounded-2xl border border-zinc-200 bg-white lg:col-span-2" />
      </section>
    </WaPage>
  );
}
