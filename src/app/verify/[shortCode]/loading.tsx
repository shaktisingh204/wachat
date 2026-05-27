import { Card } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zoru-ink px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-ink animate-pulse" />
          <div className="text-center w-full flex flex-col items-center gap-2">
            <div className="h-5 w-40 bg-zoru-ink rounded animate-pulse" />
            <div className="h-4 w-32 bg-zoru-ink/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-6 space-y-4 w-full">
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-zoru-ink rounded animate-pulse" />
            <div className="h-10 w-full bg-zoru-ink rounded animate-pulse" />
          </div>
          <div className="h-10 w-full bg-zoru-ink rounded animate-pulse mt-4" />
        </div>
      </Card>
    </div>
  );
}
