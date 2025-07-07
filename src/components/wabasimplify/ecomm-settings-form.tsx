
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Save, IndianRupee, CreditCard, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { getEcommFlows } from '@/app/actions/custom-ecommerce-flow.actions';
import type { WithId, Project, EcommSettings, CustomDomain, EcommFlow } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
        </Button>
    )
}

interface EcommSettingsFormProps {
    project: WithId<Project>;
    settings: EcommSettings | null;
    domains: WithId<CustomDomain>[];
}

export function EcommSettingsForm({ project, settings, domains }: EcommSettingsFormProps) {
    const [state, formAction] = useActionState(saveEcommShopSettings, initialState);
    const { toast } = useToast();
    const [ecommFlows, setEcommFlows] = useState<WithId<EcommFlow>[]>([]);

    useEffect(() => {
        getEcommFlows(project._id.toString()).then(setEcommFlows);
    }, [project._id]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    const verifiedDomains = domains.filter(d => d.verified);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card>
                <CardHeader>
                    <CardTitle>Basic Configuration</CardTitle>
                    <CardDescription>Set the fundamental properties for your custom shop.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="shopName">Shop Name</Label>
                            <Input id="shopName" name="shopName" placeholder="My Awesome Store" defaultValue={settings?.shopName || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select name="currency" defaultValue={settings?.currency || 'USD'} required>
                                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="customDomain">Custom Domain</Label>
                            <Select name="customDomain" defaultValue={settings?.customDomain || ''}>
                                <SelectTrigger id="customDomain">
                                    <SelectValue placeholder="Select a verified domain..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">None (Use default)</SelectItem>
                                    {verifiedDomains.map(d => (
                                        <SelectItem key={d._id.toString()} value={d.hostname}>{d.hostname}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Add and verify domains in the section below.</p>
                        </div>
                    </div>
                    <Separator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4"/>Payment Links</h3>
                        <p className="text-sm text-muted-foreground mb-4">Provide direct payment links for services like Razorpay, Paytm, or GPay to enable "Pay" buttons in your shop flows.</p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="paymentLinkRazorpay">Razorpay Link</Label>
                                <Input id="paymentLinkRazorpay" name="paymentLinkRazorpay" placeholder="https://rzp.io/l/yourlink" defaultValue={settings?.paymentLinkRazorpay || ''} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="paymentLinkPaytm">Paytm Link</Label>
                                <Input id="paymentLinkPaytm" name="paymentLinkPaytm" placeholder="https://p.paytm.me/yourlink" defaultValue={settings?.paymentLinkPaytm || ''} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="paymentLinkGPay">Google Pay (GPay) Link</Label>
                                <Input id="paymentLinkGPay" name="paymentLinkGPay" placeholder="gpay://..." defaultValue={settings?.paymentLinkGPay || ''} />
                            </div>
                        </div>
                    </div>
                     <Separator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><Bell className="h-4 w-4"/>Abandoned Cart Reminder</h3>
                        <p className="text-sm text-muted-foreground mb-4">Automatically send a follow-up message to users who leave items in their cart.</p>
                        <div className="space-y-4 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="abandonedCart.enabled" className="font-medium">Enable Reminder</Label>
                                <Switch id="abandonedCart.enabled" name="abandonedCart.enabled" defaultChecked={settings?.abandonedCart?.enabled || false} />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="abandonedCart.delayMinutes">Delay (minutes)</Label>
                                    <Input id="abandonedCart.delayMinutes" name="abandonedCart.delayMinutes" type="number" defaultValue={settings?.abandonedCart?.delayMinutes || 60} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="abandonedCart.flowId">Reminder Flow</Label>
                                    <Select name="abandonedCart.flowId" defaultValue={settings?.abandonedCart?.flowId}>
                                        <SelectTrigger id="abandonedCart.flowId"><SelectValue placeholder="Select a flow..."/></SelectTrigger>
                                        <SelectContent>
                                            {ecommFlows.map(flow => (
                                                <SelectItem key={flow._id.toString()} value={flow._id.toString()}>{flow.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
