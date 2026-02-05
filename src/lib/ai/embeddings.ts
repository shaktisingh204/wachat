// Simple wrapper for OpenAI Embeddings via fetch to avoid adding new deps
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function generateEmbedding(text: string): Promise<number[]> {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is missing from environment variables.");
    }

    // Clean text
    const cleanText = text.replace(/\n/g, " ");

    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "text-embedding-3-small", // 1536 dimensions
            input: cleanText
        })
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(`OpenAI Embedding Error: ${data.error.message}`);
    }

    return data.data[0].embedding;
}
