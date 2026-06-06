'use client';

import { Button, Input, Card, CardHeader, CardTitle, CardBody, cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type CategoryType = 'Questions' | 'Commercial' | 'Local' | 'Informational';

const LANGUAGES: Record<string, Record<CategoryType, string[]>> = {
  en: {
    Questions: ['how to', 'what is', 'where to find', 'when to', 'why is'],
    Commercial: ['best', 'top', 'cheap', 'buy', 'affordable', 'free'],
    Local: ['near me', 'in my city', 'around me', 'locally'],
    Informational: ['for beginners', 'ideas', 'examples', 'guide', 'tutorial', 'tips'],
  },
  es: {
    Questions: ['cómo', 'qué es', 'dónde encontrar', 'cuándo', 'por qué es'],
    Commercial: ['mejor', 'top', 'barato', 'comprar', 'asequible', 'gratis'],
    Local: ['cerca de mí', 'en mi ciudad', 'a mi alrededor', 'localmente'],
    Informational: ['para principiantes', 'ideas', 'ejemplos', 'guía', 'tutorial', 'consejos'],
  },
  fr: {
    Questions: ['comment', 'qu\'est-ce que', 'où trouver', 'quand', 'pourquoi est'],
    Commercial: ['meilleur', 'top', 'pas cher', 'acheter', 'abordable', 'gratuit'],
    Local: ['près de chez moi', 'dans ma ville', 'autour de moi', 'localement'],
    Informational: ['pour les débutants', 'idées', 'exemples', 'guide', 'tutoriel', 'conseils'],
  },
  de: {
    Questions: ['wie', 'was ist', 'wo finde ich', 'wann', 'warum ist'],
    Commercial: ['beste', 'top', 'billig', 'kaufen', 'erschwinglich', 'kostenlos'],
    Local: ['in meiner Nähe', 'in meiner Stadt', 'um mich herum', 'lokal'],
    Informational: ['für Anfänger', 'Ideen', 'Beispiele', 'Anleitung', 'Tutorial', 'Tipps'],
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German'
};

export default function LongTailKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [lang, setLang] = useState('en');
  const [results, setResults] = useState<Record<string, string[]>>({});

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    
    const categories = LANGUAGES[lang] || LANGUAGES['en'];
    const out: Record<string, string[]> = {};
    for (const [category, mods] of Object.entries(categories)) {
      out[category] = mods.map(m => {
        // Questions and Commercial usually prefix the seed
        if (category === 'Questions' || category === 'Commercial') {
           return `${m} ${s}`;
        }
        // Local and Informational usually postfix the seed
        return `${s} ${m}`;
      });
    }
    setResults(out);
  };

  return (
    <ToolShell title="Long-Tail Keyword Expander" description="Expand a seed keyword with long-tail modifiers for more specific queries.">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          className="flex-1"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <div className="flex gap-2">
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={run}>Expand</Button>
        </div>
      </div>
      
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {items.map((r) => (
                    <li key={r} className="p-3 rounded-md bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)]">{r}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
