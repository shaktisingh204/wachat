/**
 * /wachat/chat loading — mirrors the 3-pane inbox shape so the layout
 * doesn't shift in. Full-bleed (no WaPage wrapper) to match the chat
 * route which uses the full canvas.
 */
export default function ChatLoading() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <div className="h-full w-[320px] shrink-0 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="h-4 w-32 rounded-full bg-zinc-100" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-2">
              <div className="h-9 w-9 rounded-full bg-zinc-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded-full bg-zinc-100" />
                <div className="h-2.5 w-32 rounded-full bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-full flex-1 rounded-2xl border border-zinc-200 bg-white" />
      <div className="h-full w-[300px] shrink-0 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="h-12 w-12 rounded-full bg-zinc-100" />
        <div className="mt-3 h-4 w-32 rounded-full bg-zinc-100" />
        <div className="mt-2 h-3 w-24 rounded-full bg-zinc-100" />
      </div>
    </div>
  );
}
