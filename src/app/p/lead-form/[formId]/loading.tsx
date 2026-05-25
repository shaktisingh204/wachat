import { Card, ZoruCardContent, ZoruCardHeader } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="h-6 w-48 bg-secondary rounded mb-2" />
          <div className="h-8 w-64 bg-secondary rounded mb-2" />
          <div className="h-4 w-full max-w-sm bg-secondary rounded" />
        </div>
        <Card>
          <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
            <div className="h-5 w-48 bg-secondary/80 rounded" />
          </ZoruCardHeader>
          <ZoruCardContent className="p-4 flex flex-col gap-3">
            <div className="h-4 w-full bg-secondary/60 rounded" />
            <div className="h-4 w-full bg-secondary/60 rounded" />
            <div className="h-4 w-3/4 bg-secondary/60 rounded" />
          </ZoruCardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <div className="flex flex-col gap-5 sticky top-6">
          <div className="h-6 w-48 bg-secondary rounded" />
          <Card className="shadow-md border-foreground/10">
            <ZoruCardContent className="p-5 flex flex-col gap-4">
              <div className="h-5 w-32 bg-secondary/80 rounded" />
              <div className="flex flex-col gap-3">
                <div className="h-10 w-full bg-secondary/60 rounded" />
                <div className="h-10 w-full bg-secondary/60 rounded" />
                <div className="h-24 w-full bg-secondary/60 rounded" />
              </div>
              <div className="mt-2 flex justify-end">
                <div className="h-9 w-32 bg-secondary/80 rounded" />
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
