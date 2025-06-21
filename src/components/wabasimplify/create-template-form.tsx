'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, LoaderCircle, AlertCircle } from 'lucide-react';
import { handleSuggestContent } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CreateTemplateForm() {
  const [topic, setTopic] = useState('');
  const [body, setBody] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const onGenerateSuggestions = async () => {
    if (!topic) {
        toast({
            title: "Topic required",
            description: "Please enter a topic to generate suggestions.",
            variant: "destructive"
        })
        return;
    }
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    
    const result = await handleSuggestContent(topic);
    
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.suggestions) {
      setSuggestions(result.suggestions);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    setBody((prevBody) => (prevBody ? `${prevBody}\n\n${suggestion}` : suggestion));
    toast({
        title: "Suggestion Inserted!",
        description: "The AI suggestion has been added to your template body."
    })
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>Define the name and category of your template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input id="template-name" placeholder="e.g., appointment_reminder_1" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Template Content</CardTitle>
            <CardDescription>Write the body of your message. Use variables like {'{{1}}'}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="template-body"
              placeholder="Hi {{1}}, this is a reminder..."
              className="min-h-[150px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </CardContent>
        </Card>
         <div className="flex justify-end">
            <Button size="lg">Save Template</Button>
        </div>
      </form>

      <div className="lg:col-span-1 space-y-6">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="text-primary" />
              AI Content Assistant
            </CardTitle>
            <CardDescription>
              Get help writing your message. Enter a topic and we'll generate suggestions for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ai-topic">Topic</Label>
              <Input
                id="ai-topic"
                placeholder="e.g., Order shipped confirmation"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <Button onClick={onGenerateSuggestions} disabled={isLoading} className="w-full">
              {isLoading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate Suggestions
            </Button>
            <div className="space-y-4 pt-4">
              {error && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {suggestions.length > 0 && <h4 className="font-semibold text-foreground">Suggestions</h4>}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {suggestions.map((suggestion, index) => (
                   <Card key={index} className="bg-background/80 hover:border-primary transition-colors cursor-pointer" onClick={() => insertSuggestion(suggestion)}>
                     <CardContent className="p-3 text-sm text-foreground/90">
                        {suggestion}
                     </CardContent>
                   </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
