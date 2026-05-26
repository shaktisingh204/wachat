import { SprintCreateForm } from './_components/sprint-create-form';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function NewSprintPage({ params }: PageProps) {
  const { projectId } = await params;
  return <SprintCreateForm projectId={projectId} />;
}
