'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Alert,
  EmptyState,
  ColorPicker,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Plus, Trash2, ChevronLeft } from 'lucide-react';
import { SabFilePickerButton } from '@/components/sabfiles';

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
  const router = useRouter();
  const { toast } = useToast();
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<KitFormState>(defaultForm());
  const [formError, setFormError] = useState('');

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
    toast.success(`Saved "${kit.name}" to your brand kits.`);
  };

  const handleDelete = (kit: BrandKit) => {
    persist(kits.filter(k => k.id !== kit.id));
    toast.success(`Deleted "${kit.name}".`);
  };

  const handleApply = (kit: BrandKit) => {
    const value = JSON.stringify({ primaryColor: kit.primaryColor, bgColor: kit.bgColor, logoUrl: kit.logoUrl });
    navigator.clipboard.writeText(value).then(
      () => toast.success(`Copied "${kit.name}" to the clipboard.`),
      () => toast.error('Could not copy the brand kit.'),
    );
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={ChevronLeft}
          className="-ml-2 self-start"
          onClick={() => router.push('/dashboard/qr-code-maker/settings')}
        >
          Back to Settings
        </Button>
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageTitle>Brand Kit</PageTitle>
            <PageDescription>Save your colors and logo as reusable presets.</PageDescription>
          </PageHeaderHeading>
        </PageHeader>
      </div>

      <PageHeader bordered={false} compact>
        <PageHeaderHeading>
          <PageDescription>{kits.length} / {MAX_KITS} kits saved</PageDescription>
        </PageHeaderHeading>
        {!showForm && kits.length < MAX_KITS && (
          <PageActions>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={() => { setShowForm(true); setFormError(''); }}
            >
              Add Brand Kit
            </Button>
          </PageActions>
        )}
      </PageHeader>

      {showForm && (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
              New Brand Kit
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Kit Name" required>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Corporate Blue"
                maxLength={60}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary Color">
                <ColorPicker
                  value={form.primaryColor}
                  onChange={color => setForm(f => ({ ...f, primaryColor: color }))}
                />
              </Field>
              <Field label="Background Color">
                <ColorPicker
                  value={form.bgColor}
                  onChange={color => setForm(f => ({ ...f, bgColor: color }))}
                />
              </Field>
            </div>
            <Field label="Logo">
              <div className="flex items-center gap-3">
                {form.logoUrl && (
                  <div className="w-12 h-12 border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden flex items-center justify-center bg-[var(--st-bg-secondary)]">
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
                  <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, logoUrl: undefined }))}>
                    Remove
                  </Button>
                )}
              </div>
            </Field>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="flex gap-2 pt-2">
              <Button variant="primary" onClick={handleAdd}>Save Kit</Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setForm(defaultForm()); setFormError(''); }}>Cancel</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {kits.length === 0 && !showForm && (
        <EmptyState
          icon={Palette}
          title="No brand kits yet"
          description="Add your first kit to reuse colors and logos across QR codes."
        />
      )}

      <div className="space-y-3">
        {kits.map(kit => (
          <Card key={kit.id} variant="outlined">
            <CardBody className="flex items-center gap-4 py-4">
              <div className="flex gap-2 shrink-0">
                <div
                  className="w-10 h-10 rounded-[var(--st-radius)] border border-[var(--st-border)] shadow-sm"
                  style={{ backgroundColor: kit.primaryColor }}
                  title={`Primary: ${kit.primaryColor}`}
                />
                <div
                  className="w-10 h-10 rounded-[var(--st-radius)] border border-[var(--st-border)] shadow-sm"
                  style={{ backgroundColor: kit.bgColor }}
                  title={`Background: ${kit.bgColor}`}
                />
              </div>
              {kit.logoUrl && (
                <div className="w-10 h-10 border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden flex items-center justify-center bg-[var(--st-bg-secondary)] shrink-0">
                  <img src={kit.logoUrl} className="max-w-full max-h-full object-contain" alt={`${kit.name} logo`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-[var(--st-text)]">{kit.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)] font-mono">{kit.primaryColor} , {kit.bgColor}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleApply(kit)}>
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={() => handleDelete(kit)}
                  aria-label={`Delete ${kit.name}`}
                />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
