import { WaPage } from '@/components/wachat-ui';

export default function ChatbotLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-full bg-zinc-100" />
          <div className="h-9 w-24 rounded-full bg-zinc-100" />
          <div className="h-9 w-32 rounded-full bg-zinc-100" />
        </div>
      </div>
      <section aria-hidden className="mb-8 grid grid-cols-2 gap-3 sm:max-w-md">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-3 w-24 rounded-full bg-zinc-100" />
            <div className="mt-3 h-7 w-12 rounded-lg bg-zinc-100" />
          </div>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="mt-5 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-zinc-50" />
            ))}
          </div>
        </div>
        <div className="h-[460px] rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}
