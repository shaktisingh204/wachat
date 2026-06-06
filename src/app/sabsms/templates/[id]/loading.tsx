import { Skeleton } from "@/components/sabcrm/20ui/zoru";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Template Editor"
      eyebrow="SabSMS"
      description="Loading editor..."
      breadcrumbs={[{ label: "Templates", href: "/sabsms/templates" }, { label: "Loading" }]}
    >
      <div className="space-y-6 mt-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    </SabsmsPageShell>
  );
}
