/**
 * Client-safe map: SabFlow credential type → registered OAuth provider id.
 *
 * Lives in its own module (no Node-only deps) so it can be imported from
 * `'use client'` pages.  Server-side code should import this transitively
 * via `./providers`, which re-exports it.
 *
 * Returning `undefined` from a lookup means the credential is API-key only
 * and must be entered manually.
 */

export const OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE: Readonly<Record<string, string>> = {
  // Identity-mapped
  slack: 'slack',
  discord: 'discord',
  github: 'github',
  notion: 'notion',
  linear: 'linear',
  hubspot: 'hubspot',
  asana: 'asana',
  // Microsoft Graph family
  microsoft_teams: 'microsoft',
  microsoft_excel: 'microsoft',
  microsoft_onedrive: 'microsoft',
  microsoft_outlook: 'microsoft',
  microsoft_sharepoint: 'microsoft',
  microsoft_todo: 'microsoft',
  microsoft_dynamics_crm: 'microsoft',
  // Google family
  google_sheets: 'google',
  google_drive: 'google',
  google_analytics: 'google',
  google_bigquery: 'google',
  google_chat: 'google',
  google_cloud_storage: 'google',
  google_firestore: 'google',
  // Atlassian
  jira: 'atlassian',
  // Batch 3
  trello: 'trello',
  box: 'box',
  dropbox: 'dropbox',
  salesforce: 'salesforce',
  pipedrive: 'pipedrive',
  intercom: 'intercom',
  clickup: 'clickup',
  calendly: 'calendly',
};

/** Pretty label for a provider id, used in the Connect button. */
export const OAUTH_PROVIDER_LABEL: Readonly<Record<string, string>> = {
  google: 'Google',
  slack: 'Slack',
  github: 'GitHub',
  microsoft: 'Microsoft',
  notion: 'Notion',
  linear: 'Linear',
  discord: 'Discord',
  hubspot: 'HubSpot',
  asana: 'Asana',
  atlassian: 'Atlassian',
  zoom: 'Zoom',
  spotify: 'Spotify',
  trello: 'Trello',
  box: 'Box',
  dropbox: 'Dropbox',
  salesforce: 'Salesforce',
  pipedrive: 'Pipedrive',
  intercom: 'Intercom',
  clickup: 'ClickUp',
  calendly: 'Calendly',
};

/** Brand-tinted ring color for the Connect CTA per provider. */
export const OAUTH_PROVIDER_ACCENT: Readonly<Record<string, string>> = {
  google: 'from-blue-500/15 to-red-500/15',
  slack: 'from-purple-500/15 to-yellow-400/15',
  github: 'from-zinc-700/20 to-zinc-900/20',
  microsoft: 'from-sky-500/15 to-green-500/15',
  notion: 'from-zinc-800/20 to-zinc-500/15',
  linear: 'from-indigo-500/15 to-violet-500/15',
  discord: 'from-indigo-500/15 to-blurple-500/15',
  hubspot: 'from-orange-500/15 to-rose-500/15',
  asana: 'from-rose-500/15 to-orange-400/15',
  atlassian: 'from-blue-600/15 to-cyan-400/15',
  zoom: 'from-sky-500/15 to-blue-600/15',
  spotify: 'from-emerald-500/15 to-green-600/15',
  trello: 'from-blue-500/15 to-sky-400/15',
  box: 'from-blue-600/15 to-indigo-500/15',
  dropbox: 'from-sky-500/15 to-blue-500/15',
  salesforce: 'from-sky-400/15 to-cyan-500/15',
  pipedrive: 'from-zinc-700/15 to-zinc-500/15',
  intercom: 'from-blue-500/15 to-indigo-500/15',
  clickup: 'from-purple-500/15 to-pink-500/15',
  calendly: 'from-blue-500/15 to-violet-500/15',
};

export function getOAuthProviderIdForCredentialType(
  credentialType: string,
): string | undefined {
  return OAUTH_PROVIDER_FOR_CREDENTIAL_TYPE[credentialType];
}
