/**
 * SabCRM — Data Model settings page (Server Component).
 *
 * The admin console for the runtime metadata engine. Lists every object the
 * active project can see (standard + custom), lets an admin create custom
 * objects, and opens an object to manage its fields and relations.
 *
 * This page is a thin server shell:
 *   - it resolves the object catalogue through the gated
 *     {@link listObjectsAction} (session → project → RBAC → plan), failing
 *     closed to a calm empty state if the gate rejects;
 *   - it derives the code-declared standard field keys (so the client can lock
 *     immutable standard fields) directly from the standard schema — pure data,
 *     safe to read at the server boundary;
 *   - all interactivity (dialogs, field forms, relation builder) lives in the
 *     {@link DataModelClient} child, which calls the same gated object/field
 *     server actions for every mutation.
 *
 * Auth / onboarding / RBAC / project context are enforced by `../../layout.tsx`;
 * the actions independently re-run the full gate, so this route fails closed for
 * anyone who slips past the layout guard.
 */

import type { Metadata } from 'next';

import { listObjectsAction } from '@/app/actions/sabcrm.actions';
import { STANDARD_OBJECTS } from '@/lib/sabcrm/schema';
import {
  EmptyState,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';

import { DataModelClient } from './data-model-client';

export const metadata: Metadata = {
  title: 'Data Model · SabCRM',
  description:
    'Define the objects, fields, and relations that make up your CRM data model.',
};

// The object catalogue is per-request and project-scoped — never cache it.
export const dynamic = 'force-dynamic';

/**
 * Map each standard object slug to its code-declared field keys. These fields
 * are immutable (the metadata engine rejects edits/removal/reorder on them),
 * so the client uses this to render them as locked. Custom objects are not in
 * this map; every field on a custom object is editable.
 */
const STANDARD_FIELD_KEYS: Record<string, string[]> = Object.fromEntries(
  STANDARD_OBJECTS.map((object) => [
    object.slug,
    object.fields.map((field) => field.key),
  ]),
);

export default async function DataModelPage(): Promise<React.JSX.Element> {
  const objectsRes = await listObjectsAction();

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Settings</ZoruPageEyebrow>
          <ZoruPageTitle>Data Model</ZoruPageTitle>
          <ZoruPageDescription>
            Objects, fields, and relations are data — not code. Create custom
            objects, manage their fields, and link objects together. Standard
            objects accept new fields but keep their built-in identity.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {!objectsRes.ok ? (
        <EmptyState
          title="Data model is unavailable"
          description={objectsRes.error}
        />
      ) : (
        <DataModelClient
          initialObjects={objectsRes.data}
          standardFieldKeys={STANDARD_FIELD_KEYS}
        />
      )}
    </main>
  );
}
