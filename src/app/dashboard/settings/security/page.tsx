'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Switch, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    Key,
  Laptop,
  LoaderCircle,
  Lock,
  LogOut,
  Save,
  Shield,
  } from 'lucide-react';

import { handleChangePassword } from '@/app/actions/user.actions';
import {
    getAccountPreferences,
    getActiveSessions,
    setLoginAlerts as setLoginAlertsAction,
    signOutEverywhere,
    type ActiveSession,
} from '@/app/actions/account.actions';
import { useT } from '@/lib/i18n/client';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

function SaveBtn() {
    const { pending } = useFormStatus();
    const { t } = useT();
    return (
        <Button type="submit" size="md" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pending ? t('common.saving') : t('settings.security.updatePassword')}
        </Button>
    );
}

export default function SecuritySettingsPage() {
    const { t } = useT();
    const [state, formAction] = useActionState(handleChangePassword, initialState);
    const [twoFactor, setTwoFactor] = useState(false);
    const [loginAlerts, setLoginAlerts] = useState(true);
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [revokeAllPending, startRevokeAll] = useTransition();
    const [alertsPending, startAlerts] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) toast({ title: state.message });
        if (state.error) toast({ title: t('common.error'), description: state.error, variant: 'destructive' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getAccountPreferences(), getActiveSessions()])
            .then(([prefs, list]) => {
                if (cancelled) return;
                setLoginAlerts(prefs.loginAlerts);
                setTwoFactor(prefs.twoFactorEnabled);
                setSessions(list);
            })
            .catch(() => {
                /* ignore — page still renders with safe defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const persistLoginAlerts = (next: boolean) => {
        setLoginAlerts(next);
        startAlerts(async () => {
            try {
                await setLoginAlertsAction(next);
            } catch {
                setLoginAlerts(!next);
                toast({ title: t('settings.security.toast.savePrefFailed'), variant: 'destructive' });
            }
        });
    };

    const persistTwoFactor = (next: boolean) => {
        // Real TOTP wiring lands in a follow-up — flag is read-back from
        // the user record but enabling currently shows a toast so users
        // aren't tricked into thinking 2FA is live.
        if (next) {
            toast({
                title: t('settings.security.toast.twoFactorSoon'),
                description: t('settings.security.toast.twoFactorSoonDesc'),
            });
            return;
        }
        setTwoFactor(false);
    };

    const handleSignOutEverywhere = () => {
        startRevokeAll(async () => {
            try {
                await signOutEverywhere();
                toast({ title: t('settings.security.toast.signedOutEverywhere') });
                window.location.href = '/login';
            } catch (e: any) {
                toast({
                    title: t('settings.security.toast.signOutEverywhereFailed'),
                    description: e?.message ?? t('common.tryAgain'),
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('settings.security.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>{t('settings.security.title')}</PageTitle>
                    <PageDescription>
                        {t('settings.security.subtitle')}
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            {/* Password */}
            <Card className="p-6">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Lock className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-[var(--st-text)]">{t('settings.security.password.title')}</p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            {t('settings.security.password.hint')}
                        </p>
                    </div>
                </div>
                <form action={formAction} className="grid gap-4 sm:grid-cols-3">
                    <Field label={t('settings.security.password.current')}>
                        <Input type="password" name="currentPassword" required />
                    </Field>
                    <Field label={t('settings.security.password.new')}>
                        <Input type="password" name="newPassword" required minLength={12} />
                    </Field>
                    <Field label={t('settings.security.password.confirm')}>
                        <Input type="password" name="confirmPassword" required minLength={12} />
                    </Field>
                    <div className="sm:col-span-3 flex justify-end">
                        <SaveBtn />
                    </div>
                </form>
            </Card>

            {/* 2FA */}
            <Card className="p-6">
                <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--st-text)]">
                                {t('settings.security.twoFactor.title')}
                            </p>
                            <Badge variant={twoFactor ? 'success' : 'ghost'}>
                                {twoFactor ? t('common.enabled') : t('common.disabled')}
                            </Badge>
                        </div>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            {t('settings.security.twoFactor.hint')}
                        </p>
                    </div>
                    <Switch checked={twoFactor} onCheckedChange={persistTwoFactor} />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                    <div>
                        <Label className="text-[13px]">{t('settings.security.alerts.label')}</Label>
                        <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                            {t('settings.security.alerts.hint')}
                        </p>
                    </div>
                    <Switch
                        checked={loginAlerts}
                        onCheckedChange={persistLoginAlerts}
                        disabled={alertsPending}
                    />
                </div>
            </Card>

            {/* Active sessions */}
            <Card className="p-6">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Laptop className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-[var(--st-text)]">{t('settings.security.sessions.title')}</p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            {t('settings.security.sessions.hint')}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSignOutEverywhere}
                        disabled={revokeAllPending}
                    >
                        {revokeAllPending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <LogOut className="h-4 w-4" />
                        )}
                        {t('settings.security.sessions.signOutEverywhere')}
                    </Button>
                </div>
                <div className="divide-y divide-[var(--st-border)] rounded-xl border border-[var(--st-border)]">
                    {sessions.length === 0 ? (
                        <SessionRow label={t('settings.security.sessions.current')} device={t('settings.security.sessions.thisBrowser')} location="—" current />
                    ) : (
                        sessions.map((s) => (
                            <SessionRow
                                key={s.id}
                                label={s.current ? t('settings.security.sessions.current') : t('settings.security.sessions.session')}
                                device={s.device}
                                location={s.location ?? '—'}
                                current={s.current}
                            />
                        ))
                    )}
                </div>
            </Card>

            {/* Recovery */}
            <Card className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Key className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-[var(--st-text)]">{t('settings.security.recovery.title')}</p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            {t('settings.security.recovery.hint')}
                        </p>
                    </div>
                    <Button variant="outline" size="sm">
                        {t('settings.security.recovery.generate')}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-xs">{label}</Label>
            {children}
        </div>
    );
}

function SessionRow({
    label,
    device,
    location,
    current,
}: {
    label: string;
    device: string;
    location: string;
    current?: boolean;
}) {
    const { t } = useT();
    return (
        <div className="flex items-center justify-between px-4 py-3 text-[13px]">
            <div>
                <div className="flex items-center gap-2">
                    <p className="text-[var(--st-text)]">{label}</p>
                    {current && <Badge variant="success">{t('settings.security.sessions.thisDevice')}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                    {device} · {location}
                </p>
            </div>
            {!current && (
                <Button variant="ghost" size="sm">
                    {t('settings.security.sessions.signOut')}
                </Button>
            )}
        </div>
    );
}
