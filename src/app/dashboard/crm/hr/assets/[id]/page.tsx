import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps): Promise<never> {
  const { id } = await params;
  redirect(`/dashboard/hrm/hr/assets/${id}`);
}
