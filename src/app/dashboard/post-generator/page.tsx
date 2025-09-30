
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Copy, Lightbulb, Loader2, MagicWand } from 'lucide-react';

import { getSuggestions } from '@/app/actions/ai-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { mockFacebookDataString } from '@/lib/mock-data';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <MagicWand className="mr-2 h-4 w-4" />
          Generate Suggestions
        </>
      )}
    </Button>
  );
}

export default function PostGeneratorPage() {
  const initialState = { suggestions: [], errors: {} };
  const [state, dispatch] = useFormState(getSuggestions, initialState);
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard!',
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="text-accent" />
            AI Post Generator
          </CardTitle>
          <CardDescription>
            Paste your Facebook data below or use sample data to generate engaging post ideas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={dispatch} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="facebookData">Facebook Page Data</Label>
              <Textarea
                id="facebookData"
                name="facebookData"
                placeholder="Paste your data here..."
                className="min-h-[250px]"
                defaultValue={mockFacebookDataString}
                required
              />
              {state.errors?.facebookData && (
                <p className="text-sm font-medium text-destructive">
                  {state.errors.facebookData[0]}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="md:col-span-1">
        <h2 className="text-2xl font-bold mb-4">Suggestions</h2>
        <div className="space-y-4">
          {state.suggestions && state.suggestions.length > 0 ? (
            state.suggestions.map((suggestion, index) => (
              <Card key={index} className="shadow-md transition-shadow hover:shadow-lg">
                <CardContent className="p-4">
                  <p className="text-card-foreground/90">{suggestion}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(suggestion)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      Use Post
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
              <MagicWand className="h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                Your generated post suggestions will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
