

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wand2, LoaderCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AiSuggestionsProps {
  onSuggestionSelect: (suggestion: string) => void;
}

export function AiSuggestions({ onSuggestionSelect }: AiSuggestionsProps) {
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const getSuggestions = async () => {
    // This feature is temporarily disabled as the backend action does not exist.
    setError("AI Suggestions are temporarily unavailable.");
    toast({
        title: 'Feature Unavailable',
        description: 'The AI content suggestion feature is currently under maintenance.',
        variant: 'destructive',
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionSelect(suggestion);
    toast({
        title: 'Suggestion applied!',
        description: 'The content has been copied to the template body.',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Content Assistant</CardTitle>
        <CardDescription>Get AI-powered suggestions for your template body.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <div className="flex gap-2">
            <Input
              id="topic"
              placeholder="e.g., flash sale, new product"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  getSuggestions();
                }
              }}
            />
            <Button type="button" onClick={getSuggestions} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              <span className="sr-only">Get Suggestions</span>
            </Button>
          </div>
        </div>

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <Label>Suggestions</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 text-sm border rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    