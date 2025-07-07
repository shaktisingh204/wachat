
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function RedirectToNewDashboard() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/facebook/custom-ecommerce');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}
