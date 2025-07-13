

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Server, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmEmailSettings } from '@/app/actions/crm-email.actions';
import type { CrmEmailSettings } from '@/lib/definitions';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save SMTP Configuration
    </Button>
  );
}

interface CrmSmtpFormProps {
  settings: CrmEmailSettings | null;
}

export function CrmSmtpForm({ settings }: CrmSmtpFormProps) {
    const [state, formAction] = useActionState(saveCrmEmailSettings, initialState);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state.message) toast({ title: 'Success!', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5"/>Custom SMTP</CardTitle>
                    <CardDescription>Connect your own SMTP server to send emails. This gives you full control over your email delivery.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fromName">From Name</Label>
                            <Input id="fromName" name="fromName" defaultValue={settings?.fromName} placeholder="e.g. SabNode Support" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromEmail">From Email</Label>
                            <Input id="fromEmail" name="fromEmail" type="email" defaultValue={settings?.fromEmail} placeholder="e.g. support@yourdomain.com" required/>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost">SMTP Host</Label>
                            <Input id="smtpHost" name="smtpHost" defaultValue={settings?.smtp?.host} placeholder="smtp.example.com" required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort">SMTP Port</Label>
                            <Input id="smtpPort" name="smtpPort" type="number" defaultValue={settings?.smtp?.port || 587} required />
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser">SMTP Username</Label>
                            <Input id="smtpUser" name="smtpUser" defaultValue={settings?.smtp?.user} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPass">SMTP Password</Label>
                            <Input id="smtpPass" name="smtpPass" type="password" defaultValue={settings?.smtp?.pass} required />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="smtpSecure" name="smtpSecure" defaultChecked={settings?.smtp?.secure !== false}/>
                        <Label htmlFor="smtpSecure">Use SSL/TLS Encryption</Label>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
