import { WaPage } from '@/components/wachat-ui';

export default function HealthLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-64 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
        </div>
        <div className="h-9 w-24 rounded-full bg-zinc-100" />
      </div>
      <div aria-hidden className="h-32 rounded-2xl border border-zinc-200 bg-white" />
      <div aria-hidden className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-[260px] rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-[260px] rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}
