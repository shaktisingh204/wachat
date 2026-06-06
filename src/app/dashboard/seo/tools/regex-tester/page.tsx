'use client';

import { Input, Textarea, Card, CardBody, CardHeader, CardTitle, CardDescription, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

// Cheatsheet data
const CHEATSHEET = [
  { category: 'Character Classes', items: [
    { token: '.', description: 'Any character except newline' },
    { token: '\\w', description: 'Word character (a-z, A-Z, 0-9, _)' },
    { token: '\\W', description: 'Not a word character' },
    { token: '\\d', description: 'Digit (0-9)' },
    { token: '\\D', description: 'Not a digit' },
    { token: '\\s', description: 'Whitespace (space, tab, newline)' },
    { token: '\\S', description: 'Not whitespace' },
  ]},
  { category: 'Anchors & Boundaries', items: [
    { token: '^', description: 'Start of string or line' },
    { token: '$', description: 'End of string or line' },
    { token: '\\b', description: 'Word boundary' },
    { token: '\\B', description: 'Not a word boundary' },
  ]},
  { category: 'Quantifiers', items: [
    { token: '*', description: '0 or more occurrences' },
    { token: '+', description: '1 or more occurrences' },
    { token: '?', description: '0 or 1 occurrence (or lazy modifier)' },
    { token: '{n}', description: 'Exactly n occurrences' },
    { token: '{n,}', description: 'n or more occurrences' },
    { token: '{n,m}', description: 'Between n and m occurrences' },
  ]},
  { category: 'Groups & Sets', items: [
    { token: '[abc]', description: 'Any character in the set (a, b, or c)' },
    { token: '[^abc]', description: 'Any character NOT in the set' },
    { token: '[a-z]', description: 'Any character in the range a to z' },
    { token: '(abc)', description: 'Capture group' },
    { token: '(?:abc)', description: 'Non-capturing group' },
    { token: 'a|b', description: 'Alternation (a or b)' },
  ]}
];

// Parser for the regex explanations
function parseRegex(pattern: string) {
  const tokens = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '\\') {
      const next = pattern[i + 1];
      if (next) {
        tokens.push({ token: `\\${next}`, type: 'escaped', description: getEscapedDescription(next) });
        i += 2;
      } else {
        tokens.push({ token: '\\', type: 'literal', description: 'Literal \\' });
        i++;
      }
    } else if (c === '[') {
      let end = pattern.indexOf(']', i);
      if (end === -1) end = pattern.length;
      else end++;
      const token = pattern.slice(i, end);
      tokens.push({ token, type: 'character_class', description: 'Character class' });
      i = end;
    } else if (c === '(') {
      const isNonCap = pattern.slice(i, i + 3) === '(?:';
      const isLookahead = pattern.slice(i, i + 3) === '(?=';
      const isNegLookahead = pattern.slice(i, i + 3) === '(?!';
      const isLookbehind = pattern.slice(i, i + 4) === '(?<=';
      const isNegLookbehind = pattern.slice(i, i + 4) === '(?<!';
      
      let token = '(';
      let desc = 'Start of capture group';
      let jump = 1;

      if (isLookbehind) { token = '(?<='; desc = 'Start of positive lookbehind'; jump = 4; }
      else if (isNegLookbehind) { token = '(?<!'; desc = 'Start of negative lookbehind'; jump = 4; }
      else if (isNonCap) { token = '(?:'; desc = 'Start of non-capturing group'; jump = 3; }
      else if (isLookahead) { token = '(?='; desc = 'Start of positive lookahead'; jump = 3; }
      else if (isNegLookahead) { token = '(?!'; desc = 'Start of negative lookahead'; jump = 3; }

      tokens.push({ token, type: 'group_start', description: desc });
      i += jump;
    } else if (c === ')') {
      tokens.push({ token: ')', type: 'group_end', description: 'End of group' });
      i++;
    } else if (c === '{') {
      let end = pattern.indexOf('}', i);
      if (end !== -1) {
        const token = pattern.slice(i, end + 1);
        tokens.push({ token, type: 'quantifier', description: `Quantifier: ${token}` });
        i = end + 1;
      } else {
        tokens.push({ token: '{', type: 'literal', description: 'Literal {' });
        i++;
      }
    } else if (['*', '+', '?'].includes(c)) {
      let desc = '';
      if (c === '*') desc = '0 or more times';
      if (c === '+') desc = '1 or more times';
      if (c === '?') desc = '0 or 1 time (or lazy modifier)';
      tokens.push({ token: c, type: 'quantifier', description: desc });
      i++;
    } else if (['^', '$'].includes(c)) {
      tokens.push({ token: c, type: 'anchor', description: c === '^' ? 'Start of string/line' : 'End of string/line' });
      i++;
    } else if (c === '.') {
      tokens.push({ token: c, type: 'wildcard', description: 'Any character (except newline)' });
      i++;
    } else if (c === '|') {
      tokens.push({ token: c, type: 'alternation', description: 'OR operator' });
      i++;
    } else {
      tokens.push({ token: c, type: 'literal', description: `Literal '${c}'` });
      i++;
    }
  }
  return tokens;
}

function getEscapedDescription(c: string) {
  switch (c) {
    case 'w': return 'Word character';
    case 'W': return 'Non-word character';
    case 'd': return 'Digit';
    case 'D': return 'Non-digit';
    case 's': return 'Whitespace';
    case 'S': return 'Non-whitespace';
    case 'b': return 'Word boundary';
    case 'B': return 'Non-word boundary';
    case 'n': return 'Newline';
    case 'r': return 'Carriage return';
    case 't': return 'Tab';
    default: return `Escaped literal '\\${c}'`;
  }
}

export default function RegexTesterPage() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [test, setTest] = useState('');

  const { error, matches, parsedTokens } = useMemo(() => {
    if (!pattern) return { error: '', matches: [] as RegExpMatchArray[], parsedTokens: [] };
    
    let parsedTokens: any[] = [];
    try {
      parsedTokens = parseRegex(pattern);
    } catch (e) {
      // Ignore parsing errors, it's just for explanation
    }

    try {
      const re = new RegExp(pattern, flags);
      const ms = Array.from(test.matchAll(flags.includes('g') ? re : new RegExp(pattern, flags + 'g')));
      return { error: '', matches: ms, parsedTokens };
    } catch (e: any) {
      return { error: e?.message || 'invalid regex', matches: [] as RegExpMatchArray[], parsedTokens };
    }
  }, [pattern, flags, test]);

  // Safely render the highlighted text using React elements (prevents XSS natively)
  const highlightedNodes = useMemo(() => {
    if (!matches.length || !pattern || error) return test;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const index = m.index || 0;
      
      if (index > lastIndex) {
        nodes.push(<span key={`text-${lastIndex}`}>{test.slice(lastIndex, index)}</span>);
      }
      
      nodes.push(
        <mark key={`match-${i}-${index}`} className="bg-[var(--st-bg-muted)] text-black px-[2px] rounded-sm bg-opacity-70 border-b-2 border-[var(--st-border)]">
          {m[0]}
        </mark>
      );
      
      lastIndex = index + m[0].length;
    }
    
    if (lastIndex < test.length) {
      nodes.push(<span key={`text-${lastIndex}`}>{test.slice(lastIndex)}</span>);
    }
    
    return nodes;
  }, [test, matches, pattern, error]);

  return (
    <ToolShell title="Regex Tester" description="Test regular expressions against sample text.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Testing Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-xl text-[var(--st-text-secondary)]">/</span>
            <Input 
              value={pattern} 
              onChange={(e) => setPattern(e.target.value)} 
              placeholder="pattern" 
              className="font-mono text-base flex-1" 
            />
            <span className="text-xl text-[var(--st-text-secondary)]">/</span>
            <Input 
              value={flags} 
              onChange={(e) => setFlags(e.target.value)} 
              placeholder="flags" 
              className="w-24 font-mono text-base" 
            />
          </div>
          
          {error && (
            <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)]/50">
              <CardBody className="p-4 text-[var(--st-text)] text-sm font-medium">
                Error: {error}
              </CardBody>
            </Card>
          )}

          {parsedTokens.length > 0 && !error && (
            <Card variant="soft">
              <CardHeader className="py-3 px-4 border-b border-[var(--st-border)]/50">
                <CardTitle className="text-sm">Regex Explanation</CardTitle>
              </CardHeader>
              <CardBody className="p-4 flex flex-wrap gap-2">
                {parsedTokens.map((t, idx) => (
                  <div key={idx} className="flex flex-col border border-[var(--st-border)] rounded-md overflow-hidden text-xs bg-[var(--st-bg)]">
                    <div className="bg-[var(--st-bg-muted)] px-2 py-1 font-mono font-bold text-center border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 dark:bg-[var(--st-text)]/50">
                      {t.token}
                    </div>
                    <div className="px-2 py-1 text-[var(--st-text-secondary)] text-center">
                      {t.description}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--st-text)]">Test String</label>
            <Textarea 
              value={test} 
              onChange={(e) => setTest(e.target.value)} 
              placeholder="Enter text to test your regex against..." 
              className="min-h-[140px] font-mono text-sm leading-relaxed" 
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-[var(--st-text)]">Match Results</label>
              <div className="text-xs font-semibold text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] px-2 py-1 rounded-full">
                {matches.length} match{matches.length !== 1 ? 'es' : ''}
              </div>
            </div>
            <Card>
              <CardBody className="p-4">
                <div className="font-mono text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {highlightedNodes || <span className="text-[var(--st-text-secondary)] italic">No matches yet...</span>}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Sidebar: Cheatsheet */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3 border-b border-[var(--st-border)]/50">
              <CardTitle>Regex Cheatsheet</CardTitle>
              <CardDescription>Quick reference for regular expressions</CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Accordion type="multiple" defaultValue={['category-0', 'category-1', 'category-2', 'category-3']} className="w-full">
                {CHEATSHEET.map((cat, catIdx) => (
                  <AccordionItem key={catIdx} value={`category-${catIdx}`} className="border-x-0 first:border-t-0 last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                      {cat.category}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2.5 pt-1">
                        {cat.items.map((item, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <code className="font-mono bg-[var(--st-bg-muted)]/60 text-[var(--st-text)] px-1.5 py-0.5 rounded text-xs whitespace-nowrap self-start">
                              {item.token}
                            </code>
                            <span className="text-[var(--st-text-secondary)] text-xs leading-relaxed">
                              {item.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardBody>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
