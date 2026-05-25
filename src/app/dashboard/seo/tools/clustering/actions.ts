'use server';

export async function fetchDatamuseTopics(kw: string): Promise<string[]> {
    try {
        const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(kw)}&max=3`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'SabNodeSEOBot/1.0'
            }
        });
        
        if (!res.ok) {
            throw new Error(`Datamuse API error: ${res.status}`);
        }
        
        const data = await res.json();
        if (Array.isArray(data)) {
            return data.map((d: any) => d.word);
        }
        return [];
    } catch (error) {
        console.error("NLP fetch error for", kw, error);
        return [];
    }
}
