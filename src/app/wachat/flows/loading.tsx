import { WaPage } from '@/components/wachat-ui';

export default function FlowsLoading() {
  return (
    <WaPage>
      <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
      <div className="mt-2 h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-8 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}
