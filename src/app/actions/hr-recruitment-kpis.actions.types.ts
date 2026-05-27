/**
 * Types extracted from hr-recruitment-kpis.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export interface CandidateKpis {
  newApplications: number;
  inScreening: number;
  inInterview: number;
  offered: number;
  hired: number;
  total: number;
}
