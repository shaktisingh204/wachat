import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { Skeleton, Card, CardHeader, CardBody } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <SabsmsPageShell
      title="Billing & Credits"
      description="Loading billing details..."
      eyebrow="Settings"
      breadcrumbs={[{ label: "Settings" }, { label: "Billing" }]}
    >
      <div className="space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardBody>
            <Skeleton className="h-[300px] w-full" />
          </CardBody>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
