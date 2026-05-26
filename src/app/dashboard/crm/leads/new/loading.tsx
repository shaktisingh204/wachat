import { SabnodeWaterLoader } from '@/components/zoruui';

export default function Loading() {
    return (
        <div className="flex h-[60vh] w-full flex-col items-center justify-center">
            <SabnodeWaterLoader />
        </div>
    );
}
