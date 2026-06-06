import type { ReactNode } from 'react';

import { SabConnectSubnav } from './_components/sabconnect-subnav';

export default function SabConnectLayout({ children }: { children: ReactNode }) {
    return (
        <div className="ui20 flex w-full flex-col gap-6 p-4 md:p-6">
            <SabConnectSubnav />
            {children}
        </div>
    );
}
