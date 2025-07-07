

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

export default function RedirectToNewCustomEcommerceDashboard() {
    const router = useRouter();

    useEffect(() => {
        const projectId = localStorage.getItem('activeProjectId');
        if (projectId) {
            router.replace('/dashboard/facebook/custom-ecommerce/manage/shops');
        } else {
             router.replace('/dashboard/facebook/all-projects');
        }
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-4">Redirecting...</p>
        </div>
    );
}
