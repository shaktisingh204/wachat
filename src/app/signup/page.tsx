'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  getPublicSignupSettings,
  submitClientSignup,
  type ClientSignupInput,
  type SignupSettings,
} from '@/app/actions/client-signup.actions';

const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'India',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Brazil',
  'Mexico',
  'Singapore',
  'United Arab Emirates',
  'South Africa',
  'Other',
];

const EMPTY_FORM: ClientSignupInput = {
  company_name: '',
  contact_name: '',
  email: '',
  password: '',
  mobile: '',
  country: 'United States',
  website: '',
  agree_to_terms: false,
};

export default function ClientSignupPage() {
  const { toast } = useZoruToast();
  const [form, setForm] = useState<ClientSignupInput>(EMPTY_FORM);
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPublicSignupSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const update = <K extends keyof ClientSignupInput>(key: K, value: ClientSignupInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.agree_to_terms) {
      toast({ title: 'Please agree to the Terms', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const res = await submitClientSignup(form);
      if (res.error) {
        toast({ title: 'Signup failed', description: res.error, variant: 'destructive' });
        return;
      }
      setSubmitted(true);
    });
  };

  if (settings && !settings.allowClientSignup) {
    return (
      <main className="zoruui min-h-screen bg-zoru-bg px-4 py-16 text-zoru-ink">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl text-zoru-ink">Signup unavailable</h1>
          <p className="mt-2 text-sm text-zoru-ink-muted">
            New client signups are currently closed. Please contact the SabNode team for access.
          </p>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="zoruui min-h-screen bg-zoru-bg px-4 py-16 text-zoru-ink">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl text-zoru-ink">Account created</h1>
          <p className="mt-3 text-sm text-zoru-ink-muted">
            Your account is awaiting admin approval. You will receive an email when activated.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/login">
              <Button variant="outline">Back to login</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="zoruui min-h-screen bg-zoru-bg px-4 py-12 text-zoru-ink">
      <Card className="mx-auto max-w-xl p-8">
        <header className="mb-6">
          <h1 className="text-2xl text-zoru-ink">Create a client account</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Tell us about your business. An admin will review your request before activation.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="company_name">Company name</Label>
            <Input
              id="company_name"
              required
              value={form.company_name}
              onChange={(e) => update('company_name', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact_name">Contact name</Label>
            <Input
              id="contact_name"
              required
              value={form.contact_name}
              onChange={(e) => update('contact_name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                required
                value={form.mobile}
                onChange={(e) => update('mobile', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={form.country}
                onValueChange={(v) => update('country', v)}
              >
                <ZoruSelectTrigger id="country">
                  <ZoruSelectValue placeholder="Select country" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {COUNTRIES.map((c) => (
                    <ZoruSelectItem key={c} value={c}>
                      {c}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://"
              value={form.website ?? ''}
              onChange={(e) => update('website', e.target.value)}
            />
          </div>

          <label className="mt-2 flex items-start gap-2 text-sm text-zoru-ink">
            <Checkbox
              checked={form.agree_to_terms}
              onCheckedChange={(c) => update('agree_to_terms', Boolean(c))}
              aria-label="Agree to terms"
            />
            <span>
              {settings?.termsText ??
                'I agree to the Terms of Service and Privacy Policy.'}{' '}
              <Link
                href={settings?.termsLink ?? '/terms'}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                Read terms
              </Link>
            </span>
          </label>

          <div className="mt-2 flex items-center justify-between gap-3">
            <Link href="/login" className="text-sm text-zoru-ink-muted underline">
              Already have an account? Sign in
            </Link>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Submitting…' : 'Create account'}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
