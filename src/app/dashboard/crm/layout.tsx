
'use client';

import { usePathname } from 'next/navigation';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isAutomationPage = pathname.startsWith('/dashboard/crm/automations');

    if (isAutomationPage) {
        return <div className="h-full w-full">{children}</div>;
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            {children}
        </div>
    );
}
