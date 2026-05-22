/**
 * SabSMS RBAC permission keys registry.
 * Defines the granular permissions used to control access to SabSMS resources.
 */

export const SABSMS_PERMISSIONS = [
  'sabsms.messages.send',
  'sabsms.messages.view',
  'sabsms.templates.create',
  'sabsms.templates.approve',
  'sabsms.templates.delete',
  'sabsms.campaigns.create',
  'sabsms.campaigns.manage',
  'sabsms.drips.manage',
  'sabsms.numbers.view',
  'sabsms.numbers.manage',
  'sabsms.provider_accounts.manage',
  'sabsms.suppressions.manage',
  'sabsms.consent.manage',
  'sabsms.webhooks.manage',
  'sabsms.conversations.manage',
  'sabsms.conversations.view',
  'sabsms.short_links.manage',
] as const;

export type SabsmsPermission = typeof SABSMS_PERMISSIONS[number];
