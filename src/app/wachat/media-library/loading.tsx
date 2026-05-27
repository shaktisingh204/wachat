import { WaPage } from '@/components/wachat-ui';

export default function MediaLibraryLoading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-20 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="mb-6 h-9 w-72 rounded-full bg-zinc-100" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-zinc-100" />
            <div className="p-3">
              <div className="h-3 w-3/4 rounded-full bg-zinc-100" />
              <div className="mt-2 h-2.5 w-1/2 rounded-full bg-zinc-100" />
            </div>
          </li>
        ))}
      </ul>
    </WaPage>
  );
}
