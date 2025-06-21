
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Languages, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface TemplateCardProps {
  template: {
    name: string;
    category: string;
    body: string;
    language: string;
    status: string;
    components?: any[];
  };
}

export function TemplateCard({ template }: TemplateCardProps) {
  const { toast } = useToast();
  const [isViewOpen, setIsViewOpen] = useState(false);

  const getStatusVariant = (status: string) => {
    status = status.toLowerCase();
    if (status === 'approved') return 'default';
    if (status === 'pending' || status === 'in_review') return 'secondary';
    return 'destructive';
  };

  const handleCopyBody = () => {
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    const textToCopy = bodyComponent?.text || template.body;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast({
        title: 'Copied to Clipboard',
        description: 'The template body has been copied.',
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({
        title: 'Copy Failed',
        description: 'Could not copy text to clipboard.',
        variant: 'destructive',
      });
    });
  };

  const renderComponentContent = (component: any) => {
    if (component.text) return component.text;
    if (component.format) return `Format: ${component.format}`;
    if (component.buttons) {
      return (
        <ul className="list-disc pl-5 space-y-1">
          {component.buttons.map((button: any, index: number) => (
            <li key={index}>
              <strong>{button.text}</strong> ({button.type.replace('_', ' ')})
              {button.url && <span className="block text-xs text-muted-foreground">{button.url}</span>}
              {button.phone_number && <span className="block text-xs text-muted-foreground">Call: {button.phone_number}</span>}
            </li>
          ))}
        </ul>
      );
    }
    return "No text content";
  };


  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-headline break-all">{template.name}</CardTitle>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge variant="outline" className="capitalize">{template.category.toLowerCase()}</Badge>
              <Badge variant={getStatusVariant(template.status)} className="capitalize">
                {template.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
          <CardDescription className="flex items-center pt-2 text-xs">
            <Languages className="h-4 w-4 mr-2" />
            {template.language}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-sm text-foreground/80 line-clamp-4">{template.body}</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCopyBody}>
            <Copy className="mr-2 h-4 w-4"/>
            Copy
          </Button>
          <Button variant="outline" onClick={() => setIsViewOpen(true)}>View</Button>
          <Button variant="secondary" disabled>Edit</Button>
        </CardFooter>
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>
              Category: {template.category} | Language: {template.language} | Status: <span className="capitalize">{template.status.replace(/_/g, ' ')}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
            {(template.components && template.components.length > 0) ? (
              template.components.map((component, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-semibold text-primary">{component.type}</h4>
                  <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap font-mono">
                    {renderComponentContent(component)}
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <h4 className="font-semibold text-primary">BODY</h4>
                <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap font-mono">
                  {template.body}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
