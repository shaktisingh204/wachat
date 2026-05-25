'use server';

import { getKeywordDataLive } from '@/lib/seo/data-for-seo';
import { classifyIntent } from '@/lib/seo-suite/keyword-research';

export type RelatedKeywordIdea = {
  term: string;
  volume: number;
  cpc: number;
  intent: 'transactional' | 'commercial' | 'navigational' | 'informational';
  competition: number; // 0-1 or 0-100
};

export async function fetchRelatedKeywords(seed: string): Promise<RelatedKeywordIdea[]> {
  const normalizedSeed = seed.trim().toLowerCase();
  if (!normalizedSeed) return [];

  // 1. Generate ideas using a free provider (Google Autocomplete / Datamuse)
  // We'll use Google Suggest for real autocomplete data which is better for SEO
  let ideas: string[] = [normalizedSeed];
  
  try {
    const res = await fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(normalizedSeed)}%20`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        ideas = [...ideas, ...data[1].filter((t: string) => t !== normalizedSeed)];
      }
    }
    
    // Also try with prefix questions
    const resQ = await fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=how%20to%20${encodeURIComponent(normalizedSeed)}`);
    if (resQ.ok) {
      const dataQ = await resQ.json();
      if (Array.isArray(dataQ) && Array.isArray(dataQ[1])) {
        ideas = [...ideas, ...dataQ[1]];
      }
    }
  } catch (e) {
    console.error("Failed to fetch suggestions", e);
  }

  // Deduplicate and limit to 20 ideas to avoid hitting volume API limits
  ideas = Array.from(new Set(ideas)).slice(0, 20);

  // Fallback to basic prefixes/suffixes if we didn't get enough
  if (ideas.length < 5) {
      const PREFIXES = ['best', 'top', 'cheap', 'what is'];
      const SUFFIXES = ['guide', 'tips', 'tutorial', 'alternatives', 'services'];
      for (const p of PREFIXES) ideas.push(`${p} ${normalizedSeed}`);
      for (const s of SUFFIXES) ideas.push(`${normalizedSeed} ${s}`);
      ideas = Array.from(new Set(ideas)).slice(0, 20);
  }

  // 2. Fetch real search volumes and CPC via DataForSEO
  const results: RelatedKeywordIdea[] = [];
  
  try {
      const volumeData = await getKeywordDataLive(ideas, 2840, "en"); // 2840 is US
      
      // Map the results
      if (volumeData && volumeData.tasks && volumeData.tasks[0]?.result) {
          const items = volumeData.tasks[0].result;
          const dataMap = new Map<string, any>();
          
          for (const item of items) {
              if (item.keyword) {
                  dataMap.set(item.keyword, item);
              }
          }

          for (const idea of ideas) {
              const data = dataMap.get(idea);
              results.push({
                  term: idea,
                  volume: data?.search_volume || estimateVolume(idea, normalizedSeed),
                  cpc: data?.cpc || estimateCpc(idea),
                  competition: data?.competition || estimateCompetition(idea),
                  intent: classifyIntent(idea)
              });
          }
      } else {
          // Fallback if DataForSEO API is not configured or returned no data
          for (const idea of ideas) {
              results.push({
                  term: idea,
                  volume: estimateVolume(idea, normalizedSeed),
                  cpc: estimateCpc(idea),
                  competition: estimateCompetition(idea),
                  intent: classifyIntent(idea)
              });
          }
      }
  } catch (e) {
      console.error("Failed to fetch volume data", e);
      // Fallback
      for (const idea of ideas) {
          results.push({
              term: idea,
              volume: estimateVolume(idea, normalizedSeed),
              cpc: estimateCpc(idea),
              competition: estimateCompetition(idea),
              intent: classifyIntent(idea)
          });
      }
  }

  return results.sort((a, b) => b.volume - a.volume);
}

// Fallback heuristics if API fails or is not configured
function estimateVolume(term: string, seed: string): number {
  const words = term.split(/\s+/).length;
  const base = 5000;
  const wordPenalty = Math.max(0, words - 1) * 0.55;
  const seedBoost = term === seed ? 1.5 : 1;
  const v = (base / Math.pow(1 + wordPenalty, 1.4)) * seedBoost;
  return Math.round(v);
}

function estimateCpc(term: string): number {
    const intent = classifyIntent(term);
    let base = 0.5;
    if (intent === 'transactional') base = 3.5;
    if (intent === 'commercial') base = 2.0;
    
    // add some randomness based on term length
    return Number((base + (term.length % 5) * 0.2).toFixed(2));
}

function estimateCompetition(term: string): number {
    const words = term.split(/\s+/).length;
    // shorter terms are harder
    return Math.max(0.1, Math.min(1.0, 1.0 - (words - 1) * 0.15));
}
