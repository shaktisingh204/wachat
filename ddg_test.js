async function test() {
  const keyword = "sabnode";
  const domain = "sabnode.com";
  
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: 'q=' + encodeURIComponent(keyword)
    });
    
    if (!res.ok) {
      console.log({ error: `DuckDuckGo fallback error: ${res.status}` });
      return;
    }
    
    const text = await res.text();
    const serpResults = [];
    
    const regex = /<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)<\/a>/gi;
    const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
    
    let match;
    let rank = 1;
    let foundRank = -1;
    let foundUrl = '';
    
    while ((match = regex.exec(text)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      
      serpResults.push({
        rank: rank,
        url: url,
        title: title,
        snippet: '' // We will fill snippet below if we want, but it's optional
      });
      
      if (foundRank === -1 && url.includes(domain)) {
        foundRank = rank;
        foundUrl = url;
      }
      rank++;
    }
    
    // Optional snippet extraction
    let snippetMatch;
    let i = 0;
    while ((snippetMatch = snippetRegex.exec(text)) !== null) {
       if (serpResults[i]) {
         serpResults[i].snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
       }
       i++;
    }
    
    console.log({
      rank: foundRank,
      url: foundUrl,
      message: foundRank === -1 ? 'Domain not found in top results.' : undefined,
      serpResultsCount: serpResults.length,
      serpResults
    });
    
  } catch (err) {
    console.log({ error: err.message });
  }
}

test();
