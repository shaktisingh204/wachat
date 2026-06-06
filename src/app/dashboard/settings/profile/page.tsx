'use client';

import { BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea, useToast, Breadcrumb } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AtSign,
  LoaderCircle,
  Mail,
  Save,
  User as UserIcon } from 'lucide-react';

import { getSession,
  handleUpdateUserProfile } from '@/app/actions/user.actions';
import { useT } from '@/lib/i18n/client';

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
  const { t } = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? t('common.saving') : t('settings.profile.saveChanges')}
    </Button>
  );
}

export default function ProfileSettingsPage() {
  const { t } = useT();
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [loading, startLoading] = useTransition();
  const [language, setLanguage] = useState('en');
  const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
  const { toast } = useToast();

  const load = () => {
    startLoading(async () => {
      const session = await getSession();
      const u = session?.user || null;
      setUser(u as any);
      if (u && u.language) setLanguage(u.language);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ title: t('settings.profile.toast.updated') });
      load();
    }
    if (state.error) toast({ title: t('common.error'), description: state.error, variant: 'destructive' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.profile.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>{t('settings.profile.title')}</PageTitle>
          <PageDescription>
            {t('settings.profile.subtitle')}
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {loading || !user ? (
        <Skeleton className="h-[420px] w-full rounded-[var(--st-radius-lg)]" />
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-[var(--st-text)]">{user.name ?? t('settings.profile.unnamedUser')}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">{user.email}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('settings.profile.fields.displayName')}>
                <Input
                  name="name"
                  defaultValue={user.name ?? ''}
                  placeholder={t('settings.profile.placeholders.name')}
                  leadingSlot={<UserIcon />}
                />
              </Field>
              <Field label={t('settings.profile.fields.contactEmail')}>
                <Input
                  name="email"
                  type="email"
                  defaultValue={user.email ?? ''}
                  leadingSlot={<Mail />}
                />
              </Field>
              <Field label={t('settings.profile.fields.usernameHandle')}>
                <Input
                  name="username"
                  defaultValue={(user as any).username ?? ''}
                  placeholder={t('settings.profile.placeholders.username')}
                  leadingSlot={<AtSign />}
                />
              </Field>
              <Field label={t('settings.profile.fields.preferredLanguage')}>
                <Select name="language" value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="language" value={language} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <p className="text-sm text-[var(--st-text)]">{t('settings.profile.bio.title')}</p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                {t('settings.profile.bio.description')}
              </p>
            </div>
            <Textarea
              name="bio"
              defaultValue={(user as any).bio ?? ''}
              rows={4}
              placeholder={t('settings.profile.bio.placeholder')}
            />
          </Card>

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
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
