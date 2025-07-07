
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function RichTextBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={`html-content-${settings.id}`}>HTML Content</Label>
            <Textarea
                id={`html-content-${settings.id}`}
                value={settings.htmlContent || ''}
                onChange={(e) => onUpdate({ ...settings, htmlContent: e.target.value })}
                placeholder="Enter your formatted text or HTML here..."
                className="h-48 font-mono"
            />
        </div>
    );
}
