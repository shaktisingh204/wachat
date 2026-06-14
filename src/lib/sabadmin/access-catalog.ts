import {
  can,
  type EffectivePermissions,
  type EffectivePermissionMap,
  type ModulePermission,
  type PermissionAction,
} from '@/lib/rbac';

/**
 * SabAdmin access catalog — the bridge between "an app" and "the permission
 * keys that gate it". Selecting an app in the onboarding wizard / an Access
 * Package resolves to these keys; the grant is then clamped to whatever the
 * acting admin themselves holds (decision #3: you can never hand out access you
 * don't have). Owners are bounded only by their plan ceiling.
 *
 * The catalog intentionally covers the apps that have real permission keys
 * (registered in `permission-modules.ts`). Apps without per-feature keys are
 * reached through plain project membership and aren't listed here.
 */
export interface AppAccessEntry {
  /** Matches a `SAB_APPS` id where one exists (drives the dock surface). */
  appId: string;
  label: string;
  /** Permission keys that gate this app. */
  keys: string[];
}

export const APP_ACCESS_CATALOG: AppAccessEntry[] = [
  {
    appId: 'wachat',
    label: 'WaChat',
    keys: [
      'wachat_overview',
      'wachat_chat',
      'wachat_contacts',
      'wachat_campaigns',
      'wachat_templates',
      'wachat_flows',
      'wachat_settings',
    ],
  },
  { appId: 'sabcrm', label: 'SabCRM', keys: ['sabcrm:view', 'sabcrm:manage', 'sabcrm:admin'] },
  {
    appId: 'crm',
    label: 'CRM — Sales',
    keys: ['crm_dashboard', 'crm_leads', 'crm_deals', 'crm_tasks', 'crm_contact', 'crm_pipeline'],
  },
  {
    appId: 'hrm',
    label: 'HRM',
    keys: [
      'crm_employees',
      'crm_attendance',
      'crm_payroll',
      'crm_leave',
      'crm_department',
      'crm_designation',
    ],
  },
  {
    appId: 'email',
    label: 'Email / SabMail',
    keys: ['email_dashboard', 'email_inbox', 'email_campaigns', 'email_templates', 'email_settings'],
  },
  {
    appId: 'sabsms',
    label: 'SabSMS',
    keys: ['sabsms_overview', 'sabsms_inbox', 'sabsms_campaigns', 'sabsms_templates', 'sabsms_settings'],
  },
  { appId: 'sabchat', label: 'SabChat', keys: ['sabchat_inbox', 'sabchat_visitors', 'sabchat_settings'] },
  {
    appId: 'sabflow',
    label: 'SabFlow',
    keys: ['sabflow.workflow.read', 'sabflow.workflow.write', 'sabflow.workflow.execute'],
  },
  {
    appId: 'facebook',
    label: 'Meta — Facebook',
    keys: ['facebook_dashboard', 'facebook_posts', 'facebook_messages'],
  },
  {
    appId: 'instagram',
    label: 'Instagram',
    keys: ['instagram_dashboard', 'instagram_feed', 'instagram_messages'],
  },
  {
    appId: 'ad-manager',
    label: 'Ad Manager',
    keys: ['ad_manager_accounts', 'ad_manager_campaigns', 'ad_manager_audiences'],
  },
  { appId: 'team', label: 'Team', keys: ['team_users', 'team_roles', 'team_tasks', 'team_chat'] },
  { appId: 'url', label: 'URL Shortener', keys: ['url_shortener'] },
  { appId: 'qr', label: 'QR Code', keys: ['qr_code_maker'] },
  { appId: 'website-builder', label: 'SabSites', keys: ['website_builder'] },
  { appId: 'api', label: 'API & Dev', keys: ['api_keys', 'api_docs'] },
];

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

/** The actions the granter actually holds on a key (their grant ceiling). */
export function granterActionsFor(
  effective: EffectivePermissions,
  key: string,
): ModulePermission {
  const out: ModulePermission = {};
  if (effective.isOwner) {
    const cap = effective.planCeiling?.[key];
    for (const a of ACTIONS) out[a] = cap && a in cap ? Boolean(cap[a]) : true;
    return out;
  }
  const grant = effective.permissions?.[key];
  for (const a of ACTIONS) out[a] = Boolean(grant?.[a]);
  return out;
}

/** Whether the granter can grant ANY access to this app (has view on ≥1 key). */
export function canGrantApp(effective: EffectivePermissions, appId: string): boolean {
  const entry = APP_ACCESS_CATALOG.find((e) => e.appId === appId);
  if (!entry) return false;
  return entry.keys.some((k) => can(effective, k, 'view'));
}

/** The catalog apps the granter is allowed to hand out. */
export function grantableApps(effective: EffectivePermissions): AppAccessEntry[] {
  return APP_ACCESS_CATALOG.filter((e) => canGrantApp(effective, e.appId));
}

/**
 * Build the permission map for a set of apps, clamped to what the granter
 * holds. For every key of every selected app, the granted actions are exactly
 * the granter's own actions on that key — never more. Keys the granter can't
 * even view are dropped.
 */
export function buildPermissionMapForApps(
  appIds: string[],
  effective: EffectivePermissions,
): EffectivePermissionMap {
  const out: EffectivePermissionMap = {};
  const wanted = new Set(appIds);
  for (const entry of APP_ACCESS_CATALOG) {
    if (!wanted.has(entry.appId)) continue;
    for (const key of entry.keys) {
      const actions = granterActionsFor(effective, key);
      if (actions.view) out[key] = actions;
    }
  }
  return out;
}

/** Clamp an arbitrary requested permission map to the granter's ceiling. */
export function clampToGranter(
  requested: EffectivePermissionMap | undefined,
  effective: EffectivePermissions,
): EffectivePermissionMap {
  const out: EffectivePermissionMap = {};
  for (const [key, actions] of Object.entries(requested || {})) {
    const ceil = granterActionsFor(effective, key);
    const clamped: ModulePermission = {};
    for (const a of ACTIONS) clamped[a] = Boolean(actions?.[a]) && Boolean(ceil[a]);
    if (clamped.view || clamped.create || clamped.edit || clamped.delete) {
      out[key] = clamped;
    }
  }
  return out;
}

/** Merge two permission maps (OR of actions per key). */
export function mergePermissionMaps(
  a: EffectivePermissionMap,
  b: EffectivePermissionMap,
): EffectivePermissionMap {
  const out: EffectivePermissionMap = {};
  for (const map of [a, b]) {
    for (const [key, actions] of Object.entries(map || {})) {
      const cur = out[key] ?? {};
      for (const act of ACTIONS) {
        cur[act] = Boolean(cur[act]) || Boolean(actions?.[act]);
      }
      out[key] = cur;
    }
  }
  return out;
}

/** Which catalog apps a granted permission map covers (for the dock surface). */
export function appsFromPermissionMap(perms: EffectivePermissionMap): string[] {
  const out: string[] = [];
  for (const entry of APP_ACCESS_CATALOG) {
    if (entry.keys.some((k) => perms[k]?.view)) out.push(entry.appId);
  }
  return out;
}
