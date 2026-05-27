import { WaPage } from '@/components/wachat-ui';

export default function TemplatesCreateLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="h-9 w-32 rounded-full bg-zinc-100" />
      </div>

      <div aria-hidden className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="h-3 w-32 rounded-full bg-zinc-100" />
              <div className="mt-4 h-9 w-full rounded-xl bg-zinc-100" />
              <div className="mt-3 h-9 w-2/3 rounded-xl bg-zinc-100" />
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="h-[460px] rounded-[2.2rem] border border-zinc-200 bg-white" />
        </div>
      </div>
    </WaPage>
  );
}
