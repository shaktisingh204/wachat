
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function CustomHtmlBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    return (
        <div className="space-y-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                    Custom HTML and scripts can introduce security vulnerabilities or break your page layout. Use with caution.
                </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor={`custom-html-${settings.id}`}>Custom HTML/Script</Label>
                <Textarea
                    id={`custom-html-${settings.id}`}
                    value={settings.html || ''}
                    onChange={(e) => onUpdate({ ...settings, html: e.target.value })}
                    placeholder="<style>...</style> <div>...</div> <script>...</script>"
                    className="h-64 font-mono"
                />
            </div>
        </div>
    );
}
