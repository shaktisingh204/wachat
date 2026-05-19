import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';

type PageProps = {
    params: Promise<{ shortCode: string }>;
};

export default async function ShortUrlRedirectPage({ params }: PageProps) {
    const resolvedParams = await params;
    const headersList = await headers();
    const hostHeader = headersList.get('host');
    const { shortCode } = resolvedParams;

    // A list of all top-level paths that are part of the application itself.
    // This prevents the short link handler from trying to resolve them.
    const protectedPaths = [
        'dashboard', 'admin', 'login', 'signup', 's', 'api', 'shop',
        'portfolio', 'web', 'embed', 'setup', 'pending-approval', 'pricing',
        'about-us', 'contact', 'careers', 'blog', 'terms-and-conditions',
        'privacy-policy', 'forgot-password', 'admin-login',
        'r', 'dl', 'expired', 'verify',
        // Public files and Next.js internal paths
        'favicon.ico', 'robots.txt', 'site.webmanifest', 'layout.tsx', 'page.tsx',
        'globals.css', 'opengraph-image.png', 'twitter-image.png', '_next'
    ];

    if (protectedPaths.includes(shortCode)) {
        notFound();
    }

    if (!shortCode) {
        notFound();
    }

    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;

    // Extract hostname from host header (which may include port)
    const requestHost = hostHeader ? hostHeader.split(':')[0] : null;

    // If the request's host matches the main app's host, it's a default link (lookupHost = null).
    // Otherwise, it's a custom domain link (lookupHost = requestHost).
    const lookupHost = (mainAppHost && requestHost === mainAppHost) ? null : requestHost;

    const { originalUrl, error, passwordHash, utmParams, isExpired } =
        await trackClickAndGetUrl(shortCode, lookupHost);

    if (isExpired) {
        redirect('/expired');
    }

    if (error || !originalUrl) {
        if (passwordHash) {
            redirect(`/verify/${shortCode}`);
        }
        notFound();
    }

    if (passwordHash) {
        redirect(`/verify/${shortCode}`);
    }

    let finalUrl = originalUrl;
    if (utmParams && Object.keys(utmParams).length > 0) {
        try {
            const u = new URL(originalUrl);
            const map: Record<string, string> = {
                source: 'utm_source',
                medium: 'utm_medium',
                campaign: 'utm_campaign',
                term: 'utm_term',
                content: 'utm_content',
            };
            for (const [key, param] of Object.entries(map)) {
                const val = utmParams[key];
                if (val) u.searchParams.set(param, val);
            }
            finalUrl = u.toString();
        } catch {
            // malformed URL — redirect to original unchanged
        }
    }

    redirect(finalUrl);
}
