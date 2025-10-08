import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
