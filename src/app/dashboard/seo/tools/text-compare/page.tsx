'use client';

import { Textarea, Card, ZoruCardContent, Switch, Label } from '@/components/zoruui';
import { useMemo, useState, useRef } from 'react';
import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type DiffChar = { type: 'equal' | 'insert' | 'delete'; text: string };
type DiffRow = {
  left: DiffChar[] | null;
  right: DiffChar[] | null;
  equal: boolean;
};

const dmp = new DiffMatchPatch();

function computeSideBySideDiff(text1: string, text2: string, ignoreWhitespace: boolean): DiffRow[] {
  // Ensure texts always end with newline to help line diff alignment
  // Though dmp line mode can handle without, it's safer
  const a = dmp.diff_linesToChars_(text1, text2);
  const lineDiffs = dmp.diff_main(a.chars1, a.chars2, false);
  dmp.diff_charsToLines_(lineDiffs, a.lineArray);
  
  const rows: DiffRow[] = [];
  
  for (let i = 0; i < lineDiffs.length; i++) {
    const diff = lineDiffs[i];
    const op = diff[0];
    const text = diff[1];
    // Avoid trailing empty string from split('\n') unless it's a real blank line
    const lines = text.replace(/\n$/, '').split('\n');
    
    if (op === 0) {
      lines.forEach(l => {
        rows.push({ left: [{type: 'equal', text: l}], right: [{type: 'equal', text: l}], equal: true });
      });
    } else if (op === -1) {
      // Deletion block
      if (i + 1 < lineDiffs.length && lineDiffs[i+1][0] === 1) {
        // Followed by insertion -> pair them line-by-line
        const nextDiff = lineDiffs[i+1];
        const nextText = nextDiff[1];
        const nextLines = nextText.replace(/\n$/, '').split('\n');
        
        const maxLines = Math.max(lines.length, nextLines.length);
        for (let j = 0; j < maxLines; j++) {
          const l1 = lines[j] ?? null;
          const l2 = nextLines[j] ?? null;
          
          if (l1 !== null && l2 !== null) {
            const isEq = ignoreWhitespace ? l1.replace(/\s+/g, '') === l2.replace(/\s+/g, '') : l1 === l2;
            if (isEq) {
              rows.push({ left: [{type: 'equal', text: l1}], right: [{type: 'equal', text: l2}], equal: true });
            } else {
              const charDiffs = dmp.diff_main(l1, l2);
              dmp.diff_cleanupSemantic(charDiffs);
              
              const leftChars: DiffChar[] = [];
              const rightChars: DiffChar[] = [];
              charDiffs.forEach(([cop, ctext]) => {
                const isWs = ignoreWhitespace && /^\s+$/.test(ctext);
                if (cop === 0) {
                  leftChars.push({type: 'equal', text: ctext});
                  rightChars.push({type: 'equal', text: ctext});
                } else if (cop === -1) {
                  leftChars.push({type: isWs ? 'equal' : 'delete', text: ctext});
                } else if (cop === 1) {
                  rightChars.push({type: isWs ? 'equal' : 'insert', text: ctext});
                }
              });
              rows.push({ left: leftChars, right: rightChars, equal: false });
            }
          } else if (l1 !== null) {
            rows.push({ left: [{type: 'delete', text: l1}], right: null, equal: false });
          } else if (l2 !== null) {
            rows.push({ left: null, right: [{type: 'insert', text: l2}], equal: false });
          }
        }
        i++; // skip the next insertion since we've processed it
      } else {
        lines.forEach(l => {
          rows.push({ left: [{type: 'delete', text: l}], right: null, equal: false });
        });
      }
    } else if (op === 1) {
      // Insertion block not preceded by deletion
      lines.forEach(l => {
        rows.push({ left: null, right: [{type: 'insert', text: l}], equal: false });
      });
    }
  }
  
  return rows;
}

export default function TextComparePage() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  
  const leftRef = useRef<HTMLTextAreaElement>(null);
  const rightRef = useRef<HTMLTextAreaElement>(null);
  
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>, isLeft: boolean) => {
    const target = isLeft ? rightRef.current : leftRef.current;
    if (target) {
      target.scrollTop = e.currentTarget.scrollTop;
      target.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const rows = useMemo(() => computeSideBySideDiff(a, b, ignoreWhitespace), [a, b, ignoreWhitespace]);
  const diffs = rows.filter((r) => !r.equal).length;

  return (
    <ToolShell title="Text Compare (Diff)" description="Line-by-line side-by-side comparison of two texts.">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center space-x-2">
          <Switch id="ignore-ws" checked={ignoreWhitespace} onCheckedChange={setIgnoreWhitespace} />
          <Label htmlFor="ignore-ws">Ignore whitespace differences</Label>
        </div>
        <div className="text-sm text-muted-foreground">{diffs} differing line(s)</div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Textarea 
          ref={leftRef}
          value={a} 
          onChange={(e) => setA(e.target.value)} 
          onScroll={(e) => handleScroll(e, true)}
          placeholder="Original text…" 
          className="min-h-[240px] font-mono text-sm leading-relaxed" 
        />
        <Textarea 
          ref={rightRef}
          value={b} 
          onChange={(e) => setB(e.target.value)} 
          onScroll={(e) => handleScroll(e, false)}
          placeholder="Changed text…" 
          className="min-h-[240px] font-mono text-sm leading-relaxed" 
        />
      </div>
      
      <Card>
        <ZoruCardContent className="p-0 overflow-auto max-h-[600px]">
          <div className="font-mono text-xs min-w-[600px]">
            {rows.map((r, i) => (
              <div key={i} className={`flex w-full border-b ${r.equal ? '' : 'bg-yellow-50 dark:bg-yellow-950/20'}`}>
                <div className="flex-1 w-1/2 px-2 py-1 border-r break-all whitespace-pre-wrap">
                  {r.left ? r.left.map((chunk, j) => (
                    <span key={j} className={
                      chunk.type === 'delete' ? 'bg-red-200 dark:bg-red-900/60' : ''
                    }>{chunk.text}</span>
                  )) : <span className="text-muted-foreground select-none">—</span>}
                </div>
                <div className="flex-1 w-1/2 px-2 py-1 break-all whitespace-pre-wrap">
                  {r.right ? r.right.map((chunk, j) => (
                    <span key={j} className={
                      chunk.type === 'insert' ? 'bg-green-200 dark:bg-green-900/60' : ''
                    }>{chunk.text}</span>
                  )) : <span className="text-muted-foreground select-none">—</span>}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">No text to compare</div>
            )}
          </div>
        </ZoruCardContent>
      </Card>
    </ToolShell>
  );
}
