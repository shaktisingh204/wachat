'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, MapPin, Tags } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Separator,
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
      addressLine1: String(form.get('addressLine1') ?? '') || undefined,
      city: String(form.get('city') ?? '') || undefined,
      region: String(form.get('region') ?? '') || undefined,
      postalCode: String(form.get('postalCode') ?? '') || undefined,
      country: String(form.get('country') ?? '') || undefined,
      phone: String(form.get('phone') ?? '') || undefined,
      websiteUrl: String(form.get('websiteUrl') ?? '') || undefined,
      categories: String(form.get('categories') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!payload.name) {
      setError('Enter a business name to continue.');
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
    <div className="20ui mx-auto max-w-2xl space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>New location</PageTitle>
          <PageDescription>
            Create a draft location. You can connect providers and edit profile
            details once it is saved.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="ghost" iconLeft={ArrowLeft} asChild>
            <Link href="/dashboard/sabpublish/locations">Back to locations</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={16} aria-hidden="true" />
              <CardTitle>Business basics</CardTitle>
            </div>
            <CardDescription>How customers will recognise you.</CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Business name" required>
              <Input name="name" required placeholder="Northwind Trading" />
            </Field>
            <Field label="Phone">
              <Input name="phone" placeholder="+1 (312) 847-1928" />
            </Field>
            <Field label="Website">
              <Input
                name="websiteUrl"
                type="url"
                prefix="https://"
                placeholder="northwind.example"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin size={16} aria-hidden="true" />
              <CardTitle>Address</CardTitle>
            </div>
            <CardDescription>
              Used for the NAP (name, address, phone) shown on every listing.
            </CardDescription>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Street address">
              <Input name="addressLine1" placeholder="221B Baker Street" />
            </Field>
            <Field label="City">
              <Input name="city" placeholder="Pune" />
            </Field>
            <Field label="State / region">
              <Input name="region" placeholder="Maharashtra" />
            </Field>
            <Field label="Postal code">
              <Input name="postalCode" placeholder="411001" />
            </Field>
            <Field label="Country">
              <Input name="country" placeholder="India" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tags size={16} aria-hidden="true" />
              <CardTitle>Categories</CardTitle>
            </div>
            <CardDescription>
              Comma-separated. Providers use these to classify your business.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Field label="Categories">
              <Textarea
                name="categories"
                rows={2}
                placeholder="Coffee shop, Bakery, Breakfast restaurant"
              />
            </Field>
          </CardBody>
        </Card>

        {error ? (
          <Alert tone="danger" title="Could not save">
            {error}
          </Alert>
        ) : null}

        <Separator />

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabpublish/locations">Cancel</Link>
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? 'Creating' : 'Create location'}
          </Button>
        </div>
      </form>
    </div>
  );
}
