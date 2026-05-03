/**
 * Vertical marketplace surface.
 *
 * Thin orchestration layer that the SabNode admin UI calls to list, install
 * and uninstall verticals. Persistence is delegated to the registry's
 * configured {@link InstallTransport}.
 */

import {
  getVertical,
  installVertical,
  listVerticals,
  type InstallOptions,
} from './registry';
import type { InstallReport, Vertical } from './types';

export interface MarketplaceListing {
  id: string;
  name: string;
  industry: string;
  description: string;
  icon?: string;
  flowCount: number;
  dashboardCount: number;
  agentCount: number;
  complianceRegimes: string[];
  recommendedAddons: Array<{ id: string; required: boolean }>;
}

function toListing(v: Vertical): MarketplaceListing {
  const regimes = new Set<string>();
  for (const h of v.complianceHooks) {
    const prefix = h.id.split('.')[0];
    if (prefix) regimes.add(prefix.toUpperCase());
  }
  return {
    id: v.id,
    name: v.name,
    industry: v.industry,
    description: v.description ?? `${v.name} for ${v.industry}`,
    icon: v.icon,
    flowCount: v.baselineFlows.length,
    dashboardCount: v.dashboards.length,
    agentCount: v.aiAgents.length,
    complianceRegimes: Array.from(regimes).sort(),
    recommendedAddons: v.recommendedAddons.map((a) => ({ id: a.id, required: !!a.required })),
  };
}

/** Lists every vertical packaged in the platform as marketplace listings. */
export function listMarketplace(): MarketplaceListing[] {
  return listVerticals().map(toListing);
}

/** Returns full marketplace detail for a single vertical. */
export function getMarketplaceListing(id: string): MarketplaceListing | undefined {
  const v = getVertical(id);
  return v ? toListing(v) : undefined;
}

export interface InstallRequest {
  verticalId: string;
  tenantId: string;
  options?: InstallOptions;
}

/** Installs a vertical onto a tenant. Wrapper around the registry orchestrator. */
export async function installFromMarketplace(req: InstallRequest): Promise<InstallReport> {
  return installVertical(req.verticalId, req.tenantId, req.options);
}

// ── Uninstall (best-effort) ─────────────────────────────────────────────────

export interface UninstallTransport {
  removeFlow(tenantId: string, flowId: string): Promise<void> | void;
  removeDashboard(tenantId: string, dashboardId: string): Promise<void> | void;
  removeMessagingTemplate(tenantId: string, tplId: string): Promise<void> | void;
  removeContractTemplate(tenantId: string, tplId: string): Promise<void> | void;
  unregisterAgent(tenantId: string, agentId: string): Promise<void> | void;
}

export class TraceUninstallTransport implements UninstallTransport {
  public events: Array<{ kind: string; tenantId: string; payload: unknown }> = [];
  removeFlow(tenantId: string, flowId: string) {
    this.events.push({ kind: 'removeFlow', tenantId, payload: { flowId } });
  }
  removeDashboard(tenantId: string, dashboardId: string) {
    this.events.push({ kind: 'removeDashboard', tenantId, payload: { dashboardId } });
  }
  removeMessagingTemplate(tenantId: string, tplId: string) {
    this.events.push({ kind: 'removeMessagingTemplate', tenantId, payload: { tplId } });
  }
  removeContractTemplate(tenantId: string, tplId: string) {
    this.events.push({ kind: 'removeContractTemplate', tenantId, payload: { tplId } });
  }
  unregisterAgent(tenantId: string, agentId: string) {
    this.events.push({ kind: 'unregisterAgent', tenantId, payload: { agentId } });
  }
}

let DEFAULT_UNINSTALL: UninstallTransport = new TraceUninstallTransport();

export function setUninstallTransport(t: UninstallTransport): void {
  DEFAULT_UNINSTALL = t;
}

export async function uninstallVertical(
  verticalId: string,
  tenantId: string,
  transport: UninstallTransport = DEFAULT_UNINSTALL,
): Promise<{ removed: number }> {
  const v = getVertical(verticalId);
  if (!v) throw new Error(`Unknown vertical: ${verticalId}`);
  let removed = 0;
  for (const f of v.baselineFlows) {
    await transport.removeFlow(tenantId, f.id);
    removed++;
  }
  for (const d of v.dashboards) {
    await transport.removeDashboard(tenantId, d.id);
    removed++;
  }
  for (const t of v.messagingTemplates) {
    await transport.removeMessagingTemplate(tenantId, t.id);
    removed++;
  }
  for (const t of v.contractTemplates) {
    await transport.removeContractTemplate(tenantId, t.id);
    removed++;
  }
  for (const a of v.aiAgents) {
    await transport.unregisterAgent(tenantId, a.id);
    removed++;
  }
  return { removed };
}
