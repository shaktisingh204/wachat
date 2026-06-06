'use client';

import { Button, Input, Label, Switch, Separator, Card, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Server, Save } from 'lucide-react';
import { saveCrmEmailSettings } from '@/app/actions/crm-email.actions';
import type { EmailSettings as CrmEmailSettings } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    >
      Save SMTP Configuration
    </Button>
  );
}

interface CrmSmtpFormProps {
  settings: CrmEmailSettings | null;
}

export function CrmSmtpForm({ settings }: CrmSmtpFormProps) {
    const [state, formAction] = useActionState(saveCrmEmailSettings as any, initialState as any);
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state.message) toast({ title: 'Success!', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
             <Card className="p-0">
                <div className="p-6 pb-4">
                    <h2 className="flex items-center gap-2 text-[var(--st-text)] font-semibold text-lg"><Server className="h-5 w-5"/>Custom SMTP</h2>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">Connect your own SMTP server to send emails. This gives you full control over your email delivery.</p>
                </div>
                <div className="px-6 pb-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fromName" className="text-[var(--st-text)]">From Name</Label>
                            <Input id="fromName" name="fromName" defaultValue={settings?.fromName} placeholder="e.g. SabNode Support" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromEmail" className="text-[var(--st-text)]">From Email</Label>
                            <Input id="fromEmail" name="fromEmail" type="email" defaultValue={settings?.fromEmail} placeholder="e.g. support@yourdomain.com" required/>
                        </div>
                    </div>
                    <Separator className="bg-[var(--st-border)]" />
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost" className="text-[var(--st-text)]">SMTP Host</Label>
                            <Input id="smtpHost" name="smtpHost" defaultValue={settings?.smtp?.host} placeholder="smtp.example.com" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort" className="text-[var(--st-text)]">SMTP Port</Label>
                            <Input id="smtpPort" name="smtpPort" type="number" defaultValue={settings?.smtp?.port || 587} required />
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser" className="text-[var(--st-text)]">SMTP Username</Label>
                            <Input id="smtpUser" name="smtpUser" defaultValue={settings?.smtp?.user} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPass" className="text-[var(--st-text)]">SMTP Password</Label>
                            <Input id="smtpPass" name="smtpPass" type="password" defaultValue={settings?.smtp?.pass} required />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="smtpSecure" name="smtpSecure" defaultChecked={settings?.smtp?.secure !== false}/>
                        <Label htmlFor="smtpSecure" className="text-[var(--st-text)]">Use SSL/TLS Encryption</Label>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-[var(--st-border)] flex">
                    <SubmitButton />
                </div>
            </Card>
        </form>
    );
}
