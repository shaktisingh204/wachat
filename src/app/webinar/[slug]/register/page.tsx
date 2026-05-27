import { notFound } from 'next/navigation';
import { getSabwebinarBySlug } from '@/app/actions/sabwebinar.actions';
import { RegisterForm } from './register-form';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function WebinarRegisterPage({ params }: Params) {
  const { slug } = await params;
  const { data: webinar } = await getSabwebinarBySlug(slug);
  if (!webinar) notFound();
  return <RegisterForm slug={webinar.slug} title={webinar.title} theme={webinar.landingTheme} />;
}
