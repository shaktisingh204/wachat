'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { GripVertical, Trash2, Plus, Link2 } from 'lucide-react';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

const STORAGE_KEY = 'url-shortener-bio-v1';

type BioLink = { id: string; label: string; url: string };

type BioState = {
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string;
  links: BioLink[];
  theme: string;
};

const DEFAULT_STATE: BioState = {
  slug: '',
  title: '',
  bio: '',
  avatarUrl: '',
  links: [],
  theme: 'dark',
};

export default function BioBuilderPage() {
  const { toast } = useZoruToast();
  const [state, setState] = useState<BioState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const update = (patch: Partial<BioState>) => setState((s) => ({ ...s, ...patch }));

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      toast({ title: 'Saved', description: 'Your bio page has been saved.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    }
  };

  const addLink = () => {
    if (state.links.length >= 20) return;
    update({ links: [...state.links, { id: crypto.randomUUID(), label: '', url: '' }] });
  };

  const updateLink = (id: string, patch: Partial<BioLink>) => {
    update({ links: state.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  };

  const removeLink = (id: string) => {
    update({ links: state.links.filter((l) => l.id !== id) });
  };

  const handleAvatarPick = (pick: SabFilePick) => {
    update({ avatarUrl: pick.url });
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Link in Bio</ZoruPageTitle>
          <ZoruPageDescription>
            Build your public bio page with links and a personal profile.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <ZoruCard className="p-5 space-y-4">
            <div className="space-y-1.5">
              <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Page URL</ZoruLabel>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-zoru-ink-muted whitespace-nowrap">/bio/</span>
                <ZoruInput
                  placeholder="your-name"
                  value={state.slug}
                  onChange={(e) => update({ slug: e.target.value.replace(/[^a-z0-9-_]/gi, '').toLowerCase() })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Title</ZoruLabel>
              <ZoruInput
                placeholder="Your name or brand"
                value={state.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                Bio{' '}
                <span className="text-zoru-ink-muted/60">({state.bio.length}/160)</span>
              </ZoruLabel>
              <ZoruTextarea
                placeholder="A short description about you..."
                value={state.bio}
                maxLength={160}
                rows={3}
                onChange={(e) => update({ bio: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Avatar</ZoruLabel>
              <div className="flex items-center gap-3">
                {state.avatarUrl ? (
                  <img
                    src={state.avatarUrl}
                    alt="Avatar"
                    className="h-10 w-10 rounded-full object-cover border border-zoru-line"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-zinc-800 border border-zoru-line" />
                )}
                <SabFilePickerButton onPick={handleAvatarPick} variant="outline">
                  Choose Avatar
                </SabFilePickerButton>
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <ZoruLabel className="text-[13px] text-zoru-ink">
                Links{' '}
                <span className="text-zoru-ink-muted">({state.links.length}/20)</span>
              </ZoruLabel>
              <ZoruButton
                type="button"
                size="sm"
                variant="outline"
                onClick={addLink}
                disabled={state.links.length >= 20}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Link
              </ZoruButton>
            </div>

            {state.links.length === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-zoru-ink-muted">
                No links yet. Click "Add Link" to get started.
              </p>
            ) : (
              <ul className="space-y-2">
                {state.links.map((link) => (
                  <li key={link.id} className="flex items-start gap-2">
                    <button
                      type="button"
                      className="mt-2.5 cursor-grab text-zoru-ink-muted/40 hover:text-zoru-ink-muted"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="flex flex-1 gap-2">
                      <ZoruInput
                        placeholder="Label"
                        value={link.label}
                        onChange={(e) => updateLink(link.id, { label: e.target.value })}
                        className="flex-1"
                      />
                      <ZoruInput
                        placeholder="https://"
                        value={link.url}
                        onChange={(e) => updateLink(link.id, { url: e.target.value })}
                        className="flex-[2]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLink(link.id)}
                      className="mt-2 rounded p-1 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger-ink"
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ZoruCard>

          <ZoruButton onClick={handleSave} className="w-full">
            Save Changes
          </ZoruButton>
        </div>

        <div className="flex justify-center lg:justify-start">
          <div
            className="relative w-[375px] min-h-[640px] rounded-[2.5rem] border-4 border-zinc-700 bg-zinc-950 px-6 py-10 shadow-2xl overflow-hidden"
            aria-label="Preview"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              {state.avatarUrl ? (
                <img
                  src={state.avatarUrl}
                  alt="Avatar preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-zinc-700"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-zinc-800 border-2 border-zinc-700" />
              )}
              <div>
                <p className={cn('text-[17px] font-semibold text-white', !state.title && 'text-zinc-600')}>
                  {state.title || 'Your Name'}
                </p>
                {state.bio ? (
                  <p className="mt-1 text-[13px] text-zinc-400 max-w-[280px]">{state.bio}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {state.links.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-center">
                  <p className="text-[12px] text-zinc-600">Your links will appear here</p>
                </div>
              ) : (
                state.links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-[13px] text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{link.label || link.url || 'Untitled link'}</span>
                  </div>
                ))
              )}
            </div>

            <div className="absolute bottom-5 left-0 right-0 text-center">
              <span className="text-[10px] text-zinc-700">Powered by SabNode</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
