'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Skeleton, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';

/**
 * Careers page settings — §1D.4 specialised "settings list" upgrade.
 *
 * Singular configuration document (not a CRUD list). Renders sectioned
 * cards covering:
 *   • Slug + theme
 *   • Intro text + headline
 *   • CTA + visibility
 *   • SEO meta (placeholders — server keys are preserved)
 *
 * Preserves every FormData key the existing `saveCareersPageConfig`
 * action reads (headline · intro · logoUrl · primaryColor · ctaLabel ·
 * slug · isPublished).
 */

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';

import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCareersPageConfig,
  saveCareersPageConfig,
} from '@/app/actions/hr.actions';
import type { HrCareersPageConfig } from '@/lib/hr-types';

type ConfigDoc = (HrCareersPageConfig & { _id: unknown }) | null;

export default function CareersPageConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigDoc>(null);
  const [logoUrl, setLogoUrl] = useState('');
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
        const next = (doc as ConfigDoc) ?? null;
        setConfig(next);
        setLogoUrl(
          next && (next as any).logoUrl != null
            ? String((next as any).logoUrl)
            : '',
        );
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
    <EntityListShell
      title="Careers Page"
      subtitle="Public-facing careers site — slug, theme, intro, jobs & SEO."
    >

      {isLoading && !config ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <form action={saveFormAction} className="flex flex-col gap-4">
          {configId ? (
            <input type="hidden" name="_id" value={configId} />
          ) : null}

          {/* ─── Slug + theme ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">Slug & theme</CardTitle>
              <CardDescription>
                Public URL slug and brand colours.
              </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={value('slug')}
                  placeholder="careers-acme"
                />
              </div>
              <div>
                <Label htmlFor="primaryColor">Primary colour</Label>
                <Input
                  id="primaryColor"
                  name="primaryColor"
                  defaultValue={value('primaryColor')}
                  placeholder="#E11D48"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="logoUrl">Logo</Label>
                <SabFileUrlInput
                  id="logoUrl"
                  name="logoUrl"
                  accept="image"
                  value={logoUrl}
                  onChange={(v) => setLogoUrl(v)}
                />
              </div>
            </CardBody>
          </Card>

          {/* ─── Intro text ────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">
                Headline & intro
              </CardTitle>
              <CardDescription>
                The top-of-fold copy candidates land on.
              </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  name="headline"
                  defaultValue={value('headline')}
                  placeholder="Join us — we're hiring."
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="intro">Intro</Label>
                <Textarea
                  id="intro"
                  name="intro"
                  rows={4}
                  defaultValue={value('intro')}
                  placeholder="Tell candidates about the company, the mission, and what makes the team great."
                />
              </div>
            </CardBody>
          </Card>

          {/* ─── Visibility + CTA ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">CTA & visibility</CardTitle>
              <CardDescription>
                Apply button copy and whether the public page is live.
              </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ctaLabel">CTA label</Label>
                <Input
                  id="ctaLabel"
                  name="ctaLabel"
                  defaultValue={value('ctaLabel')}
                  placeholder="Apply now"
                />
              </div>
              <div>
                <Label>Published</Label>
                <EnumFormField
                  name="isPublished"
                  enumName="yesNo"
                  initialId={config && (config as any).isPublished ? 'yes' : 'no'}
                  allowInlineCreate={false}
                  placeholder="Published?"
                />
              </div>
            </CardBody>
          </Card>

          {/* ─── SEO meta ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[15px]">SEO meta</CardTitle>
              <CardDescription>
                Search engine optimization fields for the careers site.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="metaTitle" className="text-[13.5px] font-medium">Meta Title</Label>
                <Input
                  id="metaTitle"
                  name="metaTitle"
                  defaultValue={(config as any)?.metaTitle ?? ''}
                  placeholder="e.g. Careers at Acme"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="metaDescription" className="text-[13.5px] font-medium">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  name="metaDescription"
                  defaultValue={(config as any)?.metaDescription ?? ''}
                  rows={2}
                  placeholder="e.g. Join us to build the future."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ogImage" className="text-[13.5px] font-medium">OG Image URL</Label>
                <Input
                  id="ogImage"
                  name="ogImage"
                  defaultValue={(config as any)?.ogImage ?? ''}
                  placeholder="e.g. https://example.com/og-image.png"
                />
              </div>
            </CardBody>
          </Card>

          <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 bg-[var(--st-bg)]/95 px-1 py-3 backdrop-blur">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : null}
              Save
            </Button>
          </div>
        </form>
      )}
    </EntityListShell>
  );
}
