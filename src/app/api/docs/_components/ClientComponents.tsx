'use client';
import { useState } from 'react';
import { Check, Copy, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn, IconButton, SegmentedControl } from '@/components/sabcrm/20ui';

export function CodeTerminal({ title, code, response }: { title: string; code: string; response?: string }) {
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleCopyReq = () => {
    navigator.clipboard.writeText(code);
    setCopiedReq(true);
    setTimeout(() => setCopiedReq(false), 2000);
  };

  const handleCopyRes = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopiedRes(true);
      setTimeout(() => setCopiedRes(false), 2000);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'dark';

  return (
    <div className={cn("rounded-[var(--st-radius)] border shadow-lg overflow-hidden font-mono text-[12px] transition-colors",
      isDark ? "border-[var(--st-border)] bg-[var(--st-text)] text-white" : "border-[var(--st-border)] bg-white text-[var(--st-text)]"
    )}>
      {/* Top Window Bar */}
      <div className={cn("flex items-center justify-between border-b px-4 py-2.5 text-[11px]",
        isDark ? "border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text-secondary)]" : "border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
      )}>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full border", isDark ? "bg-[var(--st-text)] border-[var(--st-border)]" : "bg-[var(--st-bg-muted)] border-[var(--st-border)]")} />
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full border", isDark ? "bg-[var(--st-text)] border-[var(--st-border)]" : "bg-[var(--st-bg-muted)] border-[var(--st-border)]")} />
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full border", isDark ? "bg-[var(--st-text)] border-[var(--st-border)]" : "bg-[var(--st-bg-muted)] border-[var(--st-border)]")} />
          <span className={cn("ml-2 font-medium tracking-tight", isDark ? "text-[var(--st-text-secondary)]" : "text-[var(--st-text)]")}>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-[10px] uppercase tracking-widest font-bold", "text-[var(--st-text)]")}>cURL / BASH</span>
          <IconButton
            label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            icon={isDark ? Sun : Moon}
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
          />
        </div>
      </div>

      {/* Code Container */}
      <div className="p-4 space-y-4">
        <div>
          <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", "text-[var(--st-text)]")}>
            <span>{'// REQUEST PAYLOAD'}</span>
            <IconButton
              label={copiedReq ? 'Request payload copied' : 'Copy request payload'}
              icon={copiedReq ? Check : Copy}
              variant="ghost"
              size="sm"
              onClick={handleCopyReq}
            />
          </div>
          <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-[var(--st-radius)] border leading-relaxed",
            isDark ? "bg-[var(--st-text)]/50 border-[var(--st-border)]/80 text-[var(--st-text-secondary)]" : "bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]"
          )}>
            <code>{code.trim()}</code>
          </pre>
        </div>

        {response ? (
          <div>
            <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", "text-[var(--st-text)]")}>
              <span>{'// RESPONSE BLOB'}</span>
              <IconButton
                label={copiedRes ? 'Response copied' : 'Copy response'}
                icon={copiedRes ? Check : Copy}
                variant="ghost"
                size="sm"
                onClick={handleCopyRes}
              />
            </div>
            <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-[var(--st-radius)] border leading-relaxed",
              isDark ? "bg-[var(--st-text)]/50 border-[var(--st-border)]/80 text-[var(--st-text-secondary)]" : "bg-[var(--st-bg-muted)] border-[var(--st-border)] text-[var(--st-text)]"
            )}>
              <code>{response.trim()}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ModuleSelector({ modules, activeModule }: { modules: string[], activeModule: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2 py-4 border-b border-[var(--st-border)] mb-8">
      <SegmentedControl
        aria-label="API module"
        value={activeModule}
        items={modules.map(mod => ({ value: mod, label: mod }))}
        onChange={(mod) => router.push(`?module=${mod}`)}
      />
    </div>
  );
}
