
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
};

interface CrmFormPreviewProps {
    title: string;
    description: string;
    fields: FormField[];
}

export function CrmFormPreview({ title, description, fields }: CrmFormPreviewProps) {
    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>{title || 'Form Title'}</CardTitle>
                <CardDescription>{description || 'Form description...'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {fields.map(field => (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={`preview-${field.id}`}>{field.label} {field.required && '*'}</Label>
                        {field.type === 'textarea' ? (
                            <Textarea id={`preview-${field.id}`} placeholder={field.placeholder} disabled />
                        ) : (
                            <Input id={`preview-${field.id}`} type={field.type} placeholder={field.placeholder} disabled />
                        )}
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button disabled className="w-full">Submit</Button>
            </CardFooter>
        </Card>
    );
}
