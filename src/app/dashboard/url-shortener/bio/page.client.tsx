'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  useZoruToast,
  Skeleton,
} from '@/components/sabcrm/20ui/compat';
import { BioState } from './types';
import { fetchBioData, saveBioData } from './api';
import { BioProfileForm } from './_components/BioProfileForm';
import { BioLinksForm } from './_components/BioLinksForm';
import { BioPreview } from './_components/BioPreview';

export default function BioBuilderPage() {
  const { toast } = useZoruToast();
  const [state, setState] = useState<BioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    async function load() {
      setLoading(true);
      const res = await fetchBioData();
      
      if (!mounted) return;

      if (res.error) {
        toast({ title: 'Error Loading', description: res.error.message, variant: 'destructive' });
      } else {
        setState(res.data);
      }
      setLoading(false);
    }

    load();

    return () => { mounted = false; };
  }, [toast]);

  const update = (patch: Partial<BioState>) => {
    if (!state) return;
    setState((s) => s ? { ...s, ...patch } : s);
  };

  const handleSave = async () => {
    if (!state) return;
    setSaving(true);
    const res = await saveBioData(state);
    setSaving(false);

    if (res.error) {
      toast({ title: 'Error Saving', description: res.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved successfully', description: 'Your bio page has been saved.' });
      setState(res.data);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Link in Bio</ZoruPageTitle>
          <ZoruPageDescription>
            Build your public bio page with links and a personal profile.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        ) : !state ? (
          <div className="py-10 text-center text-[var(--st-text)]">
            Failed to load bio data.
          </div>
        ) : (
          <div className="space-y-5">
            <BioProfileForm state={state} update={update} />
            <BioLinksForm state={state} update={update} />
            
            <Button 
              onClick={handleSave} 
              className="w-full"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}

        <div className="flex justify-center lg:justify-start">
          {loading ? (
            <Skeleton className="w-[375px] h-[640px] rounded-[2.5rem]" />
          ) : state ? (
            <BioPreview state={state} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
