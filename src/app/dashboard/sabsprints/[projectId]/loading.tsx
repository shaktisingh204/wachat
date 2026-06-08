import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';

export default function AgileLoading() {
  return (
    <div className="20ui flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace…</span>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardBody>
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardBody>
          </Card>
        ))}
      </section>
      <Card>
        <CardBody>
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
