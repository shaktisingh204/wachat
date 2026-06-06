import { WaterLoader } from '@/components/sabcrm/20ui/compat';

export default function Loading() {
  return (
    <div className="flex h-[40vh] w-full flex-col items-center justify-center">
      <WaterLoader size={48} label="Redirecting..." />
    </div>
  );
}
