'use client';

import { Input, Label, Switch, Button, Badge, Card } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';
import { Save, Trash2, History } from 'lucide-react';
import { diffChars } from 'diff';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function UrlRewriterPage() {
  const [url, setUrl] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [isGlobal, setIsGlobal] = useState(true);
  const [isIgnoreCase, setIsIgnoreCase] = useState(false);
  
  type Rule = { find: string; replace: string; regex: boolean; isGlobal: boolean; isIgnoreCase: boolean };
  const [history, setHistory] = useState<Rule[]>([]);

  const { out, error } = useMemo(() => {
    if (!url || !find) return { out: url, error: null };
    try {
      let flags = '';
      if (isGlobal) flags += 'g';
      if (isIgnoreCase) flags += 'i';
      
      const pattern = regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (pattern === '(?:)' || pattern === '') {
        return { out: url, error: null };
      }

      const re = new RegExp(pattern, flags);
      return { out: url.replace(re, replace), error: null };
    } catch (e) {
      return { out: url, error: (e as Error).message };
    }
  }, [url, find, replace, regex, isGlobal, isIgnoreCase]);

  const diffResult = useMemo(() => {
    if (!url || !find || url === out) return [];
    return diffChars(url, out);
  }, [url, out, find]);

  const handleSaveRule = () => {
    if (!find) return;
    setHistory(prev => [...prev, { find, replace, regex, isGlobal, isIgnoreCase }]);
  };

  const removeRule = (index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  const loadRule = (rule: Rule) => {
    setFind(rule.find);
    setReplace(rule.replace);
    setRegex(rule.regex);
    setIsGlobal(rule.isGlobal);
    setIsIgnoreCase(rule.isIgnoreCase);
  };

  return (
    <ToolShell title="URL Rewriter" description="Find and replace text in a URL with optional regex.">
      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Source URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://old.example.com/path" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Find</Label>
              <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search text or pattern" />
            </div>
            <div className="space-y-2">
              <Label>Replace with</Label>
              <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replacement text" />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 p-4 bg-muted/40 border rounded-lg">
            <div className="flex items-center gap-2">
              <Switch checked={regex} onCheckedChange={setRegex} id="regex-switch" />
              <Label htmlFor="regex-switch" className="cursor-pointer">Regular Expression</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isGlobal} onCheckedChange={setIsGlobal} id="global-switch" />
              <Label htmlFor="global-switch" className="cursor-pointer">Global (Replace All)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isIgnoreCase} onCheckedChange={setIsIgnoreCase} id="ignore-case-switch" />
              <Label htmlFor="ignore-case-switch" className="cursor-pointer">Case Insensitive</Label>
            </div>
            <div className="ml-auto flex items-center">
              <Button size="sm" variant="secondary" onClick={handleSaveRule} disabled={!find}>
                <Save className="w-4 h-4 mr-2" /> Save Rule
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-md text-sm">
            <strong>Regex Error:</strong> {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Result Output</Label>
            <div className="font-mono text-sm bg-muted p-4 rounded-md break-all min-h-[3rem] border flex items-center">
              {out || <span className="text-muted-foreground">—</span>}
            </div>
          </div>

          {diffResult.length > 0 && (
            <div className="space-y-2">
              <Label>Highlight Changes</Label>
              <div className="font-mono text-sm bg-muted/30 p-4 rounded-md break-all border leading-relaxed">
                {diffResult.map((part, i) => (
                  <span
                    key={i}
                    className={_zoruCn(
                      part.added && "bg-green-500/30 text-green-900 dark:text-green-200 px-0.5 rounded",
                      part.removed && "bg-red-500/30 text-red-900 dark:text-red-200 line-through px-0.5 rounded opacity-70",
                      !part.added && !part.removed && "opacity-80"
                    )}
                  >
                    {part.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-3 pt-6 border-t mt-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4" /> Saved Rules
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {history.map((rule, idx) => (
                <Card key={idx} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 font-mono text-xs truncate">
                      <span className="font-semibold text-primary truncate max-w-[150px]" title={rule.find}>{rule.find}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold text-primary truncate max-w-[150px]" title={rule.replace}>{rule.replace || '""'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 sm:mt-0 sm:ml-4">
                      {rule.regex && <Badge variant="outline" className="text-[10px] h-5 px-1.5">Regex</Badge>}
                      {rule.isGlobal && <Badge variant="outline" className="text-[10px] h-5 px-1.5">Global</Badge>}
                      {rule.isIgnoreCase && <Badge variant="outline" className="text-[10px] h-5 px-1.5">IgnoreCase</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => loadRule(rule)}>
                      Load
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeRule(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
