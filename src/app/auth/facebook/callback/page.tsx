import { redirect } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

// ✅ Async Server Component (correct)
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
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Authentication Error
          </h1>
          <p className="text-muted-foreground">
            Missing authorization code or state. Please try the connection
            process again.
          </p>
        </div>
      </div>
    );
  }

  try {
    // ✅ Call server action
    await handleWabaOnboarding(code, state);

    // ✅ Embedded Signup → wait for webhook
    redirect('/dashboard/setup?status=connecting');
  } catch (e: any) {
    redirect(`/dashboard/setup?error=${encodeURIComponent(e.message)}`);
  }
}
