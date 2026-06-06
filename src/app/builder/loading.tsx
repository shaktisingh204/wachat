import { SabnodeWaterLoader } from '@/components/sabcrm/20ui/compat';

export default function BuilderLoading() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-zoru-surface">
            <SabnodeWaterLoader size={100} color="primary" />
        </div>
    );
}
