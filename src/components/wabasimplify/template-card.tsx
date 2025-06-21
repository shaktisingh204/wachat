import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Languages } from 'lucide-react';

interface TemplateCardProps {
  template: {
    name: string;
    category: string;
    body: string;
    language: string;
    status: string;
  };
}

export function TemplateCard({ template }: TemplateCardProps) {
  const getStatusVariant = (status: string) => {
    status = status.toLowerCase();
    if (status === 'approved') return 'default';
    if (status === 'pending' || status === 'in_review') return 'secondary';
    return 'destructive';
  };

  return (
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
        <Button variant="ghost" disabled>View</Button>
        <Button variant="secondary" disabled>Edit</Button>
      </CardFooter>
    </Card>
  );
}
