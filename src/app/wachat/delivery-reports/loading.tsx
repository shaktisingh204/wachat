import { WaPage } from '@/components/wachat-ui';

export default function DeliveryReportsLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
        </div>
        <div className="h-9 w-32 rounded-full bg-zinc-100" />
      </div>
      <section aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </section>
      <div aria-hidden className="mt-6 h-[380px] rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}
