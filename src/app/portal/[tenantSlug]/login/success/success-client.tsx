'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/sabcrm/20ui';

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
                <Button variant="primary" block onClick={handleOpenEmail}>
                    Open Email App
                </Button>
            )}

            <div className="text-[13px] text-[var(--st-text-secondary)]">
                Didn&apos;t get it?{' '}
                {timeLeft > 0 ? (
                    <span>Wait {timeLeft}s to request a new link</span>
                ) : (
                    <Link
                        href={`/portal/${encodeURIComponent(tenantSlug)}/login`}
                        className="font-semibold text-[var(--st-text)] hover:underline"
                    >
                        Request a new link
                    </Link>
                )}
            </div>
        </div>
    );
}
