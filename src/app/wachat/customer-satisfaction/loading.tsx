import { WaPage } from '@/components/wachat-ui';

export default function CustomerSatisfactionLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-80 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-full bg-zinc-100" />
          <div className="h-9 w-24 rounded-full bg-zinc-100" />
        </div>
      </div>
      <section aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </section>
      <div aria-hidden className="mt-6 h-[280px] rounded-2xl border border-zinc-200 bg-white" />
      <div aria-hidden className="mt-6 h-[320px] rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}
