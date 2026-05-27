/**
 * Types extracted from crm-feedback-360.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type Feedback360Status =

export type Feedback360ReviewerRole =

export interface Feedback360ReviewerResponse {
    reviewerId: string;
    role: Feedback360ReviewerRole;
    scores?: Record<string, number>;
    comments?: string;
    submittedAt?: string;
}

export interface Feedback360Doc {
    _id: string;
    userId?: string;
    employeeId: string;
    employeeName?: string;
    period?: string;
    reviewerIds: string[];
    reviewerResponses?: Feedback360ReviewerResponse[];
    aggregatedScores?: Record<string, number>;
    overallRating?: number;
    status: Feedback360Status;
    completedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}
