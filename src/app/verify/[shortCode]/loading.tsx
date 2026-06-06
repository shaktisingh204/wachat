import { Card } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--st-text)] px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)] animate-pulse" />
          <div className="text-center w-full flex flex-col items-center gap-2">
            <div className="h-5 w-40 bg-[var(--st-text)] rounded animate-pulse" />
            <div className="h-4 w-32 bg-[var(--st-text)]/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-6 space-y-4 w-full">
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-[var(--st-text)] rounded animate-pulse" />
            <div className="h-10 w-full bg-[var(--st-text)] rounded animate-pulse" />
          </div>
          <div className="h-10 w-full bg-[var(--st-text)] rounded animate-pulse mt-4" />
        </div>
      </Card>
    </div>
  );
}
