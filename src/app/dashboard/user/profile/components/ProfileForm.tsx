'use client';

import { useActionState, useEffect } from 'react';
import { handleUpdateUserProfile } from '@/app/actions/user.actions';
import { useToast } from '@/hooks/use-toast';
import {
    CardBody,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Field,
    Input,
    Button,
    SelectField,
    RadioCardGroup,
    RadioCard,
    Separator,
} from '@/components/sabcrm/20ui';
import { Save, UserRound, PanelLeft, PanelTop, CalendarClock, Mail } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { UserProfileFormProps, ActionResponse } from './types';

const profileInitialState: ActionResponse = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} loading={pending} iconLeft={Save}>
            Save changes
        </Button>
    );
}

export function ProfileForm({ user }: UserProfileFormProps) {
    const [state, formAction] = useActionState(handleUpdateUserProfile, profileInitialState);
    const { toast } = useToast();
    const [rail, setRail] = useState<string>(user.appRailPosition || 'left');
    const [language, setLanguage] = useState<string | null>(user.language || 'en');

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
            <input type="hidden" name="appRailPosition" value={rail} />
            <input type="hidden" name="language" value={language || 'en'} />

            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserRound size={16} aria-hidden="true" />
                    User profile
                </CardTitle>
                <CardDescription>Manage your name, language and layout.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
                <Field label="Full name" required>
                    <Input
                        name="name"
                        defaultValue={user.name}
                        required
                        maxLength={50}
                        pattern="^[a-zA-Z\s'-]+$"
                        title="Name can only contain letters, spaces, apostrophes, and hyphens."
                    />
                </Field>
                <Field label="Email" help="Your email cannot be changed here.">
                    <Input name="email" value={user.email} disabled iconLeft={Mail} />
                </Field>
                <Field label="Account created">
                    <Input value={formattedCreatedAt} disabled iconLeft={CalendarClock} />
                </Field>

                <Separator label="Preferences" />

                <Field label="Language">
                    <SelectField
                        value={language}
                        onChange={setLanguage}
                        options={[
                            { value: 'en', label: 'English' },
                            { value: 'hi', label: 'Hindi' },
                            { value: 'es', label: 'Spanish' },
                            { value: 'pt-BR', label: 'Portuguese (Brazil)' },
                        ]}
                    />
                </Field>

                <Field label="Sidebar position">
                    <RadioCardGroup value={rail} onChange={setRail} label="Sidebar position">
                        <RadioCard
                            value="left"
                            label="Left"
                            description="Vertical rail"
                            icon={PanelLeft}
                        />
                        <RadioCard
                            value="top"
                            label="Top"
                            description="Horizontal bar"
                            icon={PanelTop}
                        />
                    </RadioCardGroup>
                </Field>
            </CardBody>
            <CardFooter>
                <SubmitButton />
            </CardFooter>
        </form>
    );
}
