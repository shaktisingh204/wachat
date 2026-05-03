/**
 * Vertical registry — in-memory catalogue of registered verticals plus the
 * `installVertical` orchestrator that materialises a vertical onto a tenant.
 *
 * Persistence is delegated to the caller via {@link InstallTransport}. The
 * default transport is a no-op stub that records a structured trace; tests
 * (and the live SaaS) can swap in a Mongo-backed transport.
 */

import { runHook } from './compliance-hooks';
import type { InstallReport, Vertical } from './types';

// ── Registry ────────────────────────────────────────────────────────────────

const REGISTRY = new Map<string, Vertical>();

export function registerVertical(v: Vertical): void {
  if (!v.id) throw new Error('Vertical must have an id');
  if (REGISTRY.has(v.id)) {
    // Re-registration is allowed (hot-reload friendly) but we replace.
    REGISTRY.delete(v.id);
  }
  REGISTRY.set(v.id, v);
}

export function getVertical(id: string): Vertical | undefined {
  return REGISTRY.get(id);
}

export function listVerticals(): Vertical[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function unregisterVertical(id: string): boolean {
  return REGISTRY.delete(id);
}

// ── Install transport ───────────────────────────────────────────────────────

/**
 * The transport handles the actual persistence side-effects of installing a
 * vertical. Each method MUST be idempotent — installing the same vertical
 * twice should not duplicate seed data.
 */
export interface InstallTransport {
  provisionEntity(tenantId: string, entity: { name: string; label: string }): Promise<void> | void;
  seedRecord(tenantId: string, entity: string, record: Record<string, unknown>): Promise<void> | void;
  installFlow(tenantId: string, flow: { id: string; name: string }): Promise<void> | void;
  installDashboard(tenantId: string, dashboard: { id: string; name: string }): Promise<void> | void;
  installMessagingTemplate(tenantId: string, tpl: { id: string; name: string }): Promise<void> | void;
  installContractTemplate(tenantId: string, tpl: { id: string; name: string }): Promise<void> | void;
  registerAgent(tenantId: string, agent: { id: string; name: string }): Promise<void> | void;
}

/** Default transport — collects a structured log instead of touching storage. */
export class TraceTransport implements InstallTransport {
  public events: Array<{ kind: string; tenantId: string; payload: unknown }> = [];
  provisionEntity(tenantId: string, entity: { name: string; label: string }) {
    this.events.push({ kind: 'provisionEntity', tenantId, payload: entity });
  }
  seedRecord(tenantId: string, entity: string, record: Record<string, unknown>) {
    this.events.push({ kind: 'seedRecord', tenantId, payload: { entity, record } });
  }
  installFlow(tenantId: string, flow: { id: string; name: string }) {
    this.events.push({ kind: 'installFlow', tenantId, payload: flow });
  }
  installDashboard(tenantId: string, dashboard: { id: string; name: string }) {
    this.events.push({ kind: 'installDashboard', tenantId, payload: dashboard });
  }
  installMessagingTemplate(tenantId: string, tpl: { id: string; name: string }) {
    this.events.push({ kind: 'installMessagingTemplate', tenantId, payload: tpl });
  }
  installContractTemplate(tenantId: string, tpl: { id: string; name: string }) {
    this.events.push({ kind: 'installContractTemplate', tenantId, payload: tpl });
  }
  registerAgent(tenantId: string, agent: { id: string; name: string }) {
    this.events.push({ kind: 'registerAgent', tenantId, payload: agent });
  }
}

let DEFAULT_TRANSPORT: InstallTransport = new TraceTransport();

export function setInstallTransport(t: InstallTransport): void {
  DEFAULT_TRANSPORT = t;
}

export function getInstallTransport(): InstallTransport {
  return DEFAULT_TRANSPORT;
}

// ── installVertical orchestrator ────────────────────────────────────────────

export interface InstallOptions {
  /** Tenant flags (e.g. baaSigned) used by compliance hooks. */
  tenantFlags?: Record<string, boolean>;
  /** Skip seeding sample data (fresh-tenant flag). */
  skipSampleData?: boolean;
  /** Override the default transport just for this call. */
  transport?: InstallTransport;
}

export async function installVertical(
  verticalId: string,
  tenantId: string,
  options: InstallOptions = {},
): Promise<InstallReport> {
  const v = REGISTRY.get(verticalId);
  if (!v) throw new Error(`Unknown vertical: ${verticalId}`);
  if (!tenantId) throw new Error('tenantId is required');

  const transport = options.transport ?? DEFAULT_TRANSPORT;
  const warnings: string[] = [];

  // Run install-time compliance hooks first.
  for (const hook of v.complianceHooks) {
    if (hook.on !== 'install') continue;
    const verdict = runHook(hook.id, { tenantId, tenantFlags: options.tenantFlags });
    if (!verdict.allowed) {
      throw new Error(`Compliance gate "${hook.id}" blocked install: ${verdict.reason}`);
    }
  }

  // Provision entities.
  const entitiesProvisioned: string[] = [];
  for (const entity of v.dataModel.entities) {
    await transport.provisionEntity(tenantId, { name: entity.name, label: entity.label });
    entitiesProvisioned.push(entity.name);
  }

  // Seed sample data (unless skipped).
  if (!options.skipSampleData) {
    for (const [entity, records] of Object.entries(v.sampleData)) {
      if (!entitiesProvisioned.includes(entity)) {
        warnings.push(`Sample data for unknown entity "${entity}" was skipped.`);
        continue;
      }
      for (const record of records) {
        await transport.seedRecord(tenantId, entity, record);
      }
    }
  }

  // Install flows.
  for (const flow of v.baselineFlows) {
    await transport.installFlow(tenantId, { id: flow.id, name: flow.name });
  }

  // Install dashboards.
  for (const dash of v.dashboards) {
    await transport.installDashboard(tenantId, { id: dash.id, name: dash.name });
  }

  // Install messaging templates.
  for (const tpl of v.messagingTemplates) {
    await transport.installMessagingTemplate(tenantId, { id: tpl.id, name: tpl.name });
  }

  // Install contract templates.
  for (const tpl of v.contractTemplates) {
    await transport.installContractTemplate(tenantId, { id: tpl.id, name: tpl.name });
  }

  // Register AI agents.
  for (const agent of v.aiAgents) {
    await transport.registerAgent(tenantId, { id: agent.id, name: agent.name });
  }

  return {
    verticalId: v.id,
    tenantId,
    installedAt: new Date().toISOString(),
    entitiesProvisioned,
    flowsInstalled: v.baselineFlows.length,
    dashboardsInstalled: v.dashboards.length,
    templatesInstalled: v.messagingTemplates.length + v.contractTemplates.length,
    warnings,
  };
}
