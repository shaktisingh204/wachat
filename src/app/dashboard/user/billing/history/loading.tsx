import { Skeleton } from '@/components/sabcrm/20ui';
import { TransactionSkeleton } from './transaction-skeleton';

export default function Loading() {
  return (
    <div className="20ui mx-auto flex w-full max-w-[1100px] flex-col gap-[var(--st-space-6)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton width={200} height={28} radius={8} />
          <Skeleton width={340} height={16} radius={8} />
        </div>
        <Skeleton width={150} height={36} radius={8} />
      </div>
      <TransactionSkeleton />
    </div>
  );
}
