import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Templates"
      eyebrow="SabSMS"
      description="Loading templates..."
      breadcrumbs={[{ label: "Templates" }]}
    >
      <div className="space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    </SabsmsPageShell>
  );
}
