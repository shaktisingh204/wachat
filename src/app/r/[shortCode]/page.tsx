import React from "react";
import { notFound, redirect } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';
import { PasswordForm } from './password-form';

export const dynamic = 'force-dynamic';


type Props = { 
    params: Promise<{ shortCode: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function RetargetingPageContent({ params, searchParams }: Props) {
    const { shortCode } = await params;
    const { pwd } = await searchParams;
    
    const password = typeof pwd === 'string' ? pwd : null;

    const headersList = await headers();
    const hostHeader = headersList.get('host');
    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
    const requestHost = hostHeader ? hostHeader.split(':')[0] : null;
    const lookupHost = (mainAppHost && requestHost === mainAppHost) ? null : requestHost;

    const { originalUrl, error, isExpired, passwordHash, pixelIds } = await trackClickAndGetUrl(shortCode, lookupHost, password);

    if (isExpired || error === 'Link expired') {
        return (
            <html lang="en">
                <head><title>Link Expired</title></head>
                <body style={{ fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: 0, backgroundColor: '#f9fafb' }}>
                    <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h1 style={{ fontSize: '1.5rem', color: '#dc2626', marginBottom: '1rem' }}>Link Expired</h1>
                        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>The link you are trying to access has expired or reached its click limit.</p>
                        <a href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Go to Homepage</a>
                    </div>
                </body>
            </html>
        );
    }

    if (error === 'Link not yet active.') {
        return (
            <html lang="en">
                <head><title>Link Not Active</title></head>
                <body style={{ fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: 0, backgroundColor: '#f9fafb' }}>
                    <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h1 style={{ fontSize: '1.5rem', color: '#d97706', marginBottom: '1rem' }}>Link Not Active</h1>
                        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>The link you are trying to access is not yet active.</p>
                        <a href="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Go to Homepage</a>
                    </div>
                </body>
            </html>
        );
    }

    if (passwordHash && !originalUrl) {
        // If password was provided but incorrect, we can show an error in the form
        return <PasswordForm shortCode={shortCode} hasError={!!password} />;
    }

    if (!originalUrl) {
        notFound();
    }

    // Check if there are any pixel IDs to fire
    const hasPixels = pixelIds && (pixelIds.facebook || pixelIds.google || pixelIds.tiktok);

    if (!hasPixels) {
        // Fast edge redirect if no pixels are needed.
        // We use Next.js redirect which throws and handles the 307 response.
        redirect(originalUrl);
    }

    // If there are pixels, render HTML to fire them and redirect
    return (
        <html lang="en">
            <head>
                <meta httpEquiv="refresh" content={`1;url=${originalUrl}`} />
                <title>Redirecting…</title>
                {/* Insert Pixels here */}
                {pixelIds.facebook && (
                    <script dangerouslySetInnerHTML={{
                        __html: `!function(f,b,e,v,n,t,s)
                        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                        n.queue=[];t=b.createElement(e);t.async=!0;
                        t.src=v;s=b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t,s)}(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');
                        fbq('init', '${pixelIds.facebook}');
                        fbq('track', 'PageView');`
                    }} />
                )}
                {pixelIds.google && (
                    <>
                        <script async src={`https://www.googletagmanager.com/gtag/js?id=${pixelIds.google}`}></script>
                        <script dangerouslySetInnerHTML={{
                            __html: `window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${pixelIds.google}');`
                        }} />
                    </>
                )}
                {pixelIds.tiktok && (
                    <script dangerouslySetInnerHTML={{
                        __html: `!function (w, d, t) {
                        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                        ttq.load('${pixelIds.tiktok}');
                        ttq.page();
                        }(window, document, 'ttq');`
                    }} />
                )}
            </head>
            <body style={{ backgroundColor: '#ffffff', margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
                <noscript>
                    {pixelIds.facebook && (
                        <img height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${pixelIds.facebook}&ev=PageView&noscript=1`} />
                    )}
                    <p>Click <a href={originalUrl}>here</a> to continue.</p>
                </noscript>
                
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                    <p style={{ color: '#4b5563' }}>Redirecting to your destination...</p>
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    `}} />
                </div>

                <script
                    dangerouslySetInnerHTML={{
                        __html: `setTimeout(function(){ window.location.replace(${JSON.stringify(originalUrl)}); }, 500);`
                    }}
                />
            </body>
        </html>
    );
}


export default function RetargetingPage({ params, searchParams }: Props) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <RetargetingPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
