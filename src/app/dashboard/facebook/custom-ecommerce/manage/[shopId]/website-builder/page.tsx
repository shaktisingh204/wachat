
'use client';

import { useState } from 'react';
import { WebsiteBuilder } from '@/components/wabasimplify/website-builder/website-builder';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function DangerZone({ onProceed }: { onProceed: () => void }) {
    return (
        <div className="flex items-center justify-center h-screen bg-muted">
            <Card className="max-w-lg text-center shadow-2xl animate-fade-in-up">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="mt-4">You are entering the Website Builder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        This is a powerful, experimental tool that allows for direct manipulation of your shop's homepage.
                    </p>
                    <Separator />
                    <ul className="list-disc list-inside text-left space-y-1">
                        <li>Ensure your image URLs are correct and publicly accessible.</li>
                        <li>Using the "Custom HTML" block can break your page layout or introduce security risks if used improperly.</li>
                        <li>Always save your work before exiting.</li>
                    </ul>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button size="lg" onClick={onProceed}>I understand, proceed to builder</Button>
                </CardFooter>
            </Card>
        </div>
    );
}


export default function WebsiteBuilderPageWrapper() {
  const [hasProceeded, setHasProceeded] = useState(false);

  if (!hasProceeded) {
    return <DangerZone onProceed={() => setHasProceeded(true)} />;
  }

  return <WebsiteBuilder />;
}
