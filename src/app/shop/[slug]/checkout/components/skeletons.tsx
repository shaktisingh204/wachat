import { Skeleton } from '@/components/sabcrm/20ui/compat';

export function CheckoutPageSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <Skeleton className="h-8 w-1/3 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-12 w-full mt-6" />
        </div>
      </div>
      <div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}
