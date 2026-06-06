'use client';

import { Button, Textarea } from '@/components/sabcrm/20ui/compat';
import { Switch } from '@/components/sabcrm/20ui/compat';
import { Label } from '@/components/sabcrm/20ui/compat';
import { RadioGroup, ZoruRadioCard } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function RemoveExtraSpacesPage() {
  const [text, setText] = useState('');
  
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [trimLines, setTrimLines] = useState(false);
  const [blankLineAction, setBlankLineAction] = useState<'collapse' | 'remove' | 'keep'>('collapse');

  const handleProcess = () => {
    let result = text;
    
    if (collapseSpaces) {
      result = result.replace(/[ \t]+/g, ' ');
    }
    
    if (trimLines) {
      result = result.split('\n').map(l => l.trim()).join('\n');
    }
    
    if (blankLineAction === 'collapse') {
      result = result.replace(/\n([ \t]*\n)+/g, '\n\n');
    } else if (blankLineAction === 'remove') {
      result = result.replace(/\n([ \t]*\n)+/g, '\n');
    }
    
    result = result.trim();
    setText(result);
  };

  return (
    <ToolShell title="Remove Extra Spaces" description="Collapse multiple spaces and blank lines.">
      <div className="flex flex-col gap-6">
        <Textarea 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Paste text with extra spaces…" 
          className="min-h-[220px]" 
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4 border p-4 rounded-[var(--st-radius-lg)] border-[var(--st-border)]">
            <h3 className="font-semibold text-sm text-[var(--st-text)]">Space Options</h3>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="collapse-spaces" className="flex-1 cursor-pointer">
                Collapse multiple spaces
              </Label>
              <Switch 
                id="collapse-spaces" 
                checked={collapseSpaces} 
                onCheckedChange={setCollapseSpaces} 
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="trim-lines" className="flex-1 cursor-pointer">
                Trim spaces at start/end of lines
              </Label>
              <Switch 
                id="trim-lines" 
                checked={trimLines} 
                onCheckedChange={setTrimLines} 
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border p-4 rounded-[var(--st-radius-lg)] border-[var(--st-border)]">
            <h3 className="font-semibold text-sm text-[var(--st-text)]">Blank Line Action</h3>
            <RadioGroup 
              value={blankLineAction} 
              onValueChange={(val) => setBlankLineAction(val as any)}
              className="grid grid-cols-1 gap-2"
            >
              <ZoruRadioCard
                value="collapse"
                label="Collapse blank lines"
                description="Reduces multiple blank lines to a single one"
              />
              <ZoruRadioCard
                value="remove"
                label="Remove all blank lines"
                description="Eliminates all empty lines entirely"
              />
              <ZoruRadioCard
                value="keep"
                label="Keep blank lines"
                description="Leaves empty lines untouched"
              />
            </RadioGroup>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleProcess}>Remove Spaces</Button>
          <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
        </div>
      </div>
    </ToolShell>
  );
}
