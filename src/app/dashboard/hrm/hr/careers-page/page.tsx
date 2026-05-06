'use client';

import * as React from 'react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Globe, LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
  getCareersPageConfig,
  saveCareersPageConfig,
} from '@/app/actions/hr.actions';
import type { HrCareersPageConfig } from '@/lib/hr-types';

type ConfigDoc =
  | (HrCareersPageConfig & { _id: unknown })
  | null;

export default function CareersPageConfigPage() {
  const { toast } = useZoruToast();
  const [config, setConfig] = useState<ConfigDoc>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveCareersPageConfig,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const doc = await getCareersPageConfig();
        setConfig((doc as ConfigDoc) ?? null);
      } catch (e) {
        console.error('Failed to load careers page config:', e);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const value = (key: keyof HrCareersPageConfig) => {
    const v = config ? (config as any)[key] : undefined;
    return v == null ? '' : String(v);
  };

  const configId = config && (config as any)._id
    ? String((config as any)._id)
    : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Careers Page"
        subtitle="Public-facing careers site configuration."
        icon={Globe}
      />

      <ZoruCard className="p-6">
        {isLoading && !config ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-24 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : (
          <form action={saveFormAction} className="space-y-4">
            {configId ? (
              <input type="hidden" name="_id" value={configId} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <ZoruLabel htmlFor="headline" className="text-zoru-ink">
                  Headline
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="headline"
                    name="headline"
                    defaultValue={value('headline')}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <ZoruLabel htmlFor="intro" className="text-zoru-ink">
                  Intro
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruTextarea
                    id="intro"
                    name="intro"
                    rows={3}
                    defaultValue={value('intro')}
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="logoUrl" className="text-zoru-ink">
                  Logo URL
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="logoUrl"
                    name="logoUrl"
                    defaultValue={value('logoUrl')}
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="primaryColor" className="text-zoru-ink">
                  Primary Color
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="primaryColor"
                    name="primaryColor"
                    defaultValue={value('primaryColor')}
                    placeholder="#E11D48"
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="ctaLabel" className="text-zoru-ink">
                  CTA Label
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="ctaLabel"
                    name="ctaLabel"
                    defaultValue={value('ctaLabel')}
                  />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="slug" className="text-zoru-ink">
                  Slug
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="slug"
                    name="slug"
                    defaultValue={value('slug')}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <ZoruLabel htmlFor="isPublished" className="text-zoru-ink">
                  Published
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruSelect
                    name="isPublished"
                    defaultValue={
                      config && (config as any).isPublished ? 'yes' : 'no'
                    }
                  >
                    <ZoruSelectTrigger id="isPublished">
                      <ZoruSelectValue placeholder="Select" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                      <ZoruSelectItem value="no">No</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null}
                Save
              </ZoruButton>
            </div>
          </form>
        )}
      </ZoruCard>
    </div>
  );
}
