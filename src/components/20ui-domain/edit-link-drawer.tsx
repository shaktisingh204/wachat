'use client';

import { useState, useTransition } from 'react';
import { updateShortUrl } from '@/app/actions/url-shortener.actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label, useToast } from '@/components/sabcrm/20ui';
import type { WithId } from 'mongodb';
import type { ShortUrl } from '@/lib/definitions';
import { Settings, LoaderCircle } from 'lucide-react';

interface EditLinkDrawerProps {
  shortUrl: WithId<ShortUrl>;
}

export function EditLinkDrawer({ shortUrl }: EditLinkDrawerProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [originalUrl, setOriginalUrl] = useState(shortUrl.originalUrl);
  const [expiresAt, setExpiresAt] = useState(
    shortUrl.expiresAt ? new Date(shortUrl.expiresAt).toISOString().slice(0, 16) : '',
  );
  const [clickLimit, setClickLimit] = useState(shortUrl.clickLimit?.toString() ?? '');
  const [utmSource, setUtmSource] = useState(shortUrl.utmParams?.source ?? '');
  const [utmMedium, setUtmMedium] = useState(shortUrl.utmParams?.medium ?? '');
  const [utmCampaign, setUtmCampaign] = useState(shortUrl.utmParams?.campaign ?? '');

  const handleSave = () => {
    startTransition(async () => {
      const body: Parameters<typeof updateShortUrl>[1] = { originalUrl };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      else body.expiresAt = null;
      if (clickLimit) body.clickLimit = Number(clickLimit);
      else body.clickLimit = null;
      if (utmSource || utmMedium || utmCampaign) {
        body.utmParams = {
          source: utmSource || undefined,
          medium: utmMedium || undefined,
          campaign: utmCampaign || undefined,
        };
      }
      const result = await updateShortUrl(shortUrl._id.toString(), body);
      if (result.success) {
        toast({ title: 'Link updated', variant: 'success' });
        setOpen(false);
      } else {
        toast({ title: result.error ?? 'Failed to update', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Destination URL</Label>
              <Input
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Expiry Date</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">Click Limit</Label>
              <Input
                type="number"
                min={1}
                value={clickLimit}
                onChange={(e) => setClickLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-[var(--st-text-secondary)]">UTM Source / Medium / Campaign</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  placeholder="Source"
                  className="text-[12px]"
                />
                <Input
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  placeholder="Medium"
                  className="text-[12px]"
                />
                <Input
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="Campaign"
                  className="text-[12px]"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending || !originalUrl}>
              {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
