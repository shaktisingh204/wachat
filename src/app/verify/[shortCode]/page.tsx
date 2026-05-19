'use client';

import { useState, useTransition } from 'react';
import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel } from '@/components/zoruui';
import { Lock, LoaderCircle } from 'lucide-react';
import { verifyLinkPassword } from '@/app/actions/url-shortener.actions';

export default function VerifyLinkPage({ params }: { params: { shortCode: string } }) {
  const { shortCode } = params;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyLinkPassword(shortCode, password);
      if (result.success && result.originalUrl) {
        window.location.href = result.originalUrl;
      } else {
        setError('Incorrect password');
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <ZoruCard className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Lock className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="text-center">
            <h1 className="text-[17px] font-medium text-zoru-ink">This link is protected</h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">Enter password to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="password" className="text-[12.5px] text-zoru-ink-muted">
              Password
            </ZoruLabel>
            <ZoruInput
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            {error ? (
              <p className="text-[12px] text-zoru-danger-ink">{error}</p>
            ) : null}
          </div>
          <ZoruButton type="submit" className="w-full" disabled={isPending || !password}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Continue
          </ZoruButton>
        </form>
      </ZoruCard>
    </div>
  );
}
