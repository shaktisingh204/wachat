'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Skeleton,
} from '@/components/zoruui';
import { useEffect, useState } from 'react';
import { BarChart2, MousePointerClick, Users, Info } from 'lucide-react';

interface QrScanStatsModalProps {
  qrCodeId: string;
  qrName: string;
  isDynamic: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ScanStats {
  clickCount: number;
  uniqueClicks?: number;
}

export function QrScanStatsModal({ qrCodeId, qrName, isDynamic, open, onOpenChange }: QrScanStatsModalProps) {
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !isDynamic) return;

    setIsLoading(true);
    setError('');
    setStats(null);

    import('@/app/actions/qr-code.actions')
      .then(mod => {
        if (typeof (mod as any).getQrScanStats !== 'function') {
          throw new Error('getQrScanStats is not available yet.');
        }
        return (mod as any).getQrScanStats(qrCodeId) as Promise<ScanStats | null>;
      })
      .then(data => {
        setStats(data);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load scan statistics.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, qrCodeId, isDynamic]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-sm">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-purple-600" />
            Scan Analytics
          </ZoruDialogTitle>
        </ZoruDialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground truncate" title={qrName}>
            {qrName}
          </p>

          {!isDynamic && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Scan analytics are only available for dynamic QR codes. Convert this QR to dynamic to start tracking scans.
              </p>
            </div>
          )}

          {isDynamic && isLoading && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg space-y-2">
                <ZoruSkeleton className="h-4 w-20" />
                <ZoruSkeleton className="h-8 w-12" />
              </div>
              <div className="p-4 border rounded-lg space-y-2">
                <ZoruSkeleton className="h-4 w-20" />
                <ZoruSkeleton className="h-8 w-12" />
              </div>
            </div>
          )}

          {isDynamic && !isLoading && error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isDynamic && !isLoading && !error && stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg space-y-1 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Total Scans
                </div>
                <p className="text-3xl font-bold tabular-nums">{stats.clickCount.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg space-y-1 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Users className="h-3.5 w-3.5" />
                  Unique Scans
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {stats.uniqueClicks != null ? stats.uniqueClicks.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          )}

          {isDynamic && !isLoading && !error && stats === null && !error && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No scan data available yet.
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>Close</ZoruButton>
        </div>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
