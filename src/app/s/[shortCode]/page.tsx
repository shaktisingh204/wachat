import React from "react";
import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import type { ShortUrl } from '@/lib/definitions';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';


const getCachedUrlData = unstable_cache(
    async (shortCode: string) => {
        const { db } = await connectToDatabase();
        const doc = await db.collection('short_urls').findOne({
            shortCode,
        }) as ShortUrl | null;
        if (!doc) return null;
        return {
            originalUrl: doc.originalUrl,
            splitTargets: doc.splitTargets,
            geoTargets: doc.geoTargets,
            deviceTargets: doc.deviceTargets,
            pixelIds: doc.pixelIds,
        };
    },
    ['short-url-data-s-route'],
    { revalidate: 60 }
);

async function ShortUrlRedirectPageContent({ params }: { params: Promise<{ shortCode: string }> }) {
    const resolvedParams = await params;
    const { shortCode } = resolvedParams;

    if (!shortCode) {
        notFound();
    }
    
    const headersList = await headers();
    
    // Pass `null` for the hostname to signify a default domain lookup
    const { originalUrl, error, passwordHash, utmParams, isExpired } = await trackClickAndGetUrl(shortCode, null);
    
    if (isExpired) {
        redirect(`/expired?code=${shortCode}`);
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
    let pixelIds: ShortUrl['pixelIds'] | undefined = undefined;

    const data = await getCachedUrlData(shortCode);
    if (data) {
        let routedUrl: string | null = null;
        const country = headersList.get('x-vercel-ip-country') || headersList.get('x-real-ip-country') || 'unknown';
        const ua = (headersList.get('user-agent') || '').toLowerCase();

        // 1. Geo routing
        if (data.geoTargets && data.geoTargets.length > 0) {
            const target = data.geoTargets.find(t => t.country.toLowerCase() === country.toLowerCase());
            if (target) routedUrl = target.url;
        }

        // 2. Device routing
        if (!routedUrl && data.deviceTargets && data.deviceTargets.length > 0) {
            let deviceType = 'desktop';
            if (/iphone|ipad|ipod/i.test(ua)) deviceType = 'ios';
            else if (/android/i.test(ua)) deviceType = 'android';
            else if (/ipad|tablet/i.test(ua)) deviceType = 'tablet';
            else if (/mobi|touch/i.test(ua)) deviceType = 'mobile';
            
            const target = data.deviceTargets.find(t => t.device === deviceType) || 
                           data.deviceTargets.find(t => t.device === 'mobile' && (deviceType === 'ios' || deviceType === 'android'));
            if (target) routedUrl = target.url;
        }

        // 3. A/B Testing
        if (!routedUrl && data.splitTargets && data.splitTargets.length > 0) {
            const allTargets = [{ url: originalUrl, weight: 50 }, ...data.splitTargets];
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
        
        pixelIds = data.pixelIds;
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
            // malformed URL
        }
    }

    // Handle tracking pixels securely and respectfully of privacy laws
    const dnt = headersList.get('dnt') === '1';
    const secGpc = headersList.get('sec-gpc') === '1';
    
    const hasPixels = pixelIds && (pixelIds.facebook || pixelIds.google || pixelIds.tiktok);
    const trackingAllowed = !dnt && !secGpc;

    if (hasPixels && trackingAllowed) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--st-bg-secondary)]">
                {/* Meta redirect as fallback */}
                <meta httpEquiv="refresh" content={`2;url=${finalUrl}`} />
                
                {pixelIds?.facebook && (
                    <Script
                        id="fb-pixel"
                        strategy="afterInteractive"
                        dangerouslySetInnerHTML={{
                            __html: `
                                !function(f,b,e,v,n,t,s)
                                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                                n.queue=[];t=b.createElement(e);t.async=!0;
                                t.src=v;s=b.getElementsByTagName(e)[0];
                                s.parentNode.insertBefore(t,s)}(window, document,'script',
                                'https://connect.facebook.net/en_US/fbevents.js');
                                fbq('init', '${pixelIds.facebook}');
                                fbq('track', 'PageView');
                            `
                        }}
                    />
                )}

                {pixelIds?.google && (
                    <>
                        <Script
                            id="google-analytics-script"
                            strategy="afterInteractive"
                            src={`https://www.googletagmanager.com/gtag/js?id=${pixelIds.google}`}
                        />
                        <Script
                            id="google-analytics-init"
                            strategy="afterInteractive"
                            dangerouslySetInnerHTML={{
                                __html: `
                                    window.dataLayer = window.dataLayer || [];
                                    function gtag(){dataLayer.push(arguments);}
                                    gtag('js', new Date());
                                    gtag('config', '${pixelIds.google}');
                                `
                            }}
                        />
                    </>
                )}

                {pixelIds?.tiktok && (
                    <Script
                        id="tiktok-pixel"
                        strategy="afterInteractive"
                        dangerouslySetInnerHTML={{
                            __html: `
                                !function (w, d, t) {
                                    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                                    ttq.load('${pixelIds.tiktok}');
                                    ttq.page();
                                }(window, document, 'ttq');
                            `
                        }}
                    />
                )}
                
                <div id="redirect-data" data-url={finalUrl} style={{ display: 'none' }}></div>
                <Script id="redirect-script" strategy="afterInteractive" dangerouslySetInnerHTML={{
                    __html: `
                        setTimeout(function() {
                            var url = document.getElementById('redirect-data').getAttribute('data-url');
                            if (url) window.location.replace(url);
                        }, 1000);
                    `
                }} />
                
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-[var(--st-text)]" />
                    <p className="text-lg font-medium text-[var(--st-text)]">Taking you to your destination...</p>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        If you are not redirected automatically, <a href={finalUrl} className="text-[var(--st-text)] hover:underline">click here</a>.
                    </p>
                </div>
            </main>
        );
    }

    // Direct redirect if no pixels or tracking is not allowed (privacy first)
    redirect(finalUrl);
}


export default function ShortUrlRedirectPage({ params }: { params: Promise<{ shortCode: string }> }) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ShortUrlRedirectPageContent params={params} />
    </React.Suspense>
  );
}
