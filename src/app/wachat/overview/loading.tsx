import { WaPage } from '@/components/wachat-ui';

/**
 * Overview skeleton — mirrors the rebuilt layout: header + 4 KPI tiles
 * + funnel/actions/chart row + campaigns list.
 */
export default function OverviewLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-full bg-zinc-100" />
          <div className="h-9 w-28 rounded-full bg-zinc-100" />
          <div className="h-9 w-32 rounded-full bg-zinc-100" />
        </div>
      </div>

      <section aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-16 rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-24 rounded-lg bg-zinc-100" />
          </div>
        ))}
      </section>

      <section aria-hidden className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-[320px] rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-[320px] rounded-2xl border border-zinc-200 bg-white lg:col-span-2" />
      </section>

      <section aria-hidden className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="h-4 w-40 rounded-full bg-zinc-100" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-zinc-50" />
          ))}
        </div>
      </section>
    </WaPage>
  );
}
