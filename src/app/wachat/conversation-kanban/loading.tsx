import { WaPage } from '@/components/wachat-ui';

export default function ConversationKanbanLoading() {
  return (
    <WaPage fullBleed>
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-10 pt-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-3 w-24 rounded-full bg-zinc-100" />
            <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
            <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
          </div>
          <div className="h-9 w-28 rounded-full bg-zinc-100" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[320, 360, 320].map((w, i) => (
            <div key={i} className="shrink-0" style={{ width: w }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-200" />
                <div className="h-3 w-20 rounded-full bg-zinc-100" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-24 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="h-3 w-32 rounded-full bg-zinc-100" />
                    <div className="mt-2 h-2.5 w-24 rounded-full bg-zinc-100" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </WaPage>
  );
}
