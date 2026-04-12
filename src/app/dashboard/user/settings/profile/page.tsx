

'use client';

import { useEffect, useState, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { handleUpdateUserProfile, handleChangePassword, getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, LoaderCircle, Save, KeyRound, User as UserIcon, Building, CheckCircle2, Clock, Briefcase, Globe, Layers } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const profileInitialState = { message: undefined, error: undefined };
const passwordInitialState = { message: undefined, error: undefined };

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
            {/* Pass all existing user settings to avoid them being overwritten */}
            <input type="hidden" name="tags" value={JSON.stringify(user.tags || [])} />
            <input type="hidden" name="appRailPosition" value={user.appRailPosition || 'left'} />
            <input type="hidden" name="businessName" value={user.businessProfile?.name || ''} />
            <input type="hidden" name="businessAddress" value={user.businessProfile?.address || ''} />
            <input type="hidden" name="businessGstin" value={user.businessProfile?.gstin || ''} />

            <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Manage your name and view your account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" defaultValue={user.name} required maxLength={50} pattern="^[a-zA-Z\s'-]+$" title="Name can only contain letters, spaces, apostrophes, and hyphens." />
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

function BusinessProfileForm({ user }: { user: Omit<User, 'password'> }) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            {/* Pass all existing user settings to avoid them being overwritten */}
            <input type="hidden" name="name" value={user.name} />
            <input type="hidden" name="tags" value={JSON.stringify(user.tags || [])} />
            <input type="hidden" name="appRailPosition" value={user.appRailPosition || 'left'} />

            <CardHeader>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>This information will be used in invoices, vouchers, and other accounting documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" name="businessName" defaultValue={user.businessProfile?.name} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="businessAddress">Address</Label>
                    <Textarea id="businessAddress" name="businessAddress" defaultValue={user.businessProfile?.address} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="businessGstin">GSTIN</Label>
                    <Input id="businessGstin" name="businessGstin" defaultValue={user.businessProfile?.gstin} />
                </div>
            </CardContent>
            <CardFooter>
                <SubmitButton icon={Save}>Save Business Profile</SubmitButton>
            </CardFooter>
        </form>
    );
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
                    <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
                </div>
                <Separator />
                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
                </div>
            </CardContent>
            <CardFooter>
                <SubmitButton icon={KeyRound}>Update Password</SubmitButton>
            </CardFooter>
        </form>
    );
}

function OnboardingDetailsCard({ user }: { user: Omit<User, 'password'> }) {
    const ob = user.onboarding;
    if (!ob) return null;

    const isComplete = ob.status === 'complete';
    const modules = ob.requirements?.modules ?? user.enabledModules ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Onboarding Details
                </CardTitle>
                <CardDescription>
                    Setup information collected during your onboarding.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* Status */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <Badge variant={isComplete ? 'default' : 'secondary'}>
                        {isComplete ? (
                            <><CheckCircle2 className="mr-1 h-3 w-3" /> Complete</>
                        ) : (
                            <><Clock className="mr-1 h-3 w-3" /> In progress ({ob.status})</>
                        )}
                    </Badge>
                </div>

                <Separator />

                {/* Profile info */}
                {ob.profile && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.profile.companyName && (
                                <><span className="text-muted-foreground">Company</span><span>{ob.profile.companyName}</span></>
                            )}
                            {ob.profile.role && (
                                <><span className="text-muted-foreground">Role</span><span>{ob.profile.role}</span></>
                            )}
                            {ob.profile.country && (
                                <><span className="text-muted-foreground">Country</span><span>{ob.profile.country}</span></>
                            )}
                            {ob.profile.phone && (
                                <><span className="text-muted-foreground">Phone</span><span>{ob.profile.phone}</span></>
                            )}
                            {ob.profile.website && (
                                <><span className="text-muted-foreground">Website</span><span>{ob.profile.website}</span></>
                            )}
                        </div>
                    </div>
                )}

                {/* Business info */}
                {ob.business && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> Business
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.business.industry && (
                                <><span className="text-muted-foreground">Industry</span><span>{ob.business.industry}</span></>
                            )}
                            {ob.business.teamSize && (
                                <><span className="text-muted-foreground">Team size</span><span>{ob.business.teamSize}</span></>
                            )}
                            {ob.business.monthlyVolume && (
                                <><span className="text-muted-foreground">Monthly volume</span><span>{ob.business.monthlyVolume}</span></>
                            )}
                            {ob.business.useCases && ob.business.useCases.length > 0 && (
                                <><span className="text-muted-foreground">Use cases</span><span>{ob.business.useCases.join(', ')}</span></>
                            )}
                        </div>
                    </div>
                )}

                {/* Requirements / Modules */}
                {(modules.length > 0 || ob.requirements) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Requirements
                        </p>
                        {modules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {modules.map((m) => (
                                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                ))}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {ob.requirements?.primaryGoal && (
                                <><span className="text-muted-foreground">Primary goal</span><span>{ob.requirements.primaryGoal}</span></>
                            )}
                            {ob.requirements?.currentTools && (
                                <><span className="text-muted-foreground">Current tools</span><span>{ob.requirements.currentTools}</span></>
                            )}
                            {ob.requirements?.timeline && (
                                <><span className="text-muted-foreground">Timeline</span><span>{ob.requirements.timeline}</span></>
                            )}
                        </div>
                    </div>
                )}

                {/* Timestamps */}
                {(ob.startedAt || ob.completedAt) && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm pt-2 border-t">
                        {ob.startedAt && (
                            <><span className="text-muted-foreground">Started</span><span>{new Date(ob.startedAt).toLocaleDateString()}</span></>
                        )}
                        {ob.completedAt && (
                            <><span className="text-muted-foreground">Completed</span><span>{new Date(ob.completedAt).toLocaleDateString()}</span></>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ProfilePageSkeleton() {
    return (
        <div className="space-y-6">
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
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-48" />
                </CardFooter>
            </Card>
        </div>
    );
}


export default function ProfilePage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "My Profile | SabNode";
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
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card><ProfileForm user={user} /></Card>
                <Card><PasswordForm /></Card>
            </div>
            <Card><BusinessProfileForm user={user} /></Card>
            <OnboardingDetailsCard user={user} />
        </div>
    )
}
