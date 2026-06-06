'use client';

import * as React from 'react';

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="ui20 flex h-full w-full flex-col overflow-auto p-4 md:p-6">
            {children}
        </div>
    );
}
