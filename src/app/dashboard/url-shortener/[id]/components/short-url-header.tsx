import { Card, Button } from '@/components/zoruui';
import { BarChart2, Calendar, Clock, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SharePermissionsModal } from '@/components/zoruui-domain/share-permissions-modal';
import { QrCodeModal } from './qr-code-modal';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const statusStyles = {
  active: 'border-zoru-success/40 bg-zoru-success/10 text-zoru-success-ink',
  expired: 'border-zoru-danger/40 bg-zoru-danger/10 text-zoru-danger-ink',
  scheduled: 'border-zoru-warning/40 bg-zoru-warning/10 text-zoru-warning-ink',
} as const;

export function ShortUrlHeader({
  shortUrl,
  shortUrlString,
  status,
}: {
  shortUrl: WithId<ShortUrl>;
  shortUrlString: string;
  status: 'active' | 'expired' | 'scheduled';
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <BarChart2 className="h-5 w-5 text-zoru-ink-muted shrink-0" />
            <h1 className="text-[18px] text-zoru-ink font-medium leading-tight break-all">
              {shortUrl.customSlug || shortUrl.shortCode}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${statusStyles[status]}`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {status[0].toUpperCase() + status.slice(1)}
            </span>
          </div>

          <a
            href={shortUrlString}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-zoru-ink-muted hover:text-zoru-ink break-all"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {shortUrlString}
          </a>

          <p className="mt-1.5 text-[12px] text-zoru-ink-muted truncate max-w-lg">
            {shortUrl.originalUrl}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11.5px] text-zoru-ink-muted">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Created {new Date(shortUrl.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            {shortUrl.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Expires {new Date(shortUrl.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <QrCodeModal url={shortUrlString} />
          <SharePermissionsModal
            resourceType="url"
            resourceId={shortUrl._id.toString()}
            resourceName={shortUrl.shortCode}
          />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/url-shortener">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Links
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
