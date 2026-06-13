/**
 * PUBLIC booking page (`/share/book/[slug]`).
 *
 * Unauthenticated by design — it lives under the public `/share/*` route group
 * (`src/app/share/layout.tsx`: no auth middleware, branded header), the same
 * place the public lead-form render lives. All data flows through the UNGATED
 * `getPublicAvailability` / `createBookingPublic` server actions, which resolve
 * the tenant entirely from the stored link document (the visitor only supplies
 * the slug, a chosen slot and their contact details).
 */

import * as React from 'react';

import { PublicBookingClient } from './page.client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Book a time',
  robots: { index: false },
};

export default async function PublicBookingPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await props.params;
  return <PublicBookingClient slug={slug} />;
}
