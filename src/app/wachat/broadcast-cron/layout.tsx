import { redirect } from 'next/navigation';
import { getCachedSession } from '@/lib/server-cache';

const ALLOWED_EMAILS = ['ceo@waplia.in'];

export default async function BroadcastCronLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  const email = session?.user?.email ?? '';

  if (!ALLOWED_EMAILS.includes(email)) {
    redirect('/wachat');
  }

  return <>{children}</>;
}
