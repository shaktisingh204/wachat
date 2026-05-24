import { Skeleton } from "@/components/zoruui";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-96 mt-2" />
      <div className="flex flex-col gap-4 mt-8">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
