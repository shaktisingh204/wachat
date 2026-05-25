'use server';

import { revalidatePath } from 'next/cache';
import { getSeoProject, getBrandMentions } from '@/app/actions/seo.actions';
import type { BrandMention } from '@/lib/definitions';

export interface AlertConfig {
  id?: string;
  name: string;
  condition: string;
  active: boolean;
}

// Mock storage for alerts in-memory (in production, use DB)
let alerts: AlertConfig[] = [
  { id: '1', name: 'High negative sentiment', condition: 'sentiment < 50', active: true },
  { id: '2', name: 'Competitor Mention Spike', condition: 'mentions > 100', active: false },
];

let actionableAlerts = [
  { id: 'a1', alertId: '1', message: 'Sentiment dropped below 50% on Twitter.', timestamp: new Date().toISOString(), status: 'unread' },
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

export async function fetchRealBrandMentions(projectId: string) {
  const project = await getSeoProject(projectId);
  if (!project) return [];

  const brandName = project.name || project.domain.split('.')[0] || 'SabNode';
  
  const mentions = await getBrandMentions(brandName);
  
  // Basic alert generation for negative sentiment
  const negativeMentions = mentions.filter(m => m.sentiment === 'negative');
  if (negativeMentions.length > 0) {
      // Check if alert rule exists and is active
      const negativeAlertRule = alerts.find(a => a.condition.includes('sentiment') || a.condition.includes('negative'));
      if (negativeAlertRule && negativeAlertRule.active) {
          const alertMessage = `Found ${negativeMentions.length} new negative mentions for ${brandName}.`;
          
          // Only add if not recently added
          const alreadyExists = actionableAlerts.some(a => a.message === alertMessage && a.status === 'unread');
          if (!alreadyExists) {
              actionableAlerts.unshift({
                  id: Math.random().toString(36).substring(7),
                  alertId: negativeAlertRule.id || '1',
                  message: alertMessage,
                  timestamp: new Date().toISOString(),
                  status: 'unread'
              });
          }
      }
  }

  // Map to the format the UI expects
  return mentions.map(m => ({
      id: Math.random().toString(36).substring(7),
      title: m.content || 'Mention',
      source: m.source,
      sentiment: m.sentiment,
      unlinked: Math.random() > 0.5, // Mock unlinked status
      date: m.date.toISOString(),
      url: m.url
  }));
}

export async function fetchRealBrandSentiment(projectId: string) {
    const project = await getSeoProject(projectId);
    if (!project) return null;
  
    const brandName = project.name || project.domain.split('.')[0] || 'SabNode';
    const mentions = await getBrandMentions(brandName);
    
    if (mentions.length === 0) {
        return {
            score: 0,
            positiveSentiment: '0%',
            newMentions: 0,
            mentionsDiff: '0',
            shareOfVoice: '0%',
            rankText: 'No data',
        };
    }

    const positiveCount = mentions.filter(m => m.sentiment === 'positive').length;
    const positivePercentage = Math.round((positiveCount / mentions.length) * 100);

    return {
        score: positivePercentage,
        positiveSentiment: `${positivePercentage}%`,
        newMentions: mentions.length,
        mentionsDiff: '+2', // Mock diff
        shareOfVoice: '15%', // Mock share
        rankText: 'Rank 3rd in niche',
    };
}
