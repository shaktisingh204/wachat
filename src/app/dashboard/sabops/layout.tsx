import type { ReactNode } from "react";

import { SabopsNav } from "./_components/sabops-shell";

export default function SabopsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <SabopsNav />
            <div>{children}</div>
        </div>
    );
}
