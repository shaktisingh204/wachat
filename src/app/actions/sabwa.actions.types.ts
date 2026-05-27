/**
 * Types extracted from sabwa.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface SabwaSendMessagePayload {
  type: SabwaScheduledPayload['type'];
  body?: string;
  mediaSabFileId?: string;
  caption?: string;
  quotedMessageId?: string;
  mentionJids?: string[];
}

export interface SabwaAnalyticsSeriesPoint {
  date: string; // ISO date (yyyy-mm-dd)
  in: number;
  out: number;
}

export interface SabwaAnalyticsHistogramBin {
  bucket: string; // e.g. "0-30s"
  count: number;
}

export interface SabwaAnalyticsTopContact {
  jid: string;
  name?: string;
  count: number;
}

export interface SabwaAnalyticsHeatCell {
  day: number; // 0=Sun..6=Sat
  hour: number; // 0..23
  count: number;
}

export interface SabwaAnalyticsHourBar {
  hour: number; // 0..23
  count: number;
}

export interface SabwaAnalyticsAiDay {
  date: string;
  suggest: number;
  summarise: number;
  translate: number;
}
