'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Skeleton,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter,
  useParams } from 'next/navigation';
import { getPlanById,
  savePlan } from '@/app/actions/plan.actions';
import type { Plan } from '@/lib/definitions';

import type { WithId } from 'mongodb';
import { ChevronLeft, LoaderCircle, Save } from 'lucide-react';
import { planFeatureMap } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const initialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            Save Plan
        </Button>
    );
}

export default function PlanEditorPage() {
    const params = useParams();
    const planId = params.planId as string;
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, setState] = useState<any>(initialState);
    const [, startTransition] = useTransition();

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
            getPlanById(planId).then((data) => {
                setPlan(data);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [planId, isNew]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/admin/dashboard/plans');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
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
                    <Link href="/admin/dashboard/plans">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Plans
                    </Link>
                </Button>
                <h1 className="text-3xl text-zoru-ink">
                    {isNew ? 'Create New Plan' : `Edit Plan: ${plan?.name}`}
                </h1>
                <p className="text-zoru-ink-muted">Configure the details, limits, and features for this plan.</p>
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Basic Details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Plan Name</Label>
                            <Input id="name" name="name" defaultValue={plan?.name} required placeholder="e.g., Pro Tier" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appCategory">Plan Category</Label>
                            <Select name="appCategory" defaultValue={plan?.appCategory}>
                                <ZoruSelectTrigger id="appCategory">
                                    <ZoruSelectValue placeholder="Select a category..." />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="All-In-One">All-In-One</ZoruSelectItem>
                                    <ZoruSelectItem value="Wachat">Wachat</ZoruSelectItem>
                                    <ZoruSelectItem value="CRM">CRM</ZoruSelectItem>
                                    <ZoruSelectItem value="Meta">Meta Suite</ZoruSelectItem>
                                    <ZoruSelectItem value="Instagram">Instagram Suite</ZoruSelectItem>
                                    <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                                    <ZoruSelectItem value="SMS">SMS</ZoruSelectItem>
                                    <ZoruSelectItem value="URL Shortener">URL Shortener</ZoruSelectItem>
                                    <ZoruSelectItem value="QR Code Generator">QR Code Generator</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (per month)</Label>
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                defaultValue={plan?.price ?? 49}
                                required
                                min="0"
                                step="1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select name="currency" defaultValue={plan?.currency || 'INR'} required>
                                <ZoruSelectTrigger id="currency">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="INR">INR (Indian Rupee)</ZoruSelectItem>
                                    <ZoruSelectItem value="USD">USD (US Dollar)</ZoruSelectItem>
                                    <ZoruSelectItem value="EUR">EUR (Euro)</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="signupCredits">Signup Credits</Label>
                            <Input
                                id="signupCredits"
                                name="signupCredits"
                                type="number"
                                defaultValue={plan?.signupCredits ?? 0}
                                required
                                min="0"
                                step="1"
                            />
                            <p className="text-xs text-zoru-ink-muted">Credits new users get on this plan.</p>
                        </div>
                    </div>
                    <div>
                        <Label className="text-base">Per-Message Costs</Label>
                        <div className="mt-2 grid gap-4 rounded-[var(--zoru-radius)] border border-zoru-line p-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="cost_marketing" className="text-sm">
                                    Marketing
                                </Label>
                                <Input
                                    id="cost_marketing"
                                    name="cost_marketing"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.marketing ?? 0.05}
                                    required
                                    min="0"
                                    step="0.001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cost_utility" className="text-sm">
                                    Utility
                                </Label>
                                <Input
                                    id="cost_utility"
                                    name="cost_utility"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.utility ?? 0.02}
                                    required
                                    min="0"
                                    step="0.001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cost_authentication" className="text-sm">
                                    Authentication
                                </Label>
                                <Input
                                    id="cost_authentication"
                                    name="cost_authentication"
                                    type="number"
                                    defaultValue={plan?.messageCosts?.authentication ?? 0.02}
                                    required
                                    min="0"
                                    step="0.001"
                                />
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter className="flex flex-wrap gap-x-8 gap-y-4">
                    <div className="flex items-center space-x-2">
                        <Switch id="isPublic" name="isPublic" defaultChecked={plan?.isPublic ?? false} />
                        <Label htmlFor="isPublic">Publicly Visible</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="isDefault" name="isDefault" defaultChecked={plan?.isDefault ?? false} />
                        <Label htmlFor="isDefault">Default for New Signups</Label>
                    </div>
                </ZoruCardFooter>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Feature Limits</ZoruCardTitle>
                        <ZoruCardDescription>Set to 0 for unlimited.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="projectLimit">Project Limit</Label>
                            <Input
                                id="projectLimit"
                                name="projectLimit"
                                type="number"
                                defaultValue={plan?.projectLimit ?? 5}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="agentLimit">Agent Limit (per project)</Label>
                            <Input
                                id="agentLimit"
                                name="agentLimit"
                                type="number"
                                defaultValue={plan?.agentLimit ?? 10}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="attributeLimit">Custom Attribute Limit</Label>
                            <Input
                                id="attributeLimit"
                                name="attributeLimit"
                                type="number"
                                defaultValue={plan?.attributeLimit ?? 20}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="templateLimit">Template Limit</Label>
                            <Input
                                id="templateLimit"
                                name="templateLimit"
                                type="number"
                                defaultValue={plan?.templateLimit ?? 50}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="flowLimit">Flow Builder Limit</Label>
                            <Input
                                id="flowLimit"
                                name="flowLimit"
                                type="number"
                                defaultValue={plan?.flowLimit ?? 10}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="metaFlowLimit">Meta Flows Limit</Label>
                            <Input
                                id="metaFlowLimit"
                                name="metaFlowLimit"
                                type="number"
                                defaultValue={plan?.metaFlowLimit ?? 10}
                                required
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cannedMessageLimit">Canned Messages Limit</Label>
                            <Input
                                id="cannedMessageLimit"
                                name="cannedMessageLimit"
                                type="number"
                                defaultValue={plan?.cannedMessageLimit ?? 25}
                                required
                                min="0"
                            />
                        </div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Enabled Apps & Features</ZoruCardTitle>
                        <ZoruCardDescription>
                            Select which apps and major features are available on this plan.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {planFeatureMap.map((feature) => (
                                <div
                                    key={feature.id}
                                    className="flex items-center space-x-3 rounded-[var(--zoru-radius)] border border-zoru-line p-3 hover:bg-zoru-surface-2"
                                >
                                    <Checkbox
                                        id={feature.id}
                                        name={feature.id}
                                        defaultChecked={(plan?.features as any)?.[feature.id] ?? true}
                                    />
                                    <div className="space-y-1 leading-none">
                                        <Label htmlFor={feature.id} className="flex items-center gap-2">
                                            <feature.icon className="h-4 w-4" />
                                            {feature.name}
                                        </Label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>

            <Separator />

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
