'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const initialState = { message: null, error: null };

function SubmitButton({ app }: { app: any }) {
    const { pending } = useFormStatus();

    if (app.connectionType === 'oauth' || app.connectionType === 'internal' || app.connectionType === 'webhook') {
        return null;
    }

    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
            Connect
        </Button>
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
                            <Label htmlFor="connectionName">Connection Name</Label>
                            <Input id="connectionName" name="connectionName" defaultValue={`${app.name} Account`} required />
                        </div>
                        {(app.credentials || []).map((cred: any) => (
                            <div className="space-y-2" key={cred.name}>
                                <Label htmlFor={cred.name}>{cred.label}</Label>
                                <Input 
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
                        <Button type="button" disabled>Connect via {app.name}</Button>
                    </div>
                );
            default:
                return <p className="text-sm text-muted-foreground text-center">This app integration is not yet fully configured.</p>
        }
    }
  
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form action={formAction} ref={formRef}>
                    {app && <input type="hidden" name="appId" value={app.appId} />}
                    {app && <input type="hidden" name="appName" value={app.name} />}
                    {app && app.credentials && <input type="hidden" name="credentialKeys" value={app.credentials.map((c: any) => c.name).join(',')} />}
                    <DialogHeader className="items-center text-center">
                        {app?.logo ? (
                            <Image src={app.logo} alt={`${app.name} logo`} width={48} height={48} className="rounded-md"/>
                        ) : app?.icon ? (
                            <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-md">
                                <app.icon className="w-8 h-8 text-muted-foreground"/>
                            </div>
                        ) : null}
                        <DialogTitle>Connect to {app?.name}</DialogTitle>
                        <DialogDescription>
                          {app?.description || 'Provide the necessary details to connect your account.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        {renderFormFields()}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton app={app} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
