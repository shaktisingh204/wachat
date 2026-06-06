import { Card, CardBody, CardHeader } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="h-6 w-48 bg-[var(--st-bg-muted)] rounded mb-2" />
          <div className="h-8 w-64 bg-[var(--st-bg-muted)] rounded mb-2" />
          <div className="h-4 w-full max-w-sm bg-[var(--st-bg-muted)] rounded" />
        </div>
        <Card>
          <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
            <div className="h-5 w-48 bg-[var(--st-bg-muted)]/80 rounded" />
          </CardHeader>
          <CardBody className="p-4 flex flex-col gap-3">
            <div className="h-4 w-full bg-[var(--st-bg-muted)]/60 rounded" />
            <div className="h-4 w-full bg-[var(--st-bg-muted)]/60 rounded" />
            <div className="h-4 w-3/4 bg-[var(--st-bg-muted)]/60 rounded" />
          </CardBody>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <div className="flex flex-col gap-5 sticky top-6">
          <div className="h-6 w-48 bg-[var(--st-bg-muted)] rounded" />
          <Card className="shadow-md border-foreground/10">
            <CardBody className="p-5 flex flex-col gap-4">
              <div className="h-5 w-32 bg-[var(--st-bg-muted)]/80 rounded" />
              <div className="flex flex-col gap-3">
                <div className="h-10 w-full bg-[var(--st-bg-muted)]/60 rounded" />
                <div className="h-10 w-full bg-[var(--st-bg-muted)]/60 rounded" />
                <div className="h-24 w-full bg-[var(--st-bg-muted)]/60 rounded" />
              </div>
              <div className="mt-2 flex justify-end">
                <div className="h-9 w-32 bg-[var(--st-bg-muted)]/80 rounded" />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
