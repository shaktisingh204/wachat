export default function ShopLoading() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-pulse flex flex-col items-center space-y-4">
                <div className="h-12 w-12 rounded-full border-4 border-t-blue-600 border-r-blue-600 border-b-transparent border-l-transparent animate-spin"></div>
                <p className="text-zoru-ink-muted font-medium">Loading shop...</p>
            </div>
        </div>
    );
}
