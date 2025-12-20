
import { redirect } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

// This is now a single, async Server Component.
export default async function FacebookCallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
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
            <h1 className="text-xl font-semibold text-destructive">Authentication Error</h1>
            <p className="text-muted-foreground">Missing authorization code or state. Please try the connection process again.</p>
          </div>
        </div>
      );
  }

  try {
    // Await the server action directly
    await handleWabaOnboarding(code, state);
    // If the action is successful, redirect server-side
    redirect('/dashboard/setup?status=connecting');
  } catch (e: any) {
    // If the action throws an error, redirect with the error message
    redirect(`/dashboard/setup?error=${encodeURIComponent(e.message)}`);
  }

  // This part is for visual feedback during the server-side processing, though the redirect is usually very fast.
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Finalizing connection, please wait...</p>
      </div>
    </div>
  );
}
