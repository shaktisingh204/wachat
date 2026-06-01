// PORT-NOTE: cron-register-all.command.ts
// In SabNode, cron jobs are declared via Vercel Cron (vercel.json) rather than
// being programmatically registered at boot time. The original command iterated
// over a list of NestJS cron-command services and called their .run() methods.
// This port preserves the list of cron job names for documentation / registration
// reference. Wire the equivalent Next.js route handlers in /app/api/cron/... and
// declare them in vercel.json.

import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

export type CronJobRegistration = {
  name: string;
  routePath: string;
  isEnabled?: boolean;
};

/**
 * Returns the full list of cron job registrations that were registered by the
 * original `cron:register:all` command.
 * Use this list to verify that all Vercel Cron entries in vercel.json are present.
 */
export function getAllCronJobRegistrations(config: {
  signingKeyRotationDays?: number | undefined;
}): CronJobRegistration[] {
  const isSigningKeyAutoRotationEnabled = isDefined(config.signingKeyRotationDays);

  return [
    { name: 'MessagingMessagesImport', routePath: '/api/cron/messaging/messages-import' },
    { name: 'MessagingMessageListFetch', routePath: '/api/cron/messaging/message-list-fetch' },
    { name: 'MessagingOngoingStale', routePath: '/api/cron/messaging/ongoing-stale' },
    { name: 'MessagingRelaunchFailedMessageChannels', routePath: '/api/cron/messaging/relaunch-failed-channels' },
    { name: 'CalendarEventListFetch', routePath: '/api/cron/calendar/event-list-fetch' },
    { name: 'CalendarEventsImport', routePath: '/api/cron/calendar/events-import' },
    { name: 'CalendarOngoingStale', routePath: '/api/cron/calendar/ongoing-stale' },
    { name: 'CalendarRelaunchFailedCalendarChannels', routePath: '/api/cron/calendar/relaunch-failed-channels' },
    { name: 'CheckCustomDomainValidRecords', routePath: '/api/cron/workspace/check-custom-domain' },
    { name: 'CheckPublicDomainsValidRecords', routePath: '/api/cron/workspace/check-public-domains' },
    { name: 'WorkflowCronTrigger', routePath: '/api/cron/workflow/cron-trigger' },
    { name: 'WorkflowRunEnqueue', routePath: '/api/cron/workflow/run-enqueue' },
    { name: 'WorkflowHandleStaledRuns', routePath: '/api/cron/workflow/handle-staled-runs' },
    { name: 'WorkflowCleanWorkflowRuns', routePath: '/api/cron/workflow/clean-runs' },
    { name: 'CronTrigger', routePath: '/api/cron/logic-function/cron-trigger' },
    { name: 'CleanSuspendedWorkspaces', routePath: '/api/cron/workspace/clean-suspended' },
    { name: 'CleanOnboardingWorkspaces', routePath: '/api/cron/workspace/clean-onboarding' },
    { name: 'TrashCleanup', routePath: '/api/cron/trash-cleanup' },
    { name: 'EventLogCleanup', routePath: '/api/cron/event-log-cleanup' },
    { name: 'MarketplaceCatalogSync', routePath: '/api/cron/marketplace/catalog-sync' },
    { name: 'ApplicationVersionCheck', routePath: '/api/cron/application/version-check' },
    { name: 'EnterpriseKeyValidation', routePath: '/api/cron/enterprise/key-validation' },
    {
      name: 'RotateSigningKeys',
      routePath: '/api/cron/jwt/rotate-signing-keys',
      isEnabled: isSigningKeyAutoRotationEnabled,
    },
    { name: 'StaleRegistrationCleanup', routePath: '/api/cron/oauth/stale-registration-cleanup' },
  ];
}
