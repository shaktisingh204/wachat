import { ZoruWaterLoader } from '@/components/zoruui/water-loader';

export default function LoadingBankAccountDetail() {
    return (
        <div className="flex h-[400px] w-full items-center justify-center">
            <ZoruWaterLoader size={48} label="Loading account details..." />
        </div>
    );
}
