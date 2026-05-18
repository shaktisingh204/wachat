'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogFooter
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { Zap, LoaderCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveSabFlowConnection } from '@/app/actions/sabflow.actions';
import Image from 'next/image';
import { GoogleSheetsConnection } from './connections/google-sheets-connection';

interface NewConnectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    app: any | null;
    onConnectionSaved: () => void;
}

const initialState = { message: undefined, error: undefined };

function SubmitButton({ app }: { app: any }) {
    const { pending } = useFormStatus();

    if (app.connectionType === 'oauth' || app.connectionType === 'internal' || app.connectionType === 'webhook') {
        return null;
    }

    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect
        </ZoruButton>
    );
}

export function NewConnectionDialog({ isOpen, onOpenChange, app, onConnectionSaved }: NewConnectionDialogProps) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveSabFlowConnection, initialState);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            onOpenChange(false);
            onConnectionSaved();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onConnectionSaved]);

    const renderFormFields = () => {
        if (!app) return null;

        switch (app.appId) {
            case 'google_sheets':
                return <GoogleSheetsConnection />;
        }

        switch (app.connectionType) {
            case 'apikey':
                return (
                    <div className="space-y-4">
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
                    </div>
                );
            case 'oauth':
                return (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">To connect {app.name}, you'll be redirected to their authorization page.</p>
                        <ZoruButton type="button" disabled>Connect via {app.name}</ZoruButton>
                    </div>
                );
            default:
                return <p className="text-sm text-muted-foreground text-center">This app integration is not yet fully configured.</p>
        }
    }

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    {app && <input type="hidden" name="appId" value={app.appId} />}
                    {app && <input type="hidden" name="appName" value={app.name} />}
                    {app && app.credentials && <input type="hidden" name="credentialKeys" value={app.credentials.map((c: any) => c.name).join(',')} />}
                    <ZoruDialogHeader className="items-center text-center px-6 pt-6 pb-2">
                        {app?.logo ? (
                            <Image src={app.logo} alt={`${app.name} logo`} width={48} height={48} className="rounded-md" />
                        ) : app?.icon ? (
                            <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-md">
                                <app.icon className="w-8 h-8 text-muted-foreground" />
                            </div>
                        ) : null}
                        <ZoruDialogTitle>Connect to {app?.name}</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {app?.description || 'Provide the necessary details to connect your account.'}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        {renderFormFields()}
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton app={app} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
