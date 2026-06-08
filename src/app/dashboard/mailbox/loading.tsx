import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';

/** Skeleton for the mailbox landing: header band, KPI strip, mailbox cards. */
export default function MailboxLoading() {
  return (
    <div className="20ui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton width={140} height={24} />
        <Skeleton width={360} height={14} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-3 p-4">
              <Skeleton circle width={32} height={32} />
              <Skeleton width="50%" height={12} />
              <Skeleton width="35%" height={20} />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-3 p-4">
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="100%" height={32} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
