import { redirect } from 'next/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/dashboard/hrm/payroll/designations/${id}/edit`);
}
