import { NextResponse } from 'next/server';

// Local-only autocomplete: generates deterministic keyword variants
// from the seed using modifier tables. No third-party API calls.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREFIXES = ['best', 'top', 'cheap', 'free', 'premium', 'buy', 'review of', 'how to use'];
const SUFFIXES = ['2026', 'online', 'near me', 'for beginners', 'reviews', 'guide', 'tutorial', 'comparison', 'alternatives', 'pricing', 'examples', 'tips'];
const QUESTION_PREFIXES = ['how to', 'what is', 'why is', 'when to use', 'where to find', 'can i use', 'should i use', 'is', 'are'];

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export async function POST(req: Request) {
  try {
    const { q } = await req.json();
    if (!q || typeof q !== 'string') {
      return NextResponse.json({ error: 'q is required' }, { status: 400 });
    }
    const seed = q.trim();
    const out: string[] = [];

    // If seed already starts with a question prefix, expand with suffixes only
    const isQuestion = QUESTION_PREFIXES.some((p) => seed.toLowerCase().startsWith(p + ' '));
    if (isQuestion) {
      for (const s of SUFFIXES) out.push(`${seed} ${s}`);
    } else {
      for (const p of PREFIXES) out.push(`${p} ${seed}`);
      for (const s of SUFFIXES) out.push(`${seed} ${s}`);
      for (const p of QUESTION_PREFIXES) out.push(`${p} ${seed}`);
    }

    return NextResponse.json({ query: q, suggestions: uniq(out).slice(0, 30) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'autocomplete failed', suggestions: [] }, { status: 500 });
  }
}
