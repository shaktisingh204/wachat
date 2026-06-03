'use client';

import * as React from 'react';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="zoruui flex h-full w-full flex-col p-4 md:p-6 overflow-auto">
            {children}
        </div>
    );
}
