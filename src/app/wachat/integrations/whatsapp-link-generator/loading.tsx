import { WaPage } from '@/components/wachat-ui';

export default function LinkGenLoading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-40 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[420px] rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-[420px] rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}
