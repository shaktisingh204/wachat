import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  EmptyState,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { ReactNode } from 'react';
import { Settings, Route } from 'lucide-react';
import { EditLinkDrawer } from '@/components/20ui-domain/edit-link-drawer';
import { LinkHistoryDrawer } from '@/components/20ui-domain/link-history-drawer';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

function statusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success';
    case 'expired':
    case 'disabled':
      return 'danger';
    case 'limited':
    case 'paused':
      return 'warning';
    default:
      return 'neutral';
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2">
      <dt className="text-[var(--st-text-secondary)]">{label}</dt>
      <dd className="text-[var(--st-text)]">{children}</dd>
    </div>
  );
}

export function ShortUrlSettings({
  shortUrl,
  status,
}: {
  shortUrl: WithId<ShortUrl>;
  status: string;
}) {
  const hasAdvancedRouting = Boolean(
    shortUrl.splitTargets?.length ||
      shortUrl.geoTargets?.length ||
      shortUrl.deviceTargets?.length,
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Link Details Card */}
      <Card padding="none">
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <CardTitle className="text-[13px]">Link Details</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <LinkHistoryDrawer
              linkId={shortUrl._id.toString()}
              currentUrl={shortUrl.originalUrl}
            />
            <EditLinkDrawer shortUrl={shortUrl} />
          </div>
        </CardHeader>
        <CardBody>
          <dl className="space-y-3 text-[13px]">
            <DetailRow label="Short Code">
              <span className="font-mono">{shortUrl.shortCode}</span>
            </DetailRow>
            {shortUrl.customSlug && (
              <DetailRow label="Custom Alias">
                <span className="font-mono">{shortUrl.customSlug}</span>
              </DetailRow>
            )}
            <DetailRow label="Destination URL">
              <span className="break-all">{shortUrl.originalUrl}</span>
            </DetailRow>
            <DetailRow label="Status">
              <Badge tone={statusTone(status)} dot className="capitalize">
                {status}
              </Badge>
            </DetailRow>
            <DetailRow label="Created">
              {new Date(shortUrl.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
            </DetailRow>
            <DetailRow label="Expires">
              {shortUrl.expiresAt
                ? `${new Date(shortUrl.expiresAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
                : 'Never'}
            </DetailRow>
            {shortUrl.clickLimit && (
              <DetailRow label="Click Limit">{shortUrl.clickLimit.toLocaleString()}</DetailRow>
            )}
          </dl>

          {shortUrl.utmParams && Object.values(shortUrl.utmParams).some(Boolean) && (
            <div className="mt-6">
              <div className="pt-4 border-t border-[var(--st-border)]">
                <p className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] mb-3">
                  UTM Parameters
                </p>
              </div>
              <dl className="space-y-3 text-[13px]">
                {shortUrl.utmParams.source && (
                  <DetailRow label="UTM Source">
                    <span className="font-mono">{shortUrl.utmParams.source}</span>
                  </DetailRow>
                )}
                {shortUrl.utmParams.medium && (
                  <DetailRow label="UTM Medium">
                    <span className="font-mono">{shortUrl.utmParams.medium}</span>
                  </DetailRow>
                )}
                {shortUrl.utmParams.campaign && (
                  <DetailRow label="UTM Campaign">
                    <span className="font-mono">{shortUrl.utmParams.campaign}</span>
                  </DetailRow>
                )}
                {shortUrl.utmParams.term && (
                  <DetailRow label="UTM Term">
                    <span className="font-mono">{shortUrl.utmParams.term}</span>
                  </DetailRow>
                )}
                {shortUrl.utmParams.content && (
                  <DetailRow label="UTM Content">
                    <span className="font-mono">{shortUrl.utmParams.content}</span>
                  </DetailRow>
                )}
              </dl>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Advanced Routing Features (A/B testing, Geo, Device) */}
      <div className="flex flex-col gap-4">
        {hasAdvancedRouting ? (
          <>
            {/* A/B Testing */}
            {shortUrl.splitTargets && shortUrl.splitTargets.length > 0 && (
              <Card padding="none">
                <CardHeader>
                  <CardTitle className="text-[13px]">A/B Testing (Split Targets)</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {shortUrl.splitTargets.map((target, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0"
                      >
                        <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">
                          Variant {idx + 1} ({target.weight}% Traffic)
                        </span>
                        <span className="text-[var(--st-text)] break-all font-mono">
                          {target.url}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Geographic Targeting */}
            {shortUrl.geoTargets && shortUrl.geoTargets.length > 0 && (
              <Card padding="none">
                <CardHeader>
                  <CardTitle className="text-[13px]">Geographic Routing</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {shortUrl.geoTargets.map((target, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0"
                      >
                        <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">
                          Country: {target.country}
                        </span>
                        <span className="text-[var(--st-text)] break-all font-mono">
                          {target.url}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Device Targeting */}
            {shortUrl.deviceTargets && shortUrl.deviceTargets.length > 0 && (
              <Card padding="none">
                <CardHeader>
                  <CardTitle className="text-[13px]">Device Routing</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {shortUrl.deviceTargets.map((target, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0"
                      >
                        <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">
                          Device: {target.device}
                        </span>
                        <span className="text-[var(--st-text)] break-all font-mono">
                          {target.url}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        ) : (
          <Card variant="outlined" className="h-full">
            <EmptyState
              icon={Route}
              title="Advanced Routing Not Active"
              description="Configure A/B testing, geographic routing, or device-specific links to see them here."
              action={<EditLinkDrawer shortUrl={shortUrl} />}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
