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
import { COUNTRIES } from '@/data/reference/countries';
import { STATES } from '@/data/reference/states';
import { CITIES } from '@/data/reference/cities';
import { LANGUAGES, SALUTATIONS, LEAD_SOURCES, JOB_TITLES } from '@/data/reference/misc';
import { resolveCrmEnum } from '@/data/reference/crm-enums';

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
/* Static lookup data (no DB)                                          */
/* ------------------------------------------------------------------ */

/**
 * Top 12 currencies. Kept inline so we don't need a `crm_currencies`
 * collection just to power a picker. If/when a tenant-scoped currency
 * table lands, swap this entry for a `makeMongoLookup` call.
 */
interface StaticCurrency { code: string; symbol: string; name: string }
const STATIC_CURRENCIES: StaticCurrency[] = [
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan' },
];

/**
 * Standard units of measure. Tenants pick from this canonical set when
 * creating products / line items. If/when tenant-configurable units land,
 * swap this entry for a `makeMongoLookup({ collection: 'crm_units', ... })`.
 */
const STATIC_UNITS: string[] = [
  'PCS', 'KG', 'G', 'L', 'ML', 'HRS', 'DAYS', 'BOX', 'PACK',
  'DOZEN', 'PAIR', 'ROLL', 'METER', 'FT', 'INCH', 'M2', 'M3', 'TON',
];

/**
 * Coarse industry classification — small, vetted enum so reports / filters
 * stay groupable. TODO(industry): promote to a tenant-overridable Mongo
 * collection (`crm_industries`) once admins ask to customize.
 */
const STATIC_INDUSTRIES: string[] = [
  'SaaS', 'E-commerce', 'Manufacturing', 'Retail', 'Healthcare',
  'Finance', 'Education', 'Real Estate', 'Hospitality', 'Transportation',
  'Construction', 'Agriculture', 'Media', 'Telecom', 'Other',
];

/** Vendor classification — used by purchase-order routing / GL mapping. */
const STATIC_VENDOR_TYPES: string[] = ['goods', 'services', 'both'];

/**
 * Apply free-text matching + paginate over a static array. Used by
 * `currency` and the (rare) static-fallback path for `taxRate` if
 * we ever want one.
 */
function staticPaginate<T>(
  list: T[],
  match: (item: T, q: string) => boolean,
  toItem: (item: T) => LookupItem,
  params: LookupParams,
  filterById?: (item: T, id: string) => boolean,
): LookupResult {
  const { page, limit, skip } = paginate(params);

  if (params.ids && params.ids.length > 0 && filterById) {
    const matched = list.filter(it => params.ids!.some(id => filterById(it, id)));
    const items = matched.map(toItem);
    return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
  }

  const q = params.q?.trim() ?? '';
  const filtered = q.length === 0 ? list : list.filter(it => match(it, q));
  const total = filtered.length;
  const slice = filtered.slice(skip, skip + limit);
  const items = slice.map(toItem);
  return { items, page, limit, total, hasMore: skip + items.length < total };
}

/** Empty-result helper for entities whose collection doesn't exist yet. */
function emptyLookupResult(params: LookupParams): LookupResult {
  return {
    items: [],
    page: Math.max(1, params.page ?? 1),
    limit: Math.min(Math.max(1, params.limit ?? LOOKUP_DEFAULT_LIMIT), LOOKUP_MAX_LIMIT),
    total: 0,
    hasMore: false,
  };
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

  invoice: makeMongoLookup({
    collection: 'crm_invoices',
    searchableFields: ['invoiceNo', 'customerName', 'reference'],
    rawFields: ['invoiceNo', 'customerName', 'customerId', 'issueDate', 'dueDate',
                'totals', 'status', 'currency'],
    sort: { issueDate: -1, createdAt: -1 },
    toChip: (doc) => {
      const totalRaw = doc?.totals?.total;
      const totalNum = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? NaN);
      const total = Number.isFinite(totalNum)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR', maximumFractionDigits: 0 }).format(totalNum)
        : undefined;
      return {
        primary: doc.invoiceNo || 'Invoice',
        secondary: doc.customerName || undefined,
        tertiary: total,
      };
    },
  }),

  quotation: makeMongoLookup({
    collection: 'crm_quotations',
    searchableFields: ['quotationNo', 'customerName', 'reference', 'title'],
    rawFields: ['quotationNo', 'title', 'customerName', 'customerId',
                'issueDate', 'validUntil', 'totals', 'status', 'currency'],
    sort: { issueDate: -1, createdAt: -1 },
    toChip: (doc) => {
      const totalRaw = doc?.totals?.total;
      const totalNum = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? NaN);
      const total = Number.isFinite(totalNum)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR', maximumFractionDigits: 0 }).format(totalNum)
        : undefined;
      return {
        primary: doc.quotationNo || doc.title || 'Quotation',
        secondary: doc.customerName || undefined,
        tertiary: total,
      };
    },
  }),

  deal: makeMongoLookup({
    collection: 'crm_deals',
    searchableFields: ['title'],
    rawFields: ['title', 'amount', 'currency', 'status', 'pipelineId', 'stageId', 'ownerId',
                'expectedClose', 'probabilityPct'],
    sort: { createdAt: -1 },
    toChip: (doc) => ({
      primary: doc.title || 'Deal',
      secondary: typeof doc.amount === 'number'
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR', maximumFractionDigits: 0 }).format(doc.amount)
        : undefined,
      tertiary: doc.status || undefined,
    }),
  }),

  lead: makeMongoLookup({
    collection: 'crm_leads',
    searchableFields: ['firstName', 'lastName', 'email', 'company', 'title', 'phone'],
    rawFields: ['firstName', 'lastName', 'email', 'phone', 'company', 'title',
                'estimatedValue', 'currency', 'industry'],
    sort: { createdAt: -1 },
    toChip: (doc) => ({
      primary: [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.email || 'Lead',
      secondary: doc.email || doc.phone || undefined,
      tertiary: doc.company || doc.title || undefined,
    }),
  }),

  contact: makeMongoLookup({
    collection: 'crm_contacts',
    searchableFields: ['name', 'email', 'phone', 'company'],
    rawFields: ['name', 'email', 'phone', 'company', 'jobTitle', 'avatarUrl'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || doc.email || 'Contact',
      secondary: doc.email || doc.phone || undefined,
      tertiary: doc.company || doc.jobTitle || undefined,
      avatarUrl: doc.avatarUrl || undefined,
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
                         'departmentId', 'designationId', 'departmentName', 'designationName', 'workState'];
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

  department: makeMongoLookup({
    collection: 'crm_departments',
    // `code` and `head` aren't currently part of CrmDepartment in
    // definitions.ts but extension shapes (WsDepartmentExt) and
    // future migrations may add them — keep them in the searchable
    // list and the chip projection so this entry "just works" once
    // the schema catches up.
    searchableFields: ['name', 'code'],
    rawFields: ['name', 'code', 'description', 'parentDepartmentId'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      secondary: doc.code || undefined,
      tertiary: doc?.head?.name || undefined,
    }),
  }),

  designation: {
    // Designation joins to its parent department for the tertiary
    // line, so we hand-roll the aggregation rather than reuse
    // `makeMongoLookup`.
    searchableFields: ['name', 'level'],
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      secondary: doc.level || undefined,
      tertiary: doc.departmentName || undefined,
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
        { $addFields: { departmentName: '$_dept.name' } },
        { $project: { _dept: 0 } },
        { $sort: { name: 1 } },
      ];

      const [docs, total] = await Promise.all([
        hydrateIds
          ? db.collection('crm_designations').aggregate(pipeline).toArray()
          : db.collection('crm_designations').aggregate([...pipeline, { $skip: skip }, { $limit: limit }]).toArray(),
        db.collection('crm_designations').countDocuments(matchStage as Filter<Document>),
      ]);

      const rawFields = ['name', 'level', 'departmentId', 'description', 'departmentName'];
      const items = docs.map(doc => projectItem(doc, this.toChip, rawFields));
      if (hydrateIds) {
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }
      return { items, page, limit, total, hasMore: skip + items.length < total };
    },
  },

  tag: makeMongoLookup({
    collection: 'crm_tags',
    searchableFields: ['name', 'description'],
    toChip: (doc) => ({ primary: doc.name || 'Tag', color: doc.color }),
    defaultFilter: () => ({ status: { $ne: 'archived' } }),
    rawFields: ['color', 'description', 'scope'],
    sort: { name: 1 },
  }),

  category: makeMongoLookup({
    // Confirmed: `crm_product_categories` is the canonical collection
    // (see `crm-inventory-settings.actions.ts`). There is no
    // `crm_categories` in this codebase. The current schema
    // (`CrmProductCategory`) doesn't have `code` or a parent ref but
    // we keep them in the searchable/chip projection so this entry
    // upgrades gracefully when those fields are added.
    collection: 'crm_product_categories',
    searchableFields: ['name', 'code'],
    rawFields: ['name', 'code', 'description', 'parentCategoryId', 'parentName'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Unnamed',
      secondary: doc.code || undefined,
      tertiary: doc.parentName || undefined,
    }),
  }),

  taxRate: {
    // Backed by Worksuite's `crm_taxes` collection (tenant-scoped via
    // `userId`, fields `tax_name` / `rate_percent`). If the tenant
    // hasn't created any tax rates yet, fall back to the standard
    // Indian GST slabs so the picker is never empty.
    // TODO(taxRate): consider seeding `crm_taxes` per-tenant on signup
    // so the static fallback can be removed.
    searchableFields: ['tax_name'],
    toChip: (doc) => {
      const rate = typeof doc.rate_percent === 'number' ? doc.rate_percent : Number(doc.rate_percent ?? 0);
      const ratePct = Number.isFinite(rate) ? `${rate}%` : '—';
      return {
        primary: ratePct,
        secondary: doc.tax_name || undefined,
      };
    },
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const { page, limit, skip } = paginate(params);

      const tenantFilter: Filter<Document> = { userId: context.userId };
      const hydrateIds = toObjectIds(params.ids);

      if (hydrateIds) {
        const docs = await db.collection('crm_taxes')
          .find({ ...tenantFilter, _id: { $in: hydrateIds } } as Filter<Document>).toArray();
        const items = docs.map(doc => projectItem(doc, this.toChip, ['tax_name', 'rate_percent', 'is_default']));
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }

      const text = textMatch(this.searchableFields, params.q);
      const filter: Filter<Document> = { ...tenantFilter, ...(params.filter ?? {}), ...(text ?? {}) };

      const [docs, total] = await Promise.all([
        db.collection('crm_taxes').find(filter).sort({ rate_percent: 1 }).skip(skip).limit(limit).toArray(),
        db.collection('crm_taxes').countDocuments(filter),
      ]);

      // Fallback: synthesize chips from the standard GST slabs when
      // the tenant has nothing in `crm_taxes` yet.
      if (total === 0 && !params.q) {
        const slabs = [0, 0.1, 0.25, 3, 5, 12, 18, 28];
        const items: LookupItem[] = slabs.map(rate => ({
          id: `static:gst:${rate}`,
          chip: { primary: `${rate}%`, secondary: 'GST' },
          raw: { tax_name: 'GST', rate_percent: rate, _static: true },
        }));
        return {
          items: items.slice(skip, skip + limit),
          page,
          limit,
          total: items.length,
          hasMore: skip + Math.min(items.length - skip, limit) < items.length,
        };
      }

      const rawFields = ['tax_name', 'rate_percent', 'is_default'];
      const items = docs.map(doc => projectItem(doc, this.toChip, rawFields));
      return { items, page, limit, total, hasMore: skip + items.length < total };
    },
  },

  currency: {
    // Static — see `STATIC_CURRENCIES` above. Tenant context is
    // ignored intentionally; currencies are global reference data.
    searchableFields: ['code', 'name'],
    toChip: (doc) => ({
      primary: doc.code,
      secondary: doc.symbol,
      tertiary: doc.name,
    }),
    async fetch(params) {
      return staticPaginate<StaticCurrency>(
        STATIC_CURRENCIES,
        (item, q) => {
          const needle = q.toLowerCase();
          return item.code.toLowerCase().includes(needle)
            || item.name.toLowerCase().includes(needle);
        },
        (item) => ({
          id: item.code,
          chip: { primary: item.code, secondary: item.symbol, tertiary: item.name },
          raw: { code: item.code, symbol: item.symbol, name: item.name },
        }),
        params,
        (item, id) => item.code === id,
      );
    },
  },

  pipeline: {
    // Pipelines are stored as an embedded array on the user document
    // (`users.crmPipelines`), NOT a standalone collection. Each entry
    // has a uuid `id` (string), `name`, and `stages: { id, name, chance }[]`.
    // We read the current user's array, filter in memory, and shape
    // chips. Since the data lives on the tenant's own user record,
    // tenant scoping is implicit.
    searchableFields: ['name'],
    toChip: (doc) => {
      const stageCount = Array.isArray(doc.stages) ? doc.stages.length : 0;
      return {
        primary: doc.name || 'Pipeline',
        secondary: stageCount > 0 ? `${stageCount} stage${stageCount === 1 ? '' : 's'}` : undefined,
        tertiary: doc.ownerName || undefined,
      };
    },
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const userDoc = await db.collection('users').findOne(
        { _id: context.userId },
        { projection: { crmPipelines: 1 } },
      );
      const all: any[] = Array.isArray(userDoc?.crmPipelines) ? userDoc!.crmPipelines : [];

      return staticPaginate<any>(
        all,
        (p, q) => typeof p?.name === 'string' && p.name.toLowerCase().includes(q.toLowerCase()),
        (p) => ({
          id: String(p.id),
          chip: this.toChip(p),
          raw: { name: p.name, stages: p.stages, ownerName: p.ownerName },
        }),
        params,
        (p, id) => String(p?.id) === id,
      );
    },
  },

  stage: {
    // Stages are nested inside `users.crmPipelines[].stages`. We read
    // the current user's pipelines, optionally filter to a single
    // pipeline via `params.filter.pipelineId`, then flatten into a
    // single stage list. The composite id is `pipelineId:stageId` so
    // a hydrated value can be uniquely resolved later.
    searchableFields: ['name', 'pipelineName'],
    toChip: (doc) => {
      const probability = typeof doc.chance === 'number' ? `${doc.chance}%` : undefined;
      return {
        primary: doc.name || 'Stage',
        secondary: doc.pipelineName || undefined,
        tertiary: probability,
      };
    },
    async fetch(params, ctx) {
      const context = ctx as LookupContext | null;
      if (!context) {
        return { items: [], page: 1, limit: params.limit ?? LOOKUP_DEFAULT_LIMIT, total: 0, hasMore: false };
      }
      const { db } = await connectToDatabase();
      const userDoc = await db.collection('users').findOne(
        { _id: context.userId },
        { projection: { crmPipelines: 1 } },
      );
      const pipelines: any[] = Array.isArray(userDoc?.crmPipelines) ? userDoc!.crmPipelines : [];

      const wantedPipelineId = (params.filter as Record<string, unknown> | undefined)?.pipelineId;
      const scopedPipelines = wantedPipelineId
        ? pipelines.filter(p => String(p?.id) === String(wantedPipelineId))
        : pipelines;

      // Flatten with parent context attached.
      const flat: Array<{ id: string; name: string; chance: number; pipelineId: string; pipelineName: string }> = [];
      for (const p of scopedPipelines) {
        if (!Array.isArray(p?.stages)) continue;
        for (const s of p.stages) {
          flat.push({
            id: `${String(p.id)}:${String(s.id)}`,
            name: String(s?.name ?? ''),
            chance: Number(s?.chance ?? 0),
            pipelineId: String(p.id),
            pipelineName: String(p?.name ?? ''),
          });
        }
      }

      return staticPaginate<typeof flat[number]>(
        flat,
        (s, q) => {
          const needle = q.toLowerCase();
          return s.name.toLowerCase().includes(needle)
            || s.pipelineName.toLowerCase().includes(needle);
        },
        (s) => ({
          id: s.id,
          chip: this.toChip(s),
          raw: {
            name: s.name,
            chance: s.chance,
            pipelineId: s.pipelineId,
            pipelineName: s.pipelineName,
          },
        }),
        params,
        (s, id) => s.id === id,
      );
    },
  },

  branch: makeMongoLookup({
    collection: 'crm_branches',
    searchableFields: ['name', 'code', 'city'],
    toChip: (doc) => ({
      primary: doc.name || 'Branch',
      secondary: doc.code || undefined,
      tertiary: doc.city || undefined,
    }),
    defaultFilter: () => ({ status: { $ne: 'archived' } }),
    rawFields: ['code', 'city', 'state', 'country', 'kind', 'isDefault'],
    sort: { isDefault: -1, name: 1 },
  }),

  project: makeMongoLookup({
    // Confirmed: `crm_projects` is the canonical collection (used by
    // both `crm-services.actions.ts` and `worksuite/projects.actions.ts`).
    // The base SabNode shape (`HrProject`) doesn't include `code`,
    // but we keep `code` in the searchable list and chip projection
    // for forward-compat with `WsProject.projectShortCode`-style
    // additions.
    collection: 'crm_projects',
    searchableFields: ['name', 'code', 'projectShortCode', 'description'],
    rawFields: ['name', 'code', 'projectShortCode', 'clientId', 'clientName',
                'status', 'startDate', 'endDate', 'currency'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || doc.projectName || 'Project',
      secondary: doc.code || doc.projectShortCode || undefined,
      tertiary: doc.clientName || undefined,
    }),
  }),

  purchaseOrder: makeMongoLookup({
    collection: 'crm_purchase_orders',
    searchableFields: ['poNo', 'vendorName', 'notes'],
    rawFields: ['poNo', 'date', 'vendorId', 'vendorName', 'currency',
                'totals', 'status', 'expectedDelivery'],
    sort: { date: -1, createdAt: -1 },
    toChip: (doc) => {
      const totalRaw = doc?.totals?.total;
      const totalNum = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? NaN);
      const total = Number.isFinite(totalNum)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR', maximumFractionDigits: 0 }).format(totalNum)
        : undefined;
      return {
        primary: doc.poNo || 'PO',
        secondary: doc.vendorName || undefined,
        tertiary: total,
      };
    },
  }),

  issue: makeMongoLookup({
    collection: 'crm_issues',
    searchableFields: ['title', 'description', 'labels'],
    rawFields: ['title', 'projectId', 'milestoneId', 'assigneeId',
                'issueType', 'priority', 'status', 'dueDate'],
    sort: { createdAt: -1 },
    toChip: (doc) => ({
      primary: doc.title || 'Issue',
      secondary: doc.status || undefined,
      tertiary: doc.priority || doc.issueType || undefined,
    }),
  }),

  subtask: makeMongoLookup({
    collection: 'crm_subtasks',
    searchableFields: ['title', 'description'],
    rawFields: ['title', 'parentId', 'parentKind', 'assigneeId',
                'status', 'dueDate'],
    sort: { order: 1, createdAt: -1 },
    toChip: (doc) => ({
      primary: doc.title || 'Subtask',
      secondary: doc.status || undefined,
      tertiary: doc.parentKind || undefined,
    }),
  }),

  ticket: makeMongoLookup({
    collection: 'crm_tickets',
    searchableFields: ['subject', 'category'],
    rawFields: ['subject', 'requesterId', 'assigneeId', 'channel',
                'category', 'priority', 'status', 'dueBy'],
    sort: { 'audit.createdAt': -1, _id: -1 },
    toChip: (doc) => ({
      primary: doc.subject || 'Ticket',
      secondary: doc.status || undefined,
      tertiary: doc.priority || doc.channel || undefined,
    }),
  }),

  rfq: makeMongoLookup({
    collection: 'crm_rfqs',
    searchableFields: ['title', 'terms'],
    rawFields: ['title', 'requiredBy', 'deadline', 'status', 'vendorsInvited'],
    sort: { createdAt: -1 },
    toChip: (doc) => ({
      primary: doc.title || 'RFQ',
      secondary: doc.status || undefined,
      tertiary: doc.deadline ? new Date(doc.deadline).toLocaleDateString() : undefined,
    }),
  }),

  sla: makeMongoLookup({
    collection: 'crm_slas',
    searchableFields: ['name', 'priority', 'severity', 'channel'],
    rawFields: ['name', 'priority', 'severity', 'channel',
                'firstResponseMinutes', 'resolutionMinutes'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'SLA',
      secondary: doc.priority || undefined,
      tertiary: doc.channel || doc.severity || undefined,
    }),
  }),

  vendorBill: makeMongoLookup({
    collection: 'crm_bills',
    searchableFields: ['billNo', 'vendorInvoiceNo', 'vendorName', 'reference'],
    rawFields: ['billNo', 'vendorInvoiceNo', 'vendorId', 'vendorName',
                'billDate', 'dueDate', 'status', 'currency', 'total', 'totals'],
    sort: { billDate: -1, createdAt: -1 },
    toChip: (doc) => {
      const totalRaw = doc?.totals?.total ?? doc?.total;
      const totalNum = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw ?? NaN);
      const total = Number.isFinite(totalNum)
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: doc.currency || 'INR', maximumFractionDigits: 0 }).format(totalNum)
        : undefined;
      return {
        primary: doc.billNo || doc.vendorInvoiceNo || 'Bill',
        secondary: doc.vendorName || undefined,
        tertiary: total,
      };
    },
  }),

  brand: makeMongoLookup({
    collection: 'crm_brands',
    searchableFields: ['name', 'description'],
    toChip: (doc) => ({ primary: doc.name || 'Brand', secondary: doc.website || undefined }),
    defaultFilter: () => ({ status: { $ne: 'archived' } }),
    rawFields: ['description', 'logoUrl', 'website', 'color'],
    sort: { name: 1 },
  }),

  unit: {
    // Static — small canonical UoM set. Tenant context is ignored.
    searchableFields: ['code'],
    toChip: (doc) => ({ primary: doc.code }),
    async fetch(params) {
      return staticPaginate<string>(
        STATIC_UNITS,
        (item, q) => item.toLowerCase().includes(q.toLowerCase()),
        (item) => ({
          id: item,
          chip: { primary: item },
          raw: { code: item, name: item },
        }),
        params,
        (item, id) => item === id,
      );
    },
  },

  industry: {
    // Static — short curated list. Tenant context is ignored.
    // TODO(industry): swap for a Mongo-backed lookup once tenants
    // request custom values.
    searchableFields: ['name'],
    toChip: (doc) => ({ primary: doc.name }),
    async fetch(params) {
      return staticPaginate<string>(
        STATIC_INDUSTRIES,
        (item, q) => item.toLowerCase().includes(q.toLowerCase()),
        (item) => ({
          id: item,
          chip: { primary: item },
          raw: { code: item, name: item },
        }),
        params,
        (item, id) => item === id,
      );
    },
  },

  location: {
    // TODO(location): too broad for a static enum (country/state/city
    // composition varies per consumer). The legacy SmartLocationSelect
    // is a free-text input today, so an empty registry preserves
    // current behavior while letting consumers migrate to
    // <EntityPicker>. Future: back this with a `crm_locations`
    // collection or compose Country + State + free-text city.
    searchableFields: ['name'],
    toChip: (doc) => ({ primary: doc.name || 'Location' }),
    async fetch(params) {
      return emptyLookupResult(params);
    },
  },

  vendorType: {
    // Static — fixed set wired into purchase-order GL mapping.
    searchableFields: ['code'],
    toChip: (doc) => ({ primary: doc.code }),
    async fetch(params) {
      return staticPaginate<string>(
        STATIC_VENDOR_TYPES,
        (item, q) => item.toLowerCase().includes(q.toLowerCase()),
        (item) => ({
          id: item,
          chip: { primary: item },
          raw: { code: item, name: item },
        }),
        params,
        (item, id) => item === id,
      );
    },
  },

  /* --------------------------------------------------------------- */
  /* Reference-data entries (hardcoded — see src/data/reference/*)    */
  /* --------------------------------------------------------------- */

  country: {
    searchableFields: ['name', 'code', 'dialCode'],
    toChip: (doc) => ({
      primary: doc.name,
      secondary: doc.dialCode,
      tertiary: doc.code,
    }),
    async fetch(params) {
      return staticPaginate(
        COUNTRIES,
        (c, q) => {
          const needle = q.toLowerCase();
          return c.name.toLowerCase().includes(needle)
            || c.code.toLowerCase().includes(needle)
            || c.dialCode.includes(needle);
        },
        (c) => ({
          id: c.code,
          chip: { primary: `${c.emoji} ${c.name}`, secondary: c.dialCode, tertiary: c.code },
          raw: { code: c.code, name: c.name, dialCode: c.dialCode, emoji: c.emoji, currency: c.currency },
        }),
        params,
        (c, id) => c.code === id,
      );
    },
  },

  state: {
    // Cascading: pass `params.filter.countryCode` to scope.
    searchableFields: ['name', 'code'],
    toChip: (doc) => ({ primary: doc.name, secondary: doc.code, tertiary: doc.countryCode }),
    async fetch(params) {
      const countryCode = (params.filter as Record<string, unknown> | undefined)?.countryCode;
      const scoped = countryCode
        ? STATES.filter(s => s.countryCode === String(countryCode))
        : STATES;
      return staticPaginate(
        scoped,
        (s, q) => {
          const needle = q.toLowerCase();
          return s.name.toLowerCase().includes(needle)
            || s.code.toLowerCase().includes(needle);
        },
        (s) => ({
          id: `${s.countryCode}:${s.code}`,
          chip: { primary: s.name, secondary: s.code, tertiary: s.countryCode },
          raw: { countryCode: s.countryCode, code: s.code, name: s.name },
        }),
        params,
        (s, id) => `${s.countryCode}:${s.code}` === id,
      );
    },
  },

  city: {
    // Inline-create entity: id is the literal city name. Pass
    // `params.filter.countryCode` and/or `stateCode` to scope.
    searchableFields: ['name'],
    toChip: (doc) => ({ primary: doc.name, secondary: doc.stateCode, tertiary: doc.countryCode }),
    async fetch(params) {
      const f = params.filter as { countryCode?: unknown; stateCode?: unknown } | undefined;
      const countryCode = f?.countryCode ? String(f.countryCode) : undefined;
      const stateCode = f?.stateCode ? String(f.stateCode) : undefined;
      const scoped = CITIES.filter(c => {
        if (countryCode && c.countryCode !== countryCode) return false;
        if (stateCode && c.stateCode !== stateCode) return false;
        return true;
      });

      // Hydrate-by-ids: ids ARE city names (inline-create entity).
      if (params.ids && params.ids.length > 0) {
        const items: LookupItem[] = params.ids.map(id => ({
          id,
          chip: { primary: id },
          raw: { name: id },
        }));
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }

      return staticPaginate(
        scoped,
        (c, q) => c.name.toLowerCase().includes(q.toLowerCase()),
        (c) => ({
          id: c.name,
          chip: { primary: c.name, secondary: c.stateCode, tertiary: c.countryCode },
          raw: { name: c.name, countryCode: c.countryCode, stateCode: c.stateCode },
        }),
        params,
        (c, id) => c.name === id,
      );
    },
  },

  timezone: {
    searchableFields: ['name'],
    toChip: (doc) => ({ primary: doc.name }),
    async fetch(params) {
      // Use Intl when available (Node ≥ 18), else a small fallback list.
      let zones: string[];
      try {
        zones = typeof Intl.supportedValuesOf === 'function'
          ? (Intl.supportedValuesOf('timeZone') as string[])
          : FALLBACK_TIMEZONES;
      } catch {
        zones = FALLBACK_TIMEZONES;
      }
      return staticPaginate<string>(
        zones,
        (item, q) => item.toLowerCase().includes(q.toLowerCase()),
        (item) => ({ id: item, chip: { primary: item }, raw: { name: item } }),
        params,
        (item, id) => item === id,
      );
    },
  },

  language: {
    searchableFields: ['name', 'code'],
    toChip: (doc) => ({ primary: doc.name, secondary: doc.code }),
    async fetch(params) {
      return staticPaginate(
        LANGUAGES,
        (l, q) => {
          const needle = q.toLowerCase();
          return l.name.toLowerCase().includes(needle)
            || l.code.toLowerCase().includes(needle);
        },
        (l) => ({
          id: l.code,
          chip: { primary: l.name, secondary: l.code },
          raw: { code: l.code, name: l.name },
        }),
        params,
        (l, id) => l.code === id,
      );
    },
  },

  salutation: makeInlineCreateStaticEntry(SALUTATIONS),
  leadSource: makeInlineCreateStaticEntry(LEAD_SOURCES),
  jobTitle: makeInlineCreateStaticEntry(JOB_TITLES),

  task: makeMongoLookup({
    collection: 'crm_tasks',
    searchableFields: ['title', 'description'],
    rawFields: ['title', 'description', 'status', 'priority', 'dueDate',
                'assigneeId', 'projectId', 'relatedTo'],
    sort: { dueDate: 1, createdAt: -1 },
    toChip: (doc) => ({
      primary: doc.title || 'Task',
      secondary: doc.status || undefined,
      tertiary: doc.priority || undefined,
    }),
  }),

  asset: makeMongoLookup({
    collection: 'crm_assets',
    searchableFields: ['name', 'code', 'serial', 'tag'],
    rawFields: ['name', 'code', 'serial', 'tag', 'category', 'assignedTo',
                'purchaseDate', 'value', 'condition', 'status'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Asset',
      secondary: doc.code || undefined,
      tertiary: doc.serial || undefined,
    }),
  }),

  ticketGroup: makeMongoLookup({
    collection: 'crm_ticket_groups',
    searchableFields: ['name'],
    rawFields: ['name', 'description', 'memberIds'],
    sort: { name: 1 },
    toChip: (doc) => ({
      primary: doc.name || 'Ticket Group',
    }),
  }),

  /**
   * Generic named-enum picker. Caller passes `filter.enumName` (e.g.
   * 'invoiceStatus'); registry resolves the value list from
   * `src/data/reference/crm-enums.ts`. Inline-create lets the user
   * type a one-off value when the canonical list is missing a case —
   * the id round-trips as the literal label until a tenant override
   * collection lands.
   */
  enum: {
    searchableFields: ['label', 'id'],
    toChip: (doc) => ({
      primary: doc.label || doc.id,
      secondary: doc.description || undefined,
    }),
    async fetch(params) {
      const enumName = (params.filter as { enumName?: unknown } | undefined)?.enumName;
      const list = typeof enumName === 'string' ? resolveCrmEnum(enumName) : null;

      // Hydrate-by-ids: accept any id (including ones the user typed
      // via inline-create even if they're not in the canonical list).
      if (params.ids && params.ids.length > 0) {
        const items: LookupItem[] = params.ids.map((id) => {
          const match = list?.find((it) => it.id === id);
          return {
            id,
            chip: {
              primary: match?.label ?? id,
              secondary: match?.description || undefined,
            },
            raw: {
              id,
              label: match?.label ?? id,
              tone: match?.tone,
              description: match?.description,
            },
          };
        });
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }

      if (!list) {
        return emptyLookupResult(params);
      }

      return staticPaginate(
        list,
        (item, q) => {
          const needle = q.toLowerCase();
          return item.label.toLowerCase().includes(needle)
            || item.id.toLowerCase().includes(needle);
        },
        (item) => ({
          id: item.id,
          chip: {
            primary: item.label,
            secondary: item.description || undefined,
          },
          raw: { id: item.id, label: item.label, tone: item.tone, description: item.description },
        }),
        params,
        (item, id) => item.id === id,
      );
    },
  },
};

/**
 * Helper for "id = label" reference entities backed by a small static
 * list where the user can also store ad-hoc values (returned as
 * synthetic chips on hydrate).
 */
function makeInlineCreateStaticEntry(list: string[]): EntityLookupConfig {
  return {
    searchableFields: ['name'],
    toChip: (doc) => ({ primary: doc.name }),
    async fetch(params) {
      // Hydrate-by-ids: accept any string id, even ones not in the list.
      if (params.ids && params.ids.length > 0) {
        const items: LookupItem[] = params.ids.map(id => ({
          id,
          chip: { primary: id },
          raw: { name: id },
        }));
        return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
      }
      return staticPaginate<string>(
        list,
        (item, q) => item.toLowerCase().includes(q.toLowerCase()),
        (item) => ({ id: item, chip: { primary: item }, raw: { name: item } }),
        params,
        (item, id) => item === id,
      );
    },
  };
}

const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Hong_Kong', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Karachi', 'Asia/Riyadh',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Moscow', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo',
  'America/Buenos_Aires',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland',
];

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
