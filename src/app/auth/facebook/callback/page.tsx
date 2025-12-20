import { redirect } from 'next/navigation';
import { saveSystemToken } from '@/app/actions/onboarding.actions';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const code = params.code as string | undefined;

  if (!code) {
    redirect('/dashboard/setup?error=Authorization failed');
  }

  const result = await saveSystemToken(code);

  if (result.error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(result.error)}`);
  }

  // 🔔 WABA will arrive via webhook
  redirect('/dashboard/setup?status=connecting');
}
