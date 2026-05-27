export default function OrderConfirmationLoading() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-pulse space-y-6 w-full max-w-2xl text-center">
                <div className="mx-auto bg-zoru-surface-2 rounded-full h-16 w-16 mb-4"></div>
                <div className="h-8 bg-zoru-surface-2 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-zoru-surface-2 rounded w-1/2 mx-auto"></div>
                
                <div className="mt-8 space-y-4">
                    <div className="h-24 bg-zoru-surface-2 rounded-lg"></div>
                    <div className="h-32 bg-zoru-surface-2 rounded-lg"></div>
                    <div className="h-12 bg-zoru-surface-2 rounded-lg"></div>
                </div>
            </div>
        </div>
    );
}
