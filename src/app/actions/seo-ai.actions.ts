'use server';

import { runFlow } from 'genkit/beta/client';
import { seoSchemaGenerator } from '@/ai/flows/seo-schema-generator';
import { seoMetaOptimizer } from '@/ai/flows/seo-meta-optimizer';
import { getSession } from './user.actions';

// Wrapper to call Genkit Flows from Server Actions
// Note: In production, you might call the flow directly if in same process, 
// or via HTTP if Genkit is a microservice. Here we assume direct import execution 
// or using 'runFlow' if configured. 
// For simplicity in this mono-repo structure, we will INVOKE them directly as functions if possible, 
// OR use the 'runFlow' client if using the reflection API.
// Based on typical Next.js + Genkit setup:

export async function generateSchemaAction(url: string, pageTitle?: string, contentSummary?: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Unauthorized" };

    try {
        // Direct invocation (if flows are exported as functions/callables)
        // Or using runFlow
        const result = await seoSchemaGenerator({
            url,
            pageTitle: pageTitle || '',
            contentSummary: contentSummary || '',
            businessType: "Organization" // Default, could be param
        });
        return { success: true, data: result };
    } catch (e: any) {
        console.error("AI Schema Gen Error:", e);
        return { error: e.message };
    }
}

export async function optimizeMetaAction(url: string, keyword: string, currentTitle?: string, currentDesc?: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Unauthorized" };

    try {
        const result = await seoMetaOptimizer({
            targetKeyword: keyword,
            currentTitle: currentTitle || '',
            currentDesc: currentDesc || '',
            pageContent: `Page content for ${url}` // Shim for now
        });
        return { success: true, data: result };
    } catch (e: any) {
        console.error("AI Meta Opt Error:", e);
        return { error: e.message };
    }
}
