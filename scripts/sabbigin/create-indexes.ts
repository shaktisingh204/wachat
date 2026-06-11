/**
 * SabBigin index bootstrap. Idempotent — safe to re-run.
 *
 *   npm run db:sabbigin:indexes
 *
 * Creates the indexes the SabBigin surfaces rely on: tenant-scoped lookups,
 * unique public slugs/tokens, and the booking double-book guard.
 */

import { connectToDatabase } from '../../src/lib/mongodb';

async function main() {
  const { db } = await connectToDatabase();

  const specs: Array<{
    coll: string;
    index: Record<string, 1 | -1>;
    options?: Record<string, unknown>;
  }> = [
    // pipeline-config sidecar — one doc per (tenant, pipeline)
    {
      coll: 'sabbigin_pipeline_config',
      index: { userId: 1, pipelineId: 1 },
      options: { unique: true, name: 'tenant_pipeline_unique' },
    },
    // approvals inbox
    { coll: 'crm_approvals', index: { userId: 1, status: 1, createdAt: -1 }, options: { name: 'tenant_status_created' } },
    { coll: 'crm_approvals', index: { dealId: 1 }, options: { name: 'by_deal' } },
    // booking pages — public slug must be globally unique
    {
      coll: 'sabbigin_booking_pages',
      index: { slug: 1 },
      options: { unique: true, name: 'slug_unique' },
    },
    { coll: 'sabbigin_booking_pages', index: { userId: 1, status: 1 }, options: { name: 'tenant_status' } },
    // bookings — one confirmed booking per (page, start) = double-book guard
    {
      coll: 'sabbigin_bookings',
      index: { pageId: 1, startAt: 1 },
      options: { unique: true, name: 'page_start_unique' },
    },
    // email-in aliases — token must be unique
    {
      coll: 'crm_email_aliases',
      index: { token: 1 },
      options: { unique: true, name: 'token_unique', sparse: true },
    },
  ];

  for (const s of specs) {
    try {
      await db.collection(s.coll).createIndex(s.index as any, s.options as any);
      console.log(`✓ ${s.coll} ${JSON.stringify(s.index)}`);
    } catch (e) {
      console.warn(`✗ ${s.coll} ${JSON.stringify(s.index)} — ${(e as Error).message}`);
    }
  }

  console.log('SabBigin indexes ensured.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
