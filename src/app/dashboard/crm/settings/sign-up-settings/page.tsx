'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  getSignupSettingsForAdmin,
  saveSignupSettings,
  type SignupSettings,
} from '@/app/actions/client-signup.actions';

export default function SignUpSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSignupSettingsForAdmin()
      .then(setSettings)
      .catch((e: unknown) =>
        toast({
          title: 'Failed to load settings',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        }),
      );
  }, [toast]);

  const update = <K extends keyof SignupSettings>(key: K, value: SignupSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    if (!settings) return;
    startTransition(async () => {
      const res = await saveSignupSettings(settings);
      if (res.error) {
        toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Signup settings saved' });
    });
  };

  if (!settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Sign-up settings</ZoruPageTitle>
          <ZoruPageDescription>
            Control public client signup, admin approval, and the terms shown on the public form.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zoru-ink">Allow client signup</p>
              <p className="text-[12.5px] text-zoru-ink-muted">
                When off, the public /signup page shows a "signup unavailable" message.
              </p>
            </div>
            <Switch
              checked={settings.allowClientSignup}
              onCheckedChange={(c) => update('allowClientSignup', Boolean(c))}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zoru-ink">Require admin approval</p>
              <p className="text-[12.5px] text-zoru-ink-muted">
                New accounts stay in `pending` until an admin approves them from the queue.
              </p>
            </div>
            <Switch
              checked={settings.requireAdminApproval}
              onCheckedChange={(c) => update('requireAdminApproval', Boolean(c))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="terms-link">Terms link</Label>
            <Input
              id="terms-link"
              value={settings.termsLink}
              onChange={(e) => update('termsLink', e.target.value)}
              placeholder="/terms or https://example.com/terms"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="terms-text">Terms checkbox text</Label>
            <Textarea
              id="terms-text"
              value={settings.termsText}
              rows={3}
              onChange={(e) => update('termsText', e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
