
'use client';

import React from 'react';

export default function PurchasesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline">Purchases</h1>
                <p className="text-muted-foreground">Manage your vendors, orders, and expenses.</p>
            </div>
            <div className="mt-4 flex-1">
                 {children}
            </div>
        </div>
    );
}
