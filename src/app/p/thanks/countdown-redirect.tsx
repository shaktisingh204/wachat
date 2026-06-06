'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/sabcrm/20ui/compat';
import { ArrowRight } from 'lucide-react';

interface CountdownRedirectProps {
  redirectUrl?: string;
  countdownSeconds?: number;
}

export function CountdownRedirect({ redirectUrl = '/', countdownSeconds = 5 }: CountdownRedirectProps) {
  const [countdown, setCountdown] = useState(countdownSeconds);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push(redirectUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [redirectUrl, router]);

  return (
    <div className="mt-6 flex flex-col items-center gap-4 border-t border-[var(--st-border)]/40 pt-6">
      <p className="text-[13px] text-[var(--st-text-secondary)]">
        Redirecting back in {countdown} seconds...
      </p>
      <Button 
        variant="outline" 
        onClick={() => router.push(redirectUrl)}
      >
        Return Now <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
