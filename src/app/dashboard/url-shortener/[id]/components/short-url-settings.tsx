import { Card } from '@/components/sabcrm/20ui/compat';
import { Settings } from 'lucide-react';
import { EditLinkDrawer } from '@/components/zoruui-domain/edit-link-drawer';
import { LinkHistoryDrawer } from '@/components/zoruui-domain/link-history-drawer';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';

export function ShortUrlSettings({
  shortUrl,
  status,
}: {
  shortUrl: WithId<ShortUrl>;
  status: string;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Link Details Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--st-text-secondary)]" />
            <span className="text-[13px] text-[var(--st-text)]">Link Details</span>
          </div>
          <div className="flex items-center gap-2">
            <LinkHistoryDrawer
              linkId={shortUrl._id.toString()}
              currentUrl={shortUrl.originalUrl}
            />
            <EditLinkDrawer shortUrl={shortUrl} />
          </div>
        </div>
        <dl className="space-y-3 text-[13px]">
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-[var(--st-text-secondary)]">Short Code</dt>
            <dd className="text-[var(--st-text)] font-mono">{shortUrl.shortCode}</dd>
          </div>
          {shortUrl.customSlug && (
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-[var(--st-text-secondary)]">Custom Alias</dt>
              <dd className="text-[var(--st-text)] font-mono">{shortUrl.customSlug}</dd>
            </div>
          )}
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-[var(--st-text-secondary)]">Destination URL</dt>
            <dd className="text-[var(--st-text)] break-all">{shortUrl.originalUrl}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-[var(--st-text-secondary)]">Status</dt>
            <dd className="text-[var(--st-text)] capitalize">{status}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-[var(--st-text-secondary)]">Created</dt>
            <dd className="text-[var(--st-text)]">
              {new Date(shortUrl.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
            </dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-2">
            <dt className="text-[var(--st-text-secondary)]">Expires</dt>
            <dd className="text-[var(--st-text)]">
              {shortUrl.expiresAt
                ? `${new Date(shortUrl.expiresAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
                : 'Never'}
            </dd>
          </div>
          {shortUrl.clickLimit && (
            <div className="grid grid-cols-[160px_1fr] gap-2">
              <dt className="text-[var(--st-text-secondary)]">Click Limit</dt>
              <dd className="text-[var(--st-text)]">{shortUrl.clickLimit.toLocaleString()}</dd>
            </div>
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
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-[var(--st-text-secondary)]">UTM Source</dt>
                  <dd className="text-[var(--st-text)] font-mono">{shortUrl.utmParams.source}</dd>
                </div>
              )}
              {shortUrl.utmParams.medium && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-[var(--st-text-secondary)]">UTM Medium</dt>
                  <dd className="text-[var(--st-text)] font-mono">{shortUrl.utmParams.medium}</dd>
                </div>
              )}
              {shortUrl.utmParams.campaign && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-[var(--st-text-secondary)]">UTM Campaign</dt>
                  <dd className="text-[var(--st-text)] font-mono">{shortUrl.utmParams.campaign}</dd>
                </div>
              )}
              {shortUrl.utmParams.term && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-[var(--st-text-secondary)]">UTM Term</dt>
                  <dd className="text-[var(--st-text)] font-mono">{shortUrl.utmParams.term}</dd>
                </div>
              )}
              {shortUrl.utmParams.content && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-[var(--st-text-secondary)]">UTM Content</dt>
                  <dd className="text-[var(--st-text)] font-mono">{shortUrl.utmParams.content}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Card>

      {/* Advanced Routing Features (A/B testing, Geo, Device) */}
      <div className="flex flex-col gap-4">
        {(shortUrl.splitTargets?.length || shortUrl.geoTargets?.length || shortUrl.deviceTargets?.length) ? (
          <>
            {/* A/B Testing */}
            {shortUrl.splitTargets && shortUrl.splitTargets.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] text-[var(--st-text)] font-medium">A/B Testing (Split Targets)</h3>
                </div>
                <div className="space-y-3">
                  {shortUrl.splitTargets.map((target, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0">
                      <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">Variant {idx + 1} ({target.weight}% Traffic)</span>
                      <span className="text-[var(--st-text)] break-all font-mono">{target.url}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Geographic Targeting */}
            {shortUrl.geoTargets && shortUrl.geoTargets.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] text-[var(--st-text)] font-medium">Geographic Routing</h3>
                </div>
                <div className="space-y-3">
                  {shortUrl.geoTargets.map((target, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0">
                      <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">Country: {target.country}</span>
                      <span className="text-[var(--st-text)] break-all font-mono">{target.url}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Device Targeting */}
            {shortUrl.deviceTargets && shortUrl.deviceTargets.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] text-[var(--st-text)] font-medium">Device Routing</h3>
                </div>
                <div className="space-y-3">
                  {shortUrl.deviceTargets.map((target, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-[13px] border-b border-[var(--st-border)] last:border-0 pb-3 last:pb-0">
                      <span className="text-[var(--st-text-secondary)] text-xs uppercase tracking-wide">Device: {target.device}</span>
                      <span className="text-[var(--st-text)] break-all font-mono">{target.url}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-5 flex flex-col items-center justify-center text-center h-full min-h-[200px] border-dashed">
            <h3 className="text-[13px] text-[var(--st-text)] font-medium mb-1">Advanced Routing Not Active</h3>
            <p className="text-xs text-[var(--st-text-secondary)] mb-4 max-w-xs">
              Configure A/B testing, geographic routing, or device-specific links to see them here.
            </p>
            <EditLinkDrawer shortUrl={shortUrl} />
          </Card>
        )}
      </div>
    </div>
  );
}
