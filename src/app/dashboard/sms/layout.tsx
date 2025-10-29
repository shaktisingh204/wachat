
'use client';

import React from 'react';

// This secondary layout is no longer needed as navigation is handled by the main app sidebar.
export default function SmsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            {children}
        </div>
    );
}
