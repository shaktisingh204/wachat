import { Skeleton } from "@/components/zoruui";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Webhook Delivery Log"
      description="Loading webhook logs..."
      breadcrumbs={[{ label: "Webhooks", href: "/sabsms/webhooks" }, { label: "Log" }]}
    >
      <div className="space-y-6 mt-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    </SabsmsPageShell>
  );
}
