'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Textarea,
} from '@/components/sabcrm/20ui';
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
    <div className="20ui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>New location</PageTitle>
          <PageDescription>
            Create a draft location. You can connect providers and edit
            profile details after it&apos;s saved.
          </PageDescription>
        </PageHeading>
      </PageHeader>
      <Card>
        <CardBody className="p-6">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <Field className="sm:col-span-2" label="Name" required>
              <Input name="name" required />
            </Field>
            <Field className="sm:col-span-2" label="Street address">
              <Input name="addressLine1" />
            </Field>
            <Field label="City">
              <Input name="city" />
            </Field>
            <Field label="State / region">
              <Input name="region" />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" />
            </Field>
            <Field label="Country">
              <Input name="country" />
            </Field>
            <Field label="Phone">
              <Input name="phone" />
            </Field>
            <Field label="Website">
              <Input name="websiteUrl" type="url" />
            </Field>
            <Field className="sm:col-span-2" label="Categories (comma-separated)">
              <Textarea name="categories" rows={2} />
            </Field>
            {error ? (
              <Alert className="sm:col-span-2" tone="danger" title="Could not save">
                {error}
              </Alert>
            ) : null}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="primary" loading={pending}>
                {pending ? 'Creating...' : 'Create location'}
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
        </CardBody>
      </Card>
    </div>
  );
}
