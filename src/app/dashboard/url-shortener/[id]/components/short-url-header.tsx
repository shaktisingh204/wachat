import { Card, CardTitle, Button, Badge, type BadgeTone } from '@/components/sabcrm/20ui';
import { BarChart2, Calendar, Clock, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SharePermissionsModal } from '@/components/domain/share-permissions-modal';
import { QrCodeModal } from './qr-code-modal';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const statusTone: Record<'active' | 'expired' | 'scheduled', BadgeTone> = {
  active: 'success',
  expired: 'danger',
  scheduled: 'warning',
};

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
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <BarChart2 className="h-5 w-5 text-[var(--st-text-secondary)] shrink-0" aria-hidden="true" />
            <CardTitle className="text-[18px] leading-tight break-all">
              {shortUrl.customSlug || shortUrl.shortCode}
            </CardTitle>
            <Badge tone={statusTone[status]} dot>
              {status[0].toUpperCase() + status.slice(1)}
            </Badge>
          </div>

          <a
            href={shortUrlString}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] break-all"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {shortUrlString}
          </a>

          <p className="mt-1.5 text-[12px] text-[var(--st-text-secondary)] truncate max-w-lg">
            {shortUrl.originalUrl}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11.5px] text-[var(--st-text-secondary)]">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Created {new Date(shortUrl.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            {shortUrl.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
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
          <Link href="/dashboard/url-shortener">
            <Button variant="ghost" size="sm" iconLeft={ArrowLeft}>
              All links
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
