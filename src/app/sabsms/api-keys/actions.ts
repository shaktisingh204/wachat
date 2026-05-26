"use server";

import { revalidatePath } from "next/cache";

// Replace with actual database interactions when schema is available.
// Mocking the database state in memory for now.

export interface SabsmsApiKey {
  id: string;
  name: string;
  keyValue: string;
  scopes: string[];
  ipAllowlist: string[];
  lastUsedAt: string;
  lastUsedIp: string;
  rateLimit: string;
  expiryDate: string;
  status: string;
  owner: string;
  isWebhookOnly: boolean;
  idempotencySize: string;
  createdAt: string;
}

export interface SabsmsExecutionLog {
  id: string;
  timestamp: string;
  keyName: string;
  endpoint: string;
  status: number;
  latency: string;
  ip: string;
}

let MOCK_KEYS: SabsmsApiKey[] = [
  { id: "k1", name: "Prod Integration", keyValue: "sk_live_f892je8932jf8932j89f", scopes: ["send-only"], ipAllowlist: ["192.168.1.1", "10.0.0.5"], lastUsedAt: "2026-05-23T00:10:00Z", lastUsedIp: "192.168.1.1", rateLimit: "100/s", expiryDate: "2027-01-01", status: "active", owner: "alice@example.com", isWebhookOnly: false, idempotencySize: "1.2GB", createdAt: "2025-01-15T12:00:00Z" },
  { id: "k2", name: "Reporting Read-Only", keyValue: "sk_test_1928jd8219jd129jd821", scopes: ["read-only"], ipAllowlist: ["Any"], lastUsedAt: "2026-05-22T10:00:00Z", lastUsedIp: "203.0.113.4", rateLimit: "10/s", expiryDate: "Never", status: "active", owner: "bob@example.com", isWebhookOnly: false, idempotencySize: "0B", createdAt: "2025-03-20T08:30:00Z" },
  { id: "k3", name: "Admin Setup", keyValue: "sk_live_admin8932jf8932j89f2", scopes: ["admin"], ipAllowlist: ["10.0.0.0/8"], lastUsedAt: "2026-01-10T00:00:00Z", lastUsedIp: "10.0.0.50", rateLimit: "50/s", expiryDate: "2026-12-31", status: "revoked", owner: "alice@example.com", isWebhookOnly: false, idempotencySize: "5MB", createdAt: "2024-11-05T14:45:00Z" },
  { id: "k4", name: "Webhook Sub", keyValue: "sk_live_wh1829jd8219jd129jd8", scopes: ["read-only"], ipAllowlist: ["Any"], lastUsedAt: "Never", lastUsedIp: "-", rateLimit: "5/s", expiryDate: "Never", status: "active", owner: "charlie@example.com", isWebhookOnly: true, idempotencySize: "0B", createdAt: "2026-05-01T09:15:00Z" }
];

let MOCK_EXECUTION_LOGS: SabsmsExecutionLog[] = [
  { id: "log1", timestamp: "2026-05-23T01:03:15Z", keyName: "Prod Integration", endpoint: "POST /v1/messages", status: 200, latency: "145ms", ip: "192.168.1.1" },
  { id: "log2", timestamp: "2026-05-23T01:03:10Z", keyName: "Reporting Read-Only", endpoint: "GET /v1/analytics/delivery", status: 200, latency: "89ms", ip: "203.0.113.4" },
  { id: "log3", timestamp: "2026-05-23T01:02:45Z", keyName: "Prod Integration", endpoint: "POST /v1/messages", status: 429, latency: "12ms", ip: "192.168.1.1" },
  { id: "log4", timestamp: "2026-05-23T01:01:20Z", keyName: "Unknown Key", endpoint: "GET /v1/account", status: 401, latency: "5ms", ip: "10.0.0.50" },
  { id: "log5", timestamp: "2026-05-23T00:59:55Z", keyName: "Prod Integration", endpoint: "POST /v1/messages", status: 200, latency: "130ms", ip: "192.168.1.1" },
];

export async function getApiKeys(): Promise<SabsmsApiKey[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_KEYS;
}

export async function getExecutionLogs(): Promise<SabsmsExecutionLog[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_EXECUTION_LOGS;
}

export async function createApiKey(data: Partial<SabsmsApiKey>): Promise<{ success: boolean; key?: SabsmsApiKey }> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const newKey: SabsmsApiKey = {
    id: `k${Date.now()}`,
    name: data.name || "New API Key",
    keyValue: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
    scopes: data.scopes || ["read-only"],
    ipAllowlist: data.ipAllowlist || ["Any"],
    lastUsedAt: "Never",
    lastUsedIp: "-",
    rateLimit: data.rateLimit || "100/s",
    expiryDate: data.expiryDate || "Never",
    status: "active",
    owner: "user@example.com",
    isWebhookOnly: data.isWebhookOnly || false,
    idempotencySize: "0B",
    createdAt: new Date().toISOString(),
  };
  MOCK_KEYS.unshift(newKey);
  revalidatePath('/sabsms/api-keys');
  return { success: true, key: newKey };
}

export async function updateApiKey(id: string, data: Partial<SabsmsApiKey>): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const index = MOCK_KEYS.findIndex((k) => k.id === id);
  if (index === -1) return { success: false };
  MOCK_KEYS[index] = { ...MOCK_KEYS[index], ...data };
  revalidatePath('/sabsms/api-keys');
  return { success: true };
}

export async function revokeApiKey(id: string): Promise<{ success: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const index = MOCK_KEYS.findIndex((k) => k.id === id);
  if (index === -1) return { success: false };
  MOCK_KEYS[index].status = "revoked";
  revalidatePath('/sabsms/api-keys');
  return { success: true };
}
