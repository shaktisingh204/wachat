import { Card, CardBody, CardHeader, Skeleton } from '@/components/sabcrm/20ui';

export default function SabmeetLoading() {
  return (
    <div className="space-y-6 p-6" aria-busy="true" aria-label="Loading meetings">
      <div className="space-y-2">
        <Skeleton width={72} height={14} />
        <Skeleton width={180} height={28} />
        <Skeleton width={320} height={14} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton width={96} height={12} />
              <Skeleton width={64} height={28} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <CardHeader>
          <Skeleton width={160} height={18} />
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardBody className="space-y-3">
                  <Skeleton width="70%" height={16} />
                  <Skeleton width="50%" height={12} />
                  <Skeleton width="40%" height={12} />
                  <div className="flex gap-2 pt-2">
                    <Skeleton width={64} height={30} radius={8} />
                    <Skeleton width={88} height={30} radius={8} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
