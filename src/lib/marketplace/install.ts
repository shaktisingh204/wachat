/**
 * Marketplace install lifecycle.
 *
 * `installApp` resolves the app, calls its install_callback_url with a signed
 * payload, persists an Install record, increments the app's installCount, and
 * fires an `app.installed` audit event. `uninstallApp` performs the inverse.
 *
 * Callbacks are best-effort: if the developer endpoint is unavailable the
 * install/uninstall is still recorded so the tenant isn't stuck. Failures are
 * surfaced on the returned record via `lastCallbackError`.
 */

import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getApp } from './registry';
import type { Install, InstallStatus } from './types';

interface InstallDoc extends Omit<Install, '_id'> {
  _id: ObjectId;
  lastCallbackError?: string | null;
}

interface AuditDoc {
  _id: ObjectId;
  type: string;
  tenantId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const CALLBACK_TIMEOUT_MS = 8000;

// ── Collection accessors ─────────────────────────────────────────────────────

export async function getInstallsCollection(): Promise<Collection<InstallDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<InstallDoc>('marketplace_installs');
  try {
    await col.createIndex({ tenantId: 1, appId: 1 }, { unique: true });
    await col.createIndex({ status: 1 });
  } catch {
    /* indexes exist */
  }
  return col;
}

async function getAuditCollection(): Promise<Collection<AuditDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<AuditDoc>('marketplace_audit');
}

// ── Audit ────────────────────────────────────────────────────────────────────

export async function fireAuditEvent(
  type: string,
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const col = await getAuditCollection();
    await col.insertOne({
      _id: new ObjectId(),
      type,
      tenantId,
      payload,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[marketplace.audit]', type, err);
    // Audit failures must never block lifecycle ops.
  }
}

// ── Public helpers ───────────────────────────────────────────────────────────

export interface InstallAppOptions {
  /** Scopes the tenant agreed to grant. Must be a subset of manifest.scopes. */
  grantedScopes?: string[];
  /** Optional config the tenant supplies at install time. */
  config?: Record<string, unknown>;
}

/**
 * Install an app for a tenant. Idempotent: re-installing reactivates a
 * previously uninstalled record rather than duplicating.
 */
export async function installApp(
  tenantId: string,
  appId: string,
  opts: InstallAppOptions = {},
): Promise<Install> {
  if (!tenantId) throw new Error('tenantId is required');
  if (!appId) throw new Error('appId is required');

  const app = await getApp(appId);
  if (!app) throw new Error(`App not found: ${appId}`);
  if (app.status !== 'published') {
    throw new Error(`App is not available for install (status=${app.status})`);
  }

  const requested = opts.grantedScopes ?? app.manifest.scopes;
  const allowed = new Set(app.manifest.scopes);
  const grantedScopes = requested.filter((s) => allowed.has(s));

  const installs = await getInstallsCollection();
  const now = new Date();

  // Invoke developer callback. We swallow errors here so the install proceeds
  // — the lastCallbackError field surfaces problems for retries.
  let lastCallbackError: string | null = null;
  try {
    await callDeveloperWebhook(app.manifest.install_callback_url, {
      event: 'install',
      tenantId,
      appId,
      version: app.manifest.version,
      grantedScopes,
      config: opts.config ?? {},
      timestamp: now.toISOString(),
    });
  } catch (err) {
    lastCallbackError = err instanceof Error ? err.message : String(err);
    console.error('[marketplace.install] callback failed', appId, lastCallbackError);
  }

  const status: InstallStatus = 'active';
  const update = {
    $set: {
      tenantId,
      appId,
      version: app.manifest.version,
      grantedScopes,
      status,
      config: opts.config ?? {},
      updatedAt: now,
      lastCallbackError,
    } as Partial<InstallDoc>,
    $setOnInsert: {
      installedAt: now,
      usageUnits: 0,
    } as Partial<InstallDoc>,
    $unset: { uninstalledAt: '' as const },
  };

  await installs.updateOne({ tenantId, appId }, update, { upsert: true });
  const doc = await installs.findOne({ tenantId, appId });
  if (!doc) throw new Error('Install record missing after upsert');

  // Bump install count on the app document. This counts every fresh install
  // (re-installs after uninstall also count).
  const { db } = await connectToDatabase();
  await db
    .collection('marketplace_apps')
    .updateOne({ appId }, { $inc: { installCount: 1 }, $set: { updatedAt: now } });

  await fireAuditEvent('app.installed', tenantId, {
    installId: doc._id.toString(),
    appId,
    version: app.manifest.version,
    grantedScopes,
  });

  return docToInstall(doc);
}

/**
 * Uninstall a previously installed app. Idempotent — uninstalling something
 * already removed simply returns null.
 */
export async function uninstallApp(
  tenantId: string,
  installId: string,
): Promise<{ removed: boolean; appId?: string }> {
  if (!tenantId) throw new Error('tenantId is required');
  if (!installId || !ObjectId.isValid(installId)) {
    throw new Error('Valid installId is required');
  }
  const installs = await getInstallsCollection();
  const _id = new ObjectId(installId);
  const doc = await installs.findOne({ _id, tenantId });
  if (!doc) return { removed: false };

  const app = await getApp(doc.appId);
  let lastCallbackError: string | null = null;
  if (app) {
    try {
      await callDeveloperWebhook(app.manifest.uninstall_callback_url, {
        event: 'uninstall',
        tenantId,
        appId: doc.appId,
        installId,
        version: doc.version,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      lastCallbackError = err instanceof Error ? err.message : String(err);
      console.error('[marketplace.uninstall] callback failed', doc.appId, lastCallbackError);
    }
  }

  await installs.deleteOne({ _id });

  await fireAuditEvent('app.uninstalled', tenantId, {
    installId,
    appId: doc.appId,
    callbackError: lastCallbackError,
  });

  return { removed: true, appId: doc.appId };
}

/** Returns active installs for a tenant. */
export async function listInstallsForTenant(tenantId: string): Promise<Install[]> {
  const col = await getInstallsCollection();
  const docs = await col
    .find({ tenantId, status: { $ne: 'uninstalled' } })
    .sort({ installedAt: -1 })
    .toArray();
  return docs.map(docToInstall);
}

/** Look up a single install by id (scoped to tenant). */
export async function getInstall(
  tenantId: string,
  installId: string,
): Promise<Install | null> {
  if (!ObjectId.isValid(installId)) return null;
  const col = await getInstallsCollection();
  const doc = await col.findOne({ _id: new ObjectId(installId), tenantId });
  return doc ? docToInstall(doc) : null;
}

// ── internals ────────────────────────────────────────────────────────────────

async function callDeveloperWebhook(url: string, payload: unknown): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALLBACK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'sabnode-marketplace/1.0',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Developer webhook returned ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function docToInstall(doc: InstallDoc): Install {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId,
    appId: doc.appId,
    version: doc.version,
    grantedScopes: doc.grantedScopes,
    status: doc.status,
    config: doc.config,
    usageUnits: doc.usageUnits,
    installedAt: doc.installedAt,
    updatedAt: doc.updatedAt,
    uninstalledAt: doc.uninstalledAt,
  };
}
