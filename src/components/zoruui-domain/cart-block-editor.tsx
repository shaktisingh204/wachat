'use client';

import { Label } from '@/components/zoruui';
export function CartBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    return (
        <div className="space-y-4 text-center text-zoru-ink-muted p-4">
            <p>This block dynamically displays the shopping cart.</p>
            <p className="text-xs">No configuration is needed at this time.</p>
        </div>
    );
}
