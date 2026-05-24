'use client';

import { Card, ZoruCardContent, Input, Label, Button } from '@/components/zoruui';
import { useState } from 'react';
import { Copy, Check, Wand2, Loader2 } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

// Mock backend API call to simulate LLM generation
const generateMockAdCopy = async (product: string, audience: string, keyword: string, tone: string) => {
  return new Promise<{ headlines: string[], descriptions: string[] }>((resolve) => {
    setTimeout(() => {
      const isUrgent = tone.toLowerCase() === 'urgent';
      const isFormal = tone.toLowerCase() === 'formal';

      const headlines = [
        isUrgent ? `Don't Miss Out on ${product}` : isFormal ? `Introducing ${product}` : `Meet ${product}, Your New Favorite`,
        isUrgent ? `Get 50% Off ${product} Today!` : `${product} — The Best Solution for ${audience}`,
        `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Made Easy with ${product}`
      ];

      const descriptions = [
        `Looking for ${keyword}? Try ${product} today. Specially designed for ${audience}, it's the perfect way to get results ${isUrgent ? 'fast' : isFormal ? 'efficiently' : 'with a smile'}.`,
        `${isUrgent ? 'Act now!' : isFormal ? 'Discover the benefits.' : 'Hey there!'} See why ${audience} trust ${product} for all their ${keyword} needs. ${isUrgent ? 'Limited time offer.' : 'Get started today.'}`
      ];
      
      resolve({ headlines, descriptions });
    }, 1500);
  });
};

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="flex items-center justify-between text-sm border-t border-zoru-line py-2 text-zoru-ink group">
      <span className="pr-4">{text}</span>
      <button 
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-zoru-line/50 rounded-md shrink-0 focus:opacity-100"
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-zoru-ink/60" />}
      </button>
    </div>
  );
}

export default function AdCopyGeneratorPage() {
  const [product, setProduct] = useState('SEO Tools');
  const [audience, setAudience] = useState('small business owners');
  const [keyword, setKeyword] = useState('seo tools');
  const [tone, setTone] = useState('friendly');

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ headlines: string[], descriptions: string[] }>({
    headlines: [],
    descriptions: []
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const generated = await generateMockAdCopy(product, audience, keyword, tone);
      setResults(generated);
    } catch (error) {
      console.error('Error generating copy', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ToolShell title="Ad Copy Generator" description="Generate AI-powered headlines and descriptions for a PPC ad.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="space-y-1"><Label>Product / service</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target keyword</Label><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
        <div className="space-y-1"><Label>Tone</Label>
          <select className="border border-zoru-line rounded-[var(--zoru-radius)] h-9 px-2 bg-zoru-bg text-zoru-ink w-full text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="urgent">Urgent</option>
            <option value="formal">Formal</option>
          </select>
        </div>
      </div>
      
      <Button 
        onClick={handleGenerate} 
        disabled={isLoading || !product || !audience || !keyword}
        className="mb-6 w-full md:w-auto"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
        Generate Ad Copy
      </Button>

      {(results.headlines.length > 0 || results.descriptions.length > 0) && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ZoruCardContent className="p-4 space-y-4">
            {results.headlines.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-zoru-ink mb-2">Headlines</div>
                <div className="space-y-1">
                  {results.headlines.map((h, i) => (
                    <CopyText key={i} text={h} />
                  ))}
                </div>
              </div>
            )}
            
            {results.descriptions.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-zoru-ink mb-2 mt-4">Descriptions</div>
                <div className="space-y-1">
                  {results.descriptions.map((d, i) => (
                    <CopyText key={i} text={d} />
                  ))}
                </div>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
