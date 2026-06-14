import { Skeleton } from "@/components/sabcrm/20ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
