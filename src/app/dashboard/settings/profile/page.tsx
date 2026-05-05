'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { AtSign, LoaderCircle, Mail, Save, User as UserIcon } from 'lucide-react';

import { getSession, handleUpdateUserProfile } from '@/app/actions/user.actions';
import type { WithId, User } from '@/lib/definitions';
import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {pending ? 'Saving…' : 'Save changes'}
    </ZoruButton>
  );
}

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [loading, startLoading] = useTransition();
  const [language, setLanguage] = useState('en');
  const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
  const { toast } = useZoruToast();

  const load = () => {
    startLoading(async () => {
      const session = await getSession();
      const u = session?.user || null;
      setUser(u as any);
      if (u && (u as any).language) setLanguage((u as any).language);
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
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Profile</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Profile</ZoruPageTitle>
          <ZoruPageDescription>
            Update your name, contact email, and display preferences.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {loading || !user ? (
        <ZoruSkeleton className="h-[420px] w-full rounded-[var(--zoru-radius-lg)]" />
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <ZoruCard className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-zoru-ink">{user.name ?? 'Unnamed user'}</p>
                <p className="text-xs text-zoru-ink-muted">{user.email}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <ZoruInput
                  name="name"
                  defaultValue={user.name ?? ''}
                  placeholder="Your name"
                  leadingSlot={<UserIcon />}
                />
              </Field>
              <Field label="Contact email">
                <ZoruInput
                  name="email"
                  type="email"
                  defaultValue={user.email ?? ''}
                  leadingSlot={<Mail />}
                />
              </Field>
              <Field label="Username / handle">
                <ZoruInput
                  name="username"
                  defaultValue={(user as any).username ?? ''}
                  placeholder="you"
                  leadingSlot={<AtSign />}
                />
              </Field>
              <Field label="Preferred language">
                <ZoruSelect name="language" value={language} onValueChange={setLanguage}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {LANGUAGES.map((l) => (
                      <ZoruSelectItem key={l.value} value={l.value}>
                        {l.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="language" value={language} />
              </Field>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <p className="text-sm text-zoru-ink">Bio</p>
              <p className="text-xs text-zoru-ink-muted">
                A short intro that teammates see in chat and activity logs.
              </p>
            </div>
            <ZoruTextarea
              name="bio"
              defaultValue={(user as any).bio ?? ''}
              rows={4}
              placeholder="Tell your teammates a bit about yourself…"
            />
          </ZoruCard>

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
      <ZoruLabel className="mb-1.5 block text-xs">{label}</ZoruLabel>
      {children}
    </div>
  );
}
