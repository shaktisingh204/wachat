'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  PageHeader,
  Textarea,
  ZoruPageDescription,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import { createSabpublishLocation } from '@/app/actions/sabpublish.actions';

export default function NewSabpublishLocationPage() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      addressLine1: (String(form.get('addressLine1') ?? '') || undefined),
      city: (String(form.get('city') ?? '') || undefined),
      region: (String(form.get('region') ?? '') || undefined),
      postalCode: (String(form.get('postalCode') ?? '') || undefined),
      country: (String(form.get('country') ?? '') || undefined),
      phone: (String(form.get('phone') ?? '') || undefined),
      websiteUrl: (String(form.get('websiteUrl') ?? '') || undefined),
      categories: String(form.get('categories') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!payload.name) {
      setError('Name is required');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createSabpublishLocation(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/dashboard/sabpublish/locations/${res.data._id}`);
    });
  }

  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>New location</ZoruPageTitle>
          <ZoruPageDescription>
            Create a draft location. You can connect providers and edit
            profile details after it&apos;s saved.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>
      <Card>
        <CardContent className="p-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="addressLine1">Street address</Label>
              <Input id="addressLine1" name="addressLine1" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div>
              <Label htmlFor="region">State / region</Label>
              <Input id="region" name="region" />
            </div>
            <div>
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="websiteUrl">Website</Label>
              <Input id="websiteUrl" name="websiteUrl" type="url" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="categories">Categories (comma-separated)</Label>
              <Textarea id="categories" name="categories" rows={2} />
            </div>
            {error ? (
              <p className="sm:col-span-2 text-sm text-destructive">{error}</p>
            ) : null}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create location'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/dashboard/sabpublish/locations')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
