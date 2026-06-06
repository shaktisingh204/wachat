import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/sabcrm/20ui/compat';
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
          <DialogTitle>Analytics for "{link.label || 'Untitled'}"</DialogTitle>
          <DialogDescription>
            Detailed geographic breakdown of clicks for this link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center bg-[var(--st-text)] p-4 rounded-lg">
            <span className="text-[var(--st-text-secondary)] text-sm">Total Clicks</span>
            <span className="text-xl font-semibold text-white">{totalClicks}</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--st-text-secondary)]">Top Countries</h4>
            {entries.length === 0 ? (
              <p className="text-xs text-[var(--st-text)]">No geo data available yet.</p>
            ) : (
              <div className="space-y-2">
                {entries.map(([countryCode, clicks]) => {
                  const percentage = totalClicks > 0 ? ((clicks / totalClicks) * 100).toFixed(1) : '0';
                  return (
                    <div key={countryCode} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-xs font-mono bg-[var(--st-text)] text-[var(--st-text-secondary)] rounded px-1 py-0.5">{countryCode}</span>
                        <span className="text-[var(--st-text-secondary)]">{clicks} clicks</span>
                      </div>
                      <span className="text-[var(--st-text)] text-xs">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
