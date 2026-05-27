import { WaPage } from '@/components/wachat-ui';

export default function ChatLabelsLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-56 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-28 rounded-full bg-zinc-100" />
          <div className="mt-5 space-y-3">
            <div className="h-9 w-full rounded-xl bg-zinc-100" />
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full bg-zinc-100" />
              ))}
            </div>
            <div className="h-10 w-32 rounded-full bg-zinc-100" />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-24 rounded-full bg-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </WaPage>
  );
}
