'use server';

interface SerpResult {
  rank: number;
  url: string;
  title: string;
  snippet?: string;
}

export async function checkKeywordRankAction(keyword: string, domain: string) {
  // We prefer DataForSEO if credentials exist, otherwise fallback to SerpApi, otherwise error.
  const dfsLogin = process.env.DATAFORSEO_LOGIN;
  const dfsPassword = process.env.DATAFORSEO_PASSWORD;
  const serpapiKey = process.env.SERPAPI_KEY;

  if (dfsLogin && dfsPassword) {
    try {
      const auth = Buffer.from(`${dfsLogin}:${dfsPassword}`).toString('base64');
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keyword: keyword,
          language_code: 'en',
          location_code: 2840, // US
          depth: 100,
        }]),
      });

      if (!response.ok) {
        return { error: `DataForSEO API error: ${response.status} ${response.statusText}` };
      }

      const data = await response.json();
      const tasks = data?.tasks || [];
      if (tasks.length === 0 || !tasks[0].result || tasks[0].result.length === 0) {
        return { error: 'No results from DataForSEO.' };
      }

      const items = tasks[0].result[0].items || [];
      const serpResults: SerpResult[] = [];
      let foundRank = -1;
      let foundUrl = '';

      for (const item of items) {
        if (item.type === 'organic' && item.url) {
          const res = {
            rank: item.rank_absolute,
            url: item.url,
            title: item.title || '',
            snippet: item.description || ''
          };
          serpResults.push(res);
          if (foundRank === -1 && item.url.includes(domain)) {
            foundRank = item.rank_absolute;
            foundUrl = item.url;
          }
        }
      }
      return { rank: foundRank, url: foundUrl, serpResults, message: foundRank === -1 ? 'Domain not found in top 100 results.' : undefined };
    } catch (e: any) {
      return { error: e.message || 'Unknown error calling DataForSEO' };
    }
  }

  if (serpapiKey) {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keyword)}&num=100&api_key=${serpapiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        return { error: `SerpApi error: ${response.status} ${response.statusText}` };
      }
      const data = await response.json();
      if (!data.organic_results) {
        return { error: 'No organic results from SerpApi.' };
      }
      
      const serpResults: SerpResult[] = [];
      let foundRank = -1;
      let foundUrl = '';

      for (const result of data.organic_results) {
        if (result.link) {
          const res = {
            rank: result.position,
            url: result.link,
            title: result.title || '',
            snippet: result.snippet || ''
          };
          serpResults.push(res);
          if (foundRank === -1 && result.link.includes(domain)) {
            foundRank = result.position;
            foundUrl = result.link;
          }
        }
      }
      return { rank: foundRank, url: foundUrl, serpResults, message: foundRank === -1 ? 'Domain not found in top 100 results.' : undefined };
    } catch (e: any) {
      return { error: e.message || 'Unknown error calling SerpApi' };
    }
  }

  const scaleserpKey = process.env.SCALESERP_KEY;
  if (scaleserpKey) {
    try {
      const url = `https://api.scaleserp.com/search?api_key=${scaleserpKey}&q=${encodeURIComponent(keyword)}&num=100`;
      const response = await fetch(url);
      if (!response.ok) {
        return { error: `ScaleSERP error: ${response.status} ${response.statusText}` };
      }
      const data = await response.json();
      if (!data.organic_results) {
        return { error: 'No organic results from ScaleSERP.' };
      }
      
      const serpResults: SerpResult[] = [];
      let foundRank = -1;
      let foundUrl = '';

      for (const result of data.organic_results) {
        if (result.link) {
          const res = {
            rank: result.position,
            url: result.link,
            title: result.title || '',
            snippet: result.snippet || ''
          };
          serpResults.push(res);
          if (foundRank === -1 && result.link.includes(domain)) {
            foundRank = result.position;
            foundUrl = result.link;
          }
        }
      }
      return { rank: foundRank, url: foundUrl, serpResults, message: foundRank === -1 ? 'Domain not found in top 100 results.' : undefined };
    } catch (e: any) {
      return { error: e.message || 'Unknown error calling ScaleSERP' };
    }
  }

  // As a fallback for demo/development purposes if no API keys are provided
  // We'll simulate a SERP lookup using DuckDuckGo HTML parsing to provide real results.
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
      return { error: `No API keys provided, and fallback SERP scraping failed: ${res.status}` };
    }
    
    const text = await res.text();
    const serpResults: SerpResult[] = [];
    
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
        snippet: '' 
      });
      
      if (foundRank === -1 && url.includes(domain)) {
        foundRank = rank;
        foundUrl = url;
      }
      rank++;
    }
    
    let snippetMatch;
    let i = 0;
    while ((snippetMatch = snippetRegex.exec(text)) !== null) {
       if (serpResults[i]) {
         serpResults[i].snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim();
       }
       i++;
    }

    if (serpResults.length === 0) {
      return { error: 'No API keys provided, and fallback SERP scraping returned no results.' };
    }
    
    return { 
      rank: foundRank, 
      url: foundUrl, 
      serpResults, 
      message: foundRank === -1 
        ? 'Domain not found in top fallback results (DuckDuckGo).' 
        : 'Result found using fallback SERP API (DuckDuckGo).' 
    };
  } catch (err: any) {
    return { error: `No API keys configured, and fallback SERP scraping failed: ${err.message}` };
  }
}

