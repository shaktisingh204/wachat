import 'server-only';

/**
 * SabWebinar — Analytics client. Wraps `/v1/sabwebinar/analytics`.
 *
 * Returns the aggregated per-webinar summary (registered, attended,
 * peak concurrent, avg watch, conversion, engagement counts).
 */

export interface SabwebinarSourceBreakdown {
  source: string;
  count: number;
}

export interface SabwebinarAnalyticsDoc {
  webinarId: string;
  registeredCount: number;
  attendedCount: number;
  avgWatchTimeMinutes: number;
  peakConcurrent: number;
  conversionRate: number;
  pollEngagementCount: number;
  qnaCount: number;
  registrationsBySource: SabwebinarSourceBreakdown[];
}
