import { Skeleton } from '@/components/sabcrm/20ui';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function Loading() {
  return (
    <WachatPage>
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </WachatPage>
  );
}
