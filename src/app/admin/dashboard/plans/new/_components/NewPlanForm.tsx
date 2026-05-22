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
                <Label htmlFor="name">Plan name</Label>
                <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Growth"
                    required
                    autoFocus
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="price">Monthly price</Label>
                    <Input
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
                    <Label htmlFor="currency">Currency</Label>
                    <Input
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
                    <Label htmlFor="signupCredits">Signup credits</Label>
                    <Input
                        id="signupCredits"
                        name="signupCredits"
                        type="number"
                        min="0"
                        defaultValue="0"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="projectLimit">Project limit</Label>
                    <Input
                        id="projectLimit"
                        name="projectLimit"
                        type="number"
                        min="0"
                        defaultValue="1"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="agentLimit">Agent limit</Label>
                    <Input
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
                    <Label htmlFor="isPublic" className="text-sm">
                        Publicly listed
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Show this plan on the public pricing page. You can flip this later.
                    </p>
                </div>
                <Switch
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/admin/dashboard/plans')}
                    disabled={isPending}
                    className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                >
                    Cancel
                </Button>
                <Button
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
                </Button>
            </div>
        </form>
    );
}
