import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface TemplateCardProps {
  name: string;
  category: string;
  body: string;
}

export function TemplateCard({ name, category, body }: TemplateCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-headline">{name}</CardTitle>
          <Badge variant="outline">{category}</Badge>
        </div>
        <CardDescription className="flex items-center pt-2">
            <FileText className="h-4 w-4 mr-2" />
            Message Template
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-foreground/80 line-clamp-3">{body}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost">View</Button>
        <Button variant="secondary">Edit</Button>
      </CardFooter>
    </Card>
  );
}
