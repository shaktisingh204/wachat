import { WaPage } from '@/components/wachat-ui';

export default function ConversationFiltersLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="h-10 w-32 rounded-full bg-zinc-100" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-[160px] rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-4 w-32 rounded-full bg-zinc-100" />
            <div className="mt-3 flex gap-1.5">
              <div className="h-5 w-14 rounded-full bg-zinc-100" />
              <div className="h-5 w-12 rounded-full bg-zinc-100" />
            </div>
            <div className="mt-6 h-7 w-16 rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </WaPage>
  );
}
