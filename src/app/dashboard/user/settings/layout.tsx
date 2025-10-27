'use client';

import React from 'react';

// This component is intentionally minimal.
// The main dashboard layout handles the sidebar logic.
export default function UserSettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            {children}
        </div>
    );
}
