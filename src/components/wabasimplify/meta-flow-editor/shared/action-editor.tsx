'use client';

import {
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  Separator,
} from '@/components/zoruui';
import {
  useState } from 'react';

interface ActionEditorProps {
    label: string;
    action: any;
    onActionChange: (newAction: any) => void;
    actionType: 'on-click-action' | 'on-select-action';
    allScreens?: any[];
}

export function ActionEditor({ label, action, onActionChange, actionType, allScreens = [] }: ActionEditorProps) {
    const actionName = action?.name || 'complete';

    const handleNameChange = (newName: string) => {
        const newAction: any = { name: newName };
        if(action?.payload) newAction.payload = action.payload;

        if (newName === 'navigate') {
            newAction.next = { type: 'screen', name: '' };
        } else if (newName === 'open_url') {
            newAction.url = '';
        }
        onActionChange(newAction);
    };

    const handlePayloadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        try {
            const payload = e.target.value ? JSON.parse(e.target.value) : {};
            onActionChange({ ...action, payload });
        } catch (error) {
            // Can add toast feedback here if needed
        }
    };

    return (
        <div className="space-y-2 rounded-lg border p-4">
            <ZoruLabel className="font-semibold">{label}</ZoruLabel>
            <ZoruSelect value={actionName} onValueChange={handleNameChange}>
                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="complete">Complete Flow</ZoruSelectItem>
                    <ZoruSelectItem value="navigate">Navigate to Screen</ZoruSelectItem>
                    <ZoruSelectItem value="data_exchange">Data Exchange (API)</ZoruSelectItem>
                    <ZoruSelectItem value="open_url">Open URL</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>

            {actionName === 'navigate' && (
                <div className="space-y-2 pt-2">
                    <ZoruLabel htmlFor="next-screen">Next Screen</ZoruLabel>
                     <ZoruSelect
                        value={action?.next?.name || ''}
                        onValueChange={(val) => onActionChange({ ...action, next: { type: 'screen', name: val } })}
                    >
                        <ZoruSelectTrigger id="next-screen"><ZoruSelectValue placeholder="Select a screen..." /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {allScreens.map(screen => (
                                <ZoruSelectItem key={screen.id} value={screen.id}>{screen.title || screen.id}</ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>
            )}
            
            {actionName === 'open_url' && (
                <div className="space-y-2 pt-2">
                    <ZoruLabel htmlFor="url">URL to Open</ZoruLabel>
                    <ZoruInput
                        id="url"
                        placeholder="https://example.com"
                        value={action?.url || ''}
                        onChange={e => onActionChange({ ...action, url: e.target.value })}
                    />
                </div>
            )}

            <ZoruSeparator className="my-4" />
            
            <div className="space-y-2">
                 <ZoruLabel htmlFor="payload">Payload (JSON)</ZoruLabel>
                 <ZoruTextarea
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
