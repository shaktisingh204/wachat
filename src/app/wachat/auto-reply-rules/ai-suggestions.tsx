import React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Badge,
  Card,
} from '@/components/sabcrm/20ui';
import { Wand2, Plus } from 'lucide-react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" style={{ color: 'var(--st-text)' }} aria-hidden="true" />
            AI Rule Suggestions
          </AlertDialogTitle>
          <AlertDialogDescription>
            Based on frequently asked questions, our AI suggests creating these common auto-reply rules.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-4">
          {SUGGESTIONS.map((suggestion, idx) => (
            <Card
              key={idx}
              variant="interactive"
              padding="md"
              className="flex items-center justify-between gap-4"
            >
              <div className="grid gap-1">
                <p className="text-sm" style={{ color: 'var(--st-text)', fontWeight: 'var(--st-fw-medium)' }}>
                  {suggestion.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.keywords.split(', ').map(kw => (
                    <Badge key={kw} tone="neutral" className="text-[10px] px-1 py-0 h-4">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                iconLeft={Plus}
                onClick={() => {
                  onSelectSuggestion(suggestion);
                  onOpenChange(false);
                }}
              >
                Use
              </Button>
            </Card>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
