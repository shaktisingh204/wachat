import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-20 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-80 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-[28rem] rounded-full bg-zinc-100" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}
