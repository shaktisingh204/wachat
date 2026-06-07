'use client';

import React from 'react';

interface ShapeDividerProps {
  type: 'tilt' | 'waves' | 'curve';
  position: 'top' | 'bottom';
  color?: string;
  height?: number;
  flip?: boolean;
  invert?: boolean;
}

export const ShapeDivider: React.FC<ShapeDividerProps> = ({
  type,
  position,
  color = '#FFFFFF',
  height = 100,
  flip = false,
  invert = false,
}) => {
  // Transform is genuinely runtime-computed from the flip/invert/position props.
  const transforms: string[] = [];
  if (flip) transforms.push('translateX(-50%) rotateY(180deg)');
  const needsRotate = position === 'top' ? invert : !invert;
  if (needsRotate) transforms.push('rotate(180deg)');
  const transform = transforms.length > 0 ? transforms.join(' ') : undefined;

  // Static placement: top vs bottom only toggles which edge it pins to.
  const edgeClass = position === 'top' ? 'top-0' : 'bottom-0';

  const getShape = () => {
    switch (type) {
      case 'tilt':
        return (
          <svg
            aria-hidden="true"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 100"
            className="w-full"
            style={{ height: `${height}px` }}
          >
            <path d="M0 100 1000 0 1000 100Z" fill={color} />
          </svg>
        );
      case 'waves':
        return (
          <svg
            aria-hidden="true"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            className="w-full"
            style={{ height: `${height}px` }}
          >
            <path
              fill={color}
              fillOpacity="1"
              d="M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,186.7C672,192,768,160,864,138.7C960,117,1056,107,1152,112C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
        );
      case 'curve':
        return (
          <svg
            aria-hidden="true"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            className="w-full"
            style={{ height: `${height}px` }}
          >
            <path
              fill={color}
              fillOpacity="1"
              d="M0,128L60,149.3C120,171,240,213,360,208C480,203,600,149,720,117.3C840,85,960,75,1080,90.7C1200,107,1320,149,1380,170.7L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`absolute left-0 w-full leading-none [direction:ltr] ${edgeClass}`}
      style={transform ? { transform } : undefined}
    >
      {getShape()}
    </div>
  );
};
