import { WaPage } from '@/components/wachat-ui';

export default function GreetingMessagesLoading() {
  return (
    <WaPage>
      <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-3 h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
      <div className="mt-2 h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[420px] animate-pulse rounded-[2.2rem] border border-zinc-200 bg-white" />
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          <div className="h-[420px] animate-pulse rounded-[2.2rem] border border-zinc-200 bg-white" />
        </div>
      </div>
    </WaPage>
  );
}
