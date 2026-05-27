import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
      <div className="mt-2 h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-6 flex gap-3">
        <div className="h-9 w-72 animate-pulse rounded-full bg-zinc-100" />
        <div className="h-9 w-40 animate-pulse rounded-full bg-zinc-100" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}
