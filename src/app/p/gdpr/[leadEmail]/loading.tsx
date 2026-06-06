import { ClayCard } from '@/components/zoruui-domain';
import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full" />
      </ClayCard>
      <ClayCard>
        <div className="divide-y divide-[var(--st-border)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <Skeleton className="h-4 w-4 rounded mt-1" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/3 mb-1.5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </ClayCard>
    </div>
  );
}
