import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';

type Props = { params: Promise<{ shortCode: string }> };

export default async function DeepLinkPage({ params }: Props) {
    const { shortCode } = await params;
    const headersList = await headers();
    const ua = headersList.get('user-agent') ?? '';
    const hostHeader = headersList.get('host');
    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
    const requestHost = hostHeader ? hostHeader.split(':')[0] : null;
    const lookupHost = (mainAppHost && requestHost === mainAppHost) ? null : requestHost;

    const { originalUrl } = await trackClickAndGetUrl(shortCode, lookupHost);
    if (!originalUrl) notFound();

    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    return (
        <html>
            <head>
                <title>Opening app…</title>
            </head>
            <body>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            var isIos = ${isIos};
                            var isAndroid = ${isAndroid};
                            var fallback = ${JSON.stringify(originalUrl)};
                            // Deep link URIs would be injected here from ShortUrl.deepLink
                            // For now, fall through to web URL after 500ms
                            setTimeout(function(){ window.location.href = fallback; }, 500);
                        `,
                    }}
                />
                <noscript>
                    <meta httpEquiv="refresh" content={`0;url=${originalUrl}`} />
                </noscript>
            </body>
        </html>
    );
}
