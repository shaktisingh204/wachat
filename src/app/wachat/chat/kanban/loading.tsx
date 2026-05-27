/**
 * Kanban skeleton — mirrors the asymmetric column layout.
 */
export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      {[320, 360, 300, 340].map((w, i) => (
        <div key={i} className="shrink-0" style={{ width: w }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-200" />
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-24 rounded-2xl border border-zinc-200 bg-white" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
