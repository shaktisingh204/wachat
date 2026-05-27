import { WaPage } from '@/components/wachat-ui';

export default function MessageTemplatesLibraryLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-32 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-80 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-72 rounded-full bg-zinc-100" />
        </div>
        <div className="h-9 w-28 rounded-full bg-zinc-100" />
      </div>

      <div aria-hidden className="mb-6 h-9 w-72 rounded-full bg-zinc-100" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}
