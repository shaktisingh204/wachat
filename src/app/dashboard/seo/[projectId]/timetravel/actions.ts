'use server';

export async function fetchSnapshot(url: string) {
    try {
        // 1. Fetch Live Page
        const liveRes = await fetch(url, { 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            cache: "no-store" 
        });
        if (!liveRes.ok) {
            return { error: `Failed to fetch live page (Status: ${liveRes.status})` };
        }
        const liveHtml = await liveRes.text();
        
        // Extract Live Title
        const liveTitleMatch = liveHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = liveTitleMatch ? liveTitleMatch[1].trim() : 'No Title Found';

        // Extract Live H1
        const liveH1Match = liveHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const h1 = liveH1Match ? liveH1Match[1].replace(/<[^>]*>?/gm, '').trim() : 'No H1 Found';

        let previousTitle = title;
        let previousH1 = h1;
        let lastChanged = 'Unknown';

        let previousHtml: string | null = null;

        // 2. Fetch Wayback API
        const waybackRes = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { cache: "no-store" });
        const waybackData = await waybackRes.json();

        if (waybackData?.archived_snapshots?.closest?.url) {
            const archiveUrl = waybackData.archived_snapshots.closest.url;
            const timestamp = waybackData.archived_snapshots.closest.timestamp; // e.g., "20260519194036"
            
            // Format timestamp into a readable date
            if (timestamp && timestamp.length >= 8) {
                const year = timestamp.substring(0, 4);
                const month = timestamp.substring(4, 6);
                const day = timestamp.substring(6, 8);
                lastChanged = `${year}-${month}-${day}`;
            }
            
            const archiveRes = await fetch(archiveUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                cache: "no-store" 
            });
            
            if (archiveRes.ok) {
                previousHtml = await archiveRes.text();
                
                const archiveTitleMatch = previousHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (archiveTitleMatch) previousTitle = archiveTitleMatch[1].trim();

                const archiveH1Match = previousHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                if (archiveH1Match) previousH1 = archiveH1Match[1].replace(/<[^>]*>?/gm, '').trim();
            }
        }
        
        return { 
            success: true,
            html: liveHtml, 
            previousHtml,
            title, 
            previousTitle,
            h1,
            previousH1,
            lastChanged
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
