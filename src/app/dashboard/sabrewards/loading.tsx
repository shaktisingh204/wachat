import * as React from 'react';

import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';

export default function RewardsLoading(): React.JSX.Element {
  return (
    <div className="20ui flex flex-col gap-5">
      <section aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-2">
              <Skeleton width="50%" height={12} />
              <Skeleton width="70%" height={22} />
            </CardBody>
          </Card>
        ))}
      </section>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton circle width={28} height={28} />
              <Skeleton width="40%" height={12} />
              <Skeleton width="20%" height={12} className="ml-auto" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
