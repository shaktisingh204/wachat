
'use client';

import React from 'react';

export default function TeamLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            {children}
        </div>
    );
}
