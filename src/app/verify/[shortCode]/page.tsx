'use client';

import { useState, useTransition, use } from 'react';
import { Button, Card, Input, Label } from '@/components/sabcrm/20ui/compat';
import { Lock, LoaderCircle } from 'lucide-react';
import { verifyLinkPassword } from '@/app/actions/url-shortener.actions';

export default function VerifyLinkPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = use(params);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyLinkPassword(shortCode, password);
      if (result.valid && result.originalUrl) {
        window.location.href = result.originalUrl;
      } else {
        setError(result.error || 'Incorrect password');
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zoru-ink px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-ink">
            <Lock className="h-5 w-5 text-zoru-ink-muted" />
          </div>
          <div className="text-center">
            <h1 className="text-[17px] font-medium text-zoru-ink">This link is protected</h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">Enter password to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[12.5px] text-zoru-ink-muted">
              Password
            </Label>
            <Input
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
          <Button type="submit" className="w-full" disabled={isPending || !password}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
