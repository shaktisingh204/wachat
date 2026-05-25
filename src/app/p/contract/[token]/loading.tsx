import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, Skeleton } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <Skeleton className="mt-2 h-8 w-3/4 rounded" />
          <Skeleton className="mt-2 h-4 w-1/2 rounded" />
        </div>
        
        <Card>
          <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-4 flex flex-col gap-3">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-6 w-full rounded" />
          </ZoruCardContent>
        </Card>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
          <div className="rounded-xl border border-border bg-secondary/35 p-5">
            <Skeleton className="h-4 w-full mb-2 rounded" />
            <Skeleton className="h-4 w-full mb-2 rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        </div>
      </div>
      
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          
          <Card className="shadow-md border-foreground/10">
            <ZoruCardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-10 w-full rounded" />
              </div>
              <Skeleton className="h-32 w-full mt-2 rounded-lg" />
              <div className="flex justify-between mt-2">
                <Skeleton className="h-9 w-20 rounded" />
                <Skeleton className="h-9 w-32 rounded" />
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
