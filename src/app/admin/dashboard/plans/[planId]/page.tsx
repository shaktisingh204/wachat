

'use client';

import { useEffect, useState, useTransition } from 'react';
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
import { PlanPermissionSelector } from '@/components/wabasimplify/plan-permission-selector';
export const dynamic = 'force-dynamic';

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

export default function PlanEditorPage() {
    const params = useParams();
    const planId = params.planId as string;
    const router = useRouter();
    const { toast } = useToast();
    const [state, setState] = useState<any>(initialState);
    const [isPending, startTransition] = useTransition();

    const [plan, setPlan] = useState<WithId<Plan> | null>(null);
    const [loading, setLoading] = useState(true);

    const isNew = planId === 'new';

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await savePlan(null, formData);
            setState(result);
        });
    };

    useEffect(() => {
        if (!isNew) {
            try {
                getPlanById(planId).then(data => {
                    setPlan(data);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Failed to load plan data:", error);
                toast({ title: "Error", description: "Could not load plan details.", variant: "destructive" });
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, [planId, isNew, toast]);

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

            <Card>
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Plan Name</Label>
                            <Input id="name" name="name" defaultValue={plan?.name} required placeholder="e.g., Pro Tier" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appCategory">Plan Category</Label>
                            <Select name="appCategory" defaultValue={plan?.appCategory}>
                                <SelectTrigger id="appCategory"><SelectValue placeholder="Select a category..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All-In-One">All-In-One</SelectItem>
                                    <SelectItem value="Wachat">Wachat</SelectItem>
                                    <SelectItem value="CRM">CRM</SelectItem>
                                    <SelectItem value="Meta">Meta Suite</SelectItem>
                                    <SelectItem value="Instagram">Instagram Suite</SelectItem>
                                    <SelectItem value="Email">Email</SelectItem>
                                    <SelectItem value="SMS">SMS</SelectItem>
                                    <SelectItem value="URL Shortener">URL Shortener</SelectItem>
                                    <SelectItem value="QR Code Generator">QR Code Generator</SelectItem>
                                </SelectContent>
                            </Select>
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
                            <Label htmlFor="signupCredits">Signup Credits (Legacy)</Label>
                            <Input id="signupCredits" name="signupCredits" type="number" defaultValue={plan?.signupCredits ?? 0} required min="0" step="1" />
                            <p className="text-xs text-muted-foreground">Credits new users get on this plan.</p>
                        </div>
                    </div>
                    <div>
                        <Label className="text-base font-medium">Initial Credits (User Balance on Signup)</Label>
                        <div className="grid md:grid-cols-4 gap-4 mt-2 border p-3 rounded-lg">
                            <div className="space-y-2">
                                <Label htmlFor="init_broadcast" className="text-sm">Broadcast</Label>
                                <Input id="init_broadcast" name="init_broadcast" type="number" defaultValue={plan?.initialCredits?.broadcast ?? 0} min="0" step="1" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="init_sms" className="text-sm">SMS</Label>
                                <Input id="init_sms" name="init_sms" type="number" defaultValue={plan?.initialCredits?.sms ?? 0} min="0" step="1" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="init_meta" className="text-sm">Meta Suite</Label>
                                <Input id="init_meta" name="init_meta" type="number" defaultValue={plan?.initialCredits?.meta ?? 0} min="0" step="1" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="init_email" className="text-sm">Email</Label>
                                <Input id="init_email" name="init_email" type="number" defaultValue={plan?.initialCredits?.email ?? 0} min="0" step="1" />
                            </div>
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
                <CardHeader>
                    <CardTitle>Credit Rates (Credits per Unit)</CardTitle>
                    <CardDescription>Define how many credits are deducted per message type.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 border p-3 rounded-lg mb-4">
                        <div className="col-span-3 font-semibold text-sm text-green-600 mb-1">WhatsApp (WaChat) Rates</div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_whatsapp_marketing">Marketing Rate</Label>
                            <Input id="rate_whatsapp_marketing" name="rate_whatsapp_marketing" type="number" defaultValue={plan?.rates?.whatsapp_marketing ?? 1} required min="0" step="0.1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_whatsapp_utility">Utility Rate</Label>
                            <Input id="rate_whatsapp_utility" name="rate_whatsapp_utility" type="number" defaultValue={plan?.rates?.whatsapp_utility ?? 1} required min="0" step="0.1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_whatsapp_authentication">Authentication Rate</Label>
                            <Input id="rate_whatsapp_authentication" name="rate_whatsapp_authentication" type="number" defaultValue={plan?.rates?.whatsapp_authentication ?? 1} required min="0" step="0.1" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 border p-3 rounded-lg">
                        <div className="col-span-3 font-semibold text-sm text-blue-600 mb-1">Other Channel Rates</div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_sms">SMS Rate</Label>
                            <Input id="rate_sms" name="rate_sms" type="number" defaultValue={plan?.rates?.sms ?? 1} required min="0" step="0.1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_meta">Meta Suite Rate</Label>
                            <Input id="rate_meta" name="rate_meta" type="number" defaultValue={plan?.rates?.meta ?? 1} required min="0" step="0.1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rate_email">Email Rate</Label>
                            <Input id="rate_email" name="rate_email" type="number" defaultValue={plan?.rates?.email ?? 1} required min="0" step="0.1" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Feature Limits</CardTitle>
                    <CardDescription>Set resource limits for each application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* WaChat Limits */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 text-green-600">WaChat</h3>
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit_wachat_templates">Templates</Label>
                                <Input id="limit_wachat_templates" name="limit_wachat_templates" type="number" defaultValue={plan?.appLimits?.wachat?.templates ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_wachat_flows">Flows</Label>
                                <Input id="limit_wachat_flows" name="limit_wachat_flows" type="number" defaultValue={plan?.appLimits?.wachat?.flows ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_wachat_metaFlows">Meta Flows</Label>
                                <Input id="limit_wachat_metaFlows" name="limit_wachat_metaFlows" type="number" defaultValue={plan?.appLimits?.wachat?.metaFlows ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_wachat_cannedMessages">Canned Messages</Label>
                                <Input id="limit_wachat_cannedMessages" name="limit_wachat_cannedMessages" type="number" defaultValue={plan?.appLimits?.wachat?.cannedMessages ?? 0} min="0" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* CRM Limits */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 text-blue-600">CRM</h3>
                        <div className="grid md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit_crm_products">Products</Label>
                                <Input id="limit_crm_products" name="limit_crm_products" type="number" defaultValue={plan?.appLimits?.crm?.products ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_crm_customers">Customers</Label>
                                <Input id="limit_crm_customers" name="limit_crm_customers" type="number" defaultValue={plan?.appLimits?.crm?.customers ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_crm_vendors">Vendors</Label>
                                <Input id="limit_crm_vendors" name="limit_crm_vendors" type="number" defaultValue={plan?.appLimits?.crm?.vendors ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_crm_warehouses">Warehouses</Label>
                                <Input id="limit_crm_warehouses" name="limit_crm_warehouses" type="number" defaultValue={plan?.appLimits?.crm?.warehouses ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_crm_pipelines">Pipelines</Label>
                                <Input id="limit_crm_pipelines" name="limit_crm_pipelines" type="number" defaultValue={plan?.appLimits?.crm?.pipelines ?? 0} min="0" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Meta Limits */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 text-indigo-600">Meta Suite</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit_meta_adAccounts">Ad Accounts</Label>
                                <Input id="limit_meta_adAccounts" name="limit_meta_adAccounts" type="number" defaultValue={plan?.appLimits?.meta?.adAccounts ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_meta_pages">Facebook Pages</Label>
                                <Input id="limit_meta_pages" name="limit_meta_pages" type="number" defaultValue={plan?.appLimits?.meta?.pages ?? 0} min="0" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Email Limits */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 text-orange-600">Email</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit_email_connectedAccounts">Connected Accounts</Label>
                                <Input id="limit_email_connectedAccounts" name="limit_email_connectedAccounts" type="number" defaultValue={plan?.appLimits?.email?.connectedAccounts ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_email_dailyLimit">Daily Sending Limit</Label>
                                <Input id="limit_email_dailyLimit" name="limit_email_dailyLimit" type="number" defaultValue={plan?.appLimits?.email?.dailyLimit ?? 0} min="0" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Other Limits */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3">Other Tools</h3>
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit_sms_dailyLimit">SMS Daily Limit</Label>
                                <Input id="limit_sms_dailyLimit" name="limit_sms_dailyLimit" type="number" defaultValue={plan?.appLimits?.sms?.dailyLimit ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_url_links">URL Shortener Links</Label>
                                <Input id="limit_url_links" name="limit_url_links" type="number" defaultValue={plan?.appLimits?.urlShortener?.links ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_url_domains">URL Custom Domains</Label>
                                <Input id="limit_url_domains" name="limit_url_domains" type="number" defaultValue={plan?.appLimits?.urlShortener?.domains ?? 0} min="0" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="limit_qrcode_limit">QR Codes</Label>
                                <Input id="limit_qrcode_limit" name="limit_qrcode_limit" type="number" defaultValue={plan?.appLimits?.qrCode?.limit ?? 0} min="0" />
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

            <div className="grid grid-cols-1 gap-4">
                <Card>
                    <CardHeader><CardTitle>Feature Limits</CardTitle><CardDescription>Set to 0 for unlimited.</CardDescription></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2"><Label htmlFor="projectLimit">Project Limit</Label><Input id="projectLimit" name="projectLimit" type="number" defaultValue={plan?.projectLimit ?? 5} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="agentLimit">Agent Limit (per project)</Label><Input id="agentLimit" name="agentLimit" type="number" defaultValue={plan?.agentLimit ?? 10} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="attributeLimit">Custom Attribute Limit</Label><Input id="attributeLimit" name="attributeLimit" type="number" defaultValue={plan?.attributeLimit ?? 20} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="templateLimit">Template Limit</Label><Input id="templateLimit" name="templateLimit" type="number" defaultValue={plan?.templateLimit ?? 50} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="flowLimit">Flow Builder Limit</Label><Input id="flowLimit" name="flowLimit" type="number" defaultValue={plan?.flowLimit ?? 10} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="metaFlowLimit">Meta Flows Limit</Label><Input id="metaFlowLimit" name="metaFlowLimit" type="number" defaultValue={plan?.metaFlowLimit ?? 10} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="cannedMessageLimit">Canned Messages Limit</Label><Input id="cannedMessageLimit" name="cannedMessageLimit" type="number" defaultValue={plan?.cannedMessageLimit ?? 25} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="customRoleLimit">Custom Role Limit (Team)</Label><Input id="customRoleLimit" name="customRoleLimit" type="number" defaultValue={plan?.customRoleLimit ?? 3} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="teamChannelLimit">Team Channel Limit</Label><Input id="teamChannelLimit" name="teamChannelLimit" type="number" defaultValue={plan?.teamChannelLimit ?? 10} required min="0" /></div>
                        <div className="space-y-2"><Label htmlFor="teamTaskLimit">Team Task Limit</Label><Input id="teamTaskLimit" name="teamTaskLimit" type="number" defaultValue={plan?.teamTaskLimit ?? 50} required min="0" /></div>
                    </CardContent>
                </Card>
            </div>

            <PlanPermissionSelector defaultPermissions={plan?.permissions} />

            <Separator />

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
