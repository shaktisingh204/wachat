'use client';

import React from 'react';

export default function CrmTabLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full p-4 md:p-6 lg:p-8">
            <div className="flex-1">
                 {children}
            </div>
        </div>
    );
}
