import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';

export default function SabwebinarLoading() {
  return (
    <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton width={96} height={14} />
        <Skeleton width={220} height={28} />
        <Skeleton width={420} height={16} />
      </div>

      <section
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-3">
              <Skeleton width={32} height={32} radius={8} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={24} />
            </CardBody>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-3">
              <Skeleton width="70%" height={18} />
              <Skeleton width="90%" height={14} />
              <Skeleton width="50%" height={14} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
