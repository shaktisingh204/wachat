import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-20 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-[400px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-[400px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}
