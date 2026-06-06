import { Card, CardHeader, CardBody, CardFooter, PageHeader, Skeleton, Separator } from '@/components/sabcrm/20ui';

export default function UserDashboardLoading() {
  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-8">
      <PageHeader 
        title="My Account" 
        description="Overview of your profile, security, and workspaces." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardBody className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
             <Skeleton className="h-24 w-24 rounded-full" />
             <div className="space-y-2 flex-1 w-full">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
             </div>
          </CardBody>
          <Separator />
          <CardFooter className="pt-6">
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
          </CardHeader>
          <CardBody className="space-y-4">
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-full" />
          </CardBody>
          <Separator />
          <CardFooter className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardBody>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-5 w-32" /></div>
                <div><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-5 w-32" /></div>
                <div><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-5 w-32" /></div>
                <div><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-5 w-32" /></div>
             </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
          </CardHeader>
          <CardBody className="space-y-4">
             <Skeleton className="h-12 w-16" />
             <Skeleton className="h-20 w-full" />
          </CardBody>
          <Separator />
          <CardFooter className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
