
import { redirect } from 'next/navigation';
import { handleWabaOnboardingTokenExchange } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

// This is now an async Server Component to correctly handle searchParams
export default async function FacebookCallbackPage({
  searchParams,
}: {
  // 🔥 IMPORTANT: searchParams IS A PROMISE
  searchParams: Promise<SearchParams>;
}) {
  // 🔥 MUST unwrap it
  const params = await searchParams;

  const code = params.code as string | undefined;
  const state = params.state as string | undefined;
  const error = params.error_description as string | undefined;
  
  if (error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
      // This is a user-facing error for a failed OAuth flow.
      return (
            <div className="flex h-screen w-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <h1 className="text-xl font-semibold text-destructive">
                        Authentication Error
                    </h1>
                    <p className="text-muted-foreground">Missing authorization code or state. Please try the connection process again.</p>
                </div>
            </div>
      );
  }

  // If we have a code and state, proceed with the server action.
  const result = await handleWabaOnboardingTokenExchange(code, state);

  if (result.error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(result.error)}`);
  } else {
    // Successfully stored token, now wait for webhook.
    // The UI will show a "connecting" state based on this URL param.
    redirect('/dashboard/setup?status=connecting');
  }
}
