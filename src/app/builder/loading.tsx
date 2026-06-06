import { SabnodeWaterLoader } from '@/components/sabcrm/20ui';

export default function BuilderLoading() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-[var(--st-bg-secondary)]">
            <SabnodeWaterLoader size={100} color="primary" />
        </div>
    );
}
