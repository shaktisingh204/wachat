
'use client';

import React from 'react';

// This layout is kept minimal because navigation is now handled by the main dashboard layout.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            {children}
        </div>
    );
}
