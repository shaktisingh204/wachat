
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

interface ActionEditorProps {
    label: string;
    action: any;
    onActionChange: (newAction: any) => void;
    actionType: 'on-click-action' | 'on-select-action';
}

export function ActionEditor({ label, action, onActionChange, actionType }: ActionEditorProps) {
    const actionName = action?.name || 'complete';

    const handleNameChange = (newName: string) => {
        const newAction = { name: newName, payload: action?.payload || {} };
        if (newName === 'navigate') {
            (newAction as any).next = { type: 'screen', name: '' };
        } else if (newName === 'open_url') {
            (newAction as any).url = '';
        }
        onActionChange(newAction);
    };

    const handlePayloadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        try {
            const payload = JSON.parse(e.target.value);
            onActionChange({ ...action, payload });
        } catch (error) {
            // Can add toast feedback here if needed
        }
    };

    return (
        <div className="space-y-2 rounded-lg border p-4">
            <Label className="font-semibold">{label}</Label>
            <Select value={actionName} onValueChange={handleNameChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="complete">Complete Flow</SelectItem>
                    <SelectItem value="navigate">Navigate to Screen</SelectItem>
                    <SelectItem value="data_exchange">Data Exchange (API)</SelectItem>
                    <SelectItem value="open_url">Open URL</SelectItem>
                </SelectContent>
            </Select>

            {actionName === 'navigate' && (
                <div className="space-y-2 pt-2">
                    <Label htmlFor="next-screen">Next Screen Name</Label>
                    <Input
                        id="next-screen"
                        placeholder="e.g., THANK_YOU_SCREEN"
                        value={action?.next?.name || ''}
                        onChange={e => onActionChange({ ...action, next: { type: 'screen', name: e.target.value } })}
                    />
                </div>
            )}
            
            {actionName === 'open_url' && (
                <div className="space-y-2 pt-2">
                    <Label htmlFor="url">URL to Open</Label>
                    <Input
                        id="url"
                        placeholder="https://example.com"
                        value={action?.url || ''}
                        onChange={e => onActionChange({ ...action, url: e.target.value })}
                    />
                </div>
            )}

            <Separator className="my-4" />
            
            <div className="space-y-2">
                 <Label htmlFor="payload">Payload (JSON)</Label>
                 <Textarea
                    id="payload"
                    className="font-mono text-xs h-24"
                    placeholder={`{\n  "source": "on_boarding_flow"\n}`}
                    defaultValue={action?.payload ? JSON.stringify(action.payload, null, 2) : '{}'}
                    onChange={handlePayloadChange}
                 />
            </div>
        </div>
    );
}
