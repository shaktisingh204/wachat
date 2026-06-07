'use client';

import { useRef, useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tag as TagChip,
  Button,
  IconButton,
  DatePicker,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import NextLink from 'next/link';
import { BulkImportDialog } from '@/components/20ui-domain/bulk-url-import-dialog';
import { Link as LinkIcon, X, Plus, Check, ChevronsUpDown, Settings } from 'lucide-react';
import { createShortUrl } from '@/app/actions/url-shortener.actions';
import type { Tag } from '@/lib/definitions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" iconLeft={LinkIcon} loading={pending}>
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

  const summary =
    selectedTags.length > 0
      ? selectedTags
          .map((id) => userTags.find((t) => t._id === id)?.name)
          .filter(Boolean)
          .join(', ')
      : placeholder || 'Select tags...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          block
          iconRight={ChevronsUpDown}
          aria-expanded={open}
          className="justify-between font-normal"
        >
          <span className="truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <p className="text-[13px] text-[var(--st-text-secondary)]">No tags found.</p>
                <NextLink
                  href="/dashboard/url-shortener/settings"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--st-text)] hover:underline"
                >
                  <Settings className="h-3 w-3" aria-hidden="true" /> Create and manage tags
                </NextLink>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {userTags.map((tag) => (
                <CommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag._id)}>
                  <Check
                    aria-hidden="true"
                    className={cn('mr-2 h-4 w-4', selectedTags.includes(tag._id) ? 'opacity-100' : 'opacity-0')}
                  />
                  <TagChip color={tag.color}>{tag.name}</TagChip>
                </CommandItem>
              ))}
              <NextLink
                href="/dashboard/url-shortener/settings"
                className="flex items-center gap-2 border-t border-[var(--st-border)] px-2 py-2 text-[12px] font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Manage tags
              </NextLink>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
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
  const { toast } = useToast();
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
      toast.success({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setCreateTagIds([]);
      setExpiresAt(undefined);
      setCreateDomainId('none');
      setSplitEnabled(false);
      setSplitTargets([{ url: '', weight: 50 }, { url: '', weight: 50 }]);
      onSuccess();
    }
    if (state?.error) {
      toast.error({ title: 'Error', description: state.error });
    }
  }, [state, toast, onSuccess]);

  const weightTotal = splitTargets.reduce((s, t) => s + (t.weight || 0), 0);

  return (
    <Card padding="none">
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="tagIds" value={createTagIds.join(',')} />
        <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() || ''} />
        <input type="hidden" name="domainId" value={createDomainId} />

        <CardHeader>
          <CardTitle>Create a new short link</CardTitle>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Destination URL" id="originalUrl" required>
              <Input
                name="originalUrl"
                type="url"
                placeholder="https://example.com/very-long-url-to-shorten"
                required
              />
            </Field>
            <Field label="Custom alias (optional)" id="alias">
              <Input name="alias" placeholder="e.g. summer-sale" />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tags (optional)">
              <TagsSelector
                userTags={userTags}
                selectedTags={createTagIds}
                onSelectionChange={setCreateTagIds}
              />
            </Field>
            <Field label="Expiration date (optional)">
              <DatePicker
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="No expiry"
                aria-label="Expiration date"
              />
            </Field>
            <Field label="Custom domain (optional)">
              <Select value={createDomainId} onValueChange={setCreateDomainId}>
                <SelectTrigger aria-label="Custom domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {domainOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Advanced Options */}
          <Collapsible>
            <CollapsibleTrigger className="text-[12.5px]">Advanced options</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 pt-3">
                {/* A. Click Limit */}
                <Field label="Click limit (optional)" id="clickLimit" help="Deactivates the link after this many clicks.">
                  <Input
                    id="clickLimit"
                    type="number"
                    name="clickLimit"
                    min={1}
                    placeholder="e.g. 500"
                  />
                </Field>

                {/* B. Password Protection */}
                <Field
                  label="Password protection"
                  id="passwordHash"
                  help="Visitors must enter this password before being redirected."
                >
                  <Input
                    id="passwordHash"
                    type="password"
                    name="passwordHash"
                    placeholder="Leave blank for no password"
                    autoComplete="new-password"
                  />
                </Field>

                {/* C. UTM Parameters */}
                <Collapsible>
                  <CollapsibleTrigger className="text-[12.5px]">UTM parameters</CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {[
                        { name: 'utmSource', label: 'Source', placeholder: 'google' },
                        { name: 'utmMedium', label: 'Medium', placeholder: 'cpc' },
                        { name: 'utmCampaign', label: 'Campaign', placeholder: 'spring_sale' },
                        { name: 'utmTerm', label: 'Term', placeholder: 'running+shoes' },
                        { name: 'utmContent', label: 'Content', placeholder: 'logolink' },
                      ].map((f) => (
                        <Field key={f.name} label={f.label} id={f.name}>
                          <Input name={f.name} placeholder={f.placeholder} inputSize="sm" />
                        </Field>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* D. Retargeting Pixels */}
                <Collapsible>
                  <CollapsibleTrigger className="text-[12.5px]">Retargeting pixels</CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 pt-2">
                      {[
                        { name: 'pixelFacebook', label: 'Meta Pixel ID', placeholder: '1234567890123' },
                        { name: 'pixelGoogle', label: 'Google Tag ID', placeholder: 'G-XXXXXXXXXX' },
                        { name: 'pixelTiktok', label: 'TikTok Pixel ID', placeholder: 'CXXXXXXXXXXXXXXX' },
                      ].map((f) => (
                        <Field key={f.name} label={f.label} id={f.name}>
                          <Input name={f.name} placeholder={f.placeholder} inputSize="sm" />
                        </Field>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* E. A/B Split Targets */}
                <div className="space-y-3">
                  <input
                    type="hidden"
                    name="splitTargets"
                    value={splitEnabled ? JSON.stringify(splitTargets) : ''}
                  />
                  <Switch
                    id="splitEnabled"
                    checked={splitEnabled}
                    onCheckedChange={setSplitEnabled}
                    label="Enable A/B split testing"
                  />
                  {splitEnabled ? (
                    <div className="space-y-2 pl-1">
                      {splitTargets.map((target, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={target.url}
                            onChange={(e) => {
                              const next = [...splitTargets];
                              next[i] = { ...next[i], url: e.target.value };
                              setSplitTargets(next);
                            }}
                            placeholder={`Variant ${i + 1} URL`}
                            inputSize="sm"
                            aria-label={`Variant ${i + 1} URL`}
                            className="flex-1"
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
                            inputSize="sm"
                            aria-label={`Variant ${i + 1} weight (percent)`}
                            suffix="%"
                            className="w-24"
                          />
                          {splitTargets.length > 2 ? (
                            <IconButton
                              label="Remove variant"
                              icon={X}
                              variant="ghost"
                              size="sm"
                              onClick={() => setSplitTargets(splitTargets.filter((_, idx) => idx !== i))}
                            />
                          ) : (
                            <span className="w-[26px]" />
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          iconLeft={Plus}
                          onClick={() => setSplitTargets([...splitTargets, { url: '', weight: 0 }])}
                        >
                          Add variant
                        </Button>
                        <span
                          className={cn(
                            'text-[11.5px]',
                            weightTotal === 100 ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-danger)]',
                          )}
                        >
                          Weight total: {weightTotal}%
                          {weightTotal !== 100 ? ' (must equal 100)' : ''}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardBody>

        <CardFooter className="flex items-center justify-between">
          <SubmitButton />
          <BulkImportDialog onImportComplete={onSuccess} />
        </CardFooter>
      </form>
    </Card>
  );
}
