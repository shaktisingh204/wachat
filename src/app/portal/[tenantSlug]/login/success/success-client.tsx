'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function SuccessClient({ tenantSlug }: { tenantSlug: string }) {
    const [timeLeft, setTimeLeft] = useState(60);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [timeLeft]);

    const handleOpenEmail = () => {
        window.location.href = 'mailto:';
    };

    return (
        <div className="mt-8 flex w-full flex-col items-center gap-6">
            {isMobile && (
                <button
                    onClick={handleOpenEmail}
                    className="w-full rounded-md bg-zoru-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zoru-ink focus:outline-none focus:ring-2 focus:ring-zoru-line focus:ring-offset-2"
                >
                    Open Email App
                </button>
            )}

            <div className="text-[13px] text-zoru-ink-muted">
                Didn&apos;t get it?{' '}
                {timeLeft > 0 ? (
                    <span>Wait {timeLeft}s to request a new link</span>
                ) : (
                    <Link
                        href={`/portal/${encodeURIComponent(tenantSlug)}/login`}
                        className="font-semibold text-zoru-ink hover:underline"
                    >
                        Request a new link
                    </Link>
                )}
            </div>
        </div>
    );
}
