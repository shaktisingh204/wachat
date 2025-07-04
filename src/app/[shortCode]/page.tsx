import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';

// This page handles custom domain redirects, e.g., my.link/abc
export default async function CustomDomainRedirectPage({ params }: { params: { shortCode: string } }) {
    const headersList = headers();
    const host = headersList.get('host');
    const { shortCode } = params;

    // Don't try to process paths that are clearly not shortcodes on custom domains
    const protectedPaths = ['dashboard', 'admin', 'login', 'signup', 's'];
    if (protectedPaths.includes(shortCode)) {
        notFound();
    }
    
    if (!host || !shortCode) {
        notFound();
    }

    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;

    // This page should only handle custom domains, not the main app domain
    if (!mainAppHost || host === mainAppHost) {
        notFound();
    }
    
    const { originalUrl, error } = await trackClickAndGetUrl(shortCode, host);
    
    if (error || !originalUrl) {
        notFound();
    }
    
    redirect(originalUrl);
}
