"use server";

import { revalidatePath } from "next/cache";

export type Role = "sabsms_admin" | "agent" | "marketer" | "developer" | "custom";

export interface TeamMemberRow {
  id: string;
  email: string;
  name?: string;
  role: Role;
  status: "active" | "invited";
  rateLimitOverride?: number;
  dailySendCap?: number;
  lastSeenAt?: string;
  lastActionAt?: string;
  apiKeyUsage: number;
  twoFactorEnabled: boolean;
  alertSubscriptions: string[];
  outOfOffice: boolean;
}

export interface MemberAuditEntry {
  id: string;
  actor: string;
  kind: string;
  detail?: string;
  at: string;
}

const mockTeam: TeamMemberRow[] = [
  {
    id: "m_1",
    email: "admin@sabnode.com",
    name: "Admin User",
    role: "sabsms_admin",
    status: "active",
    apiKeyUsage: 1250,
    lastSeenAt: new Date(Date.now() - 300000).toISOString(),
    lastActionAt: new Date(Date.now() - 600000).toISOString(),
    twoFactorEnabled: true,
    alertSubscriptions: ["failures", "daily_digest"],
    outOfOffice: false,
  },
  {
    id: "m_2",
    email: "marketer@sabnode.com",
    name: "Marketing Lead",
    role: "marketer",
    status: "active",
    dailySendCap: 50000,
    apiKeyUsage: 0,
    lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
    lastActionAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    twoFactorEnabled: true,
    alertSubscriptions: ["campaign_completed"],
    outOfOffice: true,
  },
  {
    id: "m_3",
    email: "dev@sabnode.com",
    name: "API Developer",
    role: "developer",
    status: "active",
    rateLimitOverride: 100,
    apiKeyUsage: 89000,
    lastSeenAt: new Date(Date.now() - 3600000).toISOString(),
    lastActionAt: new Date(Date.now() - 7200000).toISOString(),
    twoFactorEnabled: false,
    alertSubscriptions: ["rate_limits", "failures"],
    outOfOffice: false,
  },
  {
    id: "m_4",
    email: "new_agent@sabnode.com",
    role: "agent",
    status: "invited",
    apiKeyUsage: 0,
    twoFactorEnabled: false,
    alertSubscriptions: [],
    outOfOffice: false,
  },
];

export async function loadTeamMembers(workspaceId: string) {
  // Mock delay
  await new Promise((r) => setTimeout(r, 150));
  return { rows: mockTeam, total: mockTeam.length };
}

export async function inviteMember(data: { email: string; role: Role }) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, email: data.email };
}

export async function bulkInviteCsv(data: { csv: string }) {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true, sent: 3, skipped: 0 };
}

export async function updateMemberRole(data: { memberId: string; role: Role }) {
  await new Promise((r) => setTimeout(r, 200));
  revalidatePath("/sabsms/settings/team");
  return { ok: true };
}

export async function updateMemberCaps(data: {
  memberId: string;
  rateLimitOverride?: number;
  dailySendCap?: number;
}) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true };
}

export async function revokeInvite(data: { memberId: string }) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true };
}

export async function resendInvite(data: { memberId: string }) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true };
}

export async function forceLogout(data: { memberId: string }) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true };
}

export async function loadMemberAudit(data: { memberId: string }) {
  await new Promise((r) => setTimeout(r, 300));
  const entries: MemberAuditEntry[] = [
    {
      id: "a_1",
      actor: "admin@sabnode.com",
      kind: "role_changed",
      detail: "Role changed from agent to marketer",
      at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "a_2",
      actor: "system",
      kind: "login",
      at: new Date(Date.now() - 300000).toISOString(),
    },
  ];
  return entries;
}

export async function bulkReassignRole(data: { memberIds: string[]; role: Role }) {
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true, updated: data.memberIds.length };
}
