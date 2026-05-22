'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  cn,
} from '@/components/zoruui';
import { useEffect, useState } from 'react';
import { Palette, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';
import Link from 'next/link';

const STORAGE_KEY = 'qr-brand-kits';
const MAX_KITS = 5;

interface BrandKit {
  id: string;
  name: string;
  primaryColor: string;
  bgColor: string;
  logoUrl?: string;
}

interface KitFormState {
  name: string;
  primaryColor: string;
  bgColor: string;
  logoUrl?: string;
}

const defaultForm = (): KitFormState => ({
  name: '',
  primaryColor: '#000000',
  bgColor: '#ffffff',
  logoUrl: undefined,
});

export default function BrandKitPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<KitFormState>(defaultForm());
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setKits(JSON.parse(stored));
    } catch {
      setKits([]);
    }
  }, []);

  const persist = (updated: BrandKit[]) => {
    setKits(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Kit name is required.');
      return;
    }
    if (kits.length >= MAX_KITS) {
      setFormError(`You can save up to ${MAX_KITS} brand kits.`);
      return;
    }
    const kit: BrandKit = {
      id: `kit_${Date.now()}`,
      name: form.name.trim(),
      primaryColor: form.primaryColor,
      bgColor: form.bgColor,
      logoUrl: form.logoUrl,
    };
    persist([...kits, kit]);
    setForm(defaultForm());
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist(kits.filter(k => k.id !== id));
  };

  const handleApply = (kit: BrandKit) => {
    const value = JSON.stringify({ primaryColor: kit.primaryColor, bgColor: kit.bgColor, logoUrl: kit.logoUrl });
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kit.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <ZoruButton variant="ghost" asChild className="mb-2 -ml-4">
          <Link href="/dashboard/qr-code-maker/settings">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </ZoruButton>
        <h1 className="text-3xl text-zoru-ink">Brand Kit</h1>
        <p className="text-zoru-ink-muted mt-1">Save your colors and logo as reusable presets.</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{kits.length} / {MAX_KITS} kits saved</p>
        {!showForm && kits.length < MAX_KITS && (
          <ZoruButton onClick={() => { setShowForm(true); setFormError(''); }} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Brand Kit
          </ZoruButton>
        )}
      </div>

      {showForm && (
        <ZoruCard className="border-purple-200 ring-1 ring-purple-100">
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-purple-600" />
              New Brand Kit
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="space-y-2">
              <ZoruLabel>Kit Name <span className="text-red-500">*</span></ZoruLabel>
              <ZoruInput
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Corporate Blue"
                maxLength={60}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <ZoruLabel>Primary Color</ZoruLabel>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer p-0.5"
                  />
                  <ZoruInput
                    value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <ZoruLabel>Background Color</ZoruLabel>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.bgColor}
                    onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer p-0.5"
                  />
                  <ZoruInput
                    value={form.bgColor}
                    onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <ZoruLabel>Logo</ZoruLabel>
              <div className="flex items-center gap-3">
                {form.logoUrl && (
                  <div className="w-12 h-12 border rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                    <img src={form.logoUrl} className="max-w-full max-h-full object-contain" alt="Kit logo" />
                  </div>
                )}
                <SabFilePickerButton
                  accept="image"
                  onPick={({ url }) => setForm(f => ({ ...f, logoUrl: url }))}
                >
                  {form.logoUrl ? 'Change Logo' : 'Choose Logo'}
                </SabFilePickerButton>
                {form.logoUrl && (
                  <ZoruButton variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, logoUrl: undefined }))}>
                    Remove
                  </ZoruButton>
                )}
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{formError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <ZoruButton onClick={handleAdd}>Save Kit</ZoruButton>
              <ZoruButton variant="ghost" onClick={() => { setShowForm(false); setForm(defaultForm()); setFormError(''); }}>Cancel</ZoruButton>
            </div>
          </ZoruCardContent>
        </ZoruCard>
      )}

      {kits.length === 0 && !showForm && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <Palette className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No brand kits yet</p>
          <p className="text-sm text-slate-400 mt-1">Add your first kit to reuse colors and logos across QR codes.</p>
        </div>
      )}

      <div className="space-y-3">
        {kits.map(kit => (
          <ZoruCard key={kit.id} className="border hover:shadow-sm transition-shadow">
            <ZoruCardContent className="flex items-center gap-4 py-4">
              <div className="flex gap-2 shrink-0">
                <div
                  className="w-10 h-10 rounded-lg border shadow-sm"
                  style={{ backgroundColor: kit.primaryColor }}
                  title={`Primary: ${kit.primaryColor}`}
                />
                <div
                  className="w-10 h-10 rounded-lg border shadow-sm"
                  style={{ backgroundColor: kit.bgColor }}
                  title={`Background: ${kit.bgColor}`}
                />
              </div>
              {kit.logoUrl && (
                <div className="w-10 h-10 border rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 shrink-0">
                  <img src={kit.logoUrl} className="max-w-full max-h-full object-contain" alt={`${kit.name} logo`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{kit.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{kit.primaryColor} · {kit.bgColor}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => handleApply(kit)}
                  className={cn(copied === kit.id && "border-green-500 text-green-700")}
                >
                  {copied === kit.id ? 'Copied!' : 'Apply'}
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(kit.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  aria-label={`Delete ${kit.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </ZoruButton>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        ))}
      </div>
    </div>
  );
}
