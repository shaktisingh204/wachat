/**
 * Public partner directory — search & filter helpers.
 *
 * In-memory filter implementation that mirrors the API supported by the
 * `GET /api/partners/directory` route. Mongo-backed implementations should
 * project the same `DirectoryFilter` shape into a query.
 */

import 'server-only';

import { tierRank } from './program';
import type { Partner, PartnerSpecialty, PartnerTier } from './types';

export interface DirectoryFilter {
  /** Free-text search over name + description. */
  q?: string;
  /** ISO-3166 alpha-2 region code. */
  region?: string;
  specialty?: PartnerSpecialty;
  tier?: PartnerTier;
  /** Pagination — 1-indexed. */
  page?: number;
  limit?: number;
}

export interface DirectoryResult {
  items: PublicPartner[];
  total: number;
  page: number;
  limit: number;
}

/** A partner safe to expose publicly — strips internal financial signals. */
export interface PublicPartner {
  slug: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  regions: string[];
  specialties: PartnerSpecialty[];
  tier: PartnerTier;
  certifiedEmployees: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function filterPartners(partners: Partner[], filter: DirectoryFilter): DirectoryResult {
  const q = filter.q?.trim().toLowerCase();
  const filtered = partners.filter((p) => {
    if (p.status !== 'active') return false;
    if (filter.region && !p.regions.includes(filter.region)) return false;
    if (filter.specialty && !p.specialties.includes(filter.specialty)) return false;
    if (filter.tier && p.tier !== filter.tier) return false;
    if (q) {
      const haystack = `${p.name} ${p.description ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Sort: tier desc, then certifiedEmployees desc, then name asc.
  filtered.sort((a, b) => {
    const t = tierRank(b.tier) - tierRank(a.tier);
    if (t !== 0) return t;
    const c = b.certifiedEmployees - a.certifiedEmployees;
    if (c !== 0) return c;
    return a.name.localeCompare(b.name);
  });

  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filter.limit ?? DEFAULT_LIMIT));
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map(toPublic);

  return { items, total: filtered.length, page, limit };
}

export function toPublic(p: Partner): PublicPartner {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    websiteUrl: p.websiteUrl,
    logoUrl: p.logoUrl,
    regions: p.regions,
    specialties: p.specialties,
    tier: p.tier,
    certifiedEmployees: p.certifiedEmployees,
  };
}
