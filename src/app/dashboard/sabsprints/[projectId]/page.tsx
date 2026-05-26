import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AgileRootPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(`/dashboard/sabsprints/${projectId}/backlog`);
}
