import { Card, ZoruCardContent, ZoruCardHeader } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="h-6 w-32 bg-[var(--st-bg-muted)] rounded mb-2"></div>
          <div className="h-8 w-48 bg-[var(--st-bg-muted)] rounded mb-2"></div>
          <div className="h-4 w-96 bg-[var(--st-bg-muted)] rounded"></div>
        </div>

        <Card>
          <ZoruCardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
            <div className="h-4 w-40 bg-[var(--st-bg-muted)] rounded"></div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-4 flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-[var(--st-border)]/50 last:border-0">
                <div className="h-4 w-24 bg-[var(--st-bg-muted)] rounded"></div>
                <div className="h-4 w-16 bg-[var(--st-bg-muted)] rounded"></div>
                <div className="h-4 w-20 bg-[var(--st-bg-muted)] rounded"></div>
              </div>
            ))}
          </ZoruCardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="h-6 w-48 bg-[var(--st-bg-muted)] rounded"></div>
          <Card className="shadow-md border-foreground/10">
            <ZoruCardContent className="flex flex-col gap-4 p-5">
              <div className="h-4 w-32 bg-[var(--st-bg-muted)] rounded"></div>
              <div className="h-10 w-full bg-[var(--st-bg-muted)] rounded mt-2"></div>
              <div className="h-10 w-full bg-[var(--st-bg-muted)] rounded"></div>
              <div className="h-10 w-full bg-[var(--st-bg-muted)] rounded"></div>
              <div className="h-10 w-full bg-[var(--st-bg-muted)] rounded mt-4"></div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
