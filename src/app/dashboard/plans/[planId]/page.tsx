import { redirect } from 'next/navigation';

// Legacy duplicate of the admin plan editor — /dashboard/plans already
// redirects to /admin/dashboard/plans, so the [planId] leaf follows it.
export default async function PlanEditorRedirect({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  redirect(`/admin/dashboard/plans/${planId}`);
}
