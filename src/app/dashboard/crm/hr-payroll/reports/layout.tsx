
'use client';

import React from 'react';

// This is a sub-layout and inherits permissions from its parent.
// No additional lock needed here.
export default function HrReportsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            {children}
        </div>
    );
}
