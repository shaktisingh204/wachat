'use client';

import {
  Button,
  Textarea,
  Card,
  ZoruCardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Label,
} from '@/components/zoruui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type GroupingMethod = 'token' | 'levenshtein' | 'firstWord' | 'lcs';

interface GrouperOptions {
  method: GroupingMethod;
  threshold: number;
}

// Basic stop words
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'for', 'in', 'on', 'at', 'to', 'with', 'by', 'about', 'as', 'of', 'this', 'that', 'these', 'those', 'then', 'than', 'here', 'there'
]);

function getTokens(str: string) {
  return str.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
}

// Token-based Jaccard Similarity
function tokenJaccardSimilarity(str1: string, str2: string) {
  const words1 = new Set(getTokens(str1));
  const words2 = new Set(getTokens(str2));
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = words1.size + words2.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

// Levenshtein similarity
function levenshteinSimilarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a.length === 0 && b.length === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  const dist = matrix[a.length][b.length];
  return 1 - dist / Math.max(a.length, b.length);
}

// Longest Common Substring similarity
function lcsSimilarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  let maxLen = 0;
  const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        if (matrix[i][j] > maxLen) {
          maxLen = matrix[i][j];
        }
      }
    }
  }
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return maxLen / max;
}

function groupKeywordsAdvanced(raw: string, options: GrouperOptions): Record<string, string[]> {
  const lines = Array.from(new Set(raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)));
  const groups: Record<string, string[]> = {};

  if (options.method === 'firstWord') {
    for (const line of lines) {
      const first = line.toLowerCase().split(/\s+/)[0] || 'other';
      if (!groups[first]) groups[first] = [];
      groups[first].push(line);
    }
    return groups;
  }

  // Use Union-Find (Disjoint Set) to group connected components
  const parent = new Map<string, string>();
  for (const line of lines) parent.set(line, line);
  
  function find(i: string): string {
    if (parent.get(i) === i) return i;
    const p = find(parent.get(i)!);
    parent.set(i, p);
    return p;
  }

  function union(i: string, j: string) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      // make the shorter string the root to naturally find the most generic term
      if (rootI.length <= rootJ.length) {
        parent.set(rootJ, rootI);
      } else {
        parent.set(rootI, rootJ);
      }
    }
  }

  // Optimize: Avoid O(N^2) if very large, but fine for typical keyword lists
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      let score = 0;
      if (options.method === 'token') {
        score = tokenJaccardSimilarity(lines[i], lines[j]);
      } else if (options.method === 'levenshtein') {
        score = levenshteinSimilarity(lines[i], lines[j]);
      } else if (options.method === 'lcs') {
        score = lcsSimilarity(lines[i], lines[j]);
      }

      if (score >= options.threshold) {
        union(lines[i], lines[j]);
      }
    }
  }

  const refinedGroups: Record<string, string[]> = {};
  for (const line of lines) {
    const root = find(line);
    if (!refinedGroups[root]) refinedGroups[root] = [];
    refinedGroups[root].push(line);
  }

  for (const key of Object.keys(refinedGroups)) {
    refinedGroups[key].sort();
  }

  const sortedKeys = Object.keys(refinedGroups).sort(
    (a, b) => refinedGroups[b].length - refinedGroups[a].length
  );
  
  const finalGroups: Record<string, string[]> = {};
  for (const key of sortedKeys) {
    finalGroups[key] = refinedGroups[key];
  }

  return finalGroups;
}

export default function KeywordGrouperPage() {
  const [input, setInput] = useState('');
  const [groups, setGroups] = useState<Record<string, string[]> | null>(null);
  const [method, setMethod] = useState<GroupingMethod>('token');
  const [threshold, setThreshold] = useState<number>(0.5);

  const run = () => {
    if (!input.trim()) return;
    setGroups(groupKeywordsAdvanced(input, { method, threshold }));
  };

  return (
    <ToolShell title="Keyword Grouper" description="Group a list of keywords by their common root/stem or semantic similarity.">
      <div className="flex flex-col gap-4 mb-4">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste keywords, one per line…&#10;e.g.&#10;running shoes&#10;best running shoes&#10;cheap running shoes&#10;running pants"
          className="min-h-[200px]"
        />
        
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex flex-col gap-2 w-full sm:w-64">
            <Label>Grouping Method</Label>
            <Select value={method} onValueChange={(val) => setMethod(val as GroupingMethod)}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="token">NLP / Topic Clustering (Token)</SelectItem>
                <SelectItem value="levenshtein">Lexical Similarity (Levenshtein)</SelectItem>
                <SelectItem value="lcs">Longest Common Substring (LCS)</SelectItem>
                <SelectItem value="firstWord">First Word (Legacy Rigid)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method !== 'firstWord' && (
            <div className="flex flex-col gap-2 w-full sm:w-64">
              <Label>Similarity Threshold ({threshold.toFixed(2)})</Label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full cursor-pointer mt-2"
              />
            </div>
          )}

          <Button onClick={run} className="w-full sm:w-fit">Group Keywords</Button>
        </div>
      </div>

      {groups && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groups).map(([key, items]) => (
            <Card key={key}>
              <ZoruCardContent className="p-4">
                <div className="font-semibold capitalize mb-2 border-b pb-2">
                  {key} <span className="text-xs text-zoru-ink-muted ml-1">({items.length})</span>
                </div>
                <ul className="text-sm space-y-1 text-zoru-ink-muted h-48 overflow-y-auto">
                  {items.map((i) => (
                    <li key={i} className="line-clamp-1" title={i}>
                      {i}
                    </li>
                  ))}
                </ul>
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
