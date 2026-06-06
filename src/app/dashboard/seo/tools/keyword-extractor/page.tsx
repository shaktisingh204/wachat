'use client';

import { Button, Textarea, Card, CardBody, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

const STOPWORDS: Record<string, Set<string>> = {
  en: new Set(['a','an','the','is','are','was','were','be','been','being','of','to','in','on','at','by','for','with','about','as','from','and','or','but','if','then','so','than','it','this','that','these','those','i','you','he','she','we','they','his','her','its','their','our','my','your','do','does','did','have','has','had','will','would','could','should','can','may','might','must','not','no','yes','also','very']),
  es: new Set(['el','la','los','las','un','una','unos','unas','y','o','pero','si','entonces','como','porque','de','a','en','con','por','para','sobre','sin','yo','tu','el','ella','nosotros','vosotros','ellos','ellas','mi','tu','su','nuestro','vuestro','este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella','aquellos','aquellas','que','lo','al','del','se','me','te','le','les','nos','os','ha','han','hay','he','hemos','es','son','fue','fueron','ser','estar','estoy','esta','estamos','estan','muy','mas','ya']),
  fr: new Set(['le','la','les','un','une','des','et','ou','mais','si','alors','comme','parce','de','a','en','avec','par','pour','sur','sans','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','notre','votre','leur','ce','cet','cette','ces','qui','que','quoi','dont','ou','au','aux','du','des','se','me','te','lui','leur','nous','vous','est','sont','a','ont','ete','suis','es','sommes','etes','tres','plus','deja']),
  de: new Set(['der','die','das','den','dem','des','ein','eine','einer','eines','einem','einen','und','oder','aber','wenn','dann','wie','weil','von','zu','in','mit','durch','fur','auf','ohne','ich','du','er','sie','es','wir','ihr','sie','mein','dein','sein','unser','euer','ihr','dieser','diese','dieses','welcher','welche','welches','wer','was','wo','wie','warum','am','im','zum','zur','vom','sich','mich','dich','ihn','uns','euch','ist','sind','war','waren','sein','bin','bist','sehr','mehr','schon']),
  it: new Set(['il','lo','la','i','gli','le','un','uno','una','e','o','ma','se','allora','come','perche','di','a','da','in','con','su','per','tra','fra','io','tu','lui','lei','noi','voi','loro','mio','tuo','suo','nostro','vostro','questo','questa','questi','queste','quello','quella','quelli','quelle','che','chi','cui','quale','mi','ti','ci','vi','si','ne','ha','hanno','ho','abbiamo','e','sono','era','erano','essere','stare','sto','sta','stiamo','stanno','molto','piu','gia']),
  pt: new Set(['o','a','os','as','um','uma','uns','umas','e','ou','mas','se','entao','como','porque','de','a','em','com','por','para','sobre','sem','eu','tu','ele','ela','nos','vos','eles','elas','meu','teu','seu','nosso','vosso','este','esta','estes','estas','esse','essa','esses','essas','aquele','aquela','aqueles','aquelas','que','quem','qual','me','te','se','lhe','lhes','nos','vos','ha','hao','hei','havemos','e','sao','era','eram','ser','estar','estou','esta','estamos','estao','muito','mais','ja'])
};

export default function KeywordExtractorPage() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [results, setResults] = useState<{ word: string; count: number; score: number }[]>([]);

  const run = () => {
    if (!text.trim()) return;
    const stopwords = STOPWORDS[language] || STOPWORDS['en'];
    
    // Split text into sentences for our corpus to calculate IDF
    const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    const N = sentences.length;

    const tfMap = new Map<string, number>();
    const dfMap = new Map<string, number>();

    for (const sentence of sentences) {
      const words = sentence.toLocaleLowerCase(language).match(/\p{L}{3,}/gu) || [];
      const sentenceWords = new Set<string>();
      
      for (const w of words) {
        if (stopwords.has(w)) continue;
        tfMap.set(w, (tfMap.get(w) || 0) + 1);
        sentenceWords.add(w);
      }
      
      for (const w of sentenceWords) {
        dfMap.set(w, (dfMap.get(w) || 0) + 1);
      }
    }

    const keywords: { word: string; count: number; score: number }[] = [];
    
    for (const [word, tf] of tfMap.entries()) {
      const df = dfMap.get(word) || 1;
      let idf = Math.log(N / df);
      if (N <= 1) idf = 1;
      const score = tf * (idf + 1);
      keywords.push({ word, count: tf, score });
    }

    setResults(keywords.sort((a, b) => b.score - a.score).slice(0, 30));
  };

  return (
    <ToolShell title="Keyword Extractor" description="Extract genuinely important keywords using TF-IDF scoring algorithm with multiple language support.">
      <div className="flex gap-4 items-center mb-4">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="it">Italian</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text content here..."
        className="min-h-[220px] mb-4"
      />
      <Button onClick={run} className="w-fit mb-4">Extract Keywords</Button>
      
      {results.length > 0 && (
        <Card>
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <span className="font-semibold text-sm">Keyword</span>
              <div className="flex gap-8 text-sm text-[var(--st-text-secondary)]">
                <span className="w-12 text-right">TF</span>
                <span className="w-16 text-right">TF-IDF</span>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              {results.map((r) => (
                <div key={r.word} className="flex justify-between p-2 rounded bg-[var(--st-bg-muted)]/40 items-center">
                  <span className="font-medium">{r.word}</span>
                  <div className="flex gap-8">
                    <span className="w-12 text-right text-[var(--st-text-secondary)]">{r.count}</span>
                    <span className="w-16 text-right font-medium text-[var(--st-text)]">{r.score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
