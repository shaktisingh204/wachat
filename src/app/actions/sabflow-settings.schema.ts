import { z } from 'zod';

export const sabflowVariableEntrySchema = z.object({
    key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
        message: 'Key must start with a letter or underscore, and contain only letters, numbers, and underscores.'
    }),
    value: z.string(),
});

export const sabflowSettingsSchema = z.object({
    defaults: z.object({
        defaultWorkspace: z.string(),
        executionTimeout: z.number().min(1, { message: 'Execution timeout must be at least 1 second' }),
    }).optional(),
    retention: z.object({
        keepRunHistoryDays: z.number().min(1, { message: 'Retention must be at least 1 day' }),
        purgeFailedRuns: z.boolean(),
    }).optional(),
    runLimits: z.object({
        maxConcurrentRuns: z.number().min(1, { message: 'Max concurrent runs must be at least 1' }),
        maxStepsPerRun: z.number().min(1, { message: 'Max steps per run must be at least 1' }),
    }).optional(),
    webhooks: z.object({
        url: z.union([z.literal(''), z.string().url({ message: 'Must be a valid URL' })]),
        secret: z.string(),
        retryAttempts: z.number().min(0, { message: 'Retry attempts must be at least 0' }).max(10, { message: 'Retry attempts must be at most 10' }),
    }).optional(),
    variables: z.array(sabflowVariableEntrySchema).optional(),
});
