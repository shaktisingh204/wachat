import { WaterLoader } from '@/components/sabcrm/20ui/compat';

export default function BankAccountsLoading() {
    return (
        <div className="flex h-[400px] w-full items-center justify-center">
            <WaterLoader size={48} label="Loading bank accounts..." />
        </div>
    );
}
