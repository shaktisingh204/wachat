
'use client';

import { useEffect, useState, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { getSession, handleUpdateUserProfile, handleChangePassword } from '@/app/actions';
import type { User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, LoaderCircle, Save, KeyRound, User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const profileInitialState = { message: null, error: null };
const passwordInitialState = { message: null, error: null };

export const dynamic = 'force-dynamic';

function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

function ProfileForm({ user }: { user: Omit<User, 'password'> }) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Manage your name and view your account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" defaultValue={user.name} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" value={user.email} disabled />
                </div>
                 <div className="space-y-2">
                    <Label>Account Created</Label>
                    <Input value={new Date(user.createdAt).toLocaleString()} disabled />
                </div>
            </CardContent>
            <CardFooter>
                <SubmitButton icon={Save}>Save Changes</SubmitButton>
            </CardFooter>
        </form>
    )
}

function PasswordForm() {
    const [state, formAction] = useActionState(handleChangePassword, passwordInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction} ref={formRef}>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Enter your current and new password to update your credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" name="currentPassword" type="password" required />
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" name="newPassword" type="password" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" required />
                </div>
            </CardContent>
            <CardFooter>
                <SubmitButton icon={KeyRound}>Update Password</SubmitButton>
            </CardFooter>
        </form>
    );
}

function ProfilePageSkeleton() {
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
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                     <CardFooter>
                        <Skeleton className="h-10 w-36" />
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}


export default function ProfilePage() {
    const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "My Profile | Wachat";
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <ProfilePageSkeleton />;
    }

    if (!user) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertCircle /> Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Could not load user profile. You may need to log in again.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <UserIcon className="h-8 w-8" />
                    My Profile
                </h1>
                <p className="text-muted-foreground">View and manage your account settings.</p>
            </div>
             <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card className="card-gradient card-gradient-green"><ProfileForm user={user} /></Card>
                <Card className="card-gradient card-gradient-blue"><PasswordForm /></Card>
            </div>
        </div>
    )
}
