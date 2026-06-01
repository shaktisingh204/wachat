// PORT-NOTE: Original is a NestJS CommandRunner + BullMQ cron-queue job enqueuer.
// In SabNode, periodic work is handled by Vercel Cron (vercel.json) calling
// a Next.js API route, NOT by nest-commander or BullMQ.
//
// Equivalent Vercel Cron config in vercel.json:
//   { "path": "/api/sabcrm/crons/check-custom-domain-valid-records", "schedule": "0 * * * *" }
//
// The actual job logic lives in:
//   src/engine/core-modules/workspace/crons/jobs/check-custom-domain-valid-records.cron.job.ts
// Create an API route at the path above that calls handleCheckCustomDomainValidRecords().

export const CHECK_CUSTOM_DOMAIN_VALID_RECORDS_CRON_COMMAND_NAME =
  "cron:workspace:check-custom-domain-valid-records";

export const CHECK_CUSTOM_DOMAIN_VALID_RECORDS_CRON_DESCRIPTION =
  "Starts a cron job to check workspace custom domain valid records hourly";
