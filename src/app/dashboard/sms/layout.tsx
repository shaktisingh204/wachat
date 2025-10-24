
'use client';

import React from 'react';

export default function SmsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline">SMS Suite</h1>
                <p className="text-muted-foreground">Manage your SMS campaigns and provider integrations.</p>
            </div>
            <div className="flex-1">
                 {children}
            </div>
        </div>
    );
}
