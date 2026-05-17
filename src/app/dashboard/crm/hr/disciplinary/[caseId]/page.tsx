import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ caseId: string }>;
}

export default async function Page({ params }: PageProps): Promise<never> {
  const { caseId } = await params;
  redirect(`/dashboard/hrm/hr/disciplinary/${caseId}`);
}
