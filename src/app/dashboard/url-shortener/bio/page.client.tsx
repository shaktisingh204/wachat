'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { FileWarning } from 'lucide-react';
import { BioState } from './types';
import { fetchBioData, saveBioData } from './api';
import { BioProfileForm } from './_components/BioProfileForm';
import { BioLinksForm } from './_components/BioLinksForm';
import { BioPreview } from './_components/BioPreview';

export default function BioBuilderPage() {
  const { toast } = useToast();
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
        toast({ title: 'Error loading', description: res.error.message, tone: 'danger' });
      } else {
        setState(res.data);
      }
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const update = (patch: Partial<BioState>) => {
    if (!state) return;
    setState((s) => (s ? { ...s, ...patch } : s));
  };

  const handleSave = async () => {
    if (!state) return;
    setSaving(true);
    const res = await saveBioData(state);
    setSaving(false);

    if (res.error) {
      toast({ title: 'Error saving', description: res.error.message, tone: 'danger' });
    } else {
      toast({ title: 'Saved successfully', description: 'Your bio page has been saved.', tone: 'success' });
      setState(res.data);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Link in Bio</PageTitle>
          <PageDescription>
            Build your public bio page with links and a personal profile.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-[var(--st-radius-lg)]" />
            <Skeleton className="h-80 w-full rounded-[var(--st-radius-lg)]" />
          </div>
        ) : !state ? (
          <EmptyState
            icon={FileWarning}
            tone="danger"
            title="Failed to load bio data"
            description="We could not load your bio page. Please refresh and try again."
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            <BioProfileForm state={state} update={update} />
            <BioLinksForm state={state} update={update} />

            <Button variant="primary" block onClick={handleSave} loading={saving}>
              Save Changes
            </Button>
          </div>
        )}

        <div className="flex justify-center lg:justify-start">
          {loading ? (
            <Skeleton className="h-[640px] w-[375px] rounded-[2.5rem]" />
          ) : state ? (
            <BioPreview state={state} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
