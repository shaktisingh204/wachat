
import { redirect } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

// This is now a Server Component
export default async function FacebookCallbackPage({
  searchParams,
}: {
  // 🔥 IMPORTANT: searchParams IS A PROMISE
  searchParams: SearchParams;
}) {

  const code = searchParams.code as string | undefined;
  const state = searchParams.state as string | undefined;
  const error = searchParams.error_description as string | undefined;
  
  if (error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
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

  const result = await handleWabaOnboarding(code, state);

  if (result.error) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(result.error)}`);
  } else {
    // Successfully stored token, now wait for webhook
    redirect('/dashboard/setup?status=connecting');
  }

  // This part is for visual feedback while the server-side logic runs, though redirect is usually instant.
  return (
    <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Finalizing connection, please wait...</h1>
            <p className="text-muted-foreground">Do not close this window. You will be redirected shortly.</p>
        </div>
    </div>
  );
}
