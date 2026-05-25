'use server';

interface SearchResult {
  title: string;
  url: string;
  domainAuthority: number;
}

interface KDResult {
  score: number;
  results: SearchResult[];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export async function analyzeKeywordDifficultyAction(keyword: string): Promise<KDResult> {
  const urlEncoded = encodeURIComponent(keyword);
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${urlEncoded}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    },
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch search results');
  }
  
  const text = await res.text();
  
  const results: SearchResult[] = [];
  const titleRegex = /<h2 class="result__title">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  
  let match;
  let totalDa = 0;
  
  while ((match = titleRegex.exec(text)) !== null) {
    if (results.length >= 10) break;
    let url = match[1];
    let title = match[2].replace(/<[^>]+>/g, '').trim();
    
    // Decode DuckDuckGo redirect url
    if (url.startsWith('//duckduckgo.com/l/?') || url.startsWith('https://duckduckgo.com/l/?')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const uddg = urlParams.get('uddg');
      if (uddg) {
        url = decodeURIComponent(uddg);
      }
    } else if (url.startsWith('/y.js')) {
      continue; // Skip ads
    }
    
    // If we couldn't resolve a valid URL, skip
    if (!url.startsWith('http')) continue;

    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch(e) {
      domain = url;
    }
    
    // Calculate a consistent mock DA based on domain
    const seed = hashString(domain);
    let da = Math.round(40 + seededRandom(seed) * 50); // 40-90 range
    
    // Boost well known domains
    const highAuth = ['wikipedia.org', 'youtube.com', 'github.com', 'react.dev', 'w3schools.com', 'developer.mozilla.org'];
    if (highAuth.some(d => domain.includes(d))) {
      da = Math.min(99, da + 20);
    }
    
    da = Math.min(100, Math.max(1, da));
    totalDa += da;
    
    results.push({
      title,
      url,
      domainAuthority: da
    });
  }
  
  // If fetch failed to parse, fallback to deterministic simulation
  if (results.length === 0) {
    throw new Error("No search results found");
  }
  
  const score = Math.round(totalDa / results.length);
  
  return {
    score,
    results
  };
}
