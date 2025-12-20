
import { redirect } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { LoaderCircle } from 'lucide-react';

// This is now a pure Server Component that directly handles the callback.
export default async function FacebookCallbackPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const code = searchParams.code as string | undefined;
    const error = searchParams.error_description as string | undefined;

    if (error) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        // This case handles when the user denies the permission on Facebook's side.
        redirect(`/dashboard/setup?error=No%20authorization%20code%20received.`);
    }

    // Directly await the server action with the code.
    const result = await handleWabaOnboarding(code);
    
    // Redirect based on the outcome of the server action.
    if (result.error) {
        const errorMessage = encodeURIComponent(result.error);
        redirect(`/dashboard/setup?error=${errorMessage}`);
    } else {
        // On success, redirect to the main dashboard.
        redirect('/dashboard');
    }

    // A fallback loader, though the user will likely be redirected before seeing this.
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Finalizing connection...</p>
        </div>
    );
}
