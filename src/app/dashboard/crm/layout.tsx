
'use client';

import React from 'react';

// This layout is now simplified to just pass children through,
// as navigation is handled by the main dashboard sidebar.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full h-full">
            {children}
        </div>
    );
}
