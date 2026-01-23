// This page is now redundant as the root-level [shortCode] page handles all redirects.
// This is kept to prevent 404 errors for any existing /s/ links.
import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';

export default async function ShortUrlRedirectPage({ params }: { params: Promise<{ shortCode: string }> }) {
    const resolvedParams = await params;
    if (!resolvedParams.shortCode) {
        notFound();
    }
    
    // Pass `null` for the hostname to signify a default domain lookup
    const { originalUrl, error } = await trackClickAndGetUrl(resolvedParams.shortCode, null);
    
    if (error || !originalUrl) {
        notFound();
    }
    
    redirect(originalUrl);
}
