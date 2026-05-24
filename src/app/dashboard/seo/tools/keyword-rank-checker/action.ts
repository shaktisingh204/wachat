'use server';

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
      for (const item of items) {
        if (item.type === 'organic' && item.url && item.url.includes(domain)) {
          return { rank: item.rank_absolute, url: item.url };
        }
      }
      return { rank: -1, message: 'Domain not found in top 100 results.' };
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
      for (const result of data.organic_results) {
        if (result.link && result.link.includes(domain)) {
          return { rank: result.position, url: result.link };
        }
      }
      return { rank: -1, message: 'Domain not found in top 100 results.' };
    } catch (e: any) {
      return { error: e.message || 'Unknown error calling SerpApi' };
    }
  }

  // Fallback if no keys provided, we can return the deterministic mock for development, 
  // but let's notify the user that it's a mock.
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return { error: 'Please set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD or SERPAPI_KEY in environment variables.' };
  }

  // Deterministic mock for local dev without keys
  let h = 0;
  const seed = keyword + domain;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const mockRank = (Math.abs(h) % 100) + 1;
  return { 
    rank: mockRank, 
    url: `https://${domain}/mock-result`, 
    mocked: true, 
    message: 'Mock result (API keys missing)' 
  };
}
