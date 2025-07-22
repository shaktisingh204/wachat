
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is now deprecated. It's being replaced by the WhatsApp Pay settings page.
// This component will redirect users to the new location to avoid confusion.
export default function DeprecatedRazorpayPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/whatsapp-pay/settings');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <p>This page has moved. Redirecting to WhatsApp Pay settings...</p>
        </div>
    );
}
