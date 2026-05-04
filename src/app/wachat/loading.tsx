import { ZoruWaterLoader } from "@/components/zoruui";

export default function WachatLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ZoruWaterLoader size={72} label="Loading…" />
    </div>
  );
}
