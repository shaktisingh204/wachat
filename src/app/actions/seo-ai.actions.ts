'use server';

import { seoMetaOptimizer } from '@/ai/flows/seo-meta-optimizer';

export async function generateMetaTagsAction(url: string, currentTitle: string, currentDesc: string, keyword: string) {
    try {
        // In a real crawl, we'd fetch the page content here or pass it in.
        // For now, we'll pass a placeholder or let the AI hallucinate/use what it knows if it had search tool
        // But the prompt expects 'pageContent'. 
        // Let's at least pass a dummy if missing.

        const result = await seoMetaOptimizer({
            targetKeyword: keyword,
            currentTitle: currentTitle || '',
            currentDesc: currentDesc || '',
            pageContent: `Content for ${url} targeting ${keyword}.`
        });

        return { success: true, data: result };
    } catch (e: any) {
        console.error("AI Generation Failed:", e);
        return { error: "Failed to generate AI suggestions. Ensure API keys are set." };
    }
}
