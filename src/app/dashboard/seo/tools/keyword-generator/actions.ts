'use server';

interface KeywordGeneratorOptions {
  google: boolean;
  bing: boolean;
  youtube: boolean;
  yahoo: boolean;
  duckduckgo: boolean;
  wikipedia: boolean;
  alphabet: boolean;
  questions: boolean;
  prepositions: boolean;
  comparisons: boolean;
}

export async function generateKeywords(seed: string, options: KeywordGeneratorOptions): Promise<string[]> {
  const baseQuery = seed.trim();
  if (!baseQuery) return [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  const fetchJson = async (url: string) => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchGoogleSuggest = (q: string) => fetchJson(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`);
  const fetchBingSuggest = (q: string) => fetchJson(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`);
  const fetchYoutubeSuggest = (q: string) => fetchJson(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`);
  const fetchYahooSuggest = (q: string) => fetchJson(`https://sugg.search.yahoo.net/sg/?output=fxjson&command=${encodeURIComponent(q)}`);
  const fetchWikipediaSuggest = (q: string) => fetchJson(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&format=json`);
  const fetchDuckDuckGoSuggest = async (q: string) => {
    const res = await fetchJson(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}`);
    if (res && Array.isArray(res)) {
      return [q, res.map((r: any) => r.phrase)];
    }
    return null;
  };

  const results = new Set<string>();
  const addResults = (res: any) => {
    if (res && Array.isArray(res) && Array.isArray(res[1])) {
      res[1].forEach((item: string) => results.add(item.toLowerCase()));
    }
  };

  const promises: Promise<any>[] = [];

  const addEnginePromises = (q: string) => {
    if (options.google) promises.push(fetchGoogleSuggest(q).then(addResults));
    if (options.bing) promises.push(fetchBingSuggest(q).then(addResults));
    if (options.youtube) promises.push(fetchYoutubeSuggest(q).then(addResults));
    if (options.yahoo) promises.push(fetchYahooSuggest(q).then(addResults));
    if (options.duckduckgo) promises.push(fetchDuckDuckGoSuggest(q).then(addResults));
    if (options.wikipedia) promises.push(fetchWikipediaSuggest(q).then(addResults));
  };

  // Base query for all selected engines
  addEnginePromises(baseQuery);

  if (options.alphabet) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of alphabet) {
      addEnginePromises(`${baseQuery} ${letter}`);
    }
  }

  if (options.questions) {
    const questions = [
      'how to ', 'what is ', 'what are ', 'where to ', 'why ', 'when to ', 'who ', 'can ', 'is ', 'are ', 'best '
    ];
    for (const q of questions) {
      addEnginePromises(`${q}${baseQuery}`);
    }
  }

  if (options.prepositions) {
    const prepositions = ['for ', 'with ', 'to ', 'without ', 'near ', 'is ', 'can '];
    for (const p of prepositions) {
      addEnginePromises(`${baseQuery} ${p}`);
    }
  }

  if (options.comparisons) {
    const comparisons = [' vs ', ' versus ', ' or ', ' like ', ' and '];
    for (const c of comparisons) {
      addEnginePromises(`${baseQuery}${c}`);
    }
  }

  // To prevent rate limiting or timeout issues, we chunk the promises
  const chunkSize = 20;
  for (let i = 0; i < promises.length; i += chunkSize) {
    const chunk = promises.slice(i, i + chunkSize);
    await Promise.allSettled(chunk);
    if (i + chunkSize < promises.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return Array.from(results);
}
