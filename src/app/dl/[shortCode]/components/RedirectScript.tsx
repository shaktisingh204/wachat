'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface RedirectScriptProps {
    originalUrl: string;
    isIos: boolean;
    isAndroid: boolean;
}

export default function RedirectScript({ originalUrl, isIos, isAndroid }: RedirectScriptProps) {
    const [dots, setDots] = useState('');

    // Hydration-safe dots animation
    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
        }, 300);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <Loader2 className="w-12 h-12 text-zoru-ink animate-spin mb-6" />
            <h1 className="text-2xl font-semibold mb-2">
                Opening link{dots}
            </h1>
            <p className="text-zoru-ink-muted max-w-sm">
                If you are not redirected automatically within a few seconds, please click the button below.
            </p>
            
            <a 
                href={originalUrl}
                className="mt-8 text-zoru-ink hover:underline font-medium"
            >
                Click here to continue
            </a>

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
        </div>
    );
}
