import * as React from "react"

// Ensure React exists globally for SSR / Turbopack
// This fixes legacy React.* usage safely
if (typeof globalThis !== "undefined") {
    // @ts-ignore
    globalThis.React = React
}

export { }
