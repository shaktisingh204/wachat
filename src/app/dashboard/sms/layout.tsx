




export default function SmsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex-1 flex flex-col gap-4">
            {children}
        </div>
    );
}
