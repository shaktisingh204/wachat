
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export function TestimonialsBlockRenderer({ settings }: { settings: any }) {
    return (
    <div>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'What Our Customers Say'}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.testimonials || []).map((item: any) => (
                <Card key={item.id}>
                    <CardContent className="p-6">
                        <p className="italic">"{item.quote}"</p>
                    </CardContent>
                    <CardFooter>
                        <p className="font-semibold">{item.author}</p>
                        <p className="text-sm text-muted-foreground ml-2">- {item.title}</p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
    )
}
