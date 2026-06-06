'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardFooter,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save, IndianRupee, CreditCard, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { getEcommFlows } from '@/app/actions/custom-ecommerce-flow.actions';
import type { WithId,
  EcommShop,
  CustomDomain,
  EcommFlow } from '@/lib/definitions';

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
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Basic Configuration</ZoruCardTitle>
                    <ZoruCardDescription>Set the fundamental properties for your custom shop.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="shopName">Shop Name</Label>
                            <Input id="shopName" name="name" placeholder="My Awesome Store" defaultValue={shop.name || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select name="currency" defaultValue={shop.currency || 'USD'} required>
                                <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="USD">USD - US Dollar</ZoruSelectItem>
                                    <ZoruSelectItem value="EUR">EUR - Euro</ZoruSelectItem>
                                    <ZoruSelectItem value="INR">INR - Indian Rupee</ZoruSelectItem>
                                    <ZoruSelectItem value="GBP">GBP - British Pound</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="customDomain">Custom Domain</Label>
                            <Select name="customDomain" defaultValue={shop.customDomain || 'none'}>
                                <ZoruSelectTrigger id="customDomain">
                                    <ZoruSelectValue placeholder="Select a verified domain..." />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="none">None (Use default)</ZoruSelectItem>
                                    {verifiedDomains.map(d => (
                                        <ZoruSelectItem key={d._id.toString()} value={d.hostname}>{d.hostname}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                            <p className="text-xs text-zoru-ink-muted">Add and verify domains in the section below.</p>
                        </div>
                    </div>
                    <Separator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4"/>Payment Links</h3>
                        <p className="text-sm text-zoru-ink-muted mb-4">Provide direct payment links for services like Razorpay, Paytm, or GPay to enable "Pay" buttons in your shop flows.</p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="paymentLinkRazorpay">Razorpay Link</Label>
                                <Input id="paymentLinkRazorpay" name="paymentLinkRazorpay" placeholder="https://rzp.io/l/yourlink" defaultValue={shop.paymentLinkRazorpay || ''} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="paymentLinkPaytm">Paytm Link</Label>
                                <Input id="paymentLinkPaytm" name="paymentLinkPaytm" placeholder="https://p.paytm.me/yourlink" defaultValue={shop.paymentLinkPaytm || ''} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="paymentLinkGPay">Google Pay (GPay) Link</Label>
                                <Input id="paymentLinkGPay" name="paymentLinkGPay" placeholder="gpay://..." defaultValue={shop.paymentLinkGPay || ''} />
                            </div>
                        </div>
                    </div>
                     <Separator />
                     <div>
                        <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><Bell className="h-4 w-4"/>Abandoned Cart Reminder</h3>
                        <p className="text-sm text-zoru-ink-muted mb-4">Automatically send a follow-up message to users who leave items in their cart.</p>
                        <div className="space-y-4 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="abandonedCart.enabled" className="font-medium">Enable Reminder</Label>
                                <Switch id="abandonedCart.enabled" name="abandonedCart.enabled" defaultChecked={shop.abandonedCart?.enabled || false} />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="abandonedCart.delayMinutes">Delay (minutes)</Label>
                                    <Input id="abandonedCart.delayMinutes" name="abandonedCart.delayMinutes" type="number" defaultValue={shop.abandonedCart?.delayMinutes || 60} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="abandonedCart.flowId">Reminder Flow</Label>
                                    <Select name="abandonedCart.flowId" defaultValue={shop.abandonedCart?.flowId}>
                                        <ZoruSelectTrigger id="abandonedCart.flowId"><ZoruSelectValue placeholder="Select a flow..."/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {ecommFlows.map(flow => (
                                                <ZoruSelectItem key={flow._id.toString()} value={flow._id.toString()}>{flow.name}</ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </Card>
        </form>
    );
}
