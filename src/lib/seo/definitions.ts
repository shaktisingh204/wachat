import type { ObjectId } from 'mongodb';

export type SeoProjectSettings = {
    crawlFrequency: 'daily' | 'weekly' | 'manual';
    targetedKeywords: string[];
    locations: string[]; // e.g. ["us", "in"]
};

export type SeoProject = {
    _id: ObjectId;
    userId: ObjectId;
    domain: string;
    competitors: string[];
    settings: SeoProjectSettings;
    lastAuditDate?: Date;
    healthScore?: number;
    createdAt: Date;
    updatedAt: Date;
};

export type SeoPageIssue = {
    code: string; // e.g. "missing_h1", "broken_link"
    message: string;
    severity: 'critical' | 'warning' | 'info';
    element?: string; // HTML element string if applicable
};

export type SeoPageAudit = {
    url: string;
    status: number; // 200, 404
    title?: string;
    metaDescription?: string;
    h1?: string;
    wordCount?: number;
    loadTime?: number; // ms
    issues: SeoPageIssue[];
    crawledAt: Date;
};

export type SeoAudit = {
    _id: ObjectId;
    projectId: ObjectId;
    pages: SeoPageAudit[];
    totalScore: number;
    startedAt: Date;
    completedAt?: Date;
    status: 'running' | 'completed' | 'failed' | 'pending';
    summary: {
        totalPages: number;
        criticalIssues: number;
        warningIssues: number;
    };
};

export type SeoKeywordHistory = {
    date: Date;
    rank: number; // Position
    volume: number;
    cpc?: number;
};

export type SeoKeyword = {
    _id: ObjectId;
    projectId: ObjectId;
    keyword: string;
    location: string; // e.g. "2840" for US (DataForSEO code) or iso code
    currentRank?: number;
    currentVolume?: number;
    currentDifficulty?: number;
    history: SeoKeywordHistory[];
    tags?: string[];
    lastUpdated: Date;
    createdAt: Date;
};
