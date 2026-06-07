import React from "react";
import { notFound, redirect } from 'next/navigation';
import { Clock, CalendarClock } from 'lucide-react';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';

import { Card, CardBody, EmptyState, Spinner } from '@/components/sabcrm/20ui';
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
                <body className="m-0">
                    <div className="ui20 flex min-h-screen items-center justify-center bg-[var(--st-bg-secondary)] p-6">
                        <Card variant="elevated" padding="none" className="w-full max-w-[400px]">
                            <CardBody className="p-8">
                                <EmptyState
                                    icon={Clock}
                                    tone="danger"
                                    title="Link expired"
                                    description="The link you are trying to access has expired or reached its click limit."
                                    action={
                                        <a
                                            href="/"
                                            className="text-sm font-medium text-[var(--st-accent)] no-underline hover:underline"
                                        >
                                            Go to homepage
                                        </a>
                                    }
                                />
                            </CardBody>
                        </Card>
                    </div>
                </body>
            </html>
        );
    }

    if (error === 'Link not yet active.') {
        return (
            <html lang="en">
                <head><title>Link Not Active</title></head>
                <body className="m-0">
                    <div className="ui20 flex min-h-screen items-center justify-center bg-[var(--st-bg-secondary)] p-6">
                        <Card variant="elevated" padding="none" className="w-full max-w-[400px]">
                            <CardBody className="p-8">
                                <EmptyState
                                    icon={CalendarClock}
                                    tone="warning"
                                    title="Link not active"
                                    description="The link you are trying to access is not yet active."
                                    action={
                                        <a
                                            href="/"
                                            className="text-sm font-medium text-[var(--st-accent)] no-underline hover:underline"
                                        >
                                            Go to homepage
                                        </a>
                                    }
                                />
                            </CardBody>
                        </Card>
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
                <title>Redirecting...</title>
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
            <body className="m-0">
                <div className="ui20 flex min-h-screen items-center justify-center bg-[var(--st-bg)] p-6">
                    <noscript>
                        {pixelIds.facebook && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                height="1"
                                width="1"
                                className="hidden"
                                alt=""
                                src={`https://www.facebook.com/tr?id=${pixelIds.facebook}&ev=PageView&noscript=1`}
                            />
                        )}
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            Click{' '}
                            <a href={originalUrl} className="font-medium text-[var(--st-accent)] underline">
                                here
                            </a>{' '}
                            to continue.
                        </p>
                    </noscript>

                    <div className="flex flex-col items-center gap-3 text-center">
                        <Spinner size="lg" label="Redirecting" />
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            Redirecting to your destination...
                        </p>
                    </div>
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
    <React.Suspense fallback={
      <div className="ui20 flex min-h-screen items-center justify-center bg-[var(--st-bg)]">
        <Spinner size="lg" label="Loading" />
      </div>
    }>
      <RetargetingPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
