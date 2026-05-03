'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { LuUser, LuSave, LuLoaderCircle, LuAtSign, LuMail } from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
    ClaySelect,
} from '@/components/clay';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    getSession,
    handleUpdateUserProfile,
} from '@/app/actions/user.actions';
import type { WithId, User } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
];

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            size="md"
            disabled={pending}
            leading={pending ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuSave className="h-4 w-4" />}
        >
            {pending ? 'Saving…' : 'Save changes'}
        </ClayButton>
    );
}

export default function ProfileSettingsPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [loading, startLoading] = useTransition();
    const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
    const { toast } = useToast();

    const load = () => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Profile updated' });
            load();
        }
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Profile' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Profile"
                subtitle="Update your name, contact email, and display preferences."
            />

            {loading || !user ? (
                <Skeleton className="h-[420px] w-full rounded-2xl" />
            ) : (
                <form action={formAction} className="flex flex-col gap-4">
                    <ClayCard padded>
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
                                <LuUser className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[13.5px] font-semibold text-foreground">
                                    {user.name ?? 'Unnamed user'}
                                </p>
                                <p className="text-[12.5px] text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Display name">
                                <ClayInput
                                    name="name"
                                    defaultValue={user.name ?? ''}
                                    placeholder="Your name"
                                    leading={<LuUser className="h-4 w-4" />}
                                />
                            </Field>
                            <Field label="Contact email">
                                <ClayInput
                                    name="email"
                                    type="email"
                                    defaultValue={user.email ?? ''}
                                    leading={<LuMail className="h-4 w-4" />}
                                />
                            </Field>
                            <Field label="Username / handle">
                                <ClayInput
                                    name="username"
                                    defaultValue={(user as any).username ?? ''}
                                    placeholder="you"
                                    leading={<LuAtSign className="h-4 w-4" />}
                                />
                            </Field>
                            <Field label="Preferred language">
                                <ClaySelect
                                    name="language"
                                    defaultValue={(user as any).language ?? 'en'}
                                    options={LANGUAGES}
                                />
                            </Field>
                        </div>
                    </ClayCard>

                    <ClayCard padded>
                        <SectionTitle
                            title="Bio"
                            description="A short intro that teammates see in chat and activity logs."
                        />
                        <textarea
                            name="bio"
                            defaultValue={(user as any).bio ?? ''}
                            rows={4}
                            placeholder="Tell your teammates a bit about yourself…"
                            className="clay-input w-full resize-none py-3"
                        />
                    </ClayCard>

                    <div className="flex justify-end">
                        <SaveButton />
                    </div>
                </form>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-[12.5px] font-medium text-foreground">{label}</Label>
            {children}
        </div>
    );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
    return (
        <div className="mb-4">
            <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
            <p className="text-[12.5px] text-muted-foreground">{description}</p>
        </div>
    );
}
