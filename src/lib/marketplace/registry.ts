/**
 * Marketplace registry — Mongo-backed CRUD for apps + manifest validation.
 */

import 'server-only';
import { ObjectId, type Collection, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { isKnownScope } from './permissions';
import type {
  App,
  AppListFilter,
  AppManifest,
  AppPricing,
  AppPricingType,
  AppPublisher,
  AppUiExtension,
} from './types';

// Mongo doc shape — same as App but with ObjectId in `_id`.
interface AppDoc extends Omit<App, '_id'> {
  _id: ObjectId;
}

// ── Collection accessors ─────────────────────────────────────────────────────

export async function getMarketplaceCollection(): Promise<Collection<AppDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<AppDoc>('marketplace_apps');
  // Ensure unique index on appId. Idempotent — Mongo no-ops if it exists.
  try {
    await col.createIndex({ appId: 1 }, { unique: true });
    await col.createIndex({ status: 1, 'manifest.categories': 1 });
  } catch {
    /* ignore — index already present */
  }
  return col;
}

// ── Manifest validation ──────────────────────────────────────────────────────

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

const PRICING_TYPES: AppPricingType[] = ['free', 'one-time', 'subscription', 'usage'];

export interface ManifestValidationError {
  path: string;
  message: string;
}

export interface ManifestValidationResult {
  ok: boolean;
  manifest?: AppManifest;
  errors: ManifestValidationError[];
}

/**
 * Parses + structurally validates a submitted manifest. Returns a typed
 * manifest on success, or a list of field-level errors on failure.
 */
export function validateManifest(json: unknown): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  const push = (path: string, message: string) => errors.push({ path, message });

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, errors: [{ path: '', message: 'Manifest must be a JSON object' }] };
  }
  const m = json as Record<string, unknown>;

  // id
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) {
    push('id', 'Required: lowercase, 2–64 chars, [a-z0-9_-]');
  }
  // name
  if (typeof m.name !== 'string' || m.name.trim().length === 0) {
    push('name', 'Required non-empty string');
  }
  // version
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    push('version', 'Required semver (e.g. "1.0.0")');
  }
  // scopes
  let scopes: string[] = [];
  if (!Array.isArray(m.scopes)) {
    push('scopes', 'Required array of strings');
  } else {
    scopes = m.scopes.filter((s): s is string => typeof s === 'string');
    if (scopes.length !== m.scopes.length) {
      push('scopes', 'All scopes must be strings');
    }
    for (const s of scopes) {
      if (!isKnownScope(s)) push('scopes', `Unknown scope: ${s}`);
    }
  }
  // urls
  for (const k of ['oauth_callback_url', 'install_callback_url', 'uninstall_callback_url']) {
    const v = m[k];
    if (typeof v !== 'string' || !URL_RE.test(v)) {
      push(k, 'Required absolute http(s) URL');
    }
  }
  // ui_extensions
  let uiExtensions: AppUiExtension[] = [];
  if (m.ui_extensions !== undefined) {
    if (!Array.isArray(m.ui_extensions)) {
      push('ui_extensions', 'Must be an array');
    } else {
      uiExtensions = m.ui_extensions.map((raw, i) => {
        if (!raw || typeof raw !== 'object') {
          push(`ui_extensions[${i}]`, 'Must be an object');
          return { id: '', slot: '', url: '' };
        }
        const ext = raw as Record<string, unknown>;
        if (typeof ext.id !== 'string') push(`ui_extensions[${i}].id`, 'Required string');
        if (typeof ext.slot !== 'string') push(`ui_extensions[${i}].slot`, 'Required string');
        if (typeof ext.url !== 'string' || !URL_RE.test(ext.url as string)) {
          push(`ui_extensions[${i}].url`, 'Required absolute http(s) URL');
        }
        return {
          id: typeof ext.id === 'string' ? ext.id : '',
          slot: typeof ext.slot === 'string' ? ext.slot : '',
          url: typeof ext.url === 'string' ? ext.url : '',
          label: typeof ext.label === 'string' ? ext.label : undefined,
        };
      });
    }
  }
  // pricing
  let pricing: AppPricing = { type: 'free' };
  if (!m.pricing || typeof m.pricing !== 'object') {
    push('pricing', 'Required object');
  } else {
    const p = m.pricing as Record<string, unknown>;
    if (!PRICING_TYPES.includes(p.type as AppPricingType)) {
      push('pricing.type', `Must be one of: ${PRICING_TYPES.join(', ')}`);
    } else {
      pricing = { type: p.type as AppPricingType };
      if (p.amount !== undefined) {
        if (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount < 0) {
          push('pricing.amount', 'Must be a non-negative number');
        } else {
          pricing.amount = p.amount;
        }
      }
      if (p.currency !== undefined) {
        if (typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency)) {
          push('pricing.currency', 'Must be a 3-letter uppercase ISO-4217 code');
        } else {
          pricing.currency = p.currency;
        }
      }
      if (pricing.amount !== undefined && !pricing.currency) {
        push('pricing.currency', 'Required when amount is set');
      }
    }
  }
  // categories
  let categories: string[] = [];
  if (!Array.isArray(m.categories)) {
    push('categories', 'Required array of strings');
  } else {
    categories = m.categories.filter((c): c is string => typeof c === 'string');
    if (categories.length !== m.categories.length) {
      push('categories', 'All categories must be strings');
    }
  }
  // publisher
  let publisher: AppPublisher = { name: '' };
  if (!m.publisher || typeof m.publisher !== 'object') {
    push('publisher', 'Required object');
  } else {
    const pb = m.publisher as Record<string, unknown>;
    if (typeof pb.name !== 'string' || pb.name.trim().length === 0) {
      push('publisher.name', 'Required non-empty string');
    } else {
      publisher = {
        name: pb.name.trim(),
        userId: typeof pb.userId === 'string' ? pb.userId : undefined,
        websiteUrl: typeof pb.websiteUrl === 'string' ? pb.websiteUrl : undefined,
        supportEmail: typeof pb.supportEmail === 'string' ? pb.supportEmail : undefined,
      };
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: AppManifest = {
    id: m.id as string,
    name: (m.name as string).trim(),
    version: m.version as string,
    scopes,
    oauth_callback_url: m.oauth_callback_url as string,
    install_callback_url: m.install_callback_url as string,
    uninstall_callback_url: m.uninstall_callback_url as string,
    ui_extensions: uiExtensions,
    pricing,
    categories,
    publisher,
    description: typeof m.description === 'string' ? m.description : undefined,
    iconUrl: typeof m.iconUrl === 'string' ? m.iconUrl : undefined,
    homepageUrl: typeof m.homepageUrl === 'string' ? m.homepageUrl : undefined,
  };

  return { ok: true, manifest, errors: [] };
}

// ── App CRUD ────────────────────────────────────────────────────────────────

export interface RegisterAppOptions {
  ownerId: string;
  /** When true, register as published; otherwise pending_review. */
  autoPublish?: boolean;
}

/**
 * Persists a new (or updated) app entry from a manifest. If an app with the
 * same `manifest.id` already exists, the manifest is replaced and the
 * publishedManifest pointer is updated when `autoPublish` is set.
 */
export async function registerApp(
  manifest: AppManifest,
  opts: RegisterAppOptions,
): Promise<App> {
  const validation = validateManifest(manifest);
  if (!validation.ok || !validation.manifest) {
    const msg = validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid manifest: ${msg}`);
  }
  const validated = validation.manifest;
  const col = await getMarketplaceCollection();
  const now = new Date();
  const status = opts.autoPublish ? 'published' : 'pending_review';

  const existing = await col.findOne({ appId: validated.id });
  if (existing) {
    const update: Partial<AppDoc> = {
      manifest: validated,
      status,
      ownerId: opts.ownerId,
      updatedAt: now,
    };
    if (opts.autoPublish) {
      update.publishedManifest = validated;
    }
    await col.updateOne({ _id: existing._id }, { $set: update });
    const next = await col.findOne({ _id: existing._id });
    return docToApp(next!);
  }

  const doc: AppDoc = {
    _id: new ObjectId(),
    appId: validated.id,
    manifest: validated,
    status,
    ownerId: opts.ownerId,
    installCount: 0,
    averageRating: null,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
    publishedManifest: opts.autoPublish ? validated : undefined,
  };
  await col.insertOne(doc);
  return docToApp(doc);
}

/**
 * Lists apps, defaulting to published-only for public catalogue use.
 */
export async function listApps(filter: AppListFilter = {}): Promise<{
  apps: App[];
  total: number;
  page: number;
  limit: number;
}> {
  const col = await getMarketplaceCollection();
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 24));

  const mongo: Filter<AppDoc> = {};
  mongo.status = filter.status ?? 'published';
  if (filter.category) mongo['manifest.categories'] = filter.category;
  if (filter.ownerId) mongo.ownerId = filter.ownerId;
  if (filter.pricingType) mongo['manifest.pricing.type'] = filter.pricingType;
  if (filter.q) {
    const re = new RegExp(escapeRegex(filter.q), 'i');
    mongo.$or = [
      { 'manifest.name': re },
      { 'manifest.description': re },
      { 'manifest.categories': re },
      { appId: re },
    ];
  }

  const [docs, total] = await Promise.all([
    col
      .find(mongo)
      .sort({ installCount: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    col.countDocuments(mongo),
  ]);

  return { apps: docs.map(docToApp), total, page, limit };
}

/**
 * Fetch a single app by `manifest.id`. Returns null when missing.
 */
export async function getApp(id: string): Promise<App | null> {
  if (!id) return null;
  const col = await getMarketplaceCollection();
  const doc = await col.findOne({ appId: id });
  return doc ? docToApp(doc) : null;
}

// ── helpers ────────────────────────────────────────────────────────────────

function docToApp(doc: AppDoc): App {
  return {
    _id: doc._id.toString(),
    appId: doc.appId,
    manifest: doc.manifest,
    status: doc.status,
    ownerId: doc.ownerId,
    installCount: doc.installCount,
    averageRating: doc.averageRating,
    reviewCount: doc.reviewCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedManifest: doc.publishedManifest,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
