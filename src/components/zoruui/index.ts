/**
 * ZoruUI — public barrel.
 *
 * Step 1 (foundation) only ships the scope provider, the cn helper,
 * and the dock re-export. Every primitive added in steps 2–6 will be
 * re-exported here so consumers can do
 *
 *   import { ZoruProvider, ZoruButton, ZoruDialog } from "@/components/zoruui";
 */
export { ZoruProvider } from "./lib/zoru-provider";
export type { ZoruProviderProps } from "./lib/zoru-provider";
export { cn } from "./lib/cn";
export { ZoruDock, ZoruDockIcon, type ZoruDockAccent } from "./dock";
