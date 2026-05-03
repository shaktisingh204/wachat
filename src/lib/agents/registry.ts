/**
 * Module-level registry for agents and built-in tools.
 *
 * Two flat Maps keyed by id/name. Imports are side-effect free until the
 * built-in agent modules in `./agents/*.ts` import this and call
 * `registerAgent` at module-init time.
 */

import type { Agent, AnyTool } from './types';

const agents = new Map<string, Agent>();
const tools = new Map<string, AnyTool>();

export function registerAgent(agent: Agent): void {
  if (agents.has(agent.id)) {
    // Idempotent: re-register replaces the prior definition (useful in HMR).
    agents.set(agent.id, agent);
    return;
  }
  agents.set(agent.id, agent);
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function listAgents(): Agent[] {
  return Array.from(agents.values());
}

export function unregisterAgent(id: string): boolean {
  return agents.delete(id);
}

export function registerTool(tool: AnyTool): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): AnyTool | undefined {
  return tools.get(name);
}

export function listTools(): AnyTool[] {
  return Array.from(tools.values());
}
