import { Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="w-full p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton width={250} height={32} />
        <Skeleton width={350} height={16} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            height={128}
            radius="var(--st-radius-lg)"
          />
        ))}
      </div>
      <div className="space-y-4 mt-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={48} radius="var(--st-radius)" />
        ))}
      </div>
    </div>
  );
}
