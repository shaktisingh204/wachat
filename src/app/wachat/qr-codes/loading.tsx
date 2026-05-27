import { WaPage } from '@/components/wachat-ui';

export default function Loading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-20 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="h-[180px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="h-11 w-11 rounded-xl bg-zinc-100" />
            <div className="mt-4 h-3 w-3/4 rounded-full bg-zinc-100" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </WaPage>
  );
}
