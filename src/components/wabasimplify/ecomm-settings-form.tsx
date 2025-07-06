
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, Project, EcommSettings } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
}

export function EcommSettingsForm({ project, settings }: EcommSettingsFormProps) {
    const [state, formAction] = useActionState(saveEcommShopSettings, initialState);
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
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card>
                <CardHeader>
                    <CardTitle>Basic Configuration</CardTitle>
                    <CardDescription>Set the fundamental properties for your custom shop.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
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
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
