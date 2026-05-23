import React from 'react';

export interface PhoneFrameProps {
  width: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// Phone aspect roughly matches modern iPhones (~19.5:9).
const PHONE_ASPECT_RATIO = 19.5 / 9;

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ width, children, style }) => {
  const height = Math.round(width * PHONE_ASPECT_RATIO);
  const bezel = Math.max(8, Math.round(width * 0.035));
  const screenRadius = Math.round(width * 0.095);
  const bezelRadius = screenRadius + Math.round(bezel * 0.65);
  const islandHeight = Math.round(bezel * 1.5);
  const islandWidth = Math.round(width * 0.32);

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#0a0a0a',
        borderRadius: bezelRadius,
        padding: bezel,
        boxShadow:
          '0 80px 160px rgba(0,0,0,0.65), 0 30px 60px rgba(0,0,0,0.45), inset 0 0 0 2px #2a2a2a, inset 0 0 0 6px #050505',
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          borderRadius: screenRadius,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: Math.round(bezel * 0.45),
            left: '50%',
            transform: 'translateX(-50%)',
            width: islandWidth,
            height: islandHeight,
            backgroundColor: '#000',
            borderRadius: islandHeight,
            zIndex: 100,
          }}
        />
      </div>
    </div>
  );
};
