/**
 * SabSMS templates — pure projection helpers.
 *
 * This module exists so the test suite can import the doc → row
 * projection without pulling `server-only` modules (the actions file
 * transitively imports `getCachedSession`, which can't run under
 * `node:test`).
 */

import type {
  SabsmsTemplate,
  SabsmsTemplateCategory,
  SabsmsTemplateStatus,
} from "@/lib/sabsms/types";

export interface TemplateRow {
  id: string;
  name: string;
  status: SabsmsTemplateStatus;
  category: SabsmsTemplateCategory;
  locales: string[];
  bodyPreview: string;
  variables: string[];
  usageCount: number;
  dltRegistered: boolean;
  tendlcRegistered: boolean;
  tags: string[];
  deprecated: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface TemplateDocExt extends SabsmsTemplate {
  tags?: string[];
  deprecated?: boolean;
  submittedAt?: Date;
  usageCount?: number;
}

function toIso(d?: Date | string | null): string | null {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
}

export function projectTemplate(doc: TemplateDocExt): TemplateRow {
  const firstBody = doc.bodies?.[0]?.body ?? "";
  return {
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    category: doc.category,
    locales: (doc.bodies ?? []).map((b) => b.locale),
    bodyPreview: firstBody.slice(0, 240),
    variables: doc.variables ?? [],
    usageCount: doc.usageCount ?? 0,
    dltRegistered: Boolean(
      doc.dlt?.principalEntityId && doc.dlt?.templateId,
    ),
    tendlcRegistered: Boolean(doc.tendlc?.brandId && doc.tendlc?.campaignId),
    tags: doc.tags ?? [],
    deprecated: Boolean(doc.deprecated),
    submittedAt: toIso(doc.submittedAt ?? null),
    updatedAt: toIso(doc.updatedAt ?? null),
    createdAt: toIso(doc.createdAt ?? null),
  };
}
