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
      isDark ? "border-zinc-800 bg-zinc-950 text-zinc-100" : "border-zinc-200 bg-white text-zinc-900"
    )}>
      {/* Top Window Bar */}
      <div className={cn("flex items-center justify-between border-b px-4 py-2.5 text-[11px]", 
        isDark ? "border-zinc-900 bg-zinc-900 text-zinc-400" : "border-zinc-200 bg-zinc-100 text-zinc-600"
      )}>
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zinc-800 border-zinc-700" : "bg-red-400 border-red-500")} />
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zinc-800 border-zinc-700" : "bg-yellow-400 border-yellow-500")} />
          <span className={cn("h-2 w-2 rounded-full border", isDark ? "bg-zinc-800 border-zinc-700" : "bg-green-400 border-green-500")} />
          <span className={cn("ml-2 font-medium tracking-tight", isDark ? "text-zinc-400" : "text-zinc-600")}>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-[10px] uppercase tracking-widest font-bold", isDark ? "text-zinc-500" : "text-zinc-500")}>cURL // BASH</span>
          <button onClick={toggleTheme} className="hover:opacity-75 transition-opacity">
            {isDark ? <Sun className="w-3.5 h-3.5 text-zinc-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-600" />}
          </button>
        </div>
      </div>

      {/* Code Container */}
      <div className="p-4 space-y-4">
        <div>
          <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", isDark ? "text-zinc-500" : "text-zinc-500")}>
            <span>// REQUEST PAYLOAD</span>
            <button
              onClick={handleCopyReq}
              className={cn("flex items-center gap-1 text-[10px] hover:opacity-75 transition-colors uppercase", isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700")}
            >
              {copiedReq ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedReq ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-lg border leading-relaxed", 
            isDark ? "bg-zinc-900/50 border-zinc-900/80 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-800"
          )}>
            <code>{code.trim()}</code>
          </pre>
        </div>

        {response ? (
          <div>
            <div className={cn("flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 font-bold", isDark ? "text-zinc-500" : "text-zinc-500")}>
              <span>// RESPONSE BLOB</span>
              <button
                onClick={handleCopyRes}
                className={cn("flex items-center gap-1 text-[10px] hover:opacity-75 transition-colors uppercase", isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700")}
              >
                {copiedRes ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedRes ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className={cn("overflow-x-auto whitespace-pre p-3 rounded-lg border leading-relaxed", 
              isDark ? "bg-zinc-900/50 border-zinc-900/80 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-800"
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
    <div className="flex flex-wrap gap-2 py-4 border-b border-zinc-200 mb-8">
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
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
            )}
          >
            {mod}
          </button>
        );
      })}
    </div>
  );
}
