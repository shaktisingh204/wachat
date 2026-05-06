'use server';

/**
 * Unified entity lookup action for the cross-feature picker.
 *
 * One server action — `lookupEntity(entity, params)` — backs every
 * `<EntityPicker>` instance in the app. It resolves the registered
 * entity config, runs a tenant-scoped Mongo query, projects each doc
 * through the entity's `toChip`, and returns the standard envelope
 * declared in `src/lib/lookup-registry.ts`.
 *
 * Tenant scope: every query is filtered by `userId = session.user._id`
 * — that's the existing tenant key in this repo (see `crm-vendors`,
 * `crm-products`, etc.). When a project-scoped key arrives later we can
 * branch on `params.scope`.
 *
 * TODO(perf): add Mongo text indexes for the `searchableFields` of each
 * entity once we observe the query patterns at scale. Right now we use
 * `$regex` with `$options: 'i'` so any prefix/substring works without
 * an index — fine for the typical "few hundred rows" tenant.
 *
 * TODO(redis): server-side recents (`userPrefs.recent.<entity>`) belong
 * here too. v1 stores them in localStorage on the client.
 */

import { Filter, Document, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  type EntityKey,
  type EntityLookupConfig,
  type LookupChip,
  type LookupItem,
  type LookupParams,
  type LookupResult,
  type LookupRegistry,
  LOOKUP_DEFAULT_LIMIT,
  LOOKUP_MAX_LIMIT,
} from '@/lib/lookup-registry';

interface LookupContext {
  userId: ObjectId;
  scope: 'project' | 'tenant' | 'global';
}

/**
 * Pull session and translate it into the small context object the
 * registry needs. Returns `null` if no authenticated user is found —
 * the caller must short-circuit with an empty result.
 */
async function getLookupContext(scope?: LookupParams['scope']): Promise<LookupContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return {
    userId: new ObjectId(session.user._id),
    scope: scope ?? 'tenant',
  };
}

/** Clamp + sanitize page/limit. */
function paginate(params: LookupParams): { page: number; limit: number; skip: number } {
  const limit = Math.min(Math.max(1, params.limit ?? LOOKUP_DEFAULT_LIMIT), LOOKUP_MAX_LIMIT);
  const page = Math.max(1, params.page ?? 1);
  return { page, limit, skip: (page - 1) * limit };
}

/** Build a case-insensitive `$or` matcher across the entity's searchable fields. */
function textMatch(fields: string[], q: string | undefined): Filter<Document> | null {
  if (!q || q.trim().length === 0) return null;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = { $regex: escaped, $options: 'i' as const };
  return { $or: fields.map(f => ({ [f]: rx })) } as Filter<Document>;
}

/** Coerce a hydrate-by-ids list into ObjectIds, dropping junk. */
function toObjectIds(ids: string[] | undefined): ObjectId[] | null {
  if (!ids || ids.length === 0) return null;
  const valid = ids
    .filter(id => typeof id === 'string' && ObjectId.isValid(id))
    .map(id => new ObjectId(id));
  return valid.length > 0 ? valid : null;
}

/**
 * Generic Mongo runner used by most entries. Each entity provides the
 * collection name, a chip projection, an (optional) default filter, and
 * the searchable field list — and gets pagination, hydrate-by-ids,
 * tenant scoping, and serialization for free.
 */
function makeMongoLookup(opts: {
  collection: string;
  searchableFields: string[];
  toChip: (doc: any) => LookupChip;
  defaultFilter?: () => Record<string, unknown>;
  /** Optional sort. Defaults to `{ updatedAt: -1, _id: -1 }`. */
  sort?: Record<string, 1 | -1>;
  /** Pluck only the fields you need. Defaults to entire document. */
  projection?: Record<string, 0 | 1>;
  /** Optional fields to copy out of the doc into `LookupItem.raw`. */
  rawFields?: string[];
}): EntityLookupConfig {
  const sort = opts.sort ?? { updatedAt: -1, _id: -1 };

  return {
    searchableFields: opts.searchableFields,
    defaultFilter: opts.defaultFilter,
    toChip: opts.toChip,
    async fetch(params: LookupParams, ctx: unknown): Promise<LookupResult> {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }

      const { db } = await connectToDatabase();
      const { page, limit, skip } = paginate(params);

      const tenantFilter: Filter<Document> = { userId: context.userId };
      const defaults = opts.defaultFilter ? opts.defaultFilter() : {};

      // Hydrate-by-ids takes precedence — bypass search/pagination so
      // chips can re-render even if the matching docs would otherwise
      // be filtered out by `defaultFilter`.
      const hydrateIds = toObjectIds(params.ids);
      if (hydrateIds) {
        const docs = await db.collection(opts.collection)
          .find({ ...tenantFilter, _id: { $in: hydrateIds } } as Filter<Document>,
            opts.projection ? { projection: opts.projection } : undefined)
          .toArray();
        const items = docs.map(doc => projectItem(doc, opts.toChip, opts.rawFields));
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }

      const text = textMatch(opts.searchableFields, params.q);
      const filter: Filter<Document> = {
        ...tenantFilter,
        ...defaults,
        ...(params.filter ?? {}),
        ...(text ?? {}),
      };

      const cursor = db.collection(opts.collection).find(filter,
        opts.projection ? { projection: opts.projection } : undefined)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const [docs, total] = await Promise.all([
        cursor.toArray(),
        db.collection(opts.collection).countDocuments(filter),
      ]);

      const items = docs.map(doc => projectItem(doc, opts.toChip, opts.rawFields));
      return {
        items,
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      };
    },
  };
}

function projectItem(doc: any, toChip: (d: any) => LookupChip, rawFields?: string[]): LookupItem {
  const id = (doc._id as ObjectId).toString();
  const chip = toChip(doc);
  let raw: Record<string, unknown> | undefined;
  if (rawFields && rawFields.length > 0) {
    raw = {};
    for (const f of rawFields) {
      if (doc[f] !== undefined) {
        raw[f] = JSON.parse(JSON.stringify(doc[f]));
      }
    }
  }
  return { id, chip, raw };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const registry: LookupRegistry = {
  client: makeMongoLookup({
    collection: 'crm_accounts',
    // CRM account = client/company record. Searchable across the most
    // common identifiers a salesperson would type.
    searchableFields: ['name', 'industry', 'website', 'phone', 'gstin', 'pan', 'city', 'state'],
    defaultFilter: () => ({ status: { $ne: 'archived' } }),
    rawFields: ['name', 'gstin', 'pan', 'phone', 'address', 'city', 'state', 'country', 'pincode',
                'billingAddress', 'shippingAddress', 'currency', 'paymentTerms', 'logoUrl'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      secondary: doc.gstin || doc.industry || undefined,
      tertiary: doc.city || doc.country || undefined,
      avatarUrl: doc.logoUrl || undefined,
    }),
  }),

  vendor: makeMongoLookup({
    collection: 'crm_vendors',
    searchableFields: ['name', 'displayName', 'gstin', 'pan', 'email', 'phone', 'city'],
    rawFields: ['name', 'displayName', 'gstin', 'pan', 'email', 'phone', 'city', 'state', 'country',
                'pincode', 'street', 'logoUrl', 'bankAccountDetails'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.displayName || doc.name || 'Unnamed',
      secondary: doc.gstin || doc.email || undefined,
      tertiary: doc.city || doc.country || undefined,
      avatarUrl: doc.logoUrl || undefined,
    }),
  }),

  item: makeMongoLookup({
    collection: 'crm_products',
    searchableFields: ['name', 'sku', 'hsnSac', 'description'],
    rawFields: ['name', 'sku', 'sellingPrice', 'costPrice', 'currency', 'taxRate', 'hsnSac',
                'itemType', 'totalStock', 'images'],
    sort: { name: 1 },
    toChip: (doc) => {
      const img = Array.isArray(doc.images) && doc.images.length > 0 ? doc.images[0] : undefined;
      const price = typeof doc.sellingPrice === 'number'
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR' }).format(doc.sellingPrice)
        : undefined;
      return {
        primary: doc.name || 'Unnamed',
        secondary: doc.sku || undefined,
        tertiary: price,
        avatarUrl: img,
      };
    },
  }),

  employee: {
    // Employees need a $lookup for department/designation names — so
    // we don't reuse `makeMongoLookup`. Same shape, just an aggregation.
    searchableFields: ['firstName', 'lastName', 'email', 'employeeId', 'phone'],
    toChip: (doc) => ({
      primary: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.email || 'Unnamed',
      secondary: doc.designationName || undefined,
      tertiary: doc.departmentName || undefined,
      avatarUrl: doc.avatarUrl || undefined,
    }),
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const { page, limit, skip } = paginate(params);

      const matchStage: Record<string, unknown> = { userId: context.userId };

      const hydrateIds = toObjectIds(params.ids);
      if (hydrateIds) matchStage._id = { $in: hydrateIds };

      const text = textMatch(this.searchableFields, params.q);
      if (text) Object.assign(matchStage, text);

      if (params.filter) Object.assign(matchStage, params.filter);

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'crm_departments',
            localField: 'departmentId',
            foreignField: '_id',
            as: '_dept',
          },
        },
        { $unwind: { path: '$_dept', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'crm_designations',
            localField: 'designationId',
            foreignField: '_id',
            as: '_desig',
          },
        },
        { $unwind: { path: '$_desig', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            departmentName: '$_dept.name',
            designationName: '$_desig.name',
          },
        },
        { $project: { _dept: 0, _desig: 0 } },
        { $sort: { firstName: 1, lastName: 1 } },
      ];

      const [docs, total] = await Promise.all([
        hydrateIds
          ? db.collection('crm_employees').aggregate(pipeline).toArray()
          : db.collection('crm_employees').aggregate([...pipeline, { $skip: skip }, { $limit: limit }]).toArray(),
        db.collection('crm_employees').countDocuments(matchStage as Filter<Document>),
      ]);

      const rawFields = ['firstName', 'lastName', 'email', 'phone', 'employeeId',
                         'departmentId', 'designationId', 'departmentName', 'designationName'];
      const items = docs.map(doc => projectItem(doc, this.toChip, rawFields));

      if (hydrateIds) {
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }
      return { items, page, limit, total, hasMore: skip + items.length < total };
    },
  },

  user: {
    // Users live on the global `users` collection. We scope by the
    // current user's tenant — for now that's "users with the same
    // active project / direct collaborators". Until that join exists,
    // we restrict to the current user only so we don't leak the table
    // contents across tenants. TODO(rbac): widen to team members once
    // the workspace model is wired up.
    searchableFields: ['name', 'email'],
    toChip: (doc) => ({
      primary: doc.name || doc.email || 'User',
      secondary: doc.email || undefined,
      avatarUrl: doc.image || undefined,
    }),
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const { page, limit, skip } = paginate(params);

      const hydrateIds = toObjectIds(params.ids);

      // For now: include the current user + (if any) explicit ids to
      // hydrate. Cross-tenant user search isn't safe without a workspace
      // membership table.
      const baseFilter: Filter<Document> = hydrateIds
        ? { _id: { $in: hydrateIds } }
        : { _id: context.userId };

      const text = textMatch(this.searchableFields, params.q);
      const filter: Filter<Document> = text ? { ...baseFilter, ...text } as Filter<Document> : baseFilter;

      const projection = { name: 1, email: 1, image: 1 };

      const [docs, total] = await Promise.all([
        hydrateIds
          ? db.collection('users').find(filter, { projection }).toArray()
          : db.collection('users').find(filter, { projection }).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
        db.collection('users').countDocuments(filter),
      ]);

      const items = docs.map(doc => projectItem(doc, this.toChip, ['name', 'email', 'image']));
      if (hydrateIds) {
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }
      return { items, page, limit, total, hasMore: skip + items.length < total };
    },
  },

  account: {
    // Chart of accounts — needs a join to the account-group collection
    // for the "nature" tertiary line. Mirrors `getCrmChartOfAccounts`.
    searchableFields: ['name', 'description'],
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      secondary: doc.accountGroupName || undefined,
      tertiary: doc.accountGroupCategory || doc.accountGroupType || undefined,
    }),
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const { page, limit, skip } = paginate(params);

      const matchStage: Record<string, unknown> = { userId: context.userId };
      const hydrateIds = toObjectIds(params.ids);
      if (hydrateIds) matchStage._id = { $in: hydrateIds };

      const text = textMatch(this.searchableFields, params.q);
      if (text) Object.assign(matchStage, text);
      if (params.filter) Object.assign(matchStage, params.filter);

      const pipeline: any[] = [
        { $match: matchStage },
        { $sort: { name: 1 } },
        {
          $lookup: {
            from: 'crm_account_groups',
            localField: 'accountGroupId',
            foreignField: '_id',
            as: '_grp',
          },
        },
        { $unwind: { path: '$_grp', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            accountGroupName: '$_grp.name',
            accountGroupCategory: '$_grp.category',
            accountGroupType: '$_grp.type',
          },
        },
        { $project: { _grp: 0 } },
      ];

      const [docs, total] = await Promise.all([
        hydrateIds
          ? db.collection('crm_chart_of_accounts').aggregate(pipeline).toArray()
          : db.collection('crm_chart_of_accounts').aggregate([...pipeline, { $skip: skip }, { $limit: limit }]).toArray(),
        db.collection('crm_chart_of_accounts').countDocuments(matchStage as Filter<Document>),
      ]);

      const items = docs.map(doc => projectItem(doc, this.toChip,
        ['name', 'accountGroupName', 'accountGroupCategory', 'accountGroupType', 'currency', 'balanceType']));
      if (hydrateIds) {
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }
      return { items, page, limit, total, hasMore: skip + items.length < total };
    },
  },

  warehouse: makeMongoLookup({
    collection: 'crm_warehouses',
    searchableFields: ['name', 'address', 'city', 'state', 'pincode'],
    rawFields: ['name', 'address', 'city', 'state', 'country', 'pincode', 'managerName', 'isDefault'],
    sort: { isDefault: -1, name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      // No "code" in this schema yet, so fall back to manager name.
      secondary: doc.managerName || undefined,
      tertiary: doc.city || doc.state || undefined,
    }),
  }),

  bankAccount: makeMongoLookup({
    collection: 'crm_payment_accounts',
    searchableFields: ['accountName', 'bankDetails.bankName', 'bankDetails.accountNumber', 'bankDetails.ifsc'],
    defaultFilter: () => ({ status: 'active' }),
    rawFields: ['accountName', 'accountType', 'currency', 'bankDetails', 'isDefault'],
    sort: { isDefault: -1, accountName: 1 },
    toChip: (doc) => {
      const last4 = doc?.bankDetails?.accountNumber
        ? String(doc.bankDetails.accountNumber).slice(-4)
        : undefined;
      return {
        primary: doc.accountName || 'Account',
        secondary: doc?.bankDetails?.bankName || doc.accountType || undefined,
        tertiary: last4 ? `••••${last4}` : (doc.currency || undefined),
      };
    },
  }),
};

/* ------------------------------------------------------------------ */
/* Public action                                                       */
/* ------------------------------------------------------------------ */

const EMPTY_RESULT: LookupResult = { items: [], page: 1, limit: LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };

/**
 * The single entry point used by the picker. Returns an empty (but
 * structurally valid) result if the user is unauthenticated, the entity
 * key is unknown, or anything throws — never `null`/`undefined` so the
 * client can render without branching.
 */
export async function lookupEntity(
  entity: EntityKey,
  params: LookupParams = {},
): Promise<LookupResult> {
  try {
    const config = registry[entity];
    if (!config) {
      console.warn(`[lookupEntity] unknown entity key: ${entity}`);
      return EMPTY_RESULT;
    }

    const ctx = await getLookupContext(params.scope);
    if (!ctx) return EMPTY_RESULT;

    return await config.fetch(params, ctx);
  } catch (err) {
    console.error(`[lookupEntity] ${entity} failed:`, err);
    return EMPTY_RESULT;
  }
}
