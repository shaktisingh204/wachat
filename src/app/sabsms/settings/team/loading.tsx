import { Skeleton } from "@/components/sabcrm/20ui/zoru";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Team"
      eyebrow="Settings"
      description="Loading team members..."
      breadcrumbs={[{ label: "Settings", href: "/sabsms/settings" }, { label: "Team" }]}
    >
      <div className="space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    </SabsmsPageShell>
  );
}
