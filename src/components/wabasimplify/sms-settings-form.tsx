
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, Save, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveSmsSettings } from '@/app/actions/sms.actions';
import type { WithId, User } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Twilio Settings
    </Button>
  );
}

interface SmsSettingsFormProps {
  user: WithId<User>;
}

export function SmsSettingsForm({ user }: SmsSettingsFormProps) {
    const [isPending, startTransition] = useTransition();
    const [state, setState] = useState<any>(initialState);
    const { toast } = useToast();
    const settings = user.smsProviderSettings?.twilio;

    const action = (formData: FormData) => {
        startTransition(async () => {
            const result = await saveSmsSettings(null, formData);
            setState(result);
        });
    };
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={action}>
            <Card className="card-gradient card-gradient-blue">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5"/>
                        Twilio Configuration
                    </CardTitle>
                    <CardDescription>Enter your Twilio Account SID and Auth Token to enable SMS sending.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="accountSid">Account SID</Label>
                        <Input id="accountSid" name="accountSid" defaultValue={settings?.accountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="authToken">Auth Token</Label>
                        <Input id="authToken" name="authToken" type="password" defaultValue={settings?.authToken} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fromNumber">Twilio Phone Number</Label>
                        <Input id="fromNumber" name="fromNumber" type="tel" defaultValue={settings?.fromNumber} placeholder="+15551234567" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Twilio Settings
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
