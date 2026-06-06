import React from 'react';
import { SabworkerlyNav } from './_components/sabworkerly-nav';

import '@/components/sabcrm/20ui/zoru-legacy.css';

export default function SabworkerlyLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="zoruui min-h-full bg-[color:var(--st-bg)]">
            <SabworkerlyNav />
            <div className="px-6 py-6">{children}</div>
        </div>
    );
}
