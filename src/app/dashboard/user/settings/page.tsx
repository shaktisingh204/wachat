
'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react-dom';
import { handleUpdateUserProfile, getSession } from '@/app/actions';
import type { User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save, Layout, Rows, Settings } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFormStatus } from 'react-dom';

const profileInitialState = { message: null, error: null };

function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

function UserSettingsPageSkeleton() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export default function UserSettingsPage() {
    const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();

    useEffect(() => {
        document.title = "User Settings | SabNode";
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: 'Layout preference saved. It will be applied on the next page refresh.' });
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    if (loading || !user) {
        return <UserSettingsPageSkeleton />;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Settings className="h-8 w-8" />
                    User Settings
                </h1>
                <p className="text-muted-foreground">Manage your personal account and layout preferences.</p>
            </div>
            <div className="max-w-2xl">
                 <form action={formAction}>
                    <input type="hidden" name="name" value={user.name} />
                    <Card>
                        <CardHeader>
                            <CardTitle>Layout Preferences</CardTitle>
                            <CardDescription>Customize the dashboard layout to your liking.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>App Rail Position</Label>
                                <RadioGroup name="appRailPosition" defaultValue={user.appRailPosition || 'left'} className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <RadioGroupItem value="left" id="pos-left" className="sr-only"/>
                                        <Label htmlFor="pos-left" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                            <Layout className="mb-3 h-6 w-6"/>
                                            Left Sidebar
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="top" id="pos-top" className="sr-only"/>
                                        <Label htmlFor="pos-top" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                            <Rows className="mb-3 h-6 w-6"/>
                                            Top Header
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SubmitButton icon={Save}>Save Layout</SubmitButton>
                        </CardFooter>
                    </Card>
                 </form>
            </div>
        </div>
    );
}
