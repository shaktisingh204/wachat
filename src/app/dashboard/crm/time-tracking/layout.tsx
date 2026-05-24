import { MiniStopwatch } from './_components/mini-stopwatch';

export default function TimeTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      {children}
      <MiniStopwatch />
    </div>
  );
}
