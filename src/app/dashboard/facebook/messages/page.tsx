
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function FacebookMessagesPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <MessageSquare className="h-8 w-8"/>
                    Facebook Messages
                </h1>
                <p className="text-muted-foreground mt-2">
                    A unified inbox for all your Facebook Page conversations.
                </p>
            </div>
            <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                <CardContent>
                    <p className="text-lg font-semibold">Coming Soon!</p>
                    <p>This feature is on our roadmap. You'll soon be able to manage your Messenger conversations right here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
