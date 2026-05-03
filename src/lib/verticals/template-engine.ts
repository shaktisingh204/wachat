/**
 * Template engine — merges a {@link VerticalTemplate} into an existing
 * vertical or tenant snapshot. Used both by the marketplace ("install this
 * flow pack on top of my retail tenant") and by the registry when composing
 * verticals from shared partials.
 */

import type {
  Vertical,
  VerticalTemplate,
  IndustryDataModel,
  EntityDefinition,
  BaselineFlow,
  DashboardDefinition,
  MessagingTemplate,
  ContractTemplate,
  AIAgentReference,
  RecommendedAddon,
  ComplianceHookRef,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function mergeById<T extends { id: string }>(existing: T[], incoming: T[] | undefined): T[] {
  if (!incoming || incoming.length === 0) return existing;
  const map = new Map(existing.map((e) => [e.id, e]));
  for (const inc of incoming) {
    map.set(inc.id, { ...map.get(inc.id), ...inc });
  }
  return Array.from(map.values());
}

function mergeByName<T extends { name: string }>(existing: T[], incoming: T[] | undefined): T[] {
  if (!incoming || incoming.length === 0) return existing;
  const map = new Map(existing.map((e) => [e.name, e]));
  for (const inc of incoming) {
    map.set(inc.name, { ...map.get(inc.name), ...inc });
  }
  return Array.from(map.values());
}

function mergeDataModel(
  base: IndustryDataModel,
  patch: Partial<IndustryDataModel> | undefined,
): IndustryDataModel {
  if (!patch) return base;
  const entities: EntityDefinition[] = patch.entities
    ? mergeByName(base.entities, patch.entities)
    : base.entities;
  return {
    id: patch.id ?? base.id,
    entities,
    defaultTags: [...new Set([...(base.defaultTags ?? []), ...(patch.defaultTags ?? [])])],
  };
}

function mergeSample(
  base: Record<string, Array<Record<string, unknown>>>,
  patch: Record<string, Array<Record<string, unknown>>> | undefined,
): Record<string, Array<Record<string, unknown>>> {
  if (!patch) return base;
  const out: Record<string, Array<Record<string, unknown>>> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = [...(out[k] ?? []), ...v];
  }
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply a partial template to a target vertical, returning a new merged
 * vertical. Pure: does not mutate `target`.
 *
 * Merge strategy:
 *   - flows / dashboards / messaging / contract templates / agents / addons
 *     are merged by id (incoming wins on conflict);
 *   - dataModel.entities are merged by name with incoming wins;
 *   - sampleData arrays are concatenated under the same entity key;
 *   - complianceHooks are merged by `id` (incoming wins).
 */
export function applyTemplate(template: VerticalTemplate, target: Vertical): Vertical {
  if (template.vertical !== '*' && template.vertical !== target.id) {
    throw new Error(
      `Template "${template.id}" targets vertical "${template.vertical}" but was applied to "${target.id}"`,
    );
  }

  const p = template.payload;
  const merged: Vertical = {
    ...target,
    dataModel: mergeDataModel(target.dataModel, p.dataModel),
    sampleData: mergeSample(target.sampleData, p.sampleData),
    baselineFlows: mergeById<BaselineFlow>(target.baselineFlows, p.baselineFlows),
    dashboards: mergeById<DashboardDefinition>(target.dashboards, p.dashboards),
    aiAgents: mergeById<AIAgentReference>(target.aiAgents, p.aiAgents),
    complianceHooks: mergeById<ComplianceHookRef>(target.complianceHooks, p.complianceHooks),
    messagingTemplates: mergeById<MessagingTemplate>(target.messagingTemplates, p.messagingTemplates),
    contractTemplates: mergeById<ContractTemplate>(target.contractTemplates, p.contractTemplates),
    recommendedAddons: mergeById<RecommendedAddon>(target.recommendedAddons, p.recommendedAddons),
  };
  return merged;
}

/**
 * Validate that a template is structurally sound before persisting it. Used
 * by the marketplace upload flow.
 */
export function validateTemplate(template: VerticalTemplate): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!template.id) errors.push('template.id is required');
  if (!template.name) errors.push('template.name is required');
  if (!template.vertical) errors.push('template.vertical is required');
  const p = template.payload;
  if (!p) {
    errors.push('template.payload is required');
  } else {
    for (const f of p.baselineFlows ?? []) {
      if (!f.id || !f.name || !f.trigger) errors.push(`flow ${f.id ?? '<no id>'} missing fields`);
    }
    for (const d of p.dashboards ?? []) {
      if (!d.id || !d.name) errors.push(`dashboard ${d.id ?? '<no id>'} missing fields`);
    }
  }
  return { ok: errors.length === 0, errors };
}
