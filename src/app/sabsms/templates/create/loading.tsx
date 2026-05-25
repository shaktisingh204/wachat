import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-card">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="p-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    </div>
  );
}
