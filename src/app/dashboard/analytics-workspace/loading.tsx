import {
  Card,
  CardBody,
  CardHeader,
  Skeleton,
} from '@/components/sabcrm/20ui';

/** Loading skeleton matching the workbooks overview shape: header → KPI strip → card grid. */
export default function Loading() {
  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <div className="flex flex-col gap-2">
        <Skeleton width={120} height={12} />
        <Skeleton width={220} height={28} />
        <Skeleton width={340} height={14} />
      </div>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-2">
              <Skeleton width={28} height={28} radius={8} />
              <Skeleton width={90} height={12} />
              <Skeleton width={64} height={24} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton width={150} height={16} />
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardBody className="flex flex-col gap-2">
                  <Skeleton width="70%" height={16} />
                  <Skeleton width="100%" height={12} />
                  <Skeleton width={140} height={20} />
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
