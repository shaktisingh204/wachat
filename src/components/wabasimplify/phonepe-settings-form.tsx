'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { savePaymentGatewaySettings, PaymentGatewaySettings } from '@/app/actions';
import type { WithId } from 'mongodb';
import { WaPayIcon } from '@/components/wabasimplify/custom-sidebar-components';


const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
        </Button>
    )
}

export function PhonePeSettingsForm({ settings }: { settings: WithId<PaymentGatewaySettings> | null }) {
    const [state, formAction] = useActionState(savePaymentGatewaySettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <WaPayIcon className="h-5 w-5" />
                        PhonePe Payment Gateway
                    </CardTitle>
                    <CardDescription>Configure your PhonePe credentials for processing payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="merchantId">Merchant ID</Label>
                        <Input id="merchantId" name="merchantId" defaultValue={settings?.merchantId} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="saltKey">Salt Key</Label>
                        <Input id="saltKey" name="saltKey" type="password" defaultValue={settings?.saltKey} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="saltIndex">Salt Index</Label>
                        <Input id="saltIndex" name="saltIndex" defaultValue={settings?.saltIndex} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Environment</Label>
                         <RadioGroup name="environment" defaultValue={settings?.environment || 'staging'} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="staging" id="env-staging" />
                                <Label htmlFor="env-staging" className="font-normal">Staging (UAT)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="production" id="env-prod" />
                                <Label htmlFor="env-prod" className="font-normal">Production</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
