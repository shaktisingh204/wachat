'use server';

import { revalidatePath } from 'next/cache';

export interface AlertConfig {
  id?: string;
  name: string;
  condition: string;
  active: boolean;
}

// Mock storage for alerts
let alerts: AlertConfig[] = [
  { id: '1', name: 'High negative sentiment', condition: 'sentiment < 50', active: true },
  { id: '2', name: 'Competitor Mention Spike', condition: 'mentions > 100', active: false },
];

let actionableAlerts = [
  { id: 'a1', alertId: '1', message: 'Sentiment dropped below 50% on Twitter.', timestamp: new Date().toISOString(), status: 'unread' },
  { id: 'a2', alertId: '2', message: 'Competitor mentioned 150 times in 1 hour.', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'read' },
];

export async function getAlertConfigs(projectId: string) {
  return alerts;
}

export async function saveAlertConfig(projectId: string, config: AlertConfig) {
  if (config.id) {
    alerts = alerts.map((a) => (a.id === config.id ? config : a));
  } else {
    alerts.push({ ...config, id: Math.random().toString(36).substring(7) });
  }
  revalidatePath(`/dashboard/seo/${projectId}/brand`);
  return { success: true };
}

export async function deleteAlertConfig(projectId: string, id: string) {
  alerts = alerts.filter((a) => a.id !== id);
  revalidatePath(`/dashboard/seo/${projectId}/brand`);
  return { success: true };
}

export async function getActionableAlerts(projectId: string) {
  return actionableAlerts;
}

export async function markAlertRead(projectId: string, alertId: string) {
  actionableAlerts = actionableAlerts.map((a) => (a.id === alertId ? { ...a, status: 'read' } : a));
  revalidatePath(`/dashboard/seo/${projectId}/brand`);
  return { success: true };
}
