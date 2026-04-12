'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function PasswordGeneratorPage() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true });
  const [password, setPassword] = useState('');

  const generate = () => {
    let charset = '';
    if (opts.upper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.digits) charset += '0123456789';
    if (opts.symbols) charset += '!@#$%^&*()_+-=[]{}<>?';
    if (!charset) return;
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < length; i++) out += charset[arr[i] % charset.length];
    setPassword(out);
  };

  const strength = Math.min(100, password.length * 6 + (Object.values(opts).filter(Boolean).length * 10));

  return (
    <ToolShell title="Password Generator" description="Generate strong, cryptographically random passwords.">
      <div className="space-y-1"><Label>Length: {length}</Label>
        <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full" />
      </div>
      <div className="flex flex-wrap gap-4">
        {(['upper','lower','digits','symbols'] as const).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <Switch checked={opts[k]} onCheckedChange={(v) => setOpts((s) => ({ ...s, [k]: v }))} />
            <Label className="capitalize">{k}</Label>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={generate}>Generate</Button>
        {password && <Button variant="outline" onClick={() => navigator.clipboard.writeText(password)}>Copy</Button>}
      </div>
      {password && (
        <>
          <Input readOnly value={password} className="font-mono" />
          <div className="h-1.5 bg-muted rounded"><div className="h-full rounded bg-green-500" style={{ width: `${strength}%` }} /></div>
        </>
      )}
    </ToolShell>
  );
}
