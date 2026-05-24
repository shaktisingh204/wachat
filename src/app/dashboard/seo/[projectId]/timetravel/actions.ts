'use server';

export async function fetchSnapshot(url: string) {
    try {
        const res = await fetch(url, { 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            cache: "no-store" 
        });
        if (!res.ok) {
            return { error: `Failed to fetch snapshot (Status: ${res.status})` };
        }
        const html = await res.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'No Title Found';

        // Extract H1
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const h1 = h1Match ? h1Match[1].replace(/<[^>]*>?/gm, '').trim() : 'No H1 Found';

        const previousTitle = title !== 'No Title Found' ? `${title} (Previous)` : 'Old Title';
        const previousH1 = h1 !== 'No H1 Found' ? `(Previous) ${h1}` : 'Old H1';
        
        return { 
            success: true,
            html: html.slice(0, 10000), // slice to prevent massive payloads
            title, 
            previousTitle,
            h1,
            previousH1,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
