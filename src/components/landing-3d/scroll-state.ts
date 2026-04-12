/**
 * Shared, mutable scroll-progress reference.
 *
 * The landing page's scrolling HTML content and its fixed R3F canvas live in
 * separate React roots (the <Canvas/> subtree is its own reconciler). Passing
 * data through React context across that boundary is awkward, so we use a
 * module-level singleton that both sides can read and write via
 * `requestAnimationFrame` — no renders, no context, no listeners inside the
 * Three.js tree.
 */
export const scrollState = {
  /** Normalised 0..1 scroll progress for the whole document. */
  progress: 0,
  /** Last known viewport width — used by Scene to gate mobile perf tweaks. */
  vw: typeof window === 'undefined' ? 1280 : window.innerWidth,
};
