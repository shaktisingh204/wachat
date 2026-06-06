'use client';

import { Button, Input, Label, Switch, cn } from '@/components/sabcrm/20ui/compat';
import { useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import zxcvbn from 'zxcvbn';
import { words } from './words';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Copy,
  RefreshCw,
  Loader2
} from 'lucide-react';

export default function PasswordGeneratorPage() {
  const [mode, setMode] = useState<'random' | 'passphrase'>('random');
  
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });
  
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalize, setCapitalize] = useState(false);

  const [password, setPassword] = useState('');
  const [strengthResult, setStrengthResult] = useState<any>(null);
  
  const [pwnedCount, setPwnedCount] = useState<number | null>(null);
  const [isCheckingPwned, setIsCheckingPwned] = useState(false);
  
  const generate = () => {
    let out = '';
    
    if (mode === 'random') {
      let charset = '';
      if (opts.upper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (opts.lower) charset += 'abcdefghijklmnopqrstuvwxyz';
      if (opts.digits) charset += '0123456789';
      if (opts.symbols) charset += '!@#$%^&*()_+-=[]{}<>?';
      if (!charset) {
        charset = 'abcdefghijklmnopqrstuvwxyz'; // fallback
      }
      const arr = new Uint32Array(length);
      crypto.getRandomValues(arr);
      for (let i = 0; i < length; i++) {
        out += charset[arr[i] % charset.length];
      }
    } else {
      const arr = new Uint32Array(wordCount);
      crypto.getRandomValues(arr);
      const chosenWords = [];
      for (let i = 0; i < wordCount; i++) {
        let w = words[arr[i] % words.length];
        if (capitalize) {
          w = w.charAt(0).toUpperCase() + w.slice(1);
        }
        chosenWords.push(w);
      }
      out = chosenWords.join(separator);
    }
    
    setPassword(out);
  };

  useEffect(() => {
    if (password) {
      setStrengthResult(zxcvbn(password));
      setPwnedCount(null);
    } else {
      setStrengthResult(null);
    }
  }, [password]);

  const checkPwned = async () => {
    if (!password) return;
    setIsCheckingPwned(true);
    setPwnedCount(null);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);
      
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) throw new Error('Failed to fetch from HIBP API');
      
      const text = await res.text();
      const lines = text.split('\n');
      let foundCount = 0;
      
      for (const line of lines) {
        const [hash, count] = line.split(':');
        if (hash && hash.trim() === suffix) {
          foundCount = parseInt(count.trim(), 10);
          break;
        }
      }
      
      setPwnedCount(foundCount);
    } catch (e) {
      console.error(e);
      setPwnedCount(-1);
    } finally {
      setIsCheckingPwned(false);
    }
  };

  // Generate on initial load
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strengthScore = strengthResult ? strengthResult.score : 0; // 0-4
  const strengthColors = ['bg-zoru-ink', 'bg-zoru-ink', 'bg-zoru-ink', 'bg-zoru-ink', 'bg-zoru-ink'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  return (
    <ToolShell title="Password Generator" description="Generate strong, memorable, and secure passwords.">
      
      <div className="bg-zoru-surface border rounded-lg p-6 space-y-6">
        <div className="flex gap-4">
          <Button 
            variant={mode === 'random' ? 'default' : 'outline'} 
            onClick={() => setMode('random')}
            className="flex-1"
          >
            Random Password
          </Button>
          <Button 
            variant={mode === 'passphrase' ? 'default' : 'outline'} 
            onClick={() => setMode('passphrase')}
            className="flex-1"
          >
            Memorable Passphrase
          </Button>
        </div>

        {mode === 'random' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Length</Label>
                <span className="text-zoru-ink-muted text-sm font-mono">{length}</span>
              </div>
              <input 
                type="range" 
                min={8} 
                max={128} 
                value={length} 
                onChange={(e) => setLength(Number(e.target.value))} 
                className="w-full accent-primary" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['upper','lower','digits','symbols'] as const).map((k) => (
                <div key={k} className="flex items-center gap-2 bg-zoru-surface-2/50 p-2 rounded-md">
                  <Switch checked={opts[k]} onCheckedChange={(v) => setOpts((s) => ({ ...s, [k]: v }))} />
                  <Label className="capitalize cursor-pointer" onClick={() => setOpts(s => ({...s, [k]: !s[k]}))}>{k}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'passphrase' && (
          <div className="space-y-4 animate-in fade-in">
             <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Number of Words</Label>
                <span className="text-zoru-ink-muted text-sm font-mono">{wordCount}</span>
              </div>
              <input 
                type="range" 
                min={3} 
                max={10} 
                value={wordCount} 
                onChange={(e) => setWordCount(Number(e.target.value))} 
                className="w-full accent-primary" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Separator</Label>
                <select 
                  className="w-full bg-zoru-surface border rounded-md p-2 text-sm"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=" ">Space ( )</option>
                  <option value=".">Period (.)</option>
                  <option value="">None</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2 bg-zoru-surface-2/50 p-2 rounded-md mt-6">
                  <Switch checked={capitalize} onCheckedChange={setCapitalize} />
                  <Label className="capitalize cursor-pointer" onClick={() => setCapitalize(!capitalize)}>Capitalize Words</Label>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button onClick={generate} className="w-full" size="lg">
            <RefreshCw className="w-4 h-4 mr-2" /> Generate New
          </Button>
        </div>
      </div>

      {password && (
        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="relative group">
            <Input 
              readOnly 
              value={password} 
              className="font-mono text-lg md:text-xl p-6 pr-24 h-auto" 
            />
            <Button 
              size="icon" 
              variant="secondary" 
              className="absolute right-2 top-2 h-auto py-2"
              onClick={() => navigator.clipboard.writeText(password)}
              title="Copy to clipboard"
            >
              <Copy className="w-5 h-5" />
            </Button>
          </div>

          <div className="bg-zoru-surface border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-lg">Password Strength</h3>
              <span className={cn("font-semibold", strengthResult ? `text-${strengthColors[strengthScore].split('-')[1]}-500` : '')}>
                {strengthLabels[strengthScore]}
              </span>
            </div>
            
            <div className="flex h-2 w-full gap-1">
              {[0, 1, 2, 3, 4].map(idx => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex-1 rounded-full transition-all duration-300",
                    idx <= strengthScore ? strengthColors[strengthScore] : "bg-zoru-surface-2"
                  )}
                />
              ))}
            </div>

            {strengthResult && strengthResult.feedback && (
              <div className="text-sm space-y-2 mt-4 text-zoru-ink-muted">
                {strengthResult.feedback.warning && (
                  <p className="text-zoru-ink flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{strengthResult.feedback.warning}</span>
                  </p>
                )}
                {strengthResult.feedback.suggestions && strengthResult.feedback.suggestions.length > 0 && (
                  <ul className="space-y-1 list-disc list-inside">
                    {strengthResult.feedback.suggestions.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs opacity-70 pt-2 border-t mt-2">
                  Estimated crack time: {strengthResult.crack_times_display.offline_slow_hashing_1e4_per_second} (offline slow hash)
                </p>
              </div>
            )}
          </div>

          <div className="bg-zoru-surface border rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-zoru-ink" />
                  Have I Been Pwned Check
                </h3>
                <p className="text-sm text-zoru-ink-muted mt-1">
                  Securely checks if this password has appeared in known data breaches using k-anonymity (only sends part of a hash).
                </p>
              </div>
              <Button 
                onClick={checkPwned} 
                disabled={isCheckingPwned}
                variant="outline"
              >
                {isCheckingPwned ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</>
                ) : (
                  'Check Password'
                )}
              </Button>
            </div>

            {pwnedCount !== null && (
              <div className={cn(
                "mt-4 p-4 rounded-md border flex items-start gap-3",
                pwnedCount > 0 ? "bg-zoru-ink/10 border-destructive/20 text-zoru-ink" : 
                pwnedCount === -1 ? "bg-zoru-surface-2 border-muted-foreground/20 text-zoru-ink-muted" :
                "bg-zoru-ink/10 border-zoru-line/20 text-zoru-ink dark:text-zoru-ink-muted"
              )}>
                {pwnedCount > 0 ? (
                  <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                )}
                
                <div>
                  {pwnedCount > 0 ? (
                    <>
                      <p className="font-semibold">This password has been pwned!</p>
                      <p className="text-sm mt-1">It has appeared in {pwnedCount.toLocaleString()} data breaches. You should never use this password.</p>
                    </>
                  ) : pwnedCount === 0 ? (
                    <>
                      <p className="font-semibold">Good news!</p>
                      <p className="text-sm mt-1">This password was not found in any known data breaches.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Error checking password</p>
                      <p className="text-sm mt-1">There was a problem reaching the Have I Been Pwned API.</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </ToolShell>
  );
}
