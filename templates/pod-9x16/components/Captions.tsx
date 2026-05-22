import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { Caption } from '../../../lib/scenes.ts';
import type { Brand } from '../../../lib/config.ts';

interface Props {
  captions: Caption[];
  brand: Brand;
  format: { width: number; height: number; fps: number };
}

const INK = '#0A0A0A';
const CHALK = '#F5F5F5';

export const Captions: React.FC<Props> = ({ captions, brand, format }) => {
  const frame = useCurrentFrame();
  const time = frame / format.fps;
  const active = captions.find((c) => time >= c.start && time <= c.end);
  if (!active) return null;

  // Fade in 80ms at start, fade out 120ms at end
  const fadeIn = interpolate(time, [active.start, active.start + 0.08], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(time, [active.end - 0.12, active.end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const fontSize = Math.round(format.width / 24); // ~45 at 1080 wide
  const padX = Math.round(format.width / 18);
  const padY = Math.round(format.height / 80);
  const bottomOffset = Math.round(format.height * 0.12);
  const maxWidth = Math.round(format.width * 0.86);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: bottomOffset,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: `rgba(10,10,10,0.88)`,
          color: CHALK,
          fontFamily: brand.fonts.primary ?? 'Inter',
          fontWeight: 500,
          fontSize,
          lineHeight: 1.18,
          padding: `${padY}px ${padX}px`,
          borderRadius: 16,
          textAlign: 'center',
          maxWidth,
          opacity,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {active.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
