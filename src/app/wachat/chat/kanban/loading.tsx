/**
 * Kanban skeleton — mirrors the asymmetric column layout.
 */
import { Skeleton } from '@/components/sabcrm/20ui';

export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      {[320, 360, 300, 340].map((w, i) => (
        <div key={i} className="shrink-0" style={{ width: w }}>
          <div className="mb-3 flex items-center gap-2">
            <Skeleton circle width={8} height={8} />
            <Skeleton width={80} height={12} radius={999} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} width="100%" height={96} radius={16} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
