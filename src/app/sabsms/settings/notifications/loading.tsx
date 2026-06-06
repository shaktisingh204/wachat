import { Skeleton } from '@/components/sabcrm/20ui';
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Notifications & Alerts"
      description="Loading notifications settings..."
      eyebrow="Settings"
      breadcrumbs={[{ label: "Settings" }, { label: "Notifications" }]}
    >
      <div className="space-y-6 mt-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    </SabsmsPageShell>
  );
}
