'use client';

import { useRef, useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Button,
  useZoruToast,
} from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { BulkImportDialog } from '@/components/wabasimplify/bulk-url-import-dialog';
import { TagPicker, type TagPickerTag } from '@/components/wabasimplify/tag-picker';
import { Link as LinkIcon, LoaderCircle, ChevronDown, ChevronRight, X, Plus } from 'lucide-react';
import { createShortUrl } from '@/app/actions/url-shortener.actions';
import type { Tag } from '@/lib/definitions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LinkIcon className="h-3.5 w-3.5" />
      )}
      Shorten URL
    </Button>
  );
}

function TagsSelector({
  userTags,
  selectedTags,
  onSelectionChange,
  placeholder,
}: {
  userTags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tagIds: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const handleSelect = (tagId: string) => {
    const next = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    onSelectionChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink hover:border-zoru-line-strong focus:outline-none focus:border-zoru-ink"
        >
          <span className="truncate">
            {selectedTags.length > 0
              ? selectedTags
                  .map((id) => userTags.find((t) => t._id === id)?.name)
                  .filter(Boolean)
                  .join(', ')
              : placeholder || 'Select tags...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zoru-ink-muted" />
        </button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <ZoruCommand>
          <ZoruCommandInput placeholder="Search tags..." />
          <ZoruCommandList>
            <ZoruCommandEmpty>
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <p className="text-[13px] text-zoru-ink-muted">No tags found.</p>
                <NextLink
                  href="/dashboard/url-shortener/settings"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-zoru-ink hover:underline"
                >
                  <Settings className="h-3 w-3" /> Create & manage tags
                </NextLink>
              </div>
            </ZoruCommandEmpty>
            <ZoruCommandGroup>
              {userTags.map((tag) => (
                <ZoruCommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag._id)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', selectedTags.includes(tag._id) ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                </ZoruCommandItem>
              ))}
              <NextLink
                href="/dashboard/url-shortener/settings"
                className="flex items-center gap-2 border-t border-zoru-line px-2 py-2 text-[12px] font-medium text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
              >
                <Settings className="h-3.5 w-3.5" /> Manage tags
              </NextLink>
            </ZoruCommandGroup>
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruPopoverContent>
    </Popover>
  );
}

const initialState: { message?: string; error?: string; shortUrlId?: string; shortCode?: string } = {};

export function UrlShortenerForm({
  userTags,
  domainOptions,
  onSuccess,
}: {
  userTags: Tag[];
  domainOptions: { value: string; label: string }[];
  onSuccess: () => void;
}) {
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createShortUrl, initialState);

  const [createTagIds, setCreateTagIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [createDomainId, setCreateDomainId] = useState<string>('none');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitTargets, setSplitTargets] = useState<{ url: string; weight: number }[]>([
    { url: '', weight: 50 },
    { url: '', weight: 50 },
  ]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setCreateTagIds([]);
      setExpiresAt(undefined);
      setCreateDomainId('none');
      setSplitEnabled(false);
      setSplitTargets([{ url: '', weight: 50 }, { url: '', weight: 50 }]);
      onSuccess();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <Card className="p-0">
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="tagIds" value={createTagIds.join(',')} />
        <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() || ''} />
        <input type="hidden" name="domainId" value={createDomainId} />
        <div className="border-b border-zoru-line px-5 py-4">
          <h2 className="text-[15px] text-zoru-ink">Create a new short link</h2>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="originalUrl" className="text-[12.5px] text-zoru-ink-muted">
                Destination URL
              </Label>
              <Input
                id="originalUrl"
                name="originalUrl"
                type="url"
                placeholder="https://example.com/very-long-url-to-shorten"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alias" className="text-[12.5px] text-zoru-ink-muted">
                Custom Alias (Optional)
              </Label>
              <Input id="alias" name="alias" placeholder="e.g., summer-sale" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zoru-ink-muted">Tags (Optional)</Label>
              <TagsSelector
                userTags={userTags}
                selectedTags={createTagIds}
                onSelectionChange={setCreateTagIds}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zoru-ink-muted">Expiration Date (Optional)</Label>
              <DatePicker date={expiresAt} setDate={setExpiresAt} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zoru-ink-muted">Custom Domain (Optional)</Label>
              <Select value={createDomainId} onValueChange={setCreateDomainId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {domainOptions.map((opt) => (
                    <ZoruSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <details className="group px-5 pb-1">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink py-1 select-none w-fit">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Advanced Options
          </summary>
          <div className="mt-3 space-y-4 pb-2">

            {/* A. Click Limit */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zoru-ink-muted">
                Click Limit <span className="text-zoru-ink-muted/60">(optional)</span>
              </Label>
              <Input
                type="number"
                name="clickLimit"
                min={1}
                placeholder="e.g. 500 — deactivates after N clicks"
                className="text-[13px]"
              />
            </div>

            {/* B. Password Protection */}
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-zoru-ink-muted">Password Protection</Label>
              <Input
                type="password"
                name="passwordHash"
                placeholder="Leave blank for no password"
                autoComplete="new-password"
                className="text-[13px]"
              />
              <p className="text-[11px] text-zoru-ink-muted/60">Visitors must enter this password before being redirected.</p>
            </div>

            {/* C. UTM Parameters */}
            <details className="group/utm">
              <summary className="cursor-pointer text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink list-none flex items-center gap-1.5 select-none">
                <ChevronRight className="h-3 w-3 transition-transform group-open/utm:rotate-90" />
                UTM Parameters
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 pl-4">
                {[
                  { name: 'utmSource', label: 'Source', placeholder: 'google' },
                  { name: 'utmMedium', label: 'Medium', placeholder: 'cpc' },
                  { name: 'utmCampaign', label: 'Campaign', placeholder: 'spring_sale' },
                  { name: 'utmTerm', label: 'Term', placeholder: 'running+shoes' },
                  { name: 'utmContent', label: 'Content', placeholder: 'logolink' },
                ].map((f) => (
                  <div key={f.name} className="space-y-1">
                    <Label className="text-[11.5px] text-zoru-ink-muted">{f.label}</Label>
                    <Input name={f.name} placeholder={f.placeholder} className="text-[12px] h-7" />
                  </div>
                ))}
              </div>
            </details>

            {/* D. Retargeting Pixels */}
            <details className="group/pixels">
              <summary className="cursor-pointer text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink list-none flex items-center gap-1.5 select-none">
                <ChevronRight className="h-3 w-3 transition-transform group-open/pixels:rotate-90" />
                Retargeting Pixels
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                {[
                  { name: 'pixelFacebook', label: 'Meta Pixel ID', placeholder: '1234567890123' },
                  { name: 'pixelGoogle', label: 'Google Tag ID', placeholder: 'G-XXXXXXXXXX' },
                  { name: 'pixelTiktok', label: 'TikTok Pixel ID', placeholder: 'CXXXXXXXXXXXXXXX' },
                ].map((f) => (
                  <div key={f.name} className="space-y-1">
                    <Label className="text-[11.5px] text-zoru-ink-muted">{f.label}</Label>
                    <Input name={f.name} placeholder={f.placeholder} className="text-[12px] h-7" />
                  </div>
                ))}
              </div>
            </details>

            {/* E. A/B Split Targets */}
            <div className="space-y-3">
              <input
                type="hidden"
                name="splitTargets"
                value={splitEnabled ? JSON.stringify(splitTargets) : ''}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="splitEnabled"
                  checked={splitEnabled}
                  onCheckedChange={setSplitEnabled}
                />
                <Label htmlFor="splitEnabled" className="text-[12.5px] text-zoru-ink-muted cursor-pointer">
                  Enable A/B Split Testing
                </Label>
              </div>
              {splitEnabled ? (
                <div className="space-y-2 pl-1">
                  {splitTargets.map((target, i) => {
                    const totalWeight = splitTargets.reduce((s, t) => s + (t.weight || 0), 0);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={target.url}
                          onChange={(e) => {
                            const next = [...splitTargets];
                            next[i] = { ...next[i], url: e.target.value };
                            setSplitTargets(next);
                          }}
                          placeholder={`Variant ${i + 1} URL`}
                          className="text-[12px] flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={target.weight}
                          onChange={(e) => {
                            const next = [...splitTargets];
                            next[i] = { ...next[i], weight: Number(e.target.value) };
                            setSplitTargets(next);
                          }}
                          className="text-[12px] w-20"
                        />
                        <span className="text-[11px] text-zoru-ink-muted">%</span>
                        {splitTargets.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => setSplitTargets(splitTargets.filter((_, idx) => idx !== i))}
                            className="rounded p-1 text-zoru-ink-muted hover:text-zoru-danger-ink hover:bg-zoru-danger/10"
                            aria-label="Remove variant"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="w-[26px]" />
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setSplitTargets([...splitTargets, { url: '', weight: 0 }])}
                      className="inline-flex items-center gap-1 text-[12px] text-zoru-ink-muted hover:text-zoru-ink"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add variant
                    </button>
                    <span
                      className={cn(
                        'text-[11.5px]',
                        splitTargets.reduce((s, t) => s + (t.weight || 0), 0) === 100
                          ? 'text-zoru-success-ink'
                          : 'text-zoru-danger-ink',
                      )}
                    >
                      Weight total: {splitTargets.reduce((s, t) => s + (t.weight || 0), 0)}%
                      {splitTargets.reduce((s, t) => s + (t.weight || 0), 0) !== 100 ? ' (must equal 100)' : ''}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </details>

        <div className="flex items-center justify-between border-t border-zoru-line bg-zoru-surface-2 px-5 py-3 rounded-b-[var(--zoru-radius-lg)]">
          <SubmitButton />
          <BulkImportDialog onImportComplete={onSuccess} />
        </div>
      </form>
    </Card>
  );
}
