

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Server, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmEmailSettings } from '@/app/actions/crm-email.actions';
import type { EmailSettings as CrmEmailSettings } from '@/lib/definitions';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    >
      Save SMTP Configuration
    </ClayButton>
  );
}

interface CrmSmtpFormProps {
  settings: CrmEmailSettings | null;
}

export function CrmSmtpForm({ settings }: CrmSmtpFormProps) {
    const [state, formAction] = useActionState(saveCrmEmailSettings as any, initialState as any);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) toast({ title: 'Success!', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
             <ClayCard padded={false}>
                <div className="p-6 pb-4">
                    <h2 className="flex items-center gap-2 text-clay-ink font-semibold text-lg"><Server className="h-5 w-5"/>Custom SMTP</h2>
                    <p className="text-sm text-clay-ink-muted mt-1">Connect your own SMTP server to send emails. This gives you full control over your email delivery.</p>
                </div>
                <div className="px-6 pb-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fromName" className="text-clay-ink">From Name</Label>
                            <Input id="fromName" name="fromName" defaultValue={settings?.fromName} placeholder="e.g. SabNode Support" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromEmail" className="text-clay-ink">From Email</Label>
                            <Input id="fromEmail" name="fromEmail" type="email" defaultValue={settings?.fromEmail} placeholder="e.g. support@yourdomain.com" required/>
                        </div>
                    </div>
                    <Separator className="bg-clay-border" />
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost" className="text-clay-ink">SMTP Host</Label>
                            <Input id="smtpHost" name="smtpHost" defaultValue={settings?.smtp?.host} placeholder="smtp.example.com" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort" className="text-clay-ink">SMTP Port</Label>
                            <Input id="smtpPort" name="smtpPort" type="number" defaultValue={settings?.smtp?.port || 587} required />
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser" className="text-clay-ink">SMTP Username</Label>
                            <Input id="smtpUser" name="smtpUser" defaultValue={settings?.smtp?.user} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPass" className="text-clay-ink">SMTP Password</Label>
                            <Input id="smtpPass" name="smtpPass" type="password" defaultValue={settings?.smtp?.pass} required />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="smtpSecure" name="smtpSecure" defaultChecked={settings?.smtp?.secure !== false}/>
                        <Label htmlFor="smtpSecure" className="text-clay-ink">Use SSL/TLS Encryption</Label>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-clay-border flex">
                    <SubmitButton />
                </div>
            </ClayCard>
        </form>
    );
}
