'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

import {
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

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
    status: '301',
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
            <div
              key={r.id}
              className="flex flex-col xl:flex-row gap-2 items-start xl:items-end bg-[var(--st-bg-muted)] p-3 xl:p-0 xl:bg-transparent rounded-[var(--st-radius)]"
            >
              <Field label="Match" className="w-full xl:w-auto">
                <Select
                  value={r.matchType}
                  onValueChange={(value) => updateRow(r.id, 'matchType', value as MatchType)}
                >
                  <SelectTrigger aria-label="Match type" className="min-w-[110px] w-full xl:w-auto">
                    <SelectValue placeholder="Match" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact (=)</SelectItem>
                    <SelectItem value="prefix">Prefix</SelectItem>
                    <SelectItem value="regex">Regex (~)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex-1 flex flex-col md:flex-row gap-2 items-end w-full">
                <Field label="From" className="w-full">
                  <Input
                    value={r.from}
                    onChange={(e) => updateRow(r.id, 'from', e.target.value)}
                    placeholder="/old-path"
                    className="w-full"
                  />
                </Field>
                <ArrowRight
                  className="w-4 h-4 text-[var(--st-text-secondary)] shrink-0 hidden md:block mb-2.5"
                  aria-hidden="true"
                />
                <Field label="To" className="w-full">
                  <Input
                    value={r.to}
                    onChange={(e) => updateRow(r.id, 'to', e.target.value)}
                    placeholder="/new-path"
                    className="w-full"
                  />
                </Field>
              </div>

              <div className="flex gap-2 items-end w-full xl:w-auto justify-end">
                <Field label="Method">
                  <Select
                    value={r.method}
                    onValueChange={(value) => updateRow(r.id, 'method', value as MethodType)}
                  >
                    <SelectTrigger aria-label="Method">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Return</SelectItem>
                      <SelectItem value="rewrite">Rewrite</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Status">
                  <Select
                    value={r.status}
                    onValueChange={(value) => updateRow(r.id, 'status', value as StatusType)}
                  >
                    <SelectTrigger aria-label="Status code">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301</SelectItem>
                      <SelectItem value="302">302</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <IconButton
                  label="Remove rule"
                  icon={Trash2}
                  variant="ghost"
                  className="shrink-0 mb-0.5"
                  onClick={() => removeRow(r.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" iconLeft={Plus} onClick={addRow}>
          Add Rule
        </Button>
      </div>

      <div className="mt-8 space-y-2">
        <h3 className="text-sm font-medium text-[var(--st-text)]">Generated Configuration</h3>
        <Textarea
          readOnly
          value={out}
          rows={12}
          className="min-h-[260px] font-mono text-sm"
        />
      </div>
    </ToolShell>
  );
}
