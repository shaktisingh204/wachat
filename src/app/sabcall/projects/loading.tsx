import { Skeleton } from "@/components/sabcrm/20ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
