/**
 * Org chart — build and serialise the reporting tree from a flat list of
 * employees.
 */

import type { Employee, OrgChartNode, ID } from './types';

export function buildOrgChart(employees: Employee[]): OrgChartNode[] {
  const byId = new Map<ID, OrgChartNode>();
  for (const e of employees) {
    byId.set(e.id, {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      designation: e.designation,
      managerId: e.managerId,
      departmentId: e.departmentId,
      reports: [],
    });
  }
  const roots: OrgChartNode[] = [];
  for (const node of byId.values()) {
    if (node.managerId && byId.has(node.managerId)) {
      byId.get(node.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export interface SerializedOrgChart {
  roots: ID[];
  nodes: Record<ID, Omit<OrgChartNode, 'reports'> & { reportIds: ID[] }>;
}

/** Flatten the tree to a serialisable form for caching / transport. */
export function serializeOrgChart(roots: OrgChartNode[]): SerializedOrgChart {
  const nodes: SerializedOrgChart['nodes'] = {};
  const walk = (n: OrgChartNode) => {
    const { reports, ...rest } = n;
    nodes[n.employeeId] = { ...rest, reportIds: reports.map((r) => r.employeeId) };
    reports.forEach(walk);
  };
  roots.forEach(walk);
  return { roots: roots.map((r) => r.employeeId), nodes };
}

export function deserializeOrgChart(serialized: SerializedOrgChart): OrgChartNode[] {
  const cache = new Map<ID, OrgChartNode>();
  const build = (id: ID): OrgChartNode => {
    if (cache.has(id)) return cache.get(id)!;
    const n = serialized.nodes[id];
    const node: OrgChartNode = {
      employeeId: n.employeeId,
      name: n.name,
      designation: n.designation,
      managerId: n.managerId,
      departmentId: n.departmentId,
      reports: [],
    };
    cache.set(id, node);
    node.reports = n.reportIds.map(build);
    return node;
  };
  return serialized.roots.map(build);
}

export function depth(node: OrgChartNode): number {
  if (node.reports.length === 0) return 1;
  return 1 + Math.max(...node.reports.map(depth));
}

export function flatten(node: OrgChartNode): OrgChartNode[] {
  return [node, ...node.reports.flatMap(flatten)];
}

export function findReports(node: OrgChartNode, employeeId: ID): OrgChartNode[] {
  if (node.employeeId === employeeId) return flatten(node).slice(1);
  for (const r of node.reports) {
    const found = findReports(r, employeeId);
    if (found.length > 0 || r.employeeId === employeeId) return found;
  }
  return [];
}

export function findManagerChain(employees: Employee[], employeeId: ID): Employee[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const chain: Employee[] = [];
  let cursor = byId.get(employeeId);
  const seen = new Set<ID>();
  while (cursor?.managerId && !seen.has(cursor.managerId)) {
    seen.add(cursor.managerId);
    const mgr = byId.get(cursor.managerId);
    if (!mgr) break;
    chain.push(mgr);
    cursor = mgr;
  }
  return chain;
}
