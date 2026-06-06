import { Card, Skeleton } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading tax filings"
    >
      {/* Header row: title + primary action placeholders */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-64" radius="var(--st-radius)" />
          <Skeleton className="h-9 w-28" radius="var(--st-radius)" />
        </div>
      </div>

      {/* Body: skeleton list rows inside a card */}
      <Card className="p-0">
        <div className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>

      <span className="sr-only">Loading tax filings</span>
    </div>
  );
}
