
'use client';

import React from 'react';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline">Sales</h1>
                <p className="text-muted-foreground">Manage your clients, quotations, invoices, and sales orders.</p>
            </div>
            <div className="flex-1">
                 {children}
            </div>
        </div>
    );
}
