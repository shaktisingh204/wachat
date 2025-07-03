// This component is no longer used in the main layout but is kept for potential other uses.
import * as React from 'react';

export const WachatLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" {...props}>
    <text
      x="50%"
      y="50%"
      dy=".35em"
      textAnchor="middle"
      fontFamily="'PT Sans', sans-serif"
      fontSize="30"
      fontWeight="bold"
      fill="hsl(var(--primary))"
    >
      Wachat
    </text>
  </svg>
);
