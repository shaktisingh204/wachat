import { WaPage } from '@/components/wachat-ui';

export default function TemplateBuilderLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-24 rounded-full bg-zinc-100" />
          <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
          <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-full bg-zinc-100" />
          <div className="h-9 w-36 rounded-full bg-zinc-100" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 pl-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="h-3 w-24 rounded-full bg-zinc-100" />
              <div className="mt-4 h-9 w-full rounded-xl bg-zinc-100" />
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
