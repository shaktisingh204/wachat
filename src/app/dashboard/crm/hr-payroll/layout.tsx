
'use client';

import React from 'react';

// This secondary layout is no longer needed as navigation is handled by the main CRM layout.
export default function HrPayrollLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            {children}
        </div>
    );
}
