'use server';

export async function generateAdVariants(brief: string): Promise<{ variants?: string[], error?: string }> {
    if (!brief) return { error: 'Brief is required' };
    
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return { error: 'OpenAI API key is missing' };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert Facebook ad copywriter. Generate 10 distinct, highly engaging ad copy variants for the user\'s product/offer brief. Each variant should be exactly one sentence and include an appropriate emoji and a strong call-to-action. Do not include numbering or bullet points in the output, just separate each variant by a newline.'
                    },
                    {
                        role: 'user',
                        content: `Product/Offer Brief: ${brief}`
                    }
                ],
                temperature: 0.8,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            return { error: `OpenAI error: ${error}` };
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        
        if (!content) {
            return { error: 'Failed to generate variants' };
        }

        const variants = content.split('\n').filter((line: string) => line.trim().length > 0).map((line: string) => line.replace(/^[\d\.\-\*]\s*/, '').trim()).slice(0, 10);
        return { variants };
    } catch (error: any) {
        return { error: error.message || 'An error occurred during generation' };
    }
}
