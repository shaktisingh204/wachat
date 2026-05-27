import React, { useState } from 'react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Badge,
} from '@/components/zoruui';
import { Wand2, Plus } from 'lucide-react';

const SUGGESTIONS = [
  {
    name: 'Welcome Greeting',
    keywords: 'hi, hello, hey, start',
    matchType: 'contains',
    responseType: 'text',
    responseText: 'Hello there! How can we help you today?',
  },
  {
    name: 'Pricing Info',
    keywords: 'price, pricing, cost, how much',
    matchType: 'contains',
    responseType: 'text',
    responseText: 'Our pricing plans start at $10/month. You can find more details at our website.',
  },
  {
    name: 'Support/Help',
    keywords: 'help, support, issue, broken',
    matchType: 'contains',
    responseType: 'text',
    responseText: 'I am sorry you are experiencing issues. Please describe your problem and our agent will be with you shortly.',
  }
];

export function AiSuggestionsDialog({
  open,
  onOpenChange,
  onSelectSuggestion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuggestion: (suggestion: any) => void;
}) {
  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent className="sm:max-w-[500px]">
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-zoru-ink" />
            AI Rule Suggestions
          </ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Based on frequently asked questions, our AI suggests creating these common auto-reply rules.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        
        <div className="grid gap-4 py-4">
          {SUGGESTIONS.map((suggestion, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border p-4 hover:bg-zoru-surface-2 transition-colors">
              <div className="grid gap-1">
                <p className="text-sm font-medium text-zoru-ink">{suggestion.name}</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.keywords.split(', ').map(kw => (
                    <Badge key={kw} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                onSelectSuggestion(suggestion);
                onOpenChange(false);
              }}>
                <Plus className="mr-1 h-3 w-3" /> Use
              </Button>
            </div>
          ))}
        </div>

        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Close</ZoruAlertDialogCancel>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
