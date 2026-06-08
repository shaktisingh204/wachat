'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();
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
        title: 'Session expired',
        description: 'For your security, your form has been reset due to inactivity.',
        tone: 'warning',
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
          toast({ title: 'Signup failed', description: res.error, tone: 'danger' });
          if (res.error.toLowerCase().includes('timeout') || res.error.toLowerCase().includes('token')) {
            reset();
          }
          return;
        }

        setSubmitted(true);
        reset();
      } catch (err: any) {
        toast({ title: 'Signup failed', description: err.message || 'An error occurred', tone: 'danger' });
      }
    });
  };

  if (settings && !settings.allowClientSignup) {
    return (
      <main className="20ui min-h-screen bg-[var(--st-bg)] px-4 py-16 text-[var(--st-text)]">
        <Card className="mx-auto max-w-lg text-center" padding="lg">
          <CardHeader>
            <CardTitle>Signup unavailable</CardTitle>
            <CardDescription>
              New client signups are currently closed. Please contact the SabNode team for access.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="20ui min-h-screen bg-[var(--st-bg)] px-4 py-16 text-[var(--st-text)]">
        <Card className="mx-auto max-w-lg text-center" padding="lg">
          <CardHeader>
            <CardTitle>Account created</CardTitle>
            <CardDescription>
              {settings?.requireAdminApproval
                ? 'Your account is awaiting admin approval. You will receive an email when activated.'
                : 'Your account has been created and is ready to use. You will receive a welcome email shortly.'}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="flex justify-center">
              <Link href="/login">
                <Button variant="outline">Back to login</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="20ui min-h-screen bg-[var(--st-bg)] px-4 py-12 text-[var(--st-text)]">
      <Card className="mx-auto max-w-xl" padding="lg">
        <CardHeader>
          <CardTitle>Create a client account</CardTitle>
          <CardDescription>
            {settings?.requireAdminApproval
              ? 'Tell us about your business. An admin will review your request before activation.'
              : 'Tell us about your business to get started.'}
          </CardDescription>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <Field label="Company name" error={errors.company_name?.message}>
              <Input {...register('company_name')} />
            </Field>

            <Field label="Contact name" error={errors.contact_name?.message}>
              <Input {...register('contact_name')} />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Work email" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field label="Password" error={errors.password?.message}>
                <Input type="password" autoComplete="new-password" {...register('password')} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Mobile" error={errors.mobile?.message}>
                <Input type="tel" {...register('mobile')} />
              </Field>
              <Field label="Country" error={errors.country?.message}>
                <Controller
                  control={control}
                  name="country"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field label="Website (optional)" error={errors.website?.message}>
              <Input type="url" prefix="https://" {...register('website')} />
            </Field>

            <Field error={errors.agree_to_terms?.message}>
              <label className="flex items-start gap-2 text-sm text-[var(--st-text)]">
                <Controller
                  control={control}
                  name="agree_to_terms"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
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
            </Field>

            <div className="mt-2 flex items-center justify-between gap-3">
              <Link href="/login" className="text-sm text-[var(--st-text-secondary)] underline">
                Already have an account? Sign in
              </Link>
              <Button type="submit" variant="primary" loading={isPending}>
                {isPending ? 'Submitting' : 'Create account'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
