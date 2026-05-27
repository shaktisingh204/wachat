'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  registerForSabwebinar,
  type SabwebinarLandingTheme,
} from '@/app/actions/sabwebinar.actions';

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
    <main style={{ background: bg, color: fg, minHeight: '100vh' }}>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-widest opacity-70">Register</p>
          <h1 className="text-3xl font-bold">{title}</h1>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-80">Name</span>
            <input
              required
              className="rounded-md border border-white/20 bg-transparent px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-80">Work email</span>
            <input
              required
              type="email"
              className="rounded-md border border-white/20 bg-transparent px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-80">Phone (optional)</span>
            <input
              className="rounded-md border border-white/20 bg-transparent px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-80">Company (optional)</span>
            <input
              className="rounded-md border border-white/20 bg-transparent px-3 py-2"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </label>

          {error ? <p className="text-sm" style={{ color: '#ff6b6b' }}>{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md px-6 py-3 font-medium disabled:opacity-60"
            style={{ background: accent, color: '#ffffff' }}
          >
            {pending ? 'Registering…' : (theme?.ctaLabel ?? 'Register')}
          </button>
        </form>
      </div>
    </main>
  );
}
