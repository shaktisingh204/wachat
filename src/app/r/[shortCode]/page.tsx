import { notFound } from 'next/navigation';
import { trackClickAndGetUrl } from '@/app/actions/url-shortener.actions';
import { headers } from 'next/headers';

type Props = { params: Promise<{ shortCode: string }> };

export default async function RetargetingPage({ params }: Props) {
    const { shortCode } = await params;
    const headersList = await headers();
    const hostHeader = headersList.get('host');
    const mainAppHost = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
    const requestHost = hostHeader ? hostHeader.split(':')[0] : null;
    const lookupHost = (mainAppHost && requestHost === mainAppHost) ? null : requestHost;

    const { originalUrl } = await trackClickAndGetUrl(shortCode, lookupHost);
    if (!originalUrl) notFound();

    return (
        <html>
            <head>
                <meta httpEquiv="refresh" content={`0;url=${originalUrl}`} />
                <title>Redirecting…</title>
            </head>
            <body>
                <noscript>
                    <p>Click <a href={originalUrl}>here</a> to continue.</p>
                </noscript>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            // Fire retargeting pixels here when pixel IDs are passed
                            setTimeout(function(){ window.location.href = ${JSON.stringify(originalUrl)}; }, 150);
                        `,
                    }}
                />
            </body>
        </html>
    );
}
