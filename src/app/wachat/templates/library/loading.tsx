import { WaPage } from '@/components/wachat-ui';

export default function TemplatesLibraryLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-56 rounded-full bg-zinc-100" />
          <div className="h-9 w-36 rounded-full bg-zinc-100" />
        </div>
      </div>

      <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-80 rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}
