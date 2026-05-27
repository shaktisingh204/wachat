'use client';
import { useState } from 'react';
import { Check, Copy, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/zoruui';

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
    <div className={cn("rounded-xl border shadow-lg overflow-hidden font-mono text-[12px] transition-colors", 
      isDark ? "border-zoru-line bg-zoru-ink text-white" : "border-zoru-line bg-white text-zoru-ink"
    )}>
      {/* Top Window Bar */}
      <div className={cn("flex items-center justify-between border-b px-4 py-2.5 text-[11px]", 
        isDark ? "border-zoru-line bg-zoru-ink text-zoru-ink-muted" : "border-zoru-line bg-zoru-surface-2 text-zoru-ink"
      )}>
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zoru-ink border-zoru-line" : "bg-zoru-surface-2 border-zoru-line")} />
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zoru-ink border-zoru-line" : "bg-zoru-surface-2 border-zoru-line")} />
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zoru-ink border-zoru-line" : "bg-zoru-surface-2 border-zoru-line")} />
          <span className={cn("ml-2 font-medium tracking-tight", isDark ? "text-zoru-ink-muted" : "text-zoru-ink")}>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-[10px] uppercase tracking-widest font-bold", isDark ? "text-zoru-ink" : "text-zoru-ink")}>cURL // BASH</span>
          <button onClick={toggleTheme} className="hover:opacity-75 transition-opacity">
            {isDark ? <Sun className="w-3.5 h-3.5 text-zoru-ink-muted" /> : <Moon className="w-3.5 h-3.5 text-zoru-ink" />}
          </button>
        </div>
      </div>

      {/* Code Container */}
      <div className="p-4 space-y-4">
        <div>
          <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", isDark ? "text-zoru-ink" : "text-zoru-ink")}>
            <span>// REQUEST PAYLOAD</span>
            <button
              onClick={handleCopyReq}
              className={cn("flex items-center gap-1 text-[10px] hover:opacity-75 transition-colors uppercase", isDark ? "text-zoru-ink hover:text-zoru-ink-muted" : "text-zoru-ink hover:text-zoru-ink")}
            >
              {copiedReq ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedReq ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-lg border leading-relaxed", 
            isDark ? "bg-zoru-ink/50 border-zoru-line/80 text-zoru-ink-muted" : "bg-zoru-surface-2 border-zoru-line text-zoru-ink"
          )}>
            <code>{code.trim()}</code>
          </pre>
        </div>

        {response ? (
          <div>
            <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", isDark ? "text-zoru-ink" : "text-zoru-ink")}>
              <span>// RESPONSE BLOB</span>
              <button
                onClick={handleCopyRes}
                className={cn("flex items-center gap-1 text-[10px] hover:opacity-75 transition-colors uppercase", isDark ? "text-zoru-ink hover:text-zoru-ink-muted" : "text-zoru-ink hover:text-zoru-ink")}
              >
                {copiedRes ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedRes ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-lg border leading-relaxed", 
              isDark ? "bg-zoru-ink/50 border-zoru-line/80 text-zoru-ink-muted" : "bg-zoru-surface-2 border-zoru-line text-zoru-ink"
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
    <div className="flex flex-wrap gap-2 py-4 border-b border-zoru-line mb-8">
      {modules.map(mod => {
        const isActive = mod === activeModule;
        return (
          <button
            key={mod}
            onClick={() => {
              router.push(`?module=${mod}`);
            }}
            className={cn(
              "px-3 py-1.5 text-[12px] font-mono rounded-full border transition-colors",
              isActive 
                ? "bg-black text-white border-black" 
                : "bg-white text-zoru-ink border-zoru-line hover:border-zoru-line hover:bg-zoru-surface-2"
            )}
          >
            {mod}
          </button>
        );
      })}
    </div>
  );
}
