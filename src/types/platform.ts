export interface AISalesForecast {
  id: string;
  period: string; // e.g., 'Q3 2026'
  predictedRevenue: number;
  confidenceScore: number;
  aiModel?: string;
  drivers: string[];
  createdAt: string;
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  columns: string[];
  filters: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[]; // e.g., ['crm.contact.created']
  status: 'active' | 'inactive' | 'failing';
  secret: string;
  createdAt: string;
}

export interface RedactionPolicy {
  id: string;
  name: string;
  targetFields: string[]; // e.g., ['ssn', 'credit_card']
  maskPattern: string; // e.g., '***-**-****'
  status: 'active' | 'inactive';
}

export interface GlobalSearchResult {
  id: string;
  type: 'contact' | 'deal' | 'invoice' | 'document' | 'other';
  title: string;
  subtitle: string;
  url: string;
  score: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  timestamp: string;
  ipAddress: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  active: boolean;
}

export interface NativeAppAPIKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface CustomObjectDefinition {
  id: string;
  singularName: string;
  pluralName: string;
  apiIdentifier: string;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'reference';
    required: boolean;
  }>;
  createdAt: string;
}

export interface GenerativeAIDraft {
  id: string;
  entityType: 'email' | 'proposal' | 'contract';
  prompt: string;
  content: string;
  status: 'draft' | 'approved' | 'rejected';
  createdAt: string;
}
