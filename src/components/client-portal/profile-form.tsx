'use client';

/**
 * Client portal profile form. Edits name / mobile / password via
 * `updateClientProfile`. Email is shown read-only (we don't allow
 * changing the login email from inside the portal — that's an
 * account-recovery flow handled elsewhere).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Label } from '@/components/sabcrm/20ui';
import { Switch } from '@/components/sabcrm/20ui';
import { Checkbox } from '@/components/sabcrm/20ui';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui';
import { updateClientProfile } from '@/app/actions/client-portal.actions';

export interface ProfileFormProps {
    initialName: string;
    email: string;
    initialMobile: string;
    initialAvatarUrl: string;
    initialTwoFactorEnabled: boolean;
    initialNotificationPreferences: { email: boolean; sms: boolean };
}

export function ProfileForm({
    initialName,
    email,
    initialMobile,
    initialAvatarUrl,
    initialTwoFactorEnabled,
    initialNotificationPreferences,
}: ProfileFormProps) {
    const router = useRouter();
    const [name, setName] = React.useState(initialName);
    const [mobile, setMobile] = React.useState(initialMobile);
    const [password, setPassword] = React.useState('');
    const [avatarUrl, setAvatarUrl] = React.useState(initialAvatarUrl);
    const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(initialTwoFactorEnabled);
    const [notifEmail, setNotifEmail] = React.useState(initialNotificationPreferences.email);
    const [notifSms, setNotifSms] = React.useState(initialNotificationPreferences.sms);

    const [submitting, setSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    // Inline validation states
    const [nameError, setNameError] = React.useState<string | null>(null);
    const [mobileError, setMobileError] = React.useState<string | null>(null);
    const [passwordError, setPasswordError] = React.useState<string | null>(null);

    const validateName = (val: string) => {
        if (!val.trim()) return 'Name is required.';
        return null;
    };
    const validateMobile = (val: string) => {
        if (val && !/^\+?[0-9\s\-()]+$/.test(val)) return 'Invalid mobile format.';
        return null;
    };
    const validatePassword = (val: string) => {
        if (val && val.length < 8) return 'Password must be at least 8 characters.';
        return null;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        setNameError(validateName(e.target.value));
    };

    const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMobile(e.target.value);
        setMobileError(validateMobile(e.target.value));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        setPasswordError(validatePassword(e.target.value));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setMessage(null);

        const nErr = validateName(name);
        const mErr = validateMobile(mobile);
        const pErr = validatePassword(password);
        
        setNameError(nErr);
        setMobileError(mErr);
        setPasswordError(pErr);

        if (nErr || mErr || pErr) {
            return;
        }

        setSubmitting(true);
        const res = await updateClientProfile({
            name,
            mobile,
            password: password || undefined,
            avatarUrl,
            twoFactorEnabled,
            notificationPreferences: { email: notifEmail, sms: notifSms },
        });
        setSubmitting(false);

        if (res.error) {
            setError(res.error);
            return;
        }
        setMessage('Profile updated successfully.');
        setPassword('');
        router.refresh();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shadow-[var(--st-shadow-sm)] border border-[var(--st-border)]">
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 gap-1.5">
                    <Label htmlFor="pf-avatar">Avatar URL</Label>
                    <Input
                        id="pf-avatar"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.png"
                    />
                    <p className="text-xs text-[var(--st-text-secondary)]">Enter a URL for your profile picture.</p>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-name">Name</Label>
                <Input
                    id="pf-name"
                    value={name}
                    onChange={handleNameChange}
                    onBlur={() => setNameError(validateName(name))}
                    aria-invalid={!!nameError}
                />
                {nameError && <p className="text-xs text-[var(--st-danger)]">{nameError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-email">Email</Label>
                <Input id="pf-email" value={email} readOnly disabled />
                <p className="text-xs text-[var(--st-text-secondary)]">
                    Contact support to change your sign-in email.
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-mobile">Mobile</Label>
                <Input
                    id="pf-mobile"
                    value={mobile}
                    onChange={handleMobileChange}
                    onBlur={() => setMobileError(validateMobile(mobile))}
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={!!mobileError}
                />
                {mobileError && <p className="text-xs text-[var(--st-danger)]">{mobileError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pf-password">New password</Label>
                <Input
                    id="pf-password"
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => setPasswordError(validatePassword(password))}
                    type="password"
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                    aria-invalid={!!passwordError}
                />
                {passwordError && <p className="text-xs text-[var(--st-danger)]">{passwordError}</p>}
            </div>

            <div className="flex flex-col gap-3 py-2 border-t border-b border-[var(--st-border)]">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-xs text-[var(--st-text-secondary)]">Require an extra step to sign in.</p>
                    </div>
                    <Switch
                        checked={twoFactorEnabled}
                        onCheckedChange={setTwoFactorEnabled}
                    />
                </div>
                
                <div className="flex flex-col gap-2 mt-2">
                    <Label>Notification Preferences</Label>
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            id="notif-email" 
                            checked={notifEmail} 
                            onCheckedChange={(c) => setNotifEmail(c === true)} 
                        />
                        <Label htmlFor="notif-email" className="font-normal text-sm">Email notifications</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            id="notif-sms" 
                            checked={notifSms} 
                            onCheckedChange={(c) => setNotifSms(c === true)} 
                        />
                        <Label htmlFor="notif-sms" className="font-normal text-sm">SMS notifications</Label>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="text-sm text-[var(--st-danger)] bg-[var(--st-danger-soft)] p-2 rounded border border-[var(--st-danger)]" role="alert">
                    {error}
                </div>
            ) : null}
            {message ? (
                <div className="text-sm text-[var(--st-status-ok)] bg-[var(--st-status-ok)] p-2 rounded border border-[var(--st-status-ok)]" role="status">
                    {message}
                </div>
            ) : null}

            <div className="flex justify-end">
                <Button type="submit" disabled={submitting || !!nameError || !!mobileError || !!passwordError}>
                    {submitting ? 'Saving…' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
