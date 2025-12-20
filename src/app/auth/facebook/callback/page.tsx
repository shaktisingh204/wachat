import { redirect } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // ✅ UNWRAP searchParams
  const params = await searchParams;

  const code = params.code as string | undefined;
  const error = params.error_description as string | undefined;

  if (error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    redirect(`/dashboard/setup?error=No%20authorization%20code%20received.`);
  }

  const result = await handleWabaOnboarding(code);

  if (result?.error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(result.error)}`);
  }

  redirect('/dashboard');
}
