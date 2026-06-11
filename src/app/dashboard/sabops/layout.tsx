import type { ReactNode } from "react";

/**
 * SabOps module shell. Section navigation lives in the app sidebar
 * (20ui shell `SABOPS_SIDEBAR`); this layout only provides page padding.
 */
export default function SabopsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="20ui flex flex-col gap-4 p-6">
            <div>{children}</div>
        </div>
    );
}
