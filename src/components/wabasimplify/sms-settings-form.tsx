'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Save, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { saveSmsSettings } from '@/app/actions/sms.actions';
const saveSmsSettings: any = (...args: any[]) => ({ error: 'not implemented' });
import type { WithId, User } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <ZoruButton type="submit" disabled={isPending}>
      {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Twilio Settings
    </ZoruButton>
  );
}

interface SmsSettingsFormProps {
  user: WithId<User>;
}

export function SmsSettingsForm({ user }: SmsSettingsFormProps) {
    const [isPending, startTransition] = useTransition();
    const [state, setState] = useState<any>(initialState);
    const { toast } = useToast();
    const settings = (user as any).smsProviderSettings?.twilio;

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
            <ZoruCard className="card-gradient card-gradient-blue">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5"/>
                        Twilio Configuration
                    </ZoruCardTitle>
                    <ZoruCardDescription>Enter your Twilio Account SID and Auth Token to enable SMS sending.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="accountSid">Account SID</ZoruLabel>
                        <ZoruInput id="accountSid" name="accountSid" defaultValue={settings?.accountSid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="authToken">Auth Token</ZoruLabel>
                        <ZoruInput id="authToken" name="authToken" type="password" defaultValue={settings?.authToken} required />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="fromNumber">Twilio Phone Number</ZoruLabel>
                        <ZoruInput id="fromNumber" name="fromNumber" type="tel" defaultValue={settings?.fromNumber} placeholder="+15551234567" required />
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <ZoruButton type="submit" disabled={isPending}>
                        {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Twilio Settings
                    </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
