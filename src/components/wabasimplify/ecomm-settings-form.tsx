
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { LoaderCircle, Save, IndianRupee, CreditCard, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { getEcommFlows } from '@/app/actions/custom-ecommerce-flow.actions';
import type { WithId, EcommShop, CustomDomain, EcommFlow } from '@/lib/definitions';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '../ui/select';
import { ZoruSeparator } from '../ui/separator';
import { ZoruSwitch } from '../ui/switch';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
        </ZoruButton>
    )
}

interface EcommSettingsFormProps {
    shop: WithId<EcommShop>;
    domains: WithId<CustomDomain>[];
}

export function EcommSettingsForm({ shop, domains }: EcommSettingsFormProps) {
    const [state, formAction] = useActionState(updateEcommShopSettings as any, initialState as any);
    const { toast } = useToast();
    const [ecommFlows, setEcommFlows] = useState<WithId<EcommFlow>[]>([]);

    useEffect(() => {
        getEcommFlows(shop.projectId.toString()).then(setEcommFlows);
    }, [shop.projectId]);

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
            <input type="hidden" name="shopId" value={shop._id.toString()} />
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Basic Configuration</ZoruCardTitle>
                    <ZoruCardDescription>Set the fundamental properties for your custom shop.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="shopName">Shop Name</ZoruLabel>
                            <ZoruInput id="shopName" name="name" placeholder="My Awesome Store" defaultValue={shop.name || ''} required />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                            <ZoruSelect name="currency" defaultValue={shop.currency || 'USD'} required>
                                <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="USD">USD - US Dollar</ZoruSelectItem>
                                    <ZoruSelectItem value="EUR">EUR - Euro</ZoruSelectItem>
                                    <ZoruSelectItem value="INR">INR - Indian Rupee</ZoruSelectItem>
                                    <ZoruSelectItem value="GBP">GBP - British Pound</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <ZoruLabel htmlFor="customDomain">Custom Domain</ZoruLabel>
                            <ZoruSelect name="customDomain" defaultValue={shop.customDomain || 'none'}>
                                <ZoruSelectTrigger id="customDomain">
                                    <ZoruSelectValue placeholder="ZoruSelect a verified domain..." />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="none">None (Use default)</ZoruSelectItem>
                                    {verifiedDomains.map(d => (
                                        <ZoruSelectItem key={d._id.toString()} value={d.hostname}>{d.hostname}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <p className="text-xs text-muted-foreground">Add and verify domains in the section below.</p>
                        </div>
                    </div>
                    <ZoruSeparator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4"/>Payment Links</h3>
                        <p className="text-sm text-muted-foreground mb-4">Provide direct payment links for services like Razorpay, Paytm, or GPay to enable "Pay" buttons in your shop flows.</p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="paymentLinkRazorpay">Razorpay Link</ZoruLabel>
                                <ZoruInput id="paymentLinkRazorpay" name="paymentLinkRazorpay" placeholder="https://rzp.io/l/yourlink" defaultValue={shop.paymentLinkRazorpay || ''} />
                            </div>
                             <div className="space-y-2">
                                <ZoruLabel htmlFor="paymentLinkPaytm">Paytm Link</ZoruLabel>
                                <ZoruInput id="paymentLinkPaytm" name="paymentLinkPaytm" placeholder="https://p.paytm.me/yourlink" defaultValue={shop.paymentLinkPaytm || ''} />
                            </div>
                             <div className="space-y-2">
                                <ZoruLabel htmlFor="paymentLinkGPay">Google Pay (GPay) Link</ZoruLabel>
                                <ZoruInput id="paymentLinkGPay" name="paymentLinkGPay" placeholder="gpay://..." defaultValue={shop.paymentLinkGPay || ''} />
                            </div>
                        </div>
                    </div>
                     <ZoruSeparator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><Bell className="h-4 w-4"/>Abandoned Cart Reminder</h3>
                        <p className="text-sm text-muted-foreground mb-4">Automatically send a follow-up message to users who leave items in their cart.</p>
                        <div className="space-y-4 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <ZoruLabel htmlFor="abandonedCart.enabled" className="font-medium">Enable Reminder</ZoruLabel>
                                <ZoruSwitch id="abandonedCart.enabled" name="abandonedCart.enabled" defaultChecked={shop.abandonedCart?.enabled || false} />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="abandonedCart.delayMinutes">Delay (minutes)</ZoruLabel>
                                    <ZoruInput id="abandonedCart.delayMinutes" name="abandonedCart.delayMinutes" type="number" defaultValue={shop.abandonedCart?.delayMinutes || 60} />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="abandonedCart.flowId">Reminder Flow</ZoruLabel>
                                    <ZoruSelect name="abandonedCart.flowId" defaultValue={shop.abandonedCart?.flowId}>
                                        <ZoruSelectTrigger id="abandonedCart.flowId"><ZoruSelectValue placeholder="ZoruSelect a flow..."/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {ecommFlows.map(flow => (
                                                <ZoruSelectItem key={flow._id.toString()} value={flow._id.toString()}>{flow.name}</ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
