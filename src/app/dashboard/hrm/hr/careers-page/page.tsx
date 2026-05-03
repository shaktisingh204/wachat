'use client';

import * as React from 'react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Globe, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getCareersPageConfig,
  saveCareersPageConfig,
} from '@/app/actions/hr.actions';
import type { HrCareersPageConfig } from '@/lib/hr-types';

type ConfigDoc =
  | (HrCareersPageConfig & { _id: unknown })
  | null;

export default function CareersPageConfigPage() {
  const { toast } = useToast();
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

      <ClayCard>
        {isLoading && !config ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form action={saveFormAction} className="space-y-4">
            {configId ? (
              <input type="hidden" name="_id" value={configId} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="headline" className="text-foreground">
                  Headline
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="headline"
                    name="headline"
                    defaultValue={value('headline')}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="intro" className="text-foreground">
                  Intro
                </Label>
                <div className="mt-1.5">
                  <Textarea
                    id="intro"
                    name="intro"
                    rows={3}
                    defaultValue={value('intro')}
                    className="rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="logoUrl" className="text-foreground">
                  Logo URL
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="logoUrl"
                    name="logoUrl"
                    defaultValue={value('logoUrl')}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="primaryColor" className="text-foreground">
                  Primary Color
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="primaryColor"
                    name="primaryColor"
                    defaultValue={value('primaryColor')}
                    placeholder="#E11D48"
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ctaLabel" className="text-foreground">
                  CTA Label
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="ctaLabel"
                    name="ctaLabel"
                    defaultValue={value('ctaLabel')}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="slug" className="text-foreground">
                  Slug
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={value('slug')}
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="isPublished" className="text-foreground">
                  Published
                </Label>
                <div className="mt-1.5">
                  <Select
                    name="isPublished"
                    defaultValue={
                      config && (config as any).isPublished ? 'yes' : 'no'
                    }
                  >
                    <SelectTrigger
                      id="isPublished"
                      className="h-10 rounded-lg border-border bg-card text-[13px]"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null
                }
              >
                Save
              </ClayButton>
            </div>
          </form>
        )}
      </ClayCard>
    </div>
  );
}
