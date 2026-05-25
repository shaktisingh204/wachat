import { SabnodeWaterLoader } from "@/components/ui/sabnode-water-loader";

export default function BuilderLoading() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <SabnodeWaterLoader size={100} color="primary" />
        </div>
    );
}
