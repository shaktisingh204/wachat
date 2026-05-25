import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16 justify-self-end" />
          <Skeleton className="h-4 w-20 justify-self-end" />
          <Skeleton className="h-4 w-16 justify-self-end" />
        </div>
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 p-4 items-center">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-12 justify-self-end" />
              <Skeleton className="h-4 w-12 justify-self-end" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
