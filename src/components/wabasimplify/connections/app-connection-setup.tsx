
'use client';

import React, { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSabFlowConnection } from '@/app/actions/sabflow.actions';
import { useToast } from '@/hooks/use-toast';
import { ZoruButton, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Key } from 'lucide-react';
import { GoogleSheetsConnection } from './google-sheets-connection';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
            Connect Account
        </ZoruButton>
    )
}

export function AppConnectionSetup({ app, onConnectionSaved, flowId }: { app: any, onConnectionSaved: () => void, flowId?: string }) {
    const [state, formAction] = useActionState(saveSabFlowConnection as any, initialState as any);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            onConnectionSaved();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onConnectionSaved]);

    if (!app) return null;

    if (app.connectionType === 'webhook') {
        if (app.appId === 'google_sheets') {
            return <GoogleSheetsConnection flowId={flowId} />;
        }
        return <p className="text-sm text-muted-foreground">Webhook setup instructions for this app are not yet configured.</p>;
    }
    
    if (app.connectionType === 'oauth') {
        return (
            <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">To connect {app.name}, you'll be redirected to their authorization page.</p>
                <ZoruButton type="button" disabled>Connect via {app.name}</ZoruButton>
            </div>
        );
    }
    
    if (app.connectionType === 'apikey') {
        return (
            <form action={formAction} ref={formRef} className="space-y-4">
                <input type="hidden" name="appId" value={app.appId} />
                <input type="hidden" name="appName" value={app.name} />
                <input type="hidden" name="credentialKeys" value={(app.credentials || []).map((c: any) => c.name).join(',')} />
                <p className="text-sm text-muted-foreground">{app.description}</p>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="connectionName">Connection Name</ZoruLabel>
                    <ZoruInput id="connectionName" name="connectionName" defaultValue={`${app.name} Account`} required />
                </div>
                 {(app.credentials || []).map((cred: any) => (
                    <div className="space-y-2" key={cred.name}>
                        <ZoruLabel htmlFor={cred.name}>{cred.label}</ZoruLabel>
                        <ZoruInput 
                            id={cred.name} 
                            name={cred.name} 
                            type={cred.type || 'text'} 
                            placeholder={cred.placeholder || ''} 
                            required 
                        />
                    </div>
                ))}
                <SubmitButton />
            </form>
        );
    }

    return (
        <p className="text-sm text-muted-foreground">This app does not require any special connection setup.</p>
    );
}
