import { Skeleton } from '@/components/zoruui';

export default function SeoProjectsLoading() {
  return (
    <div className="flex flex-col gap-8 w-full p-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-3 mb-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
