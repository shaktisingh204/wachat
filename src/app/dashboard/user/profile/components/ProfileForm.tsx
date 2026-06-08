'use client';

import { useActionState, useEffect } from 'react';
import { handleUpdateUserProfile } from '@/app/actions/user.actions';
import { useToast } from '@/hooks/use-toast';
import { CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, RadioGroup, RadioGroupItem, Separator } from '@/components/sabcrm/20ui';
import { Save, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
            {children}
        </Button>
    );
}

export function ProfileForm({ user }: UserProfileFormProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const formattedCreatedAt = new Date(user.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return (
        <form action={formAction}>
            <input type="hidden" name="tags" value={JSON.stringify(user.tags || [])} />
            <input type="hidden" name="businessName" value={user.businessProfile?.name || ''} />
            <input type="hidden" name="businessAddress" value={user.businessProfile?.address || ''} />
            <input type="hidden" name="businessGstin" value={user.businessProfile?.gstin || ''} />
            <input type="hidden" name="businessPan" value={user.businessProfile?.pan || ''} />

            <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Manage your name and view your account details.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                        id="name" 
                        name="name" 
                        defaultValue={user.name} 
                        required 
                        maxLength={50} 
                        pattern="^[a-zA-Z\s'-]+$" 
                        title="Name can only contain letters, spaces, apostrophes, and hyphens." 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                    <Label>Account Created</Label>
                    <Input value={formattedCreatedAt} disabled />
                </div>
                
                <Separator />

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-[var(--st-text)]">Preferences</h4>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="language">Language</Label>
                            <Select name="language" defaultValue={user.language || 'en'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="hi">Hindi</SelectItem>
                                    <SelectItem value="es">Spanish</SelectItem>
                                    <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Sidebar Position</Label>
                            <RadioGroup name="appRailPosition" defaultValue={user.appRailPosition || 'left'} className="flex items-center gap-4 mt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="left" id="r-left" />
                                    <Label htmlFor="r-left">Left</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="top" id="r-top" />
                                    <Label htmlFor="r-top">Top</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                </div>
            </CardBody>
            <CardFooter>
                <SubmitButton icon={Save}>Save Changes</SubmitButton>
            </CardFooter>
        </form>
    );
}
