import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { Metadata } from 'next';
import PasswordForm from './components/PasswordForm';
import ErrorState from './components/ErrorState';
import RedirectScript from './components/RedirectScript';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ shortCode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return {
        title: 'Opening app…'
    };
}

export default async function DeepLinkPage({ params }: Props) {
    const { shortCode } = await params;
    const headersList = await headers();
    const ua = headersList.get('user-agent') ?? '';
    const hostHeader = headersList.get('host');
    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
    const requestHost = hostHeader ? hostHeader.split(':')[0] : null;
    const lookupHost = (mainAppHost && requestHost === mainAppHost) ? null : requestHost;

    const { originalUrl, error, passwordHash, isExpired } = await trackClickAndGetUrl(shortCode, lookupHost);

    if (error) {
        return <ErrorState title="Link Error" message={error} />;
    }

    if (isExpired) {
        return <ErrorState title="Link Expired" message="This link is no longer active." />;
    }

    if (passwordHash) {
        return <PasswordForm shortCode={shortCode} />;
    }

    if (!originalUrl) notFound();

    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    return (
        <main className="min-h-screen bg-background text-foreground font-sans antialiased">
            <RedirectScript originalUrl={originalUrl} isIos={isIos} isAndroid={isAndroid} />
        </main>
    );
}
