import { WaPage } from '@/components/wachat-ui';

export default function ChatTransferLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-56 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="h-4 w-40 rounded-full bg-zinc-100" />
        <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-2">
          <div className="h-9 rounded-xl bg-zinc-100 sm:col-span-2" />
          <div className="h-9 rounded-xl bg-zinc-100" />
          <div className="h-9 rounded-xl bg-zinc-100" />
          <div className="h-16 rounded-xl bg-zinc-100 sm:col-span-2" />
        </div>
        <div className="mt-5 h-10 w-40 rounded-full bg-zinc-100" />
      </div>
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="h-4 w-40 rounded-full bg-zinc-100" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-zinc-50" />
          ))}
        </div>
      </div>
    </WaPage>
  );
}
