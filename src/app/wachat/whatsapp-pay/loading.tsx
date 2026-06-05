import { Skeleton } from '@/components/sabcrm/20ui';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function Loading() {
  return (
    <WachatPage>
      <Skeleton height={36} width={256} className="mb-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={176} className="w-full" />
        ))}
      </div>
    </WachatPage>
  );
}
