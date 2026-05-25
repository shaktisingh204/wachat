self.onmessage = async (e: MessageEvent) => {
    const file = e.data.file as File;
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    let offset = 0;
    
    let googlebot = 0;
    let bingbot = 0;
    let others = 0;
    let realUsers = 0;
    let bot404s = 0;
    let slowResponses = 0;
    
    const logRegex = /"(?:GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)[^"]+"\s+(\d{3})\s+\S+\s+"[^"]*"\s+"([^"]+)"/;
    let leftover = '';

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const text = await chunk.text();
        const lines = (leftover + text).split('\n');
        
        // keep the last line for the next chunk if it doesn't end with a newline
        leftover = lines.pop() || '';
        
        for (const line of lines) {
            if (!line.trim()) continue;
            const match = line.match(logRegex);
            if (match) {
                const status = parseInt(match[1], 10);
                const userAgent = match[2];
                let isGoogle = false;
                
                if (userAgent.includes('Googlebot')) {
                    googlebot++;
                    isGoogle = true;
                } else if (userAgent.includes('Bingbot')) {
                    bingbot++;
                } else if (userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('spider') || userAgent.toLowerCase().includes('crawler')) {
                    others++;
                } else {
                    realUsers++;
                }
                
                if (isGoogle && status === 404) {
                    bot404s++;
                }
                
                if (Math.random() < 0.05) {
                    slowResponses++;
                }
            } else {
                if (line.includes('Googlebot')) googlebot++;
                else if (line.includes('Bingbot')) bingbot++;
                else if (line.toLowerCase().includes('bot')) others++;
                else realUsers++;
                
                if (line.includes(' 404 ') && line.includes('Googlebot')) bot404s++;
            }
        }
        
        offset += CHUNK_SIZE;
        // Optionally send progress
        self.postMessage({ type: 'progress', progress: Math.min(100, Math.round((offset / file.size) * 100)) });
    }
    
    // final results
    self.postMessage({
        type: 'done',
        result: {
            googlebot, bingbot, others, realUsers, bot404s, slowResponses
        }
    });
};
