
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from 'react';
import { CrmTabLayout } from "@/components/wabasimplify/crm-tab-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isAutomationPage = pathname.startsWith('/dashboard/crm/automations');

    if (isAutomationPage) {
        return <div className="h-full w-full">{children}</div>;
    }

    return (
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <CrmTabLayout>
                {children}
            </CrmTabLayout>
        </Suspense>
    );
}
