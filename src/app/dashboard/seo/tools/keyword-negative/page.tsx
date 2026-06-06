'use client';

import { useState, useMemo, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea, Card, CardBody, Checkbox, Label, Button } from '@/components/sabcrm/20ui/compat';
import { Copy, Check } from 'lucide-react';

const BUILTIN_LISTS = {
  common: {
    label: "General / Common",
    words: [
      'free', 'cheap', 'meaning', 'definition', 'wikipedia', 'quotes',
      'lyrics', 'login', 'sign in', 'near me', 'review', 'reviews'
    ]
  },
  informational: {
    label: "Informational (No Intent)",
    words: [
      'how to', 'what is', 'guide', 'tutorial', 'example', 'history',
      'meaning', 'definition', 'who is', 'when', 'where', 'why'
    ]
  },
  bargain: {
    label: "Bargain Seekers",
    words: [
      'cheap', 'free', 'discount', 'coupon', 'promo', 'clearance',
      'bargain', 'sale', 'lowest price', 'affordable'
    ]
  },
  jobs: {
    label: "Job Seekers / Education",
    words: [
      'job', 'jobs', 'salary', 'career', 'resume', 'internship', 
      'hiring', 'recruiter', 'vacancies', 'college', 'student', 'school', 'university'
    ]
  },
  adult: {
    label: "Adult / NSFW",
    words: [
      'porn', 'nude', 'sex', 'xxx', 'escort', 'massage', 'stripper', 'onlyfans'
    ]
  },
  b2b: {
    label: "B2B (Business-to-Business)",
    words: [
      'consumer', 'home', 'personal', 'b2c', 'hobby', 'kids', 'family', 'student',
      'retail', 'diy', 'school', 'college', 'residential'
    ]
  },
  ecommerce: {
    label: "E-commerce (Transactional)",
    words: [
      'diy', 'homemade', 'free', 'review', 'complaint', 'scam', 'return',
      'repair', 'how to', 'what is', 'vs', 'compare', 'wholesale', 'bulk',
      'used', 'craigslist', 'ebay', 'second hand', 'cheap'
    ]
  },
  local: {
    label: "Local SEO",
    words: [
      'online', 'remote', 'virtual', 'national', 'global', 'international', 
      'software', 'app', 'download', 'shipping', 'delivery', 'ecommerce'
    ]
  },
  saas: {
    label: "SaaS & Software",
    words: [
      'on-premise', 'desktop', 'download', 'offline', 'cd-rom', 'one-time', 
      'free', 'open source', 'self-hosted', 'crack', 'torrent', 'nulled', 'keygen'
    ]
  },
  media: {
    label: "Media & Downloads",
    words: [
      'download', 'pdf', 'images', 'video', 'torrent', 'crack', 'mp3', 'mp4',
      'movie', 'youtube', 'facebook', 'instagram', 'twitter', 'tiktok', 'pics'
    ]
  }
};

const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function KeywordNegativePage() {
  const [kw, setKw] = useState('');
  const [activeLists, setActiveLists] = useState<Record<string, boolean>>({
    common: true,
    informational: false,
    bargain: false,
    jobs: false,
    adult: false,
    b2b: false,
    ecommerce: false,
    local: false,
    saas: false,
    media: false,
  });
  const [customListText, setCustomListText] = useState('');
  const [copied, setCopied] = useState(false);

  // Load custom list from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('seo-tool-custom-negatives');
    if (saved) {
      setCustomListText(saved);
    }
  }, []);

  const handleCustomListChange = (val: string) => {
    setCustomListText(val);
    localStorage.setItem('seo-tool-custom-negatives', val);
  };

  const activeNegatives = useMemo(() => {
    const words = new Set<string>();
    
    // Add built-ins
    Object.entries(BUILTIN_LISTS).forEach(([key, list]) => {
      if (activeLists[key]) {
        list.words.forEach(w => words.add(w.toLowerCase()));
      }
    });

    // Add custom
    if (customListText.trim()) {
      const customWords = customListText.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
      customWords.forEach(w => words.add(w));
    }

    return Array.from(words);
  }, [activeLists, customListText]);

  const { detectedNegatives, cleanedKeywords } = useMemo(() => {
    const lines = kw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const set = new Set<string>();
    const cleaned: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let isNegative = false;
      
      for (const neg of activeNegatives) {
        const pattern = `\\b${escapeRegExp(neg)}\\b`;
        const regex = new RegExp(pattern, 'i');
        
        if (regex.test(lowerLine)) {
          set.add(neg);
          isNegative = true;
        }
      }
      
      if (!isNegative) {
        cleaned.push(line);
      }
    }
    return { detectedNegatives: Array.from(set), cleanedKeywords: cleaned };
  }, [kw, activeNegatives]);

  const handleCopy = async () => {
    if (cleanedKeywords.length === 0) return;
    await navigator.clipboard.writeText(cleanedKeywords.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell title="Negative Keyword Tool" description="Identify negative keywords in your keyword list and add your own custom exclusions.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Keyword Input */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold mb-2 block">Your Keywords</Label>
            <Textarea 
              value={kw} 
              onChange={(e) => setKw(e.target.value)} 
              placeholder="Paste your keywords here (one per line)…" 
              className="min-h-[400px]" 
            />
          </div>
        </div>

        {/* Right Column: List Selection & Custom Inputs */}
        <div className="space-y-6">
          <Card>
            <CardBody className="p-4 space-y-4">
              <div className="font-semibold text-sm">Select Built-in Negative Lists</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(BUILTIN_LISTS).map(([key, list]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`list-${key}`} 
                      checked={activeLists[key]} 
                      onCheckedChange={(checked) => setActiveLists(prev => ({ ...prev, [key]: checked === true }))}
                    />
                    <Label htmlFor={`list-${key}`} className="cursor-pointer">{list.label}</Label>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4 space-y-3">
              <Label htmlFor="custom-negatives" className="font-semibold text-sm">Custom Negative Words</Label>
              <Textarea 
                id="custom-negatives"
                value={customListText}
                onChange={(e) => handleCustomListChange(e.target.value)}
                placeholder="Enter custom negatives (comma or newline separated)…"
                className="min-h-[120px]"
              />
              <p className="text-xs text-[var(--st-text-secondary)]">
                Add specific words or phrases to exclude. These will be checked along with the built-in lists selected above, and saved automatically.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Cleaned Keywords ({cleanedKeywords.length})</div>
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={cleanedKeywords.length === 0}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Textarea 
              readOnly 
              value={cleanedKeywords.join('\n')}
              placeholder="Cleaned keywords will appear here..."
              className="min-h-[200px] bg-[var(--st-bg-muted)]/50"
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBody className="p-4">
              <div className="font-semibold text-sm mb-3">Detected Negatives</div>
              {detectedNegatives.length === 0 ? (
                <span className="text-sm text-[var(--st-text-secondary)]">
                  {kw.trim().length > 0 ? (
                    <span className="text-[var(--st-text)]">Looks good! No negative keywords detected in your list.</span>
                  ) : (
                    "Enter some keywords to see if they contain any negatives."
                  )}
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detectedNegatives.map((n) => (
                    <span key={n} className="px-2 py-1 text-sm rounded-md border bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]">
                      -{n}
                    </span>
                  ))}
                </div>
              )}
              {detectedNegatives.length > 0 && (
                <div className="mt-4 text-sm font-medium text-[var(--st-text)]">
                  {detectedNegatives.length} negative word(s) detected.
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <div className="font-semibold text-sm mb-3">Currently Active Negatives ({activeNegatives.length})</div>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 pb-2">
                {activeNegatives.length === 0 && (
                  <span className="text-sm text-[var(--st-text-secondary)]">No negative lists selected.</span>
                )}
                {activeNegatives.map((n) => {
                  const isDetected = detectedNegatives.includes(n);
                  return (
                    <span 
                      key={n} 
                      className={`px-2 py-0.5 text-xs rounded border ${
                        isDetected 
                          ? 'bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)] font-medium' 
                          : 'bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text-secondary)]'
                      }`}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
