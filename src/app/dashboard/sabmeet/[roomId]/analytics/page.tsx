import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from '@/components/zoruui';
import { ArrowLeft } from 'lucide-react';
import { getMeetRoom, getMeetRoomAnalytics } from '@/app/actions/sabmeet.actions';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { roomId } = await params;
  const { data: room } = await getMeetRoom(roomId);
  if (!room) notFound();
  const { data: stats } = await getMeetRoomAnalytics(roomId);

  const stat = (label: string, value: string | number) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zoru-ink-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-zoru-ink">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <div>
          <ZoruPageTitle>Analytics</ZoruPageTitle>
          <ZoruPageDescription>{room.name}</ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stat('Total attendees', stats.totalAttendees)}
        {stat('Unique attendees', stats.uniqueAttendees)}
        {stat('Peak concurrent', stats.peakConcurrent)}
        {stat(
          'Avg duration',
          stats.avgDurationSecs
            ? `${Math.floor(stats.avgDurationSecs / 60)}m ${stats.avgDurationSecs % 60}s`
            : '—',
        )}
        {stat('Recordings', stats.totalRecordings)}
      </div>
    </div>
  );
}
