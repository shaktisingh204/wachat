export type IntegrationResult = {
  outputs?: Record<string, unknown>;
  logs?: string[];
  error?: string;
};

export type ResolvedOptions = Record<string, unknown>;
export type Credential = Record<string, string>;
