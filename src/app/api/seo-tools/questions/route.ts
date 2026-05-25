import { NextResponse } from 'next/server';

const QUESTION_PREFIXES = [
  'how to',
  'what is',
  'why',
  'when',
  'where',
  'can',
  'should i',
  'is',
  'are',
  'which',
];

// Hash function for mock search volume based on string to keep it deterministic
function getMockVolume(keyword: string): number {
  let hash = 0;
  for (let i = 0; i < keyword.length; i++) {
    hash = (hash << 5) - hash + keyword.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 10000;
  // Round to nearest 10
  return Math.max(10, Math.floor(val / 10) * 10);
}

export async function POST(req: Request) {
  try {
    const { seed } = await req.json();
    if (!seed || typeof seed !== 'string') {
      return NextResponse.json({ error: 'Seed is required' }, { status: 400 });
    }

    const queries = QUESTION_PREFIXES.map((prefix) => `${prefix} ${seed.trim()}`);

    const results: Array<{ keyword: string; volume: number; cpc: string; competition: number }> = [];

    // Fetch up to 10 queries sequentially or in parallel
    await Promise.all(
      queries.map(async (q) => {
        try {
          const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SabNode/1.0)',
            },
          });
          if (res.ok) {
            const data = await res.json();
            const suggestions = data[1] || [];
            suggestions.forEach((s: string) => {
              results.push({
                keyword: s,
                volume: getMockVolume(s),
                cpc: (getMockVolume(s) / 1000).toFixed(2),
                competition: Math.min(100, Math.floor((getMockVolume(s) / 10000) * 100)),
              });
            });
          }
        } catch (err) {
          console.error('Failed to fetch for', q, err);
        }
      })
    );

    // Deduplicate by keyword
    const uniqueMap = new Map();
    results.forEach((r) => {
      if (!uniqueMap.has(r.keyword)) {
        uniqueMap.set(r.keyword, r);
      }
    });

    const finalResults = Array.from(uniqueMap.values()).sort((a, b) => b.volume - a.volume);

    return NextResponse.json({ results: finalResults });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
