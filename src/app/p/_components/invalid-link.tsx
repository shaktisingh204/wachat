import { Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export function InvalidLinkCard({ message }: { message?: string }) {
  return (
    <Card className="border-danger/30 bg-danger/5 shadow-sm">
      <ZoruCardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger border border-danger/20 font-mono">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-[14px] font-bold tracking-tight text-zoru-ink font-mono uppercase">
            // REFERENCE.EXPIRED
          </h2>
          <p className="mt-2 text-[12.5px] text-zoru-ink-muted max-w-sm">
            {message || 'This reference URL has expired, been revoked, or reached its security threshold.'}
          </p>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
