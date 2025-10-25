'use client';

import React from 'react';
import { Settings } from 'lucide-react';

export default function WachatSettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Settings className="h-8 w-8" />
                    Project Settings
                </h1>
                <p className="text-muted-foreground">Manage settings for your selected WhatsApp project.</p>
            </div>
            <div className="flex-1">
                 {children}
            </div>
        </div>
    );
}
