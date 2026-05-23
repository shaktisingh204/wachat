import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import type { ShortUrl } from '@/lib/definitions';

const getCachedUrlRules = unstable_cache(
    async (shortCode: string, lookupHost: string | null) => {
        const { db } = await connectToDatabase();
        const doc = await db.collection('short_urls').findOne({
            shortCode,
            ...(lookupHost ? { customDomain: lookupHost } : {})
        }) as ShortUrl | null;
        if (!doc) return null;
        return {
            originalUrl: doc.originalUrl,
            splitTargets: doc.splitTargets,
            geoTargets: doc.geoTargets,
            deviceTargets: doc.deviceTargets,
        };
    },
    ['short-url-rules'],
    { revalidate: 60 }
);

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

    const rules = await getCachedUrlRules(shortCode, lookupHost);
    if (rules) {
        let routedUrl: string | null = null;
        const country = headersList.get('x-vercel-ip-country') || headersList.get('x-real-ip-country') || 'unknown';
        const ua = (headersList.get('user-agent') || '').toLowerCase();

        // 1. Geo routing
        if (rules.geoTargets && rules.geoTargets.length > 0) {
            const target = rules.geoTargets.find(t => t.country.toLowerCase() === country.toLowerCase());
            if (target) routedUrl = target.url;
        }

        // 2. Device routing
        if (!routedUrl && rules.deviceTargets && rules.deviceTargets.length > 0) {
            let deviceType = 'desktop';
            if (/iphone|ipad|ipod/i.test(ua)) deviceType = 'ios';
            else if (/android/i.test(ua)) deviceType = 'android';
            else if (/ipad|tablet/i.test(ua)) deviceType = 'tablet';
            else if (/mobi|touch/i.test(ua)) deviceType = 'mobile';
            
            const target = rules.deviceTargets.find(t => t.device === deviceType) || 
                           rules.deviceTargets.find(t => t.device === 'mobile' && (deviceType === 'ios' || deviceType === 'android'));
            if (target) routedUrl = target.url;
        }

        // 3. A/B Testing
        if (!routedUrl && rules.splitTargets && rules.splitTargets.length > 0) {
            const allTargets = [{ url: originalUrl, weight: 50 }, ...rules.splitTargets];
            const totalWeight = allTargets.reduce((sum, t) => sum + t.weight, 0);
            let random = Math.random() * totalWeight;
            for (const target of allTargets) {
                if (random < target.weight) {
                    routedUrl = target.url;
                    break;
                }
                random -= target.weight;
            }
        }
        
        if (routedUrl) finalUrl = routedUrl;
    }

    if (utmParams && Object.keys(utmParams).length > 0) {
        try {
            const u = new URL(finalUrl);
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
