'use client';

import { Button, Input, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

type MatchType = 'exact' | 'prefix' | 'regex';
type MethodType = 'return' | 'rewrite';
type StatusType = '301' | '302';

interface Rule {
  id: string;
  from: string;
  to: string;
  matchType: MatchType;
  method: MethodType;
  status: StatusType;
}

export default function NginxRedirectPage() {
  const [rows, setRows] = useState<Rule[]>([{ 
    id: '1', 
    from: '/old', 
    to: '/new', 
    matchType: 'exact',
    method: 'return',
    status: '301'
  }]);

  const updateRow = <K extends keyof Rule>(id: string, key: K, value: Rule[K]) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setRows((rs) => [
      ...rs,
      {
        id: Math.random().toString(36).slice(2),
        from: '',
        to: '',
        matchType: 'exact',
        method: 'return',
        status: '301',
      },
    ]);
  };

  const out = useMemo(() => {
    const lines = ['server {', '    listen 80;', '    server_name example.com;', ''];
    
    for (const r of rows) {
      if (!r.from || !r.to) continue;
      
      const statusCode = r.status;
      const rwStatus = statusCode === '301' ? 'permanent' : 'redirect';
      
      if (r.method === 'return') {
        let mod = '';
        if (r.matchType === 'exact') mod = '= ';
        else if (r.matchType === 'regex') mod = '~ ';
        
        lines.push(`    location ${mod}${r.from} {`);
        lines.push(`        return ${statusCode} ${r.to};`);
        lines.push(`    }`);
        lines.push('');
      } else {
        let fromRegex = r.from;
        if (r.matchType === 'exact') {
          if (!fromRegex.startsWith('^')) fromRegex = '^' + fromRegex;
          if (!fromRegex.endsWith('$')) fromRegex = fromRegex + '$';
        } else if (r.matchType === 'prefix') {
          if (!fromRegex.startsWith('^')) fromRegex = '^' + fromRegex;
        }
        lines.push(`    rewrite ${fromRegex} ${r.to} ${rwStatus};`);
        lines.push('');
      }
    }
    
    if (lines[lines.length - 1] === '') lines.pop(); // Remove trailing empty line
    lines.push('}');
    return lines.join('\n');
  }, [rows]);

  return (
    <ToolShell title="Nginx Redirect Generator" description="Generate optimized nginx rewrite or return rules.">
      <div className="space-y-4">
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col xl:flex-row gap-2 items-start xl:items-center bg-zoru-surface-2/30 p-3 xl:p-0 xl:bg-transparent rounded-lg">
              <select 
                className="border rounded-md h-9 px-2 bg-zoru-surface text-sm min-w-[110px] w-full xl:w-auto" 
                value={r.matchType} 
                onChange={(e) => updateRow(r.id, 'matchType', e.target.value as MatchType)}
              >
                <option value="exact">Exact (=)</option>
                <option value="prefix">Prefix</option>
                <option value="regex">Regex (~)</option>
              </select>

              <div className="flex-1 flex flex-col md:flex-row gap-2 items-center w-full">
                <Input 
                  value={r.from} 
                  onChange={(e) => updateRow(r.id, 'from', e.target.value)} 
                  placeholder="/old-path" 
                  className="w-full"
                />
                <ArrowRight className="w-4 h-4 text-zoru-ink-muted shrink-0 hidden md:block" />
                <Input 
                  value={r.to} 
                  onChange={(e) => updateRow(r.id, 'to', e.target.value)} 
                  placeholder="/new-path" 
                  className="w-full"
                />
              </div>

              <div className="flex gap-2 items-center w-full xl:w-auto justify-end">
                <select 
                  className="border rounded-md h-9 px-2 bg-zoru-surface text-sm" 
                  value={r.method} 
                  onChange={(e) => updateRow(r.id, 'method', e.target.value as MethodType)}
                >
                  <option value="return">Return</option>
                  <option value="rewrite">Rewrite</option>
                </select>

                <select 
                  className="border rounded-md h-9 px-2 bg-zoru-surface text-sm" 
                  value={r.status} 
                  onChange={(e) => updateRow(r.id, 'status', e.target.value as StatusType)}
                >
                  <option value="301">301</option>
                  <option value="302">302</option>
                </select>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0 text-zoru-ink hover:text-zoru-ink hover:bg-zoru-ink/10"
                  onClick={() => removeRow(r.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <Button variant="outline" onClick={addRow} className="gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </Button>
      </div>

      <div className="mt-8 space-y-2">
        <h3 className="text-sm font-medium">Generated Configuration</h3>
        <Textarea 
          readOnly 
          value={out} 
          className="min-h-[260px] font-mono text-sm bg-zoru-surface-2/50 p-4" 
        />
      </div>
    </ToolShell>
  );
}
