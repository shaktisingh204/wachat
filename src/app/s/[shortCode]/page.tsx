
import { redirect, notFound } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';

// This page now only handles default domain redirects, e.g., myapp.com/s/abc
export default async function ShortUrlRedirectPage({ params }: { params: { shortCode: string } }) {
    if (!params.shortCode) {
        notFound();
    }
    
    // Pass `null` for the hostname to signify a default domain lookup
    const { originalUrl, error } = await trackClickAndGetUrl(params.shortCode, null);
    
    if (error || !originalUrl) {
        notFound();
    }
    
    redirect(originalUrl);
}
