/**
 * SabFlow OAuth — embedded scope catalogue.
 *
 * Maps provider scope strings → user-facing description.  Used by the
 * `/dashboard/sabflow/credentials/[id]/scopes` UI to explain to the user
 * what each granted scope actually lets a flow do, and to drive the
 * "grant additional scopes" picker.
 *
 * This is a *minimal* catalogue — when a scope isn't listed we fall back to
 * the raw scope string in the UI rather than misrepresenting it.  Extend as
 * needed; each entry should be a one-sentence, plain-English description.
 */

export type ScopeEntry = {
  scope: string;
  /** One-sentence, user-facing description. */
  description: string;
  /** True for scopes the provider considers required for basic functionality. */
  required?: boolean;
  /** Optional category for grouping in pickers. */
  category?: string;
};

export type ScopeCatalogProvider =
  | 'google'
  | 'github'
  | 'slack'
  | 'microsoft'
  | 'notion'
  | 'linear';

/* ── Google ─────────────────────────────────────────────────────────────── */

const GOOGLE_SCOPES: ScopeEntry[] = [
  { scope: 'openid', description: 'Sign you in with your Google account.', required: true, category: 'Identity' },
  { scope: 'email', description: 'View your primary Google account email address.', required: true, category: 'Identity' },
  { scope: 'profile', description: 'View basic profile info (name, picture).', required: true, category: 'Identity' },
  { scope: 'https://www.googleapis.com/auth/userinfo.email', description: 'View your primary Google email address.', required: true, category: 'Identity' },
  { scope: 'https://www.googleapis.com/auth/userinfo.profile', description: 'View basic profile info (name, picture).', required: true, category: 'Identity' },
  { scope: 'https://www.googleapis.com/auth/drive.file', description: 'See, edit, create and delete only the Drive files used with this app.', category: 'Drive' },
  { scope: 'https://www.googleapis.com/auth/drive.readonly', description: 'See and download all your Google Drive files.', category: 'Drive' },
  { scope: 'https://www.googleapis.com/auth/drive', description: 'Full access to your Google Drive files.', category: 'Drive' },
  { scope: 'https://www.googleapis.com/auth/spreadsheets', description: 'See, edit, create and delete all your Google Sheets.', category: 'Sheets' },
  { scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', description: 'See all your Google Sheets.', category: 'Sheets' },
  { scope: 'https://www.googleapis.com/auth/calendar', description: 'See, edit, share and permanently delete all the calendars you can access.', category: 'Calendar' },
  { scope: 'https://www.googleapis.com/auth/calendar.events', description: 'View and edit events on all your calendars.', category: 'Calendar' },
  { scope: 'https://www.googleapis.com/auth/calendar.readonly', description: 'See your calendars and events.', category: 'Calendar' },
  { scope: 'https://www.googleapis.com/auth/gmail.send', description: 'Send mail as you (no read access).', category: 'Gmail' },
  { scope: 'https://www.googleapis.com/auth/gmail.readonly', description: 'View your email messages and settings.', category: 'Gmail' },
  { scope: 'https://www.googleapis.com/auth/gmail.modify', description: 'Read, compose, send and permanently delete email.', category: 'Gmail' },
  { scope: 'https://www.googleapis.com/auth/contacts.readonly', description: 'See your contacts.', category: 'Contacts' },
  { scope: 'https://www.googleapis.com/auth/contacts', description: 'See, edit, download and permanently delete your contacts.', category: 'Contacts' },
];

/* ── GitHub ─────────────────────────────────────────────────────────────── */

const GITHUB_SCOPES: ScopeEntry[] = [
  { scope: 'read:user', description: 'Read access to your profile data.', required: true, category: 'Identity' },
  { scope: 'user:email', description: 'Read access to your email addresses.', category: 'Identity' },
  { scope: 'user', description: 'Full read/write to your profile data.', category: 'Identity' },
  { scope: 'public_repo', description: 'Read/write to public repositories only.', category: 'Repos' },
  { scope: 'repo', description: 'Full control of private and public repositories.', category: 'Repos' },
  { scope: 'repo:status', description: 'Read/write access to commit status only.', category: 'Repos' },
  { scope: 'repo:invite', description: 'Accept/decline repository invitations.', category: 'Repos' },
  { scope: 'gist', description: 'Create and modify gists on your behalf.', category: 'Repos' },
  { scope: 'workflow', description: 'Update GitHub Actions workflow files.', category: 'Actions' },
  { scope: 'admin:repo_hook', description: 'Full control of repository webhooks.', category: 'Webhooks' },
  { scope: 'write:repo_hook', description: 'Read/write access to repository webhooks.', category: 'Webhooks' },
  { scope: 'read:repo_hook', description: 'Read-only access to repository webhooks.', category: 'Webhooks' },
  { scope: 'admin:org', description: 'Full control of organisations and teams.', category: 'Orgs' },
  { scope: 'read:org', description: 'Read-only access to organisations.', category: 'Orgs' },
  { scope: 'notifications', description: 'Read your notifications and mark as read.', category: 'Misc' },
];

/* ── Slack ──────────────────────────────────────────────────────────────── */

const SLACK_SCOPES: ScopeEntry[] = [
  { scope: 'users:read', description: 'View people in your workspace.', required: true, category: 'Users' },
  { scope: 'users:read.email', description: 'View email addresses of people in your workspace.', category: 'Users' },
  { scope: 'chat:write', description: 'Send messages as your app.', category: 'Messaging' },
  { scope: 'chat:write.public', description: 'Send messages to channels the app is not a member of.', category: 'Messaging' },
  { scope: 'channels:read', description: 'View basic info about public channels.', category: 'Channels' },
  { scope: 'channels:history', description: 'View messages and other content in public channels.', category: 'Channels' },
  { scope: 'channels:join', description: 'Join public channels.', category: 'Channels' },
  { scope: 'channels:manage', description: 'Create, archive and rename public channels.', category: 'Channels' },
  { scope: 'groups:read', description: 'View basic info about private channels the app belongs to.', category: 'Channels' },
  { scope: 'groups:history', description: 'View messages in private channels.', category: 'Channels' },
  { scope: 'im:read', description: 'View basic info about direct messages.', category: 'DMs' },
  { scope: 'im:history', description: 'View messages in direct messages.', category: 'DMs' },
  { scope: 'im:write', description: 'Start direct messages with people.', category: 'DMs' },
  { scope: 'files:read', description: 'View files in your workspace.', category: 'Files' },
  { scope: 'files:write', description: 'Upload, edit and delete files.', category: 'Files' },
  { scope: 'reactions:read', description: 'View emoji reactions.', category: 'Misc' },
  { scope: 'reactions:write', description: 'Add and remove emoji reactions.', category: 'Misc' },
];

/* ── Microsoft Graph ────────────────────────────────────────────────────── */

const MICROSOFT_SCOPES: ScopeEntry[] = [
  { scope: 'User.Read', description: 'Sign you in and read your profile.', required: true, category: 'Identity' },
  { scope: 'offline_access', description: 'Maintain access to data you have given it access to.', required: true, category: 'Identity' },
  { scope: 'User.ReadBasic.All', description: 'Read basic profiles of all users.', category: 'Identity' },
  { scope: 'Mail.Read', description: 'Read your mail.', category: 'Mail' },
  { scope: 'Mail.ReadWrite', description: 'Read and write access to your mail.', category: 'Mail' },
  { scope: 'Mail.Send', description: 'Send mail as you.', category: 'Mail' },
  { scope: 'Calendars.Read', description: 'Read your calendars.', category: 'Calendar' },
  { scope: 'Calendars.ReadWrite', description: 'Read and write access to your calendars.', category: 'Calendar' },
  { scope: 'Files.Read', description: 'Read your OneDrive files.', category: 'Files' },
  { scope: 'Files.ReadWrite', description: 'Read and write your OneDrive files.', category: 'Files' },
  { scope: 'Files.ReadWrite.All', description: 'Read and write all files you can access.', category: 'Files' },
  { scope: 'Sites.Read.All', description: 'Read items in all site collections.', category: 'SharePoint' },
  { scope: 'Sites.ReadWrite.All', description: 'Read and write items in all site collections.', category: 'SharePoint' },
  { scope: 'Tasks.ReadWrite', description: 'Create, read, update and delete your tasks and task lists.', category: 'Tasks' },
  { scope: 'Contacts.Read', description: 'Read your contacts.', category: 'Contacts' },
  { scope: 'Contacts.ReadWrite', description: 'Read and write your contacts.', category: 'Contacts' },
];

/* ── Notion ─────────────────────────────────────────────────────────────── */

const NOTION_SCOPES: ScopeEntry[] = [
  {
    scope: 'workspace',
    description:
      'Notion does not use scope strings — access is granted per-page by your workspace owner. To change which pages this credential can see, re-authorise.',
  },
];

/* ── Linear ─────────────────────────────────────────────────────────────── */

const LINEAR_SCOPES: ScopeEntry[] = [
  { scope: 'read', description: 'Read access to your Linear workspace data.', required: true, category: 'Access' },
  { scope: 'write', description: 'Write access to create and modify issues, projects, and comments.', category: 'Access' },
  { scope: 'issues:create', description: 'Create issues in your Linear workspace.', category: 'Access' },
  { scope: 'admin', description: 'Full admin access to your Linear workspace.', category: 'Access' },
];

/* ── Registry ───────────────────────────────────────────────────────────── */

const CATALOG: Record<ScopeCatalogProvider, ScopeEntry[]> = {
  google: GOOGLE_SCOPES,
  github: GITHUB_SCOPES,
  slack: SLACK_SCOPES,
  microsoft: MICROSOFT_SCOPES,
  notion: NOTION_SCOPES,
  linear: LINEAR_SCOPES,
};

export const KNOWN_PROVIDERS: ReadonlyArray<ScopeCatalogProvider> = [
  'google',
  'github',
  'slack',
  'microsoft',
  'notion',
  'linear',
];

export function isKnownProvider(value: string): value is ScopeCatalogProvider {
  return (KNOWN_PROVIDERS as ReadonlyArray<string>).includes(value);
}

export function getScopeCatalog(provider: string): ScopeEntry[] {
  if (!isKnownProvider(provider)) return [];
  return CATALOG[provider];
}

/**
 * Look up the description for a single scope.  Falls back to a lenient
 * "short form" lookup (last URL segment) so Google's long-form URLs match the
 * short keys we use in the catalogue.  Returns an empty string when nothing
 * is known.
 */
export function describeScope(provider: string, scope: string): string {
  if (!isKnownProvider(provider)) return '';
  const entries = CATALOG[provider];
  const direct = entries.find((e) => e.scope === scope);
  if (direct) return direct.description;
  const shortKey = scope.includes('/') ? scope.split('/').pop()! : scope;
  const shortMatch = entries.find((e) => e.scope === shortKey);
  return shortMatch?.description ?? '';
}

/** Provider-aware label for the connections UI. */
export const PROVIDER_LABEL: Record<ScopeCatalogProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  slack: 'Slack',
  microsoft: 'Microsoft',
  notion: 'Notion',
  linear: 'Linear',
};
