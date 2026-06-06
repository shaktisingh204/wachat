'use client';

import { Input, Label, Textarea, Switch, Button, cn } from '@/components/sabcrm/20ui';
import { useState, useEffect, useRef } from 'react';
import { Copy, Check, AlertCircle, Plus, Trash2, Upload, Loader2, Download, X } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

type Rule = {
  id: string;
  find: string;
  replace: string;
  regex: boolean;
  caseSensitive: boolean;
};

export default function FindAndReplacePage() {
  const [rules, setRules] = useState<Rule[]>([
    { id: 'initial-1', find: '', replace: '', regex: false, caseSensitive: false }
  ]);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const fullTextRef = useRef<string>('');
  const outputTextRef = useRef<string>('');

  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLargeFile, setIsLargeFile] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Web Worker to offload regex operations and prevent main thread lag
    function workerLogic() {
      self.onmessage = function (e: any) {
        const { text, rules } = e.data;
        let output = text;
        let error = null;
        let totalMatches = 0;

        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (!rule.find) continue;
          
          try {
            const flags = rule.caseSensitive ? 'g' : 'gi';
            const re = rule.regex
              ? new RegExp(rule.find, flags)
              : new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
            const matches = output.match(re);
            if (matches) totalMatches += matches.length;
            output = output.replace(re, rule.replace);
          } catch (err: any) {
            error = `Rule ${i + 1}: ${err.message || 'Invalid regular expression'}`;
            break; // Stop further rules if regex is invalid
          }
        }

        self.postMessage({ output, totalMatches, error });
      };
    }

    const code = '(' + workerLogic.toString() + ')()';
    const blob = new Blob([code], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      const { output, totalMatches, error } = e.data;
      outputTextRef.current = output;
      
      if (outputRef.current) {
        if (output.length > 100000) {
          outputRef.current.value = output.slice(0, 100000) + '\n\n...[Output truncated for performance. Please download to view full file.]';
        } else {
          outputRef.current.value = output;
        }
      }
      
      setCount(totalMatches);
      setError(error);
      setIsProcessing(false);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const triggerProcess = () => {
    if (!workerRef.current) return;
    setIsProcessing(true);
    
    let textToProcess = '';
    if (isLargeFile) {
      textToProcess = fullTextRef.current;
    } else {
      textToProcess = textRef.current?.value || '';
      fullTextRef.current = textToProcess;
    }

    workerRef.current.postMessage({
      text: textToProcess,
      rules
    });
  };

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      triggerProcess();
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [rules]);

  const handleTextChange = () => {
    if (isLargeFile) return; // Prevent change trigger if readOnly
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      triggerProcess();
    }, 300);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.length > 100000) {
      e.preventDefault();
      
      let newText = '';
      if (textRef.current) {
        const start = textRef.current.selectionStart;
        const end = textRef.current.selectionEnd;
        const currentVal = textRef.current.value;
        newText = currentVal.substring(0, start) + pastedText + currentVal.substring(end);
      } else {
        newText = pastedText;
      }
      
      fullTextRef.current = newText;
      setIsLargeFile(true);
      if (textRef.current) {
        textRef.current.value = newText.slice(0, 100000) + '\n\n...[Content truncated for performance]';
      }
      triggerProcess();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      fullTextRef.current = result;
      if (result.length > 100000) {
        setIsLargeFile(true);
        if (textRef.current) {
          textRef.current.value = result.slice(0, 100000) + '\n\n...[Content truncated for performance]';
        }
      } else {
        setIsLargeFile(false);
        if (textRef.current) {
          textRef.current.value = result;
        }
      }
      triggerProcess();
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  const clearText = () => {
    fullTextRef.current = '';
    outputTextRef.current = '';
    setIsLargeFile(false);
    if (textRef.current) textRef.current.value = '';
    if (outputRef.current) outputRef.current.value = '';
    setCount(0);
    setError(null);
  };

  const addRule = () => {
    setRules([...rules, { id: Math.random().toString(36).substring(7), find: '', replace: '', regex: false, caseSensitive: false }]);
  };

  const removeRule = (id: string) => {
    if (rules.length === 1) return;
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, field: keyof Rule, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleCopy = () => {
    const textToCopy = outputTextRef.current || outputRef.current?.value || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    const textToDownload = outputTextRef.current || outputRef.current?.value || '';
    if (!textToDownload) return;
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'find-replace-output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Find and Replace" description="Find and replace text in bulk sequentially with optional regex.">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            Input Text
            {isLargeFile && <span className="text-xs bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)] px-2 py-0.5 rounded-full">Large File Mode</span>}
          </Label>
          <div className="flex items-center gap-2">
            {(isLargeFile || (textRef.current && textRef.current.value.length > 0)) && (
              <Button variant="ghost" size="sm" onClick={clearText} className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Input 
              ref={fileInputRef} 
              type="file" 
              accept=".txt,.csv,.json,.md,.js,.ts,.html,.css" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>
        </div>
        <Textarea 
          ref={textRef} 
          onChange={handleTextChange} 
          onPaste={handlePaste}
          placeholder="Paste text or upload a file…" 
          className={cn("min-h-[220px]", isLargeFile && "opacity-75 bg-[var(--st-bg-muted)] cursor-not-allowed")}
          readOnly={isLargeFile}
        />
        {isLargeFile && (
          <p className="text-xs text-[var(--st-text-secondary)]">Editing is disabled for large files to prevent browser lag. You can clear and upload a new file.</p>
        )}
      </div>

      <div className="space-y-4 my-6">
        <Label>Rules</Label>
        {rules.map((rule, index) => (
          <div key={rule.id} className="p-4 border rounded-lg bg-[var(--st-bg-secondary)] space-y-4 relative group">
            {rules.length > 1 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--st-text-secondary)] hover:text-[var(--st-text)]" 
                onClick={() => removeRule(rule.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <div className="font-medium text-sm text-[var(--st-text-secondary)]">Rule {index + 1}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Find</Label>
                <Input 
                  value={rule.find} 
                  onChange={(e) => updateRule(rule.id, 'find', e.target.value)} 
                  placeholder="Text to find…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Replace with</Label>
                <Input 
                  value={rule.replace} 
                  onChange={(e) => updateRule(rule.id, 'replace', e.target.value)} 
                  placeholder="Replacement text…"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={rule.regex} 
                  onCheckedChange={(c) => updateRule(rule.id, 'regex', c)} 
                />
                <Label className="cursor-pointer" onClick={() => updateRule(rule.id, 'regex', !rule.regex)}>Regex</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={rule.caseSensitive} 
                  onCheckedChange={(c) => updateRule(rule.id, 'caseSensitive', c)} 
                />
                <Label className="cursor-pointer" onClick={() => updateRule(rule.id, 'caseSensitive', !rule.caseSensitive)}>Case sensitive</Label>
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="outline" onClick={addRule} className="w-full border-dashed">
          <Plus className="w-4 h-4 mr-2" />
          Add Another Rule
        </Button>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text)] bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50 p-3 rounded-md mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <Label className="text-base font-semibold">Output</Label>
          {isProcessing ? (
            <div className="flex items-center text-xs text-[var(--st-text-secondary)]">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Processing…
            </div>
          ) : (
            <div className="text-sm text-[var(--st-text-secondary)]">
              {count} match{count === 1 ? '' : 'es'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} title="Download as text file">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
      <Textarea ref={outputRef} readOnly className="min-h-[220px]" />
    </ToolShell>
  );
}
