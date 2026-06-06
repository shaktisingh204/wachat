import { Card, ZoruCardContent, ZoruCardHeader, Skeleton } from '@/components/sabcrm/20ui/compat';

export default function ProductionOrderLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header Skeleton */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-10" />
        </div>
      </header>

      {/* Body: two-column desktop, stacked mobile */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <Card>
            <ZoruCardHeader>
              <Skeleton className="h-5 w-32" />
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </ZoruCardContent>
          </Card>
          
          <Card>
            <ZoruCardHeader>
              <Skeleton className="h-5 w-40" />
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
              </div>
            </ZoruCardContent>
          </Card>
          
          <Card>
            <ZoruCardHeader>
              <Skeleton className="h-5 w-48" />
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </ZoruCardContent>
          </Card>
        </main>
        
        <aside className="w-full md:w-80 md:shrink-0">
          <div className="md:sticky md:top-4 space-y-4">
            <Card>
              <ZoruCardHeader>
                <Skeleton className="h-5 w-32" />
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardHeader>
                <Skeleton className="h-5 w-32" />
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 justify-self-end" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 justify-self-end" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24 justify-self-end" />
                  <Skeleton className="h-5 w-24 pt-1" />
                  <Skeleton className="h-5 w-28 justify-self-end pt-1" />
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
