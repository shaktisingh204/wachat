import { WaPage } from '@/components/wachat-ui';

export default function SetupLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-80 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-full bg-zinc-100" />
          <div className="h-10 w-44 rounded-full bg-zinc-100" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="h-[340px] rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[260px] rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[180px] rounded-2xl border border-zinc-200 bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-[420px] rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[160px] rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[200px] rounded-2xl border border-zinc-200 bg-white" />
        </div>
      </div>
    </WaPage>
  );
}
