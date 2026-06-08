/**
 * Route-level loading state for the bug-tracker module
 * (`/dashboard/sabbugs/*`). Shows a skeleton that matches the header band +
 * KPI strip + content shape so the layout doesn't jump on navigation.
 */
import { Card, Skeleton } from '@/components/sabcrm/20ui';

export default function SabBugsLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton width={96} height={12} />
        <Skeleton width={220} height={24} />
        <Skeleton width={360} height={14} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton width={72} height={12} />
            <Skeleton width={48} height={24} />
          </Card>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton height={14} className="flex-1" />
              <Skeleton width={64} height={20} radius={999} />
              <Skeleton width={64} height={20} radius={999} />
              <Skeleton width={72} height={14} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
