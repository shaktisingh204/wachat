/**
 * Chrome MV3 manifest builder for the SabNode browser extension.
 *
 * Returns a plain JSON object so callers can serialise it however they
 * need (write to disk, return from an API, etc.).
 */

export interface ExtensionManifestOptions {
  /** Extension display name. */
  name?: string;
  /** Semver-style version string ("1.0.0"). */
  version?: string;
  /** Short description shown in the Chrome Web Store. */
  description?: string;
  /** Origins the content script and host_permissions should match. */
  hostPermissions?: string[];
  /** Optional default popup HTML page (relative to the extension root). */
  defaultPopup?: string;
}

/** Strict-typed subset of the MV3 manifest fields we actually use. */
export interface ChromeMv3Manifest {
  manifest_version: 3;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  background: { service_worker: string; type: 'module' };
  action: { default_title: string; default_popup?: string };
  content_scripts: Array<{
    matches: string[];
    js: string[];
    run_at: 'document_idle' | 'document_start' | 'document_end';
  }>;
  icons: Record<string, string>;
}

/**
 * Build a Chrome MV3 manifest for the SabNode browser extension.
 *
 * @example
 *   buildExtensionManifest({ hostPermissions: ['https://app.sabnode.com/*'] });
 */
export function buildExtensionManifest(
  options: ExtensionManifestOptions = {},
): ChromeMv3Manifest {
  const hostPermissions =
    options.hostPermissions && options.hostPermissions.length
      ? options.hostPermissions
      : ['https://app.sabnode.com/*', 'https://*.sabnode.com/*'];

  return {
    manifest_version: 3,
    name: options.name ?? 'SabNode Companion',
    version: options.version ?? '1.0.0',
    description:
      options.description ??
      'Quick access to your SabNode workspace, broadcasts, and CRM from any tab.',
    permissions: ['storage', 'tabs', 'notifications', 'scripting'],
    host_permissions: hostPermissions,
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    action: {
      default_title: 'SabNode',
      default_popup: options.defaultPopup,
    },
    content_scripts: [
      {
        matches: hostPermissions,
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  };
}
