import path from "path";

// PORT-NOTE: ASSET_PATH constant from twenty-server is replaced with a Next.js-compatible
// public/assets path. IS_BUILT heuristic is preserved.
// In production Next.js (standalone output) the package would be placed under
// public/assets/twenty-client-sdk. In dev it is resolved from node_modules.

const IS_BUILT =
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PHASE?.includes("phase-development-server");

const ASSET_PATH = path.join(process.cwd(), "public", "assets");

export const SDK_CLIENT_PACKAGE_DIRNAME = IS_BUILT
  ? path.join(ASSET_PATH, "twenty-client-sdk")
  : (() => {
      try {
        return path.resolve(
          require.resolve("twenty-client-sdk/core"),
          "..",
          "..",
        );
      } catch {
        // Fallback when twenty-client-sdk is not installed
        return path.join(ASSET_PATH, "twenty-client-sdk");
      }
    })();
