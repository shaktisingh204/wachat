
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { redirect } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export default async function FacebookCallbackPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const code = searchParams.code as string | undefined;
    const error = searchParams.error_description as string | undefined;

    if (error) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(error)}`);
        return;
    }

    if (!code) {
        redirect(`/dashboard/setup?error=No%20authorization%20code%20received`);
        return;
    }

    const result = await handleWabaOnboarding(code);
    
    if (result.error) {
        const errorMessage = encodeURIComponent(result.error);
        redirect(`/dashboard/setup?error=${errorMessage}`);
    } else {
        redirect('/dashboard');
    }
}
