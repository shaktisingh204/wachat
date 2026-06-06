'use client';

import { useState, useEffect } from 'react';
import zxcvbn from 'zxcvbn';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Copy,
  RefreshCw,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Input,
  Switch,
  Slider,
  Badge,
  Alert,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { words } from './words';

type StrengthTone = 'danger' | 'warning' | 'success';

const STRENGTH_LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_TONES: StrengthTone[] = ['danger', 'danger', 'warning', 'success', 'success'];
const STRENGTH_BAR_FILL: Record<StrengthTone, string> = {
  danger: 'bg-[var(--st-danger)]',
  warning: 'bg-[var(--st-warn)]',
  success: 'bg-[var(--st-status-ok)]',
};

const OPTION_LABELS: Record<'upper' | 'lower' | 'digits' | 'symbols', string> = {
  upper: 'Uppercase',
  lower: 'Lowercase',
  digits: 'Digits',
  symbols: 'Symbols',
};

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
      out = chosenWords.join(separator === 'none' ? '' : separator);
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
  const strengthTone = STRENGTH_TONES[strengthScore];

  return (
    <ToolShell title="Password Generator" description="Generate strong, memorable, and secure passwords.">

      <Card padding="lg">
        <CardBody className="space-y-6">
          <div className="flex gap-4">
            <Button
              variant={mode === 'random' ? 'primary' : 'outline'}
              onClick={() => setMode('random')}
              className="flex-1"
            >
              Random Password
            </Button>
            <Button
              variant={mode === 'passphrase' ? 'primary' : 'outline'}
              onClick={() => setMode('passphrase')}
              className="flex-1"
            >
              Memorable Passphrase
            </Button>
          </div>

          {mode === 'random' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--st-text)]">Length</span>
                  <span className="text-[var(--st-text-secondary)] text-sm font-mono">{length}</span>
                </div>
                <Slider
                  min={8}
                  max={128}
                  value={length}
                  onValueChange={(v) => setLength(v as number)}
                  ariaLabel="Password length"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['upper', 'lower', 'digits', 'symbols'] as const).map((k) => (
                  <div
                    key={k}
                    className="flex items-center gap-2 bg-[var(--st-bg-secondary)] p-2 rounded-[var(--st-radius)]"
                  >
                    <Switch
                      checked={opts[k]}
                      onCheckedChange={(v) => setOpts((s) => ({ ...s, [k]: v }))}
                      label={OPTION_LABELS[k]}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'passphrase' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--st-text)]">Number of Words</span>
                  <span className="text-[var(--st-text-secondary)] text-sm font-mono">{wordCount}</span>
                </div>
                <Slider
                  min={3}
                  max={10}
                  value={wordCount}
                  onValueChange={(v) => setWordCount(v as number)}
                  ariaLabel="Number of words"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Separator">
                  <Select value={separator} onValueChange={setSeparator}>
                    <SelectTrigger aria-label="Separator">
                      <SelectValue placeholder="Choose a separator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Hyphen (-)</SelectItem>
                      <SelectItem value="_">Underscore (_)</SelectItem>
                      <SelectItem value=" ">Space ( )</SelectItem>
                      <SelectItem value=".">Period (.)</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="flex items-end pb-2">
                  <Switch
                    checked={capitalize}
                    onCheckedChange={setCapitalize}
                    label="Capitalize Words"
                  />
                </div>
              </div>
            </div>
          )}
        </CardBody>
        <CardFooter>
          <Button onClick={generate} block size="lg" iconLeft={RefreshCw}>
            Generate New
          </Button>
        </CardFooter>
      </Card>

      {password && (
        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="relative">
            <Input
              readOnly
              value={password}
              aria-label="Generated password"
              className="font-mono text-lg md:text-xl pr-24"
            />
            <IconButton
              icon={Copy}
              label="Copy to clipboard"
              variant="secondary"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => navigator.clipboard.writeText(password)}
            />
          </div>

          <Card padding="lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Password Strength</CardTitle>
                {strengthResult ? (
                  <Badge tone={strengthTone}>{STRENGTH_LABELS[strengthScore]}</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex h-2 w-full gap-1">
                {[0, 1, 2, 3, 4].map(idx => (
                  <div
                    key={idx}
                    className={cn(
                      'flex-1 rounded-full transition-all duration-300',
                      idx <= strengthScore
                        ? STRENGTH_BAR_FILL[strengthTone]
                        : 'bg-[var(--st-border)]'
                    )}
                  />
                ))}
              </div>

              {strengthResult && strengthResult.feedback && (
                <div className="text-sm space-y-3 text-[var(--st-text-secondary)]">
                  {strengthResult.feedback.warning && (
                    <Alert tone="warning" icon={AlertTriangle}>
                      {strengthResult.feedback.warning}
                    </Alert>
                  )}
                  {strengthResult.feedback.suggestions && strengthResult.feedback.suggestions.length > 0 && (
                    <ul className="space-y-1 list-disc list-inside">
                      {strengthResult.feedback.suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs pt-2 border-t border-[var(--st-border)] text-[var(--st-text-tertiary)]">
                    Estimated crack time: {strengthResult.crack_times_display.offline_slow_hashing_1e4_per_second} (offline slow hash)
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[var(--st-text)]" aria-hidden="true" />
                    Have I Been Pwned Check
                  </CardTitle>
                  <CardDescription>
                    Securely checks if this password has appeared in known data breaches using k-anonymity (only sends part of a hash).
                  </CardDescription>
                </div>
                <Button
                  onClick={checkPwned}
                  loading={isCheckingPwned}
                  variant="outline"
                >
                  {isCheckingPwned ? 'Checking...' : 'Check Password'}
                </Button>
              </div>
            </CardHeader>

            {pwnedCount !== null && (
              <CardBody>
                {pwnedCount > 0 ? (
                  <Alert tone="danger" icon={ShieldAlert} title="This password has been pwned!">
                    It has appeared in {pwnedCount.toLocaleString()} data breaches. You should never use this password.
                  </Alert>
                ) : pwnedCount === 0 ? (
                  <Alert tone="success" icon={CheckCircle2} title="Good news!">
                    This password was not found in any known data breaches.
                  </Alert>
                ) : (
                  <Alert tone="neutral" title="Error checking password">
                    There was a problem reaching the Have I Been Pwned API.
                  </Alert>
                )}
              </CardBody>
            )}
          </Card>

        </div>
      )}
    </ToolShell>
  );
}
