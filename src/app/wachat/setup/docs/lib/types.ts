export interface DocArticle {
  id: string;
  title: string;
  content: string;
  updatedAt: string; // ISO date string
  category: 'setup' | 'troubleshooting' | 'best-practices';
}

export type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

export interface ApiError {
  message: string;
  code: string;
}

export interface WABaStatus {
  status: 'connected' | 'disconnected' | 'pending';
  lastChecked: string;
  qualityRating: 'green' | 'yellow' | 'red' | 'unknown';
}
