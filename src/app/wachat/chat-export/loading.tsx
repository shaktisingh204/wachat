import { WaPage } from '@/components/wachat-ui';

export default function ChatExportLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-64 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="mt-5 space-y-3">
            <div className="h-9 w-full max-w-md rounded-xl bg-zinc-100" />
            <div className="h-9 w-full max-w-md rounded-xl bg-zinc-100" />
            <div className="h-10 w-32 rounded-full bg-zinc-100" />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="h-4 w-24 rounded-full bg-zinc-100" />
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-zinc-100" />
            <div className="h-3 w-32 rounded-full bg-zinc-100" />
          </div>
        </div>
      </div>
    </WaPage>
  );
}
