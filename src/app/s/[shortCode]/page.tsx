
import { redirect, notFound } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';

export default async function ShortUrlRedirectPage({ params }: { params: { shortCode: string } }) {
    if (!params.shortCode) {
        notFound();
    }
    
    const { originalUrl, error } = await trackClickAndGetUrl(params.shortCode);
    
    if (error || !originalUrl) {
        notFound();
    }
    
    redirect(originalUrl);
}
