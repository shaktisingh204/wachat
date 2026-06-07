'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  registerForSabwebinar,
  type SabwebinarLandingTheme,
} from '@/app/actions/sabwebinar.actions';
import {
  Button,
  Field,
  Input,
  Alert,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
} from '@/components/sabcrm/20ui';

interface Props {
  slug: string;
  title: string;
  theme?: SabwebinarLandingTheme;
}

export function RegisterForm({ slug, title, theme }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  const bg = theme?.backgroundColor ?? '#0b0d12';
  const fg = theme?.textColor ?? '#ffffff';
  const accent = theme?.accentColor ?? '#2563eb';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    startTransition(async () => {
      try {
        const res = await registerForSabwebinar({
          slug,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          source: typeof document !== 'undefined' ? document.referrer || 'direct' : 'direct',
        });
        const dest = `/webinar/${slug}/live?t=${encodeURIComponent(res.data.joinToken)}`;
        router.push(dest);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    });
  };

  return (
    <main className="ui20" style={{ background: bg, color: fg, minHeight: '100vh' }}>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageEyebrow>Register</PageEyebrow>
            <PageTitle>{title}</PageTitle>
          </PageHeaderHeading>
        </PageHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Work email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone (optional)">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Company (optional)">
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button
            type="submit"
            variant="primary"
            block
            loading={pending}
            style={{ background: accent, color: '#ffffff', borderColor: accent }}
          >
            {pending ? 'Registering...' : (theme?.ctaLabel ?? 'Register')}
          </Button>
        </form>
      </div>
    </main>
  );
}
