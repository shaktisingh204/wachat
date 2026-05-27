import { WaPage } from '@/components/wachat-ui';

export default function ConversationSummaryLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="h-4 w-32 rounded-full bg-zinc-100" />
        <div className="mt-4 h-12 w-full max-w-xl rounded-full bg-zinc-100" />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-24 rounded-full bg-zinc-100" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-16 rounded-lg bg-zinc-100" />
          </div>
        ))}
      </div>
    </WaPage>
  );
}
