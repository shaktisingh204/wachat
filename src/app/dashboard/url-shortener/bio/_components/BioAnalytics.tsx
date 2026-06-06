'use client';

import { Globe2, MousePointerClick } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  StatCard,
  EmptyState,
  Badge,
  Progress,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { BioLink } from '../types';

type Props = {
  link: BioLink | null;
  onClose: () => void;
};

export function BioAnalytics({ link, onClose }: Props) {
  if (!link) return null;

  const totalClicks = link.clicks ?? 0;
  const geoData = link.geoData ?? {};
  const entries = Object.entries(geoData).sort((a, b) => b[1] - a[1]);

  return (
    <Dialog open={!!link} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analytics for &quot;{link.label || 'Untitled'}&quot;</DialogTitle>
          <DialogDescription>
            Detailed geographic breakdown of clicks for this link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <StatCard
            label="Total clicks"
            value={totalClicks.toLocaleString()}
            icon={MousePointerClick}
          />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--st-text-secondary)]">Top countries</h4>
            {entries.length === 0 ? (
              <EmptyState
                icon={Globe2}
                title="No geographic data yet"
                description="Country level click data appears here once this link starts receiving visits."
                size="sm"
              />
            ) : (
              <Table density="compact" hover>
                <THead>
                  <Tr>
                    <Th>Country</Th>
                    <Th>Share</Th>
                    <Th align="right">Clicks</Th>
                  </Tr>
                </THead>
                <TBody>
                  {entries.map(([countryCode, clicks]) => {
                    const percentage = totalClicks > 0 ? (clicks / totalClicks) * 100 : 0;
                    return (
                      <Tr key={countryCode}>
                        <Td>
                          <Badge tone="neutral" kind="outline">
                            {countryCode}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={percentage}
                              size="sm"
                              aria-label={`${percentage.toFixed(1)} percent of clicks from ${countryCode}`}
                              className="min-w-24 flex-1"
                            />
                            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[var(--st-text-secondary)]">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </Td>
                        <Td align="right">
                          <span className="text-sm tabular-nums text-[var(--st-text)]">
                            {clicks.toLocaleString()}
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
