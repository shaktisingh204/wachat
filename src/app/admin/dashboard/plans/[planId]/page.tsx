
'use client';

import { useEffect, useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { getPlanById, savePlan } from '@/app/actions/plan.actions';
import type { PlanFeaturePermissions, Plan } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, LoaderCircle, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Plan
        </Button>
    )
}

const features: { id: keyof PlanFeaturePermissions, name: string }[] = [
    { id: 'campaigns', name: 'Broadcast Campaigns' },
    { id: 'liveChat', name: 'Live Chat' },
    { id: 'contacts', name: 'Contact Management' },
    { id: 'templates', name: 'Message Templates' },
    { id: 'catalog', name: 'Product Catalog' },
    { id: 'flowBuilder', name: 'Flow Builder' },
    { id: 'metaFlows', name: 'Meta Flows' },
    { id: 'whatsappAds', name: 'WhatsApp Ads' },
    { id: 'urlShortener', name: 'URL Shortener' },
    { id: 'qrCodeMaker', name: 'QR Code Maker' },
    { id: 'webhooks', name: 'Webhooks Page' },
    { id: 'apiAccess', name: 'API Access' },
    { id: 'settingsBroadcast', name: 'Broadcast Settings Tab' },
    { id: 'settingsAutoReply', name: 'Auto-Reply Settings Tab' },
    { id: 'settingsCannedMessages', name: 'Canned Messages Tab' },
    { id: 'settingsAgentsRoles', name: 'Agents & Roles Tab' },
    { id: 'settingsCompliance', name: 'Compliance Settings Tab' },
    { id: 'settingsUserAttributes', name: 'User Attributes Tab' },
];

export default function PlanEditorPage() {
    const params = useParams();
    const planId = params.planId as string;
    const router = useRouter();
    const { toast } = useToast();
    const [state, formAction] = useActionState(savePlan, initialState);
    const [plan, setPlan] = useState<WithId<Plan> | null>(null);
    const [loading, setLoading] = useState(true);
    
    const isNew = planId === 'new';

    useEffect(() => {
        if (!isNew) {
            getPlanById(planId).then(data => {
                setPlan(data);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [planId, isNew]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            router.push('/admin/dashboard/plans');
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="planId" value={plan?._id.toString() || 'new'} />
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/admin/dashboard/plans"><ChevronLeft className="mr-2 h-4 w-4" />Back to Plans</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{isNew ? 'Create New Plan' : `Edit Plan: ${plan?.name}`}</h1>
                <p className="text-muted-foreground">Configure the details, limits, and features for this plan.</p>
            </div>
            
            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2 lg:col-span-2">
                            <Label htmlFor="name">Plan Name</Label>
                            <Input id="name" name="name" defaultValue={plan?.name} required placeholder="e.g., Pro Tier" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (per month)</Label>
                            <Input id="price" name="price" type="number" defaultValue={plan?.price ?? 49} required min="0" step="1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select name="currency" defaultValue={plan?.currency || 'INR'} required>
                                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">INR (Indian Rupee)</SelectItem>
                                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="signupCredits">Signup Credits</Label>
                            <Input id="signupCredits" name="signupCredits" type="number" defaultValue={plan?.signupCredits ?? 0} required min="0" step="1" />
                            <p className="text-xs text-muted-foreground">Credits new users get on this plan.</p>
                        </div>
                    </div>
                    <div>
                        <Label className="text-base font-medium">Per-Message Costs</Label>
                        <div className="grid md:grid-cols-3 gap-4 mt-2 border p-3 rounded-lg">
                            <div className="space-y-2">
                                <Label htmlFor="cost_marketing" className="text-sm">Marketing</Label>
                                <Input id="cost_marketing" name="cost_marketing" type="number" defaultValue={plan?.messageCosts?.marketing ?? 0.05} required min="0" step="0.001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cost_utility" className="text-sm">Utility</Label>
                                <Input id="cost_utility" name="cost_utility" type="number" defaultValue={plan?.messageCosts?.utility ?? 0.02} required min="0" step="0.001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cost_authentication" className="text-sm">Authentication</Label>
                                <Input id="cost_authentication" name="cost_authentication" type="number" defaultValue={plan?.messageCosts?.authentication ?? 0.02} required min="0" step="0.001" />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-x-8 gap-y-4">
                     <div className="flex items-center space-x-2">
                        <Switch id="isPublic" name="isPublic" defaultChecked={plan?.isPublic ?? false} />
                        <Label htmlFor="isPublic">Publicly Visible</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="isDefault" name="isDefault" defaultChecked={plan?.isDefault ?? false} />
                        <Label htmlFor="isDefault">Default for New Signups</Label>
                    </div>
                </CardFooter>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader><CardTitle>Feature Limits</CardTitle><CardDescription>Set to 0 for unlimited.</CardDescription></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2"><Label htmlFor="projectLimit">Project Limit</Label><Input id="projectLimit" name="projectLimit" type="number" defaultValue={plan?.projectLimit ?? 5} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="agentLimit">Agent Limit (per project)</Label><Input id="agentLimit" name="agentLimit" type="number" defaultValue={plan?.agentLimit ?? 10} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="attributeLimit">Custom Attribute Limit</Label><Input id="attributeLimit" name="attributeLimit" type="number" defaultValue={plan?.attributeLimit ?? 20} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="templateLimit">Template Limit</Label><Input id="templateLimit" name="templateLimit" type="number" defaultValue={plan?.templateLimit ?? 50} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="flowLimit">Flow Builder Limit</Label><Input id="flowLimit" name="flowLimit" type="number" defaultValue={plan?.flowLimit ?? 10} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="metaFlowLimit">Meta Flows Limit</Label><Input id="metaFlowLimit" name="metaFlowLimit" type="number" defaultValue={plan?.metaFlowLimit ?? 10} required min="0"/></div>
                        <div className="space-y-2"><Label htmlFor="cannedMessageLimit">Canned Messages Limit</Label><Input id="cannedMessageLimit" name="cannedMessageLimit" type="number" defaultValue={plan?.cannedMessageLimit ?? 25} required min="0"/></div>
                    </CardContent>
                </Card>
                <Card className="card-gradient card-gradient-purple">
                    <CardHeader><CardTitle>Enabled Features</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                        {features.map(feature => (
                            <div key={feature.id} className="flex items-center space-x-3">
                                <Checkbox id={feature.id} name={feature.id} defaultChecked={(plan?.features as any)?.[feature.id] ?? true} />
                                <Label htmlFor={feature.id} className="font-normal">{feature.name}</Label>
                            </div>
                        ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Separator />

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
