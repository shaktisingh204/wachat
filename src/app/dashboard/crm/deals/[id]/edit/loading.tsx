import { ZoruWaterLoader } from '@/components/zoruui/water-loader';

export default function Loading() {
  return (
    <div className="flex h-[40vh] w-full flex-col items-center justify-center">
      <ZoruWaterLoader size={48} label="Redirecting..." />
    </div>
  );
}
