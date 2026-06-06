import { Skeleton } from "@/components/zoruui";

export default function Loading() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] bg-[var(--st-bg-secondary)]">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-[var(--st-bg-secondary)]">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="p-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    </div>
  );
}
