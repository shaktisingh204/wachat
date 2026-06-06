'use client';

import "@/components/sabcrm/20ui/zoru-legacy.css";
import { useEffect, useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from '@/components/sabcrm/20ui/compat';
import {
  getPublicSignupSettings,
  submitClientSignup,
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

const signupSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mobile: z.string().min(1, 'Mobile number is required'),
  country: z.string().min(1, 'Country is required'),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  agree_to_terms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms',
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function ClientSignupPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      company_name: '',
      contact_name: '',
      email: '',
      password: '',
      mobile: '',
      country: 'United States',
      website: '',
      agree_to_terms: false,
    },
  });

  // Handle form state reset if token/session times out (idle for 30 mins)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resetIdleTimeout = () => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      reset();
      toast({
        title: 'Session Expired',
        description: 'For your security, your form has been reset due to inactivity.',
        variant: 'destructive',
      });
    }, 30 * 60 * 1000); // 30 minutes
  };

  useEffect(() => {
    let mounted = true;
    getPublicSignupSettings()
      .then((s) => {
        if (mounted) setSettings(s);
      })
      .catch(() => {
        if (mounted) setSettings(null);
      });

    resetIdleTimeout();

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimeout();

    events.forEach((event) => window.addEventListener(event, handleActivity));

    return () => {
      mounted = false;
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [reset, toast]);

  const onSubmit = (data: SignupFormData) => {
    startTransition(async () => {
      try {
        const res = await submitClientSignup({
          ...data,
          website: data.website || undefined,
        });

        if (res.error) {
          toast({ title: 'Signup failed', description: res.error, variant: 'destructive' });
          if (res.error.toLowerCase().includes('timeout') || res.error.toLowerCase().includes('token')) {
             reset();
          }
          return;
        }

        setSubmitted(true);
        reset();
      } catch (err: any) {
        toast({ title: 'Signup failed', description: err.message || 'An error occurred', variant: 'destructive' });
      }
    });
  };

  if (settings && !settings.allowClientSignup) {
    return (
      <main className="zoruui min-h-screen bg-[var(--st-bg)] px-4 py-16 text-[var(--st-text)]">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl text-[var(--st-text)]">Signup unavailable</h1>
          <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
            New client signups are currently closed. Please contact the SabNode team for access.
          </p>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="zoruui min-h-screen bg-[var(--st-bg)] px-4 py-16 text-[var(--st-text)]">
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-2xl text-[var(--st-text)]">Account created</h1>
          <p className="mt-3 text-sm text-[var(--st-text-secondary)]">
            {settings?.requireAdminApproval
              ? 'Your account is awaiting admin approval. You will receive an email when activated.'
              : 'Your account has been created and is ready to use. You will receive a welcome email shortly.'}
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
    <main className="zoruui min-h-screen bg-[var(--st-bg)] px-4 py-12 text-[var(--st-text)]">
      <Card className="mx-auto max-w-xl p-8">
        <header className="mb-6">
          <h1 className="text-2xl text-[var(--st-text)]">Create a client account</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            {settings?.requireAdminApproval
              ? 'Tell us about your business. An admin will review your request before activation.'
              : 'Tell us about your business to get started.'}
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" {...register('company_name')} />
            {errors.company_name && (
              <span className="text-xs text-[var(--st-text)]">{errors.company_name.message}</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact_name">Contact name</Label>
            <Input id="contact_name" {...register('contact_name')} />
            {errors.contact_name && (
              <span className="text-xs text-[var(--st-text)]">{errors.contact_name.message}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <span className="text-xs text-[var(--st-text)]">{errors.email.message}</span>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <span className="text-xs text-[var(--st-text)]">{errors.password.message}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                {...register('mobile')}
              />
              {errors.mobile && (
                <span className="text-xs text-[var(--st-text)]">{errors.mobile.message}</span>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
              {errors.country && (
                <span className="text-xs text-[var(--st-text)]">{errors.country.message}</span>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://"
              {...register('website')}
            />
            {errors.website && (
              <span className="text-xs text-[var(--st-text)]">{errors.website.message}</span>
            )}
          </div>

          <div className="mt-2 grid gap-1">
            <label className="flex items-start gap-2 text-sm text-[var(--st-text)]">
              <Controller
                control={control}
                name="agree_to_terms"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Agree to terms"
                  />
                )}
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
            {errors.agree_to_terms && (
              <span className="text-xs text-[var(--st-text)]">{errors.agree_to_terms.message}</span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <Link href="/login" className="text-sm text-[var(--st-text-secondary)] underline">
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
