import { Skeleton, Card, CardBody, CardHeader, Separator } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
    return (
        <div className="space-y-4">
             <div className="flex -ml-4">
                 <Skeleton className="h-10 w-48" />
             </div>
            <Card>
                <CardHeader className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardBody className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <Skeleton className="h-6 w-32" />
                             <Skeleton className="h-20 w-48" />
                        </div>
                         <div className="space-y-2">
                             <Skeleton className="h-6 w-48" />
                             <Skeleton className="h-16 w-48" />
                        </div>
                    </div>
                     <Separator />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <ul className="space-y-3">
                             <li className="flex justify-between">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-16" />
                             </li>
                             <li className="flex justify-between">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-16" />
                             </li>
                        </ul>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-16" /></div>
                        <div className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-16" /></div>
                        <div className="flex justify-between"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-20" /></div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
