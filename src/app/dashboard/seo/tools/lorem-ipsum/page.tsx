'use client';

import { Button, Input, Label, Textarea, cn, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/zoruui';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

function generate(paragraphs: number, sentencesPerPara: number, wrapHtml: boolean = false, includeLists: boolean = false, htmlTag: string = 'p'): string {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    const isList = includeLists && paragraphs > 1 && (p % 3 === 1);
    
    if (isList) {
      const listItems: string[] = [];
      const numItems = Math.max(3, sentencesPerPara);
      for (let s = 0; s < numItems; s++) {
        const len = 4 + Math.floor(Math.random() * 8);
        const words: string[] = [];
        for (let w = 0; w < len; w++) words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        const sentence = words.join(' ');
        const text = sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
        listItems.push(wrapHtml ? `  <li>${text}</li>` : `- ${text}`);
      }
      out.push(wrapHtml ? `<ul>\n${listItems.join('\n')}\n</ul>` : listItems.join('\n'));
    } else {
      const sentences: string[] = [];
      for (let s = 0; s < sentencesPerPara; s++) {
        const len = 8 + Math.floor(Math.random() * 12);
        const words: string[] = [];
        for (let w = 0; w < len; w++) words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        const sentence = words.join(' ');
        sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.');
      }
      const paraText = sentences.join(' ');
      out.push(wrapHtml ? `<${htmlTag}>${paraText}</${htmlTag}>` : paraText);
    }
  }
  return out.join('\n\n');
}

export default function LoremIpsumPage() {
  const [paragraphs, setParagraphs] = useState(3);
  const [sentences, setSentences] = useState(5);
  const [wrapHtml, setWrapHtml] = useState(false);
  const [includeLists, setIncludeLists] = useState(false);
  const [htmlTag, setHtmlTag] = useState('p');
  const [text, setText] = useState(() => generate(3, 5, false, false, 'p'));

  return (
    <ToolShell title="Lorem Ipsum Generator" description="Generate placeholder content.">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Paragraphs</Label>
          <Input type="number" min={1} max={50} value={paragraphs} onChange={(e) => setParagraphs(Number(e.target.value) || 1)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label>Sentences / paragraph</Label>
          <Input type="number" min={1} max={30} value={sentences} onChange={(e) => setSentences(Number(e.target.value) || 1)} className="w-32" />
        </div>
        <div className="flex items-center space-x-2 h-9">
          <Switch id="wrap-html" checked={wrapHtml} onCheckedChange={setWrapHtml} />
          <Label htmlFor="wrap-html" className="cursor-pointer">Wrap in HTML</Label>
        </div>
        <div className="flex items-center space-x-2 h-9">
          <Switch id="include-lists" checked={includeLists} onCheckedChange={setIncludeLists} />
          <Label htmlFor="include-lists" className="cursor-pointer">Include Lists</Label>
        </div>
        {wrapHtml && (
          <div className="space-y-1">
            <Label>HTML Tag</Label>
            <Select value={htmlTag} onValueChange={setHtmlTag}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="p">&lt;p&gt;</SelectItem>
                <SelectItem value="div">&lt;div&gt;</SelectItem>
                <SelectItem value="span">&lt;span&gt;</SelectItem>
                <SelectItem value="h1">&lt;h1&gt;</SelectItem>
                <SelectItem value="h2">&lt;h2&gt;</SelectItem>
                <SelectItem value="h3">&lt;h3&gt;</SelectItem>
                <SelectItem value="h4">&lt;h4&gt;</SelectItem>
                <SelectItem value="h5">&lt;h5&gt;</SelectItem>
                <SelectItem value="h6">&lt;h6&gt;</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={() => setText(generate(paragraphs, sentences, wrapHtml, includeLists, htmlTag))}>Generate</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(text)}>Copy</Button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[320px] font-mono text-xs" />
    </ToolShell>
  );
}
