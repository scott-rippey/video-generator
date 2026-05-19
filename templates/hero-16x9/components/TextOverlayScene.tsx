import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import type { Brand } from '../../../lib/config.ts';
import type { Scene } from '../../../lib/scenes.ts';
import { assetUrl, resolveColor } from './SceneRouter.tsx';

interface Props {
  scene: Extract<Scene, { type: 'text-overlay' }>;
  brand: Brand;
  format: { width: number; height: number; fps: number };
  assetMap: Record<string, string>;
  slug: string;
}

export const TextOverlayScene: React.FC<Props> = ({ scene, brand, assetMap, format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow fade-in (~3s) that happens during the scene
  const textFade = interpolate(frame, [8, 100], [0, 1], { extrapolateRight: 'clamp' });
  // Gentle slide in from the left, lands by the time fade is mostly done
  const slideSpring = spring({
    frame: Math.max(frame - 8, 0),
    fps,
    config: { damping: 230, stiffness: 28, mass: 1.0 },
    durationInFrames: 90,
  });
  const slideOffset = interpolate(slideSpring, [0, 1], [-80, 0]);

  const titleColor = brand.colors.text ?? '#ffffff';
  const displayFont = brand.fonts.display ?? brand.fonts.primary ?? 'Impact, sans-serif';

  const renderBackground = () => {
    const bg = scene.background;
    if (bg.type === 'solid') {
      return (
        <AbsoluteFill style={{ backgroundColor: resolveColor(bg.color, brand) }} />
      );
    }
    if (bg.type === 'gradient') {
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${bg.angle}deg, ${resolveColor(bg.from, brand)}, ${resolveColor(bg.to, brand)})`,
          }}
        />
      );
    }
    if (bg.type === 'generated-image') {
      const src = assetUrl(assetMap, scene.id);
      if (!src) {
        return <AbsoluteFill style={{ backgroundColor: '#0f172a' }} />;
      }
      return (
        <AbsoluteFill>
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <AbsoluteFill
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        </AbsoluteFill>
      );
    }
    if (bg.type === 'library-image') {
      const src = assetUrl(assetMap, scene.id);
      if (!src) {
        return <AbsoluteFill style={{ backgroundColor: '#0f172a' }} />;
      }
      return (
        <AbsoluteFill>
          <Img
            src={src}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      );
    }
    return null;
  };

  // Hero font size for short punchy lines (CTA, statement scenes)
  const fontSize = Math.round(format.width / 18);

  return (
    <AbsoluteFill>
      {renderBackground()}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${Math.round(format.width / 24)}px`,
        }}
      >
        <div
          style={{
            textAlign: scene.align,
            maxWidth: '90%',
            fontFamily: displayFont,
            opacity: textFade,
            transform: `translateX(${slideOffset}px)`,
          }}
        >
          <div
            style={{
              fontSize,
              lineHeight: 0.95,
              fontWeight: 900,
              color: titleColor,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              textShadow: '0 4px 32px rgba(0,0,0,0.6)',
            }}
          >
            {scene.text}
          </div>
          {scene.subtext ? (
            <div
              style={{
                marginTop: 32,
                fontSize: Math.round(format.width / 56),
                fontWeight: 600,
                color: brand.colors.muted ?? '#cbd5e1',
                opacity: 0.92,
                fontFamily: brand.fonts.primary ?? 'Inter',
                textTransform: 'none',
                letterSpacing: '0',
              }}
            >
              {scene.subtext}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
