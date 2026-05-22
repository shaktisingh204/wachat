'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Button,
    Input,
    Label,
    Switch,
} from '@/components/zoruui';
import { LoaderCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPlan } from '@/app/actions/admin-hardening.actions';

export function NewPlanForm() {
    const [isPending, startTransition] = useTransition();
    const [isPublic, setIsPublic] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    const handleSubmit = (formData: FormData) => {
        if (isPublic) formData.set('isPublic', 'on');
        startTransition(async () => {
            const result = await createPlan(formData);
            if (result.success && result.planId) {
                toast({
                    title: 'Plan created',
                    description: 'You can now configure permissions and feature flags.',
                });
                router.push(`/admin/dashboard/plans/${result.planId}`);
            } else {
                toast({
                    title: 'Could not create plan',
                    description: result.error ?? 'Unknown error.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
                <ZoruLabel htmlFor="name">Plan name</ZoruLabel>
                <ZoruInput
                    id="name"
                    name="name"
                    placeholder="e.g. Growth"
                    required
                    autoFocus
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                    <ZoruLabel htmlFor="price">Monthly price</ZoruLabel>
                    <ZoruInput
                        id="price"
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        defaultValue="0"
                        required
                    />
                </div>
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                    <ZoruInput
                        id="currency"
                        name="currency"
                        defaultValue="INR"
                        maxLength={3}
                        className="uppercase"
                    />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="signupCredits">Signup credits</ZoruLabel>
                    <ZoruInput
                        id="signupCredits"
                        name="signupCredits"
                        type="number"
                        min="0"
                        defaultValue="0"
                    />
                </div>
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="projectLimit">Project limit</ZoruLabel>
                    <ZoruInput
                        id="projectLimit"
                        name="projectLimit"
                        type="number"
                        min="0"
                        defaultValue="1"
                    />
                </div>
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="agentLimit">Agent limit</ZoruLabel>
                    <ZoruInput
                        id="agentLimit"
                        name="agentLimit"
                        type="number"
                        min="0"
                        defaultValue="1"
                    />
                </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                    <ZoruLabel htmlFor="isPublic" className="text-sm">
                        Publicly listed
                    </ZoruLabel>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Show this plan on the public pricing page. You can flip this later.
                    </p>
                </div>
                <ZoruSwitch
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <ZoruButton
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/admin/dashboard/plans')}
                    disabled={isPending}
                    className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                >
                    Cancel
                </ZoruButton>
                <ZoruButton
                    type="submit"
                    disabled={isPending}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/25"
                >
                    {isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <PlusCircle className="mr-2 h-4 w-4" />
                    )}
                    Create plan
                </ZoruButton>
            </div>
        </form>
    );
}
