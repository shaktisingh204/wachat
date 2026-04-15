
'use server';

const OPENTHESAURUS_BASE = 'https://www.openthesaurus.de/synonyme/search';

export async function executeOpenThesaurusAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        switch (actionName) {
            case 'getSynonyms': {
                const term = String(inputs.term ?? '').trim();
                if (!term) throw new Error('term is required.');
                logger?.log(`[OpenThesaurus] GET getSynonyms for "${term}"`);
                const url = `${OPENTHESAURUS_BASE}?q=${encodeURIComponent(term)}&format=application/json`;
                const res = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error(`OpenThesaurus API error: ${res.status}`);
                const data = await res.json();
                const synsets: any[] = data.synsets ?? [];
                const terms = synsets.flatMap((s: any) => (s.terms ?? []).map((t: any) => t.term));
                return { output: { synsets, terms, count: synsets.length } };
            }

            case 'getWordSuggestions': {
                const term = String(inputs.term ?? '').trim();
                if (!term) throw new Error('term is required.');
                logger?.log(`[OpenThesaurus] GET getWordSuggestions for "${term}"`);
                const url = `${OPENTHESAURUS_BASE}?q=${encodeURIComponent(term)}&format=application/json&similar=true`;
                const res = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error(`OpenThesaurus API error: ${res.status}`);
                const data = await res.json();
                const synsets: any[] = data.synsets ?? [];
                const similarTerms: string[] = data.similar ?? [];
                const terms = synsets.flatMap((s: any) => (s.terms ?? []).map((t: any) => t.term));
                return { output: { synsets, terms, similarTerms, count: synsets.length } };
            }

            case 'checkSpelling': {
                const term = String(inputs.term ?? '').trim();
                if (!term) throw new Error('term is required.');
                logger?.log(`[OpenThesaurus] GET checkSpelling for "${term}"`);
                const url = `${OPENTHESAURUS_BASE}?q=${encodeURIComponent(term)}&format=application/json&baseform=true`;
                const res = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error(`OpenThesaurus API error: ${res.status}`);
                const data = await res.json();
                const synsets: any[] = data.synsets ?? [];
                const baseforms: string[] = data.baseforms ?? [];
                const terms = synsets.flatMap((s: any) => (s.terms ?? []).map((t: any) => t.term));
                return { output: { synsets, terms, baseforms, found: synsets.length > 0 } };
            }

            default:
                return { error: `OpenThesaurus action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'OpenThesaurus action failed.' };
    }
}
