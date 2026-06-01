// PORT-NOTE: Ported from twenty-server ai-models/constants/model-family-labels.const.ts
// ModelFamily enum inlined as string literals — no NestJS or Mongo dependency.

export const ModelFamily = {
  GPT: 'gpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  MISTRAL: 'mistral',
  GROK: 'grok',
} as const;

export type ModelFamily = (typeof ModelFamily)[keyof typeof ModelFamily];

export const MODEL_FAMILY_LABELS: Record<string, string> = {
  [ModelFamily.GPT]: 'GPT',
  [ModelFamily.CLAUDE]: 'Claude',
  [ModelFamily.GEMINI]: 'Gemini',
  [ModelFamily.MISTRAL]: 'Mistral',
  [ModelFamily.GROK]: 'Grok',
};
